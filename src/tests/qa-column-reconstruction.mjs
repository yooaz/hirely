#!/usr/bin/env node
/**
 * Column reconstruction — section integrity for creative / developer / recruiter CVs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectLayout } from '../core/layout/detect-layout.js';
import { detectColumns } from '../core/layout/detect-columns.js';
import { extractGeometricBlocks } from '../core/layout/block-extractor.js';
import { buildReadingOrder } from '../core/layout/reading-order.js';
import {
  reconstructColumnBlocks,
  validateSectionIntegrity,
} from '../core/layout/column-reconstruction.js';
import { fuzzySectionKey } from '../core/parsing/section-fuzzy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function loadFixture(id) {
  const p = path.join(ROOT, 'tests/fixtures', id, 'fixture.txt');
  return fs.readFileSync(p, 'utf8');
}

function linesFromText(text, opts = {}) {
  const sidebarHeaders = new Set(['profile', 'summary', 'languages', 'contact']);
  let region = 'main';
  const out = [];
  let y = 780;

  for (const raw of String(text || '').split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    const key = fuzzySectionKey(t);
    if (key) region = sidebarHeaders.has(key) ? 'sidebar' : 'main';
    const x = opts.twoColumn ? (region === 'sidebar' ? 72 : 380) : 0;
    out.push({
      text: t,
      cleanedText: t,
      rawExtraction: t,
      x,
      y,
      width: region === 'sidebar' ? 220 : 320,
      height: 14,
      page: 1,
      confidence: 90,
      source: opts.source || 'paste',
      line: out.length,
    });
    y -= 22;
  }
  return out;
}

function runFixtureIntegrity(id, opts = {}) {
  const text = loadFixture(id);
  const lines = linesFromText(text, opts);
  const layout = detectLayout({ lines, cleanedText: text });
  const geom = extractGeometricBlocks(lines);
  const columns = detectColumns(geom.blocks, layout);
  const reading = buildReadingOrder({ lines, layout, columns, blocks: geom });
  const integrity = reading.sectionIntegrity || validateSectionIntegrity(reading.orderedBlocks, layout);

  return { id, layout, reading, integrity, lines, text };
}

function assertOrderedBlockShape(blocks) {
  ok(blocks.length >= 3, 'orderedBlocks present');
  const sample = blocks[0];
  ok('section' in sample, 'orderedBlocks have section');
  ok(Number.isFinite(sample.startPosition), 'orderedBlocks have startPosition');
  ok(Number.isFinite(sample.endPosition), 'orderedBlocks have endPosition');
  ok(Number.isFinite(sample.confidence), 'orderedBlocks have confidence');
}

function assertSectionsPresent(blocks, expected) {
  const sections = new Set(blocks.map((b) => b.section));
  for (const sec of expected) {
    ok(sections.has(sec), `section present: ${sec}`);
  }
}

function assertNoSidebarBleed(blocks, layout) {
  const exp = blocks.find((b) => b.section === 'experience');
  if (!exp) return;
  const text = String(exp.text || '');
  ok(!/\bFrench\s*[—-]\s*native\b/i.test(text), 'languages not merged into experience');
  ok(!/\bTypeScript,\s*Python,\s*Go\b/i.test(text) || /engineer/i.test(text), 'skills list not isolated in experience');
  const integrity = validateSectionIntegrity(blocks, layout);
  ok(integrity.ok, `section integrity (${integrity.violations.length} violations)`);
}

const yoaz = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tests/fixtures/yoaz-cv/two-column-lines.json'), 'utf8')
);
const yoazLines = yoaz.lines.map((l, i) => ({
  ...l,
  cleanedText: l.text,
  rawExtraction: l.text,
  confidence: 90,
  source: 'native',
  line: i,
}));
const yoazLayout = detectLayout({ lines: yoazLines });
const yoazGeom = extractGeometricBlocks(yoazLines);
const yoazCols = detectColumns(yoazGeom.blocks, yoazLayout);
const yoazReading = buildReadingOrder({
  lines: yoazLines,
  layout: yoazLayout,
  columns: yoazCols,
  blocks: yoazGeom,
});
ok(yoazReading.usedColumnReconstruction === true, 'yoaz: column reconstruction used');
assertOrderedBlockShape(yoazReading.orderedBlocks);
ok(
  yoazReading.orderedBlocks.some((b) => b.section === 'experience'),
  'yoaz: experience section block'
);
ok(
  yoazReading.orderedBlocks.some((b) => b.section === 'education'),
  'yoaz: education section block'
);
const yoazExp = yoazReading.orderedBlocks.find((b) => b.section === 'experience');
ok(yoazExp && !/LISAA/i.test(yoazExp.text || ''), 'yoaz: education not in experience block');
ok(yoazReading.sectionIntegrity?.ok === true, 'yoaz: section integrity');

for (const id of ['creative-cv', 'developer-cv', 'recruiter-cv']) {
  const result = runFixtureIntegrity(id);
  ok(result.integrity.ok, `${id}: section integrity`);
  assertOrderedBlockShape(result.reading.orderedBlocks);
  assertSectionsPresent(result.reading.orderedBlocks, ['experience', 'education', 'skills']);
  assertNoSidebarBleed(result.reading.orderedBlocks, result.layout);

  const edu = result.reading.orderedBlocks.find((b) => b.section === 'education');
  ok(edu && edu.text.length >= 8, `${id}: education grouped`);
  const exp = result.reading.orderedBlocks.find((b) => b.section === 'experience');
  ok(exp && exp.text.length >= 12, `${id}: experience grouped`);
}

const creativeTwoCol = runFixtureIntegrity('creative-cv', { twoColumn: true });
ok(
  creativeTwoCol.reading.usedColumnReconstruction === true,
  'creative two-column: reconstruction used'
);
ok(creativeTwoCol.integrity.ok, 'creative two-column: integrity');
const langBlock = creativeTwoCol.reading.orderedBlocks.find((b) => b.section === 'languages');
const skillsBlock = creativeTwoCol.reading.orderedBlocks.find((b) => b.section === 'skills');
ok(langBlock && /French/i.test(langBlock.text || ''), 'creative two-column: languages grouped');
ok(skillsBlock && /Illustration/i.test(skillsBlock.text || ''), 'creative two-column: skills grouped');
const cExp = creativeTwoCol.reading.orderedBlocks.find((b) => b.section === 'experience');
ok(cExp && !/French\s*[—-]\s*native/i.test(cExp.text || ''), 'creative two-column: languages not in experience');
ok(cExp && !/Illustration,\s*Graphic Design/i.test(cExp.text || ''), 'creative two-column: skills not in experience');

const reconstructed = reconstructColumnBlocks({
  layout: yoazLayout,
  columns: yoazCols,
  blocks: yoazGeom,
});
ok(reconstructed.orderedBlocks.length >= 6, 'reconstructColumnBlocks output');
ok(reconstructed.sectionIntegrity.ok, 'reconstructColumnBlocks integrity');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nqa-column-reconstruction: PASS');
