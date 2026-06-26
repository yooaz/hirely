/**
 * PDF Block Engine — text layer lines with coordinates → visual blocks → DocumentBlock[].
 * Never parse PDF as a flat line stream for structured resume assembly.
 */

import { assessPdfTextLayer } from '../extraction/pdf-text-quality.js';
import { reconstructDocument } from './document-reconstruction.js';

/**
 * @typedef {object} PdfTextLayerProbe
 * @property {boolean} textLayerFound
 * @property {number} confidence
 * @property {number} charCount
 * @property {string} reason
 */

/**
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 */
export function hasPositionedPdfLines(lines) {
  const usable = (lines || []).filter((l) => {
    const t = String(l.cleanedText ?? l.text ?? '').trim();
    return Number.isFinite(l.x) && Number.isFinite(l.y) && t.length > 0;
  });
  if (usable.length < 3) return false;
  const ys = usable.map((l) => Number(l.y));
  const xs = usable.map((l) => Number(l.x));
  return Math.max(...ys) - Math.min(...ys) >= 4 && Math.max(...xs) - Math.min(...xs) >= 20;
}

/**
 * Probe native PDF text layer quality from extracted line text.
 * @param {string} text
 */
export function detectPdfTextLayer(text) {
  const q = assessPdfTextLayer(String(text || ''));
  return {
    textLayerFound: q.confidence >= 52 && q.charCount >= 32,
    confidence: q.confidence,
    charCount: q.charCount,
    reason: q.reason,
    garbageLineRatio: q.garbageLineRatio,
    alphaRatio: q.alphaRatio,
  };
}

/**
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 * @param {object} [opts]
 * @param {string} [opts.rawText]
 * @param {string} [opts.cleanedText]
 * @param {string} [opts.source] — pdf_native | pdf_ocr | pdf_mixed
 * @param {object} [opts.pdfExtraction]
 * @param {object} [opts.ocrLayout]
 */
export function runPdfBlockEngine(lines = [], opts = {}) {
  const recon = reconstructDocument(lines, {
    ...opts,
    source: opts.source || 'pdf',
    forbidPlainTextFallback: true,
  });

  const threshold = opts.threshold ?? 72;
  const reviewBlocks = (recon.documentBlocks || []).filter(
    (b) => b.needsReview || (b.confidence ?? 0) < threshold
  );

  return {
    stage: 'pdf_block_engine',
    ok: recon.ok === true,
    error: recon.error || null,
    textLayer: recon.textLayer,
    layout: recon.layout,
    columns: recon.columns,
    geometricBlocks: recon.geometricBlocks,
    reading: recon.reading,
    visualStructure: recon.visualStructure,
    documentBlocks: recon.documentBlocks || [],
    documentBlockStage: recon.documentBlockStage,
    renderBlocks: recon.renderBlocks || [],
    reviewBlocks,
    threshold,
    neverRawPdfLineOrder: recon.neverRawPdfLineOrder !== false,
    neverParseRawPdfText: recon.neverParseRawPdfText === true,
    parseFromBlocksOnly: true,
    parseFromVisualStructureOnly: recon.parseFromVisualStructureOnly === true,
    positionedLineCount: recon.positionedLineCount ?? lines.length,
    blockCount: recon.blockCount ?? 0,
    pipeline: recon.pipeline,
    at: recon.at || new Date().toISOString(),
  };
}
