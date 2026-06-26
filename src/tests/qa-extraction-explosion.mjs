#!/usr/bin/env node
/**
 * Extraction audit — dedupe collapses synthetic OCR loops; parser input stays bounded.
 */
import {
  dedupeExtractedLines,
  dedupePlainText,
  sanitizeParserInput,
  measureExtractionStage,
  TEXT_EXPLOSION_CHAR_THRESHOLD,
} from '../core/extraction/extraction-audit.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const baseLine = 'Freelance Illustrator — McCann Paris 2010-2011';
const noisyLines = [];
for (let i = 0; i < 500; i++) {
  noisyLines.push({
    text: baseLine,
    rawExtraction: baseLine,
    cleanedText: baseLine,
    confidence: 70,
    source: 'ocr',
    page: 1,
    line: i,
    x: 0,
    y: i,
  });
}
for (let p = 2; p <= 5; p++) {
  for (let i = 0; i < 80; i++) {
    noisyLines.push({
      text: `Duplicate page block ${p}`,
      rawExtraction: `Duplicate page block ${p}`,
      cleanedText: `Duplicate page block ${p}`,
      confidence: 70,
      source: 'ocr',
      page: p,
      line: i,
      x: 0,
      y: i,
    });
  }
}

const before = measureExtractionStage({ lines: noisyLines });
ok(before.rawChars > TEXT_EXPLOSION_CHAR_THRESHOLD, 'fixture exceeds explosion threshold');

const deduped = dedupeExtractedLines(noisyLines);
ok(deduped.after < deduped.before / 10, 'line dedupe removes bulk duplicates');
ok(deduped.after < 200, `deduped line count sane (${deduped.after})`);

const paragraphBomb = `${baseLine}\n\n`.repeat(400);
const textDedupe = dedupePlainText(paragraphBomb);
ok(textDedupe.afterChars < TEXT_EXPLOSION_CHAR_THRESHOLD, 'paragraph dedupe collapses repeated blocks');

const sanitized = sanitizeParserInput(paragraphBomb, noisyLines);
ok(
  sanitized.cleanedText.length < TEXT_EXPLOSION_CHAR_THRESHOLD,
  `parser input bounded (${sanitized.cleanedText.length} chars)`
);
ok(sanitized.metrics.uniqueLines >= 1, 'unique lines preserved');

console.log(failed ? `\n${failed} failed` : '\nAll extraction explosion checks passed');
process.exit(failed ? 1 : 0);
