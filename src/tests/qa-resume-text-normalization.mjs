#!/usr/bin/env node
/**
 * Resume text normalization — production OCR repair layer tests.
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  runResumeTextNormalization,
  normalizeResumeBlock,
  normalizeResumeBlocks,
  dedupeResumeBlocks,
  normalizeResumePlainText,
  buildNormalizationDebug,
  RESUME_NORMALIZATION_EXAMPLES,
  MIN_CORRECTION_CONFIDENCE,
} from '../core/parsing/resume-text-normalization.js';
import {
  normalizeCvLine,
  normalizeCvDocument,
  CORRECTION_RULE,
  YOAZ_NORMALIZATION_EXAMPLES,
} from '../core/parsing/cv-text-normalization.js';
import { detectSectionBlocks } from '../core/parsing/section-detect-v2.js';
import { spatialBlocksFromLayoutMemory } from '../core/layout/spatial-block.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../..');
const outDir = join(root, 'tests/output/resume-text-normalization');

const yoazOcrFixture = readFileSync(join(root, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt'), 'utf8');
const yoazPage1 = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/yoaz-pdf-benchmark/page1-lines.json'), 'utf8')
);

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

console.log('--- Date normalization ---');
ok(normalizeCvLine('20112023').text === '2011 - 2023', 'merged years 20112023');
ok(normalizeCvLine('2011 2023').text === '2011 - 2023', 'spaced years');
ok(normalizeCvLine('20m - 2023').text === '2011 - 2023', 'OCR 20m - 2023');
ok(normalizeCvLine('McCann Paris 201038').text.includes('2010 - 2018'), 'malformed 201038 in date context');
ok(normalizeCvLine('2010 38 internship').text.includes('2010 - 2018'), 'spaced malformed 2010 38');
ok(normalizeCvLine('20m impressions').text === '20m impressions', 'no fix 20m without date context');
ok(normalizeCvLine('Zyxtq 9999 8888').text === 'Zyxtq 9999 8888', 'unknown tokens unchanged');

console.log('--- Word / unicode cleanup ---');
ok(/digital\s+art/i.test(normalizeCvLine('digtitalArt').text), 'digtitalArt');
ok(normalizeCvLine('ilusrations').text === 'illustrations', 'ilusrations');
ok(normalizeCvLine('Graphic   Designer').text === 'Graphic Designer', 'duplicate spaces');
ok(normalizeCvLine('2011–2023').text === '2011 - 2023', 'unicode dash');

console.log('--- Confidence strategy ---');
{
  const { corrections } = normalizeCvLine('20112023');
  ok(corrections.every((c) => c.confidence >= MIN_CORRECTION_CONFIDENCE), 'all corrections above floor');
  ok(corrections[0].rule === CORRECTION_RULE.DATE_MERGED_YEARS, 'merged years rule');
  const low = normalizeCvLine('201038').corrections.find(
    (c) => c.rule === CORRECTION_RULE.DATE_OCR_MALFORMED_FRAGMENT
  );
  ok(low && low.confidence >= 0.7 && low.confidence < 0.85, 'malformed fragment mid confidence');
}

console.log('--- Document + line merge (Yoaz OCR fixture) ---');
{
  const doc = normalizeCvDocument(yoazOcrFixture);
  ok(doc.text.includes('2011 - 2014'), 'yoaz fixture McCann 2011 2014');
  ok(doc.stats.dateRepairs >= 5, 'yoaz fixture date repairs');
}

console.log('--- Block normalization ---');
{
  const blocks = yoazPage1.lines.map((ln, i) => ({
    block_id: `p1-${i}`,
    page_number: ln.page || 1,
    text: ln.text,
    reading_order: i,
    zone_id: ln.x < 300 ? 'sidebar' : 'main',
  }));
  const noisy = blocks.map((b) =>
    b.text === '2011 - 2023'
      ? { ...b, text: '20112023' }
      : b.text === 'Indesign'
        ? { ...b, text: 'indesing' }
        : b
  );
  const normalized = normalizeResumeBlocks(noisy);
  const dateBlock = normalized.find((b) => String(b.raw_text).includes('20112023'));
  ok(dateBlock?.normalized_text === '2011 - 2023', 'block date repair');
  const toolBlock = normalized.find((b) => String(b.raw_text).toLowerCase().includes('indesing'));
  ok(toolBlock?.normalized_text?.toLowerCase().includes('indesign'), 'block word repair');
  ok(
    normalized.every((b) => b.normalization_confidence >= 0),
    'block confidence present'
  );
}

console.log('--- Block deduplication ---');
{
  const dupBlocks = [
    { block_id: 'a', page_number: 1, zone_id: 'main', text: 'Photoshop', reading_order: 1 },
    { block_id: 'b', page_number: 1, zone_id: 'main', text: 'Photoshop', reading_order: 2 },
    { block_id: 'c', page_number: 1, zone_id: 'sidebar', text: 'Photoshop', reading_order: 3 },
  ];
  const { blocks, dropped, stats } = dedupeResumeBlocks(dupBlocks);
  ok(blocks.length === 2, 'dedupe drops one main duplicate');
  ok(dropped.length === 1, 'dropped trace');
  ok(dropped[0].confidence >= 0.9, 'dedupe confidence');
  ok(stats.dropped === 1, 'dedupe stats');
}

console.log('--- runResumeTextNormalization + debug ---');
{
  const stage = runResumeTextNormalization(
    {
      text: 'Freelancer\n20112023\nIll ustrator',
      spatialBlocks: [
        { block_id: 'x', page_number: 1, text: '20112023', reading_order: 0 },
        { block_id: 'y', page_number: 1, text: 'Ill ustrator', reading_order: 1 },
      ],
    },
    { debug: true }
  );
  ok(stage.text.includes('2011 - 2023'), 'stage text date');
  ok(stage.spatialBlocks[0].normalized_text === '2011 - 2023', 'stage block date');
  ok(stage.debug?.samples?.length >= 1, 'debug samples');
  ok(stage.stats.corrections >= 2, 'stage correction stats');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'normalization-debug-sample.json'), JSON.stringify(stage.debug, null, 2));
}

console.log('--- Pipeline wiring (section-detect) ---');
{
  const memory = {
    lines: yoazPage1.lines,
    entries: yoazPage1.lines,
    spatialBlocks: spatialBlocksFromLayoutMemory({ lines: yoazPage1.lines }),
  };
  const noisyMemory = {
    ...memory,
    lines: memory.lines.map((ln) =>
      ln.text === '2011 - 2023' ? { ...ln, text: '20112023' } : ln
    ),
    entries: memory.lines.map((ln) =>
      ln.text === '2011 - 2023' ? { ...ln, text: '20112023' } : ln
    ),
  };
  const detected = detectSectionBlocks('', {
    layoutMemory: noisyMemory,
    spatialBlocks: spatialBlocksFromLayoutMemory(noisyMemory),
  });
  ok(detected.textNormalizationStage != null, 'section-detect exposes normalization stage');
  ok(detected.textNormalizationDebug != null, 'section-detect exposes debug');
  const texts = (detected.resumeSpatialBlocks || []).map((b) => b.text).join('\n');
  ok(texts.includes('2011 - 2023'), 'pipeline repaired date on blocks');
}

console.log('--- Documented examples ---');
for (const ex of [...YOAZ_NORMALIZATION_EXAMPLES, ...RESUME_NORMALIZATION_EXAMPLES]) {
  const out = normalizeCvLine(ex.before).text;
  const needle = String(ex.after).split(' ')[0];
  ok(out.toLowerCase().includes(needle.toLowerCase()), `example ${ex.before} → ${ex.after}`);
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nRESUME_TEXT_NORMALIZATION OK');
