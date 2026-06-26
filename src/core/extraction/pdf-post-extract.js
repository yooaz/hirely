/**
 * Post-extraction PDF pipeline — PDF block engine (layout → DocumentBlock[]).
 */

import { detectLayout } from '../layout/detect-layout.js';
import { applyReadingOrder } from '../layout/reading-order.js';
import { runPdfBlockEngine } from '../layout/pdf-block-engine.js';
import {
  reconstructDocument,
  reconstructionToParseReady,
} from '../layout/document-reconstruction.js';
import { LAYOUT_TYPES } from '../layout/detect-layout.js';

export { LAYOUT_TYPES };

/**
 * Detect layout archetype from positioned lines.
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 * @param {object} [opts]
 */
export function detectPdfLayout(lines, opts = {}) {
  return detectLayout({
    lines,
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    ocrLayout: opts.ocrLayout,
  });
}

/**
 * Reorder lines for human reading (columns / sidebar / single) before block parsing.
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 * @param {object} layout — from detectPdfLayout
 * @param {object} [opts]
 */
export function buildPdfReadingOrder(lines, layout, opts = {}) {
  return applyReadingOrder({
    lines,
    layout,
    layoutType: layout.layoutType,
    layoutConfidence: layout.confidence,
    layoutSignals: layout.signals,
    columnSplit: layout.columnSplit,
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    ocrLayout: opts.ocrLayout,
  });
}

/**
 * Layout + reading order — must run before block classification / parse.
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 * @param {object} [opts]
 */
export function preparePdfLinesForParsing(lines, opts = {}) {
  const pdfSource =
    opts.pdfExtraction?.method === 'ocr'
      ? 'pdf_ocr'
      : opts.pdfExtraction?.method === 'mixed'
        ? 'pdf_mixed'
        : 'pdf_native';

  const recon = reconstructDocument(lines, {
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    ocrLayout: opts.ocrLayout,
    pdfExtraction: opts.pdfExtraction,
    source: pdfSource,
    forbidPlainTextFallback: true,
  });

  const ready = reconstructionToParseReady(recon);
  const layout = ready.layout || detectPdfLayout(lines, opts);

  return {
    ...ready,
    layout,
    layoutType: layout?.layoutType || ready.layoutType,
    textLayerFound: recon.textLayer?.textLayerFound ?? null,
    documentReconstruction: recon.ok === true,
    neverParseRawPdfText: recon.neverParseRawPdfText === true,
  };
}

/** Human-readable layout labels for UI/debug. */
export function layoutTypeLabel(layoutType) {
  const map = {
    [LAYOUT_TYPES.SINGLE_COLUMN]: 'single column',
    [LAYOUT_TYPES.TWO_COLUMN]: 'two column',
    [LAYOUT_TYPES.LEFT_SIDEBAR]: 'sidebar',
    [LAYOUT_TYPES.RIGHT_SIDEBAR]: 'sidebar',
    [LAYOUT_TYPES.CREATIVE_PORTFOLIO]: 'portfolio',
    [LAYOUT_TYPES.ATS_RESUME]: 'ATS',
    [LAYOUT_TYPES.UNKNOWN]: 'unknown',
  };
  return map[layoutType] || layoutType;
}
