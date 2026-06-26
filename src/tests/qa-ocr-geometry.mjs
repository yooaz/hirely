#!/usr/bin/env node
/**
 * OCR geometry — word bbox preservation and line reconstruction.
 * node src/tests/qa-ocr-geometry.mjs
 */
import {
  isValidWordBbox,
  isZeroWordBbox,
  extractEngineWordBbox,
  buildOcrGeometryTransform,
  mapWordBboxToPageSpace,
  normalizeOcrWordsToPageSpace,
  lineHasRealWordBoxes,
  wordHasRealOcrGeometry,
  coerceWordRealGeometry,
  resetZeroBboxTrace,
  getZeroBboxTraceReport,
} from '../core/extraction/ocr-geometry.js';
import { clusterOcrWordsIntoLineGroups } from '../core/extraction/extraction-column-split.js';
import {
  rebuildLinesFromOcrWords,
  clusterWordsWithLineWords,
  weakLineReason,
} from '../core/extraction/exact-transcription-rebuild.js';
import {
  buildExactTranscription,
  toContractWord,
  toContractBBox,
  finalizeExactTranscriptionWord,
} from '../core/extraction/exact-transcription-pipeline.js';
import { mapTesseractWords } from '../core/extraction/ocr-tesseract.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

ok(!isValidWordBbox({ x: 0, y: 0, width: 0, height: 0 }), 'zero bbox rejected');
ok(isValidWordBbox({ x: 10, y: 20, width: 40, height: 12 }), 'non-zero bbox accepted');

const tess = extractEngineWordBbox({ text: 'Hi', bbox: { x0: 5, y0: 10, x1: 25, y1: 22 } });
ok(tess?.width === 20 && tess?.height === 12, 'tesseract x0/y0/x1/y1 parsed');

const transform = buildOcrGeometryTransform(
  {
    cropLeft: 0,
    cropTop: 0,
    croppedWidth: 2000,
    croppedHeight: 2800,
    width: 4000,
    height: 5600,
    inputWidth: 2000,
    inputHeight: 2800,
    viewportWidth: 612,
    viewportHeight: 792,
  },
  { renderScale: 2000 / 612, rotationDeg: 0, renderWidth: 2000, renderHeight: 2800 }
);
const mapped = mapWordBboxToPageSpace({ x: 400, y: 800, width: 120, height: 24 }, transform);
ok(mapped && mapped.width > 0 && mapped.x > 0, 'bbox survives canvas→page normalization');

const words = normalizeOcrWordsToPageSpace(
  [{ text: 'Skills', bbox: { x: 3600, y: 1200, width: 80, height: 20 }, confidence: 88 }],
  transform
);
ok(words.length === 1 && !words[0].inferred, 'normalized words marked real');

const leftRightWords = [
  { text: 'CONTACT', bbox: { x: 40, y: 100, width: 70, height: 14 }, confidence: 90 },
  { text: 'Email', bbox: { x: 42, y: 120, width: 50, height: 12 }, confidence: 88 },
  { text: 'EXPERIENCE', bbox: { x: 320, y: 100, width: 100, height: 14 }, confidence: 91 },
  { text: 'Designer', bbox: { x: 322, y: 120, width: 80, height: 12 }, confidence: 87 },
];
const groups = clusterOcrWordsIntoLineGroups(
  leftRightWords.map((w) => ({
    text: w.text,
    bbox: {
      x0: w.bbox.x,
      y0: w.bbox.y,
      x1: w.bbox.x + w.bbox.width,
      y1: w.bbox.y + w.bbox.height,
    },
    confidence: w.confidence,
  })),
  500
);
ok(groups.length >= 3, 'left/right columns do not collapse into one line stream');
const contactLine = groups.find((g) => g.text.includes('CONTACT'));
const expLine = groups.find((g) => g.text.includes('EXPERIENCE'));
ok(contactLine && expLine && contactLine.x < expLine.x, 'column separation preserves side ordering');

const ocrWords = {
  1: leftRightWords,
};
const rebuilt = rebuildLinesFromOcrWords([], ocrWords);
const rebuilt2 = rebuildLinesFromOcrWords([], ocrWords);
ok(JSON.stringify(rebuilt.map((l) => l.text)) === JSON.stringify(rebuilt2.map((l) => l.text)), 'line reconstruction deterministic from words');

const tx = buildExactTranscription({
  enterprise: { lines: rebuilt, method: 'ocr', metadata: { ocrWordsByPage: ocrWords } },
  fileName: 'geom.pdf',
});
ok(tx.pages[0].raw_lines.some((l) => l.real_word_boxes), 'exact transcription exposes real_word_boxes');
ok(
  tx.pages[0].raw_words.every((w) => !w.bbox || !isZeroWordBbox(w.bbox)),
  'exact output never contains [0,0 0x0] word bbox'
);

resetZeroBboxTrace();
const stripped = finalizeExactTranscriptionWord({
  text: 'Broken',
  bbox: { x: 0, y: 0, w: 0, h: 0 },
  confidence: 50,
  source: 'ocr',
});
ok(stripped.bbox === null, 'zero bbox stripped at output');
ok(stripped.geometry_missing === true, 'zero bbox marked geometry_missing');
ok(getZeroBboxTraceReport().length >= 1, 'zero bbox pipeline bug traced');

ok(toContractBBox({ x: 0, y: 0, w: 0, h: 0 }) === null, 'toContractBBox rejects zero bbox');

const mappedWords = mapTesseractWords({
  words: [
    { text: 'ok', confidence: 90, bbox: { x0: 1, y0: 2, x1: 10, y1: 14 } },
    { text: 'bad', confidence: 90, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  ],
});
ok(mappedWords.length === 1 && mappedWords[0].text === 'ok', 'zero engine bbox dropped at map');

ok(lineHasRealWordBoxes({ words: [{ text: 'a', bbox: { x: 1, y: 2, w: 3, h: 4 }, inferred: false }] }), 'lineHasRealWordBoxes true');

const clusters = clusterWordsWithLineWords(leftRightWords, 500);
ok(clusters.some((c) => c.columnId === 'LEFT_COLUMN' || c.columnId === 'RIGHT_COLUMN'), 'column-aware clustering');

// mapTesseractWords filters invalid engine boxes (see mappedWords test above)

const wronglyFlagged = coerceWordRealGeometry({
  text: 'Skills',
  bbox: { x: 320, y: 100, width: 50, height: 14 },
  confidence: 90,
  inferred: true,
  source: 'ocr',
});
ok(wronglyFlagged.inferred === false, 'real OCR geometry wins over inferred flag');
ok(
  toContractWord(wronglyFlagged).inferred === false,
  'toContractWord preserves real OCR geometry'
);
ok(
  weakLineReason({
    confidence: 80,
    bbox: { x: 320, y: 100, width: 50, height: 14 },
    real_word_boxes: true,
    words: [{ text: 'Skills', bbox: { w: 50, h: 14, x: 320, y: 100 }, inferred: false }],
  }) !== 'inferred_word_boxes_only',
  'inferred_word_boxes_only never used when real_word_boxes'
);
ok(
  weakLineReason({
    confidence: 80,
    bbox: { x: 10, y: 10, width: 100, height: 12 },
    words: [
      { text: 'Hi', bbox: { w: 20, h: 12, x: 10, y: 10 }, inferred: false, source: 'ocr' },
      { text: 'there', bbox: { w: 30, h: 12, x: 40, y: 10 }, inferred: true, source: 'inferred' },
    ],
  }) !== 'inferred_word_boxes_only',
  'mixed line with any real OCR word is not inferred-only'
);

console.log('\nOCR GEOMETRY QA OK');
