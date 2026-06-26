#!/usr/bin/env node
/**
 * P0 — TEXT_RECONSTRUCTION_ENGINE: merge, section boundaries, dates, labels.
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
  stripParserLabelsFromLine,
  splitEmbeddedSectionHeader,
  preserveSectionBoundaries,
  inferLineSection,
  isFakeReconstructedSentence,
  shouldMergeLines,
  TEXT_RECONSTRUCTION_VERSION,
} from '../core/parsing/text-reconstruction.js';
import { sanitizeParserInput } from '../core/extraction/extraction-audit.js';
import { safeClean } from '../core/parsing/clean.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { applyDataSanitizationLayer } from '../core/validation/data-sanitization-layer.js';
import { isFinalCvPlaceholder } from '../core/validation/final-cv-placeholder-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/text-reconstruction-engine/report.json');
const YOAZ = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(TEXT_RECONSTRUCTION_VERSION === 'TEXT_RECONSTRUCTION_ENGINE_V2', 'engine version V2');

// --- Known artifacts ---
ok(
  !/2011\s*[-–—]\s*2011/.test(normalizeReconstructedDates('Graphic Designer — 2011 - 2011-2011')),
  'collapse 2011-2011 duplicate years'
);
ok(repairReconstructionGlitches('Contributed as at Present') === 'Contributed at Present', 'fix Contributed as at Present');
ok(repairReconstructionGlitches('English — Fluent analyse') === 'English — Fluent', 'fix Fluent analyse');
ok(stripParserLabelsFromLine('Company à confirmer') === '', 'strip Company à confirmer');
ok(isFakeReconstructedSentence('Company à confirmer'), 'placeholder is fake sentence');

// --- Section boundaries ---
const split = splitEmbeddedSectionHeader('Experience McCann Paris Lead Illustrator');
ok(split[0] === 'Experience' && /McCann/.test(split[1]), 'split embedded section header');

const bounded = preserveSectionBoundaries([
  'Skills Illustration Branding',
  'Education',
  'LISAA — Web Design',
]);
ok(bounded.some((l) => /^Skills$/i.test(l)), 'skills header isolated');
ok(bounded.some((l) => /Illustration/.test(l)), 'skills content preserved');
ok(!shouldMergeLines('McCann Paris — 2011–2014', 'LISAA — Web Design'), 'experience not merged with education');

ok(inferLineSection('Clients Nike, Adobe, Marvel') === 'clients', 'client list typed');
ok(inferLineSection('Photoshop · Illustrator · Figma') === 'tools', 'tools typed');
ok(inferLineSection('LISAA — Web & Motion Design') === 'education', 'education typed');

const mergedDate = smartLineMerge(['Freelance Illustrator', '2011 -', '2011–2022']);
ok(mergedDate.length === 1, 'date fragments merge');
ok(!/2011\s*[-–—]\s*2011/.test(mergedDate[0]), 'no duplicated dates');
ok(/2011\s*[-–—]\s*2022/.test(mergedDate[0]), 'range preserved');

const sections = smartLineMerge([
  'Experience',
  'McCann Paris',
  'Lead Illustrator · 2011 — 2014',
  'Education',
  'LISAA — Web & Motion Design',
  'Clients',
  'Nike, Adobe, Louis Vuitton',
  'Tools',
  'Photoshop, Illustrator',
]);
ok(sections.filter((l) => /^Experience$/i.test(l)).length === 1, 'experience header alone');
ok(sections.filter((l) => /^Education$/i.test(l)).length === 1, 'education header alone');
ok(sections.some((l) => /Nike/.test(l)), 'clients preserved');
ok(sections.some((l) => /Photoshop/.test(l)), 'tools preserved');
ok(!sections.some((l) => /Experience.*Education/i.test(l)), 'no section label mix in one line');

// --- Integration ---
const noisyLines = [
  { text: 'Freelance', cleanedText: 'Freelance', page: 1, line: 0, source: 'native' },
  { text: '2011 -', cleanedText: '2011 -', page: 1, line: 1, source: 'native' },
  { text: '2011-2011', cleanedText: '2011-2011', page: 1, line: 2, source: 'native' },
  { text: 'Company à confirmer', cleanedText: 'Company à confirmer', page: 1, line: 3, source: 'native' },
  { text: 'English — Fluent', cleanedText: 'English — Fluent', page: 1, line: 4, source: 'native' },
  { text: 'analyse', cleanedText: 'analyse', page: 1, line: 5, source: 'native' },
];
const sanitized = sanitizeParserInput('', noisyLines);
ok(!/2011\s*[-–—]\s*2011/.test(sanitized.cleanedText), 'sanitize no duplicate dates');
ok(!/Company\s+à\s+confirmer/i.test(sanitized.cleanedText), 'sanitize no parser labels');
ok(!/Fluent\s+analyse/i.test(sanitized.cleanedText), 'sanitize no Fluent analyse');

const cleaned = safeClean('Independent / Freelance — Independent / Freelance\n2011–2022 — 2011–2022');
ok(!/Independent \/ Freelance — Independent/.test(cleaned), 'safeClean dedupes entities');

// --- Yoaz pipeline: no fake sentences, no labels in CV ---
const yoaz = fs.readFileSync(YOAZ, 'utf8');
const reconstructed = reconstructExtractedText(yoaz);
const pipe = await runProductionExtractionPipeline(reconstructed, { extractionMethod: 'docx' });
const cv = applyDataSanitizationLayer(pipe.validatedCVData || {});

const allFields = [
  cv.name,
  cv.title,
  ...(cv.experience || []),
  ...(cv.education || []),
  ...(cv.skills || []),
  ...(cv.clients || []),
  ...(cv.tools || []),
].filter(Boolean);

const labelLeak = allFields.filter((l) => isFinalCvPlaceholder(l) || /à\s+confirmer/i.test(l));
const fakeSentences = allFields.filter((l) => isFakeReconstructedSentence(l));
const dupDates = (cv.experience || []).filter((l) => /2011\s*[-–—]\s*2011/.test(l));

ok((cv.experience || []).length >= 5, 'yoaz experiences');
ok(labelLeak.length === 0, `no parser labels in CV (${labelLeak.length})`);
ok(fakeSentences.length === 0, `no fake sentences (${fakeSentences.length})`);
ok(dupDates.length === 0, 'no duplicated dates in experience');

const report = {
  pass: failed === 0,
  generatedAt: new Date().toISOString(),
  engineVersion: TEXT_RECONSTRUCTION_VERSION,
  acceptance: {
    noFakeSentences: fakeSentences.length === 0,
    noDuplicatedDates: dupDates.length === 0,
    noParserLabels: labelLeak.length === 0,
  },
  fixes: [
    '2011 - 2011-2011 → single range',
    'Contributed as at Present → Contributed at Present',
    'Fluent analyse → Fluent',
    'Company à confirmer stripped',
    'Section labels isolated from content',
    'Clients / education / tools not cross-merged',
  ],
  yoaz: {
    experienceCount: (cv.experience || []).length,
    educationCount: (cv.education || []).length,
    clientsCount: (cv.clients || []).length,
    toolsCount: (cv.tools || []).length,
    parserLabelLeak: labelLeak.length,
    fakeSentenceCount: fakeSentences.length,
  },
  responsibilities: [
    'merge broken lines',
    'preserve section boundaries',
    'repair date ranges',
    'remove duplicated dates',
    'prevent unrelated line concatenation',
    'keep client lists as clients',
    'keep education as education',
    'keep tools as tools',
  ],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('Wrote', OUT);
process.exit(failed ? 1 : 0);
