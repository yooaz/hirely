#!/usr/bin/env node
/**
 * BLOCK_BUILDER_V1 — 38 OCR lines → ~8–15 DocumentBlocks (not 38 isolated lines).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDocumentBlocksFromOcrLines,
  computeBlockSignals,
} from '../core/parsing/block-builder-v1.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const yoazPath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const yoazLines = readFileSync(yoazPath, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const ocr38 = yoazLines.slice(0, 38);
ok(ocr38.length === 38, 'fixture has 38 OCR lines');

const { documentBlocks, stats } = buildDocumentBlocksFromOcrLines(ocr38, { source: 'ocr' });
ok(stats.rawLineCount === 38, `rawLineCount=${stats.rawLineCount}`);
ok(
  documentBlocks.length >= 8 && documentBlocks.length <= 15,
  `block count ${documentBlocks.length} in 8–15 range`
);
ok(documentBlocks.length < 38, 'not one block per line');

for (const block of documentBlocks) {
  ok(typeof block.id === 'string', `block ${block.id} has id`);
  ok(Array.isArray(block.lines) && block.lines.length >= 1, `block ${block.id} has lines[]`);
  ok(typeof block.text === 'string' && block.text.length > 0, `block ${block.id} has text`);
  ok(block.type === 'unknown', `block ${block.id} type unknown before classification`);
  ok(block.signals && typeof block.signals.hasDate === 'boolean', `block ${block.id} signals`);
}

const dateBlocks = documentBlocks.filter((b) => b.signals?.hasDate);
ok(dateBlocks.length >= 2, `date-anchored blocks (${dateBlocks.length})`);

const contactBlocks = documentBlocks.filter((b) => b.signals?.hasEmail || b.signals?.hasPhone);
ok(contactBlocks.length >= 1, 'contact grouped block');

const multiLineBlocks = documentBlocks.filter((b) => b.lines.length > 1);
ok(multiLineBlocks.length >= 3, `multi-line blocks (${multiLineBlocks.length})`);

const freelanceBlock = documentBlocks.find((b) =>
  /freelanc/i.test(b.text) && /2011/.test(b.text)
);
ok(Boolean(freelanceBlock), 'freelance date block grouped');
ok(
  freelanceBlock.lines.length >= 2,
  `freelance block has ${freelanceBlock?.lines.length} lines not isolated`
);

const signals = computeBlockSignals('2011-2022\nFreelancer Illustrator');
ok(signals.hasDate && signals.hasRole, 'signal detection on grouped text');

console.log('\nBLOCK_BUILDER_V1 QA OK', {
  blocks: documentBlocks.length,
  mergedLines: stats.mergedLineCount,
});
