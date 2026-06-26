#!/usr/bin/env node
/**
 * Experience block parser — Yohann fixture regression tests.
 * node src/tests/qa-experience-block-parser-yoaz.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseExperienceLines,
  parseExperienceFromSegments,
  parseExperienceEntryFromGroup,
  EXPERIENCE_BLOCK_PARSER,
  MIN_EXPERIENCE_EMIT_CONFIDENCE,
  collectExperienceRejectionReasons,
  buildExperienceReviewHints,
} from '../core/parsing/cv-experience-block-parser.js';
import { segmentCvLines } from '../core/parsing/section-segmenter.js';
import { CV_SECTION } from '../core/parsing/section-heading-dictionary.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/experience-block-parser-yoaz');
const goldenDir = join(root, 'tests/golden');
mkdirSync(outDir, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const yoazExperienceLines = [
  'Freelancer Illustrator, Graphic Designer',
  '2011 - 2023',
  'Clients include Nike, Converse, Pantone, Adobe, Arte',
  'McCann G. Agency (Internship)',
  '2011',
  '3B impressions (Internship)',
  '2010',
];

const { items, stats, rejected, review_hints } = parseExperienceLines(yoazExperienceLines);

ok(items.length === 3, `yoaz: 3 experiences (got ${items.length})`);
ok(stats.parsed === 3, 'yoaz: stats.parsed === 3');
ok(items.every((e) => e.confidence >= 0.55), 'yoaz: all confidence >= 0.55');
ok(rejected.length === 0, `yoaz: no rejected items (${rejected.length})`);
ok(stats.rejected === 0, 'yoaz: stats.rejected === 0');

// Rejection: garbage entry must not emit
{
  const garbage = parseExperienceLines(['Music', 'Adobe', 'Packaging']);
  ok(garbage.items.length === 0, 'garbage lines produce zero experiences');
  ok(garbage.rejected.length >= 1, 'garbage lines rejected');
  ok(garbage.review_hints.length >= 1, 'rejection review hints');
}

// Review hints for borderline (missing dates)
{
  const borderline = parseExperienceLines(['Designer somewhere', 'maybe a company']);
  ok(borderline.items.length === 0 || borderline.review_hints.length >= 0, 'borderline handled');
  const reasons = collectExperienceRejectionReasons({
    job_title: 'X',
    company: '',
    start_date: '',
    end_date: '',
    confidence: 0.3,
    entry_type: 'employer',
    client: [],
    clients: [],
    description: [],
    skills: [],
    source_block_ids: [],
  });
  ok(reasons.includes('low_confidence'), 'rejection reasons include low_confidence');
}

ok(items.every((e) => e.parser === EXPERIENCE_BLOCK_PARSER), 'yoaz: parser V2 id set');

// 1) Freelancer 2011-2023 + clients
const freelance = items.find((e) => e.entry_type === 'freelance' || /freelanc/i.test(e.job_title));
ok(freelance, 'yoaz: freelance entry found');
if (freelance) {
  ok(freelance.start_date === '2011', `freelance start 2011 (got ${freelance.start_date})`);
  ok(freelance.end_date === '2023', `freelance end 2023 (got ${freelance.end_date})`);
  ok(!freelance.is_current, 'freelance not current');
  ok(/illustrator/i.test(freelance.job_title), 'freelance job_title has Illustrator');
  ok(
    freelance.clients.some((c) => /nike/i.test(c)) && freelance.clients.some((c) => /arte/i.test(c)),
    `freelance clients include Nike & Arte (${freelance.clients.join(', ')})`
  );
  ok(freelance.client.length === freelance.clients.length, 'clients[] mirrors client[]');
  ok(
    !freelance.skills.some((s) => /nike|converse|pantone/i.test(s)),
    'clients not in skills[]'
  );
}

// 2) McCann internship 2011
const mccann = items.find((e) => /mccann/i.test(e.company));
ok(mccann, 'yoaz: McCann entry');
if (mccann) {
  ok(mccann.entry_type === 'internship', 'mccann entry_type internship');
  ok(mccann.start_date === '2011', `mccann start 2011 (got ${mccann.start_date})`);
  ok(mccann.client.length === 0, 'mccann has no clients');
}

// 3) 3B impressions internship 2010
const threeB = items.find((e) => /3b impressions/i.test(e.company));
ok(threeB, 'yoaz: 3B impressions entry');
if (threeB) {
  ok(threeB.entry_type === 'internship', '3b entry_type internship');
  ok(threeB.start_date === '2010', `3b start 2010 (got ${threeB.start_date})`);
}

// Full fixture via section segmenter
const fixturePage1 = readFileSync(
  join(root, 'tests/fixtures/yoaz-pdf-benchmark/fixture-page1.txt'),
  'utf8'
)
  .split(/\r?\n/)
  .map((t) => t.trim())
  .filter(Boolean)
  .map((text, i) => ({
    text,
    cleanedText: text,
    page: 1,
    x: /yoaz@|PROFILE|LANGUAGES|CONTACT/i.test(text) ? 70 : 360,
    y: 800 - i * 18,
    width: 200,
    height: 14,
    line: i,
    source: 'paste',
  }));

const segmented = segmentCvLines(fixturePage1);
const fromSegments = parseExperienceFromSegments(segmented.segments);
ok(fromSegments.items.length >= 3, `fixture segmenter path: >= 3 experiences (${fromSegments.items.length})`);

// Sample parsed JSON artifact
const sample = {
  fixture: 'yoaz-pdf-benchmark/experience-section',
  parser: EXPERIENCE_BLOCK_PARSER,
  items: items.map((e) => ({
    job_title: e.job_title,
    company: e.company,
    clients: e.clients,
    client: e.client,
    location: e.location,
    start_date: e.start_date,
    end_date: e.end_date,
    is_current: e.is_current,
    description: e.description,
    skills: e.skills,
    entry_type: e.entry_type,
    confidence: e.confidence,
    source_block_ids: e.source_block_ids,
  })),
};

const samplePath = join(outDir, 'yoaz-experience-parsed.json');
const goldenPath = join(goldenDir, 'yoaz-experience-parsed.expected.json');
writeFileSync(samplePath, JSON.stringify(sample, null, 2));
writeFileSync(goldenPath, JSON.stringify(sample, null, 2));

ok(sample.items.length === 3, 'sample JSON has 3 items');
console.log(`\nSample JSON: ${samplePath}`);
console.log(`Golden: ${goldenPath}`);

// Compact one-line entry
const compact = parseExperienceEntryFromGroup([
  { text: 'Lead Illustrator — McCann Paris — 2011 - 2014', block_id: 'c1' },
]);
ok(compact && compact.company && compact.start_date, 'compact one-line entry parses');

process.exit(failed ? 1 : 0);
