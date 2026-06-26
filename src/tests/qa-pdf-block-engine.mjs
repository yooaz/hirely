#!/usr/bin/env node
/**
 * PDF block engine — coordinates → DocumentBlock[]; no plain-text PDF fallback.
 */
import {
  hasPositionedPdfLines,
  runPdfBlockEngine,
  detectPdfTextLayer,
} from '../core/layout/pdf-block-engine.js';
import { toCanonicalDocumentBlock } from '../core/parsing/document-block.js';
import { buildReadingOrder } from '../core/layout/reading-order.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function line(text, x, y, page = 1) {
  return {
    text,
    cleanedText: text,
    rawExtraction: text,
    x,
    y,
    width: 120,
    height: 12,
    page,
    confidence: 90,
    source: 'native',
  };
}

const twoColLines = [
  line('EXPERIENCE', 40, 720),
  line('Nike — Lead Designer', 40, 680),
  line('EDUCATION', 420, 720),
  line('LISAA — Bachelor', 420, 680),
  line('SKILLS', 40, 400),
  line('Figma, Illustrator', 40, 360),
];

ok(hasPositionedPdfLines(twoColLines), 'positioned PDF lines detected');
ok(!hasPositionedPdfLines([{ text: 'a', x: 0, y: 0 }]), 'sparse coords rejected');

const layer = detectPdfTextLayer(twoColLines.map((l) => l.text).join('\n'));
ok(layer.textLayerFound === true, 'text layer probe');

const engine = runPdfBlockEngine(twoColLines, {
  rawText: twoColLines.map((l) => l.text).join('\n'),
  cleanedText: twoColLines.map((l) => l.text).join('\n'),
  source: 'pdf_native',
});

ok(engine.ok === true, 'pdf block engine ok');
ok(engine.documentBlocks.length >= 2, 'document blocks produced');
ok(engine.neverRawPdfLineOrder !== false, 'never raw PDF line order flag');

for (const b of engine.documentBlocks) {
  const c = toCanonicalDocumentBlock(b);
  ok(typeof c.text === 'string' && c.text.length > 0, 'block has text');
  ok(Number.isFinite(c.page) && c.page >= 1, 'block page');
  ok(Number.isFinite(c.x) && Number.isFinite(c.y), 'block coordinates');
  ok(Number.isFinite(c.width) && Number.isFinite(c.height), 'block dimensions');
  ok(Number.isFinite(c.confidence), 'block confidence');
  ok(/^pdf_/.test(c.source), `block source pdf: ${c.source}`);
}

const noCoords = runPdfBlockEngine([], { source: 'pdf_native' });
ok(noCoords.ok === false, 'missing coordinates fails closed');
ok(noCoords.documentBlocks.length === 0, 'no blocks without coordinates');

const forbid = buildReadingOrder({
  rawText: 'EXPERIENCE\nNike Designer\nEDUCATION\nLISAA',
  source: 'pdf',
  forbidPlainTextFallback: true,
  lines: [],
});
ok(forbid.orderedBlocks?.length === 0, 'PDF reading order forbids plain-text fallback');
ok(forbid.pdfBlockEngineError === 'READING_ORDER_NO_PDF_FALLBACK', 'PDF fallback error code');

process.exit(failed ? 1 : 0);
