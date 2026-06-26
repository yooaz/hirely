#!/usr/bin/env node
/**
 * Education block parser — Yohann fixture regression tests.
 * node src/tests/qa-education-block-parser-yoaz.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseEducationLines,
  parseEducationFromSegments,
  parseEducationEntryFromGroup,
  dedupeEducationBlockItems,
  EDUCATION_BLOCK_PARSER,
  canonicalSchoolKey,
  buildEducationDedupeDebug,
} from '../core/parsing/cv-education-block-parser.js';
import { CV_SECTION } from '../core/parsing/section-heading-dictionary.js';
import { normalizeCompareString } from '../core/parsing/dedupe-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/education-block-parser-yoaz');
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

ok(canonicalSchoolKey('Creapole') === canonicalSchoolKey('Créapôle'), 'canonical school key OCR variant');

const yoazEducationLines = [
  'LISAA, web and motion design',
  '2011 - 2012',
  'Créapôle, visual communication',
  '2009 - 2011',
  'Créapôle, product design',
  '2008 - 2009',
  'Créapôle, multisectoral year',
  '2007 - 2009',
];

const { items, stats } = parseEducationLines(yoazEducationLines);

ok(items.length === 4, `yoaz: 4 education entries (got ${items.length})`);
ok(stats.parsed === 4, `yoaz: stats.parsed === 4 (got ${stats.parsed})`);
ok(stats.deduped === 4, 'yoaz: no dedupe on clean fixture');
ok(items.every((e) => e.confidence >= 0.55), 'yoaz: all confidence >= 0.55');
ok(items.every((e) => e.parser === EDUCATION_BLOCK_PARSER), 'yoaz: parser id set');

const lisaa = items.find((e) => /lisaa/i.test(e.school));
ok(lisaa, 'yoaz: LISAA entry found');
if (lisaa) {
  ok(lisaa.start_date === '2011', `lisaa start 2011 (got ${lisaa.start_date})`);
  ok(lisaa.end_date === '2012', `lisaa end 2012 (got ${lisaa.end_date})`);
  ok(/web.*motion/i.test(lisaa.degree), `lisaa degree web & motion (got ${lisaa.degree})`);
}

const creapoleEntries = items.filter((e) =>
  normalizeCompareString(e.school).includes('creapole')
);
ok(creapoleEntries.length === 3, `yoaz: 3 Créapôle entries (got ${creapoleEntries.length})`);
ok(
  creapoleEntries.every((e) => e.school === 'Créapôle'),
  'yoaz: accented Créapôle preserved from dictionary'
);

const visual = items.find((e) => /visual communication/i.test(e.degree));
ok(visual, 'yoaz: visual communication entry');
if (visual) {
  ok(visual.start_date === '2009' && visual.end_date === '2011', 'visual comm dates 2009-2011');
}

const product = items.find((e) => /product design/i.test(e.degree));
ok(product, 'yoaz: product design entry');
if (product) {
  ok(product.start_date === '2008' && product.end_date === '2009', 'product design dates 2008-2009');
}

const multi = items.find((e) => /multisectoral/i.test(e.degree));
ok(multi, 'yoaz: multisectoral year entry');
if (multi) {
  ok(multi.start_date === '2007' && multi.end_date === '2009', 'multisectoral dates 2007-2009');
}

// No duplicate schools+years
const keys = items.map((e) => `${e.school}|${e.start_date}|${e.end_date}|${e.degree}`);
ok(keys.length === new Set(keys).size, 'yoaz: no duplicate entry keys');

// OCR compact line fixture
const compactLines = ['2011 2012 : LISAA, web and motion design'];
const compact = parseEducationLines(compactLines);
ok(compact.items.length === 1, 'compact: one entry from date-lead line');
if (compact.items[0]) {
  ok(/lisaa/i.test(compact.items[0].school), 'compact: LISAA school');
  ok(compact.items[0].start_date === '2011', 'compact: start 2011');
}

// Deduplication — OCR variant duplicates
const dupLines = [
  'Créapôle, visual communication',
  '2009 - 2011',
  'Creapole, visual communication',
  '2009 - 2011',
  'LISAA, web and motion design',
  '2011 - 2012',
  'LISAA, web and motion design',
  '2011 - 2012',
];
const dup = parseEducationLines(dupLines);
ok(dup.items.length === 2, `dedupe: 2 unique entries from 4 duplicates (got ${dup.items.length})`);
ok(dup.stats.dedupeRemoved >= 2, `dedupe: removed >= 2 (got ${dup.stats.dedupeRemoved})`);
ok(dup.dedupe_trace.length >= 2, `dedupe: trace events >= 2 (got ${dup.dedupe_trace?.length})`);
const creapoleMerge = dup.dedupe_trace.find((e) => e.canonical_key?.startsWith('creapole|'));
ok(creapoleMerge, 'dedupe trace: Creapole merge event');
if (creapoleMerge) {
  ok(
    creapoleMerge.action === 'merged_exact' || creapoleMerge.action === 'merged_near',
    `dedupe trace: Creapole merge action (got ${creapoleMerge.action})`
  );
  ok(
    normalizeCompareString(creapoleMerge.result?.school || '') === 'creapole',
    'dedupe trace: merged school canonical is Créapôle'
  );
  ok(
    creapoleMerge.result?.school === 'Créapôle',
    'dedupe trace: accented Créapôle kept in merge result'
  );
}
ok(dup.dedupe_debug?.events?.length >= 2, 'dedupe debug payload');
ok(
  dup.items.some((e) => e.school === 'Créapôle'),
  'dedupe: preserves accented Créapôle'
);

writeFileSync(join(outDir, 'yoaz-education-dedupe-debug.json'), JSON.stringify(dup.dedupe_debug, null, 2));

// Direct dedupe unit
const rawDup = [
  {
    school: 'Creapole',
    degree: 'Visual Communication',
    location: '',
    start_date: '2009',
    end_date: '2011',
    description: [],
    source_block_ids: ['a'],
    confidence: 0.9,
    parser: EDUCATION_BLOCK_PARSER,
  },
  {
    school: 'Créapôle',
    degree: 'Visual Communication',
    location: '',
    start_date: '2009',
    end_date: '2011',
    description: ['Honors'],
    source_block_ids: ['b'],
    confidence: 0.95,
    parser: EDUCATION_BLOCK_PARSER,
  },
];
const merged = dedupeEducationBlockItems(rawDup);
ok(merged.items.length === 1, 'dedupe unit: merges OCR school variants');
ok(merged.items[0].school === 'Créapôle', 'dedupe unit: keeps richer accented school');
ok(merged.items[0].description.includes('Honors'), 'dedupe unit: merges descriptions');

// Conservative — uncertain school without dictionary
const uncertain = parseEducationEntryFromGroup([
  { text: 'Unknown Institute XYZ, some program track', block_id: 'u1' },
  { text: '2015 - 2017', block_id: 'u2' },
]);
ok(uncertain, 'uncertain: emits entry with comma-lead school');
if (uncertain) {
  ok(uncertain.confidence < 0.85, `uncertain: lower confidence (got ${uncertain.confidence})`);
  ok(/unknown institute/i.test(uncertain.school), 'uncertain: uses comma-lead school');
}

// parseEducationFromSegments with correctly tagged education blocks
const taggedSegments = yoazEducationLines.map((text, i) => ({
  text,
  block_id: `seg-${i}`,
  reading_order: i,
  section: CV_SECTION.EDUCATION,
  is_heading: false,
}));
const fromSeg = parseEducationFromSegments(taggedSegments);
ok(fromSeg.items.length === 4, `segment path: 4 entries (got ${fromSeg.items.length})`);
ok(
  fromSeg.items.every((e) => e.source_block_ids.length >= 1),
  'segment path: source_block_ids populated'
);

// Golden snapshot (strip volatile confidence rounding for compare)
const goldenPath = join(goldenDir, 'yoaz-education-parsed.expected.json');
const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
const snapshot = {
  fixture: golden.fixture,
  parser: EDUCATION_BLOCK_PARSER,
  items: items.map((e) => ({
    school: e.school,
    degree: e.degree,
    location: e.location,
    start_date: e.start_date,
    end_date: e.end_date,
    description: e.description,
    source_block_ids: e.source_block_ids,
    confidence: e.confidence,
  })),
};
writeFileSync(join(outDir, 'yoaz-education-parsed.json'), JSON.stringify(snapshot, null, 2));

for (let i = 0; i < golden.items.length; i++) {
  const exp = golden.items[i];
  const got = snapshot.items[i];
  ok(!!got, `golden item ${i} exists`);
  if (!got) continue;
  ok(exp.school === got.school, `golden[${i}] school ${exp.school} (got ${got.school})`);
  ok(exp.degree === got.degree, `golden[${i}] degree ${exp.degree} (got ${got.degree})`);
  ok(exp.start_date === got.start_date, `golden[${i}] start ${exp.start_date}`);
  ok(exp.end_date === got.end_date, `golden[${i}] end ${exp.end_date}`);
}

console.log('\n--- stats ---', stats);
console.log(failed ? `\n${failed} FAILED` : '\nAll education block parser checks passed');
process.exit(failed ? 1 : 0);
