#!/usr/bin/env node
/**
 * P0 — Text reconstruction: smart line/paragraph merge, date + entity repair.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  smartLineMerge,
  smartParagraphMerge,
  reconstructExtractedText,
  normalizeReconstructedDates,
  dedupeEntitySegmentsInLine,
  repairReconstructionGlitches,
  shouldMergeLines,
  TEXT_RECONSTRUCTION_VERSION,
} from '../core/parsing/text-reconstruction.js';
import { sanitizeParserInput } from '../core/extraction/extraction-audit.js';
import { safeClean } from '../core/parsing/clean.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { applyDataSanitizationLayer } from '../core/validation/data-sanitization-layer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/text-reconstruction/report.json');
const YOAZ = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

// --- Date normalization ---
ok(
  !/2011\s*[-–—]\s*2011/.test(normalizeReconstructedDates('Graphic Designer — 2011 - 2011-2011')),
  'collapse 2011-2011 duplicate years'
);
ok(
  normalizeReconstructedDates('Freelance — 2011–2022 — 2011–2022') === 'Freelance — 2011–2022',
  'collapse duplicate date ranges'
);
ok(
  !/2011\s*[-–—]\s*2011/.test(normalizeReconstructedDates('2011 - 2011-2011')),
  'no 2011-2011 artifact'
);

// --- Entity dedupe ---
ok(
  dedupeEntitySegmentsInLine('Independent / Freelance — Independent / Freelance') ===
    'Independent / Freelance',
  'dedupe repeated entity'
);

// --- Glitch repair ---
ok(repairReconstructionGlitches('Contributed as at Present') === 'Contributed at Present', 'fix as at Present');
ok(repairReconstructionGlitches('English — Fluent analyse') === 'English — Fluent', 'fix Fluent analyse');

// --- smartLineMerge: merge continuations only ---
const mergedDate = smartLineMerge([
  'Freelance Illustrator',
  '2011 -',
  '2011–2022',
]);
ok(mergedDate.length === 1, 'date fragment lines merge to one');
ok(!/2011\s*[-–—]\s*2011/.test(mergedDate[0]), 'merged date line has no duplicate year');
ok(/2011\s*[-–—]\s*2022/.test(mergedDate[0]), 'merged date keeps range');

const notMerged = smartLineMerge([
  'Experience',
  'McCann Paris',
  'Lead Illustrator · 2011 — 2014',
]);
ok(notMerged.length >= 2, 'section header not glued to experience');
ok(!shouldMergeLines('Experience', 'McCann Paris'), 'never merge header with job');

const unrelated = smartLineMerge([
  'McCann Paris — Lead Illustrator — 2011–2014',
  'Education',
  'LISAA — Web & Motion Design',
]);
ok(unrelated.some((l) => /^Education$/i.test(l)), 'education section preserved');
ok(unrelated.some((l) => /McCann/i.test(l)), 'experience preserved');

// --- smartParagraphMerge ---
const para = smartParagraphMerge('Freelance Illustrator\n2011 -\n\n2011–2022');
ok(!/2011\s*[-–—]\s*2011/.test(para), 'paragraph merge fixes date duplication');
ok(/2011\s*[-–—]\s*2022/.test(para), 'paragraph merge keeps end range');

// --- sanitizeParserInput integration ---
const noisyLines = [
  { text: 'Yohann Azancot', cleanedText: 'Yohann Azancot', page: 1, line: 0, source: 'native' },
  { text: 'Graphic Designer & Illustrator', cleanedText: 'Graphic Designer & Illustrator', page: 1, line: 1, source: 'native' },
  { text: '2011 -', cleanedText: '2011 -', page: 1, line: 2, source: 'native' },
  { text: '2011-2011', cleanedText: '2011-2011', page: 1, line: 3, source: 'native' },
  { text: 'English — Fluent', cleanedText: 'English — Fluent', page: 1, line: 4, source: 'native' },
  { text: 'analyse', cleanedText: 'analyse', page: 1, line: 5, source: 'native' },
];
const sanitized = sanitizeParserInput('', noisyLines);
ok(!/2011\s*[-–—]\s*2011/.test(sanitized.cleanedText), 'sanitize removes duplicate dates');
ok(!/Fluent\s+analyse/i.test(sanitized.cleanedText), 'sanitize fixes language glitch');

// --- safeClean integration ---
const cleaned = safeClean('Independent / Freelance — Independent / Freelance\n2011–2022 — 2011–2022');
ok(!/Independent \/ Freelance — Independent/.test(cleaned), 'safeClean dedupes entities');
ok(/2011\s*[-–—]\s*2022/.test(cleaned) && !/2011[-–—].*2011[-–—].*2022.*2011/.test(cleaned), 'safeClean single date range');

// --- Yoaz fixture pipeline ---
const yoaz = fs.readFileSync(YOAZ, 'utf8');
const reconstructed = reconstructExtractedText(yoaz);
const pipe = await runProductionExtractionPipeline(reconstructed, { extractionMethod: 'docx' });
const cv = applyDataSanitizationLayer(pipe.validatedCVData || {});
const expText = (cv.experience || []).join('\n');
ok((cv.experience || []).length >= 5, 'yoaz experiences after reconstruction');
ok(!/2011\s*[-–—]\s*2011/.test(expText), 'yoaz no 2011-2011 in experience');
ok(!/Contributed\s+as\s+at/i.test(expText), 'yoaz no Contributed as at');

const report = {
  pass: failed === 0,
  generatedAt: new Date().toISOString(),
  engineVersion: TEXT_RECONSTRUCTION_VERSION,
  fixes: [
    '2011 - 2011-2011 → single range',
    'Contributed as at Present → Contributed at Present',
    'Fluent analyse → Fluent',
    'Independent / Freelance duplicates collapsed',
  ],
  yoaz: {
    experienceCount: (cv.experience || []).length,
    educationCount: (cv.education || []).length,
    duplicateDateArtifact: /2011\s*[-–—]\s*2011/.test(expText),
  },
  audit: ['line merge', 'paragraph merge', 'date normalization', 'entity reconstruction', 'experience reconstruction'],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('Wrote', OUT);
process.exit(failed ? 1 : 0);
