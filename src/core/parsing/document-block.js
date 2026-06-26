/**
 * DocumentBlock — canonical block shape for structured resume assembly.
 * Built only via block pipeline (never raw PDF text).
 *
 * @typedef {object} DocumentBlock
 * @property {string} text
 * @property {number} page
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} confidence
 * @property {string} source — pdf_native | pdf_ocr | pdf_mixed | paste | docx | txt
 * @property {string} [id]
 * @property {string} [type]
 * @property {boolean} [accepted]
 * @property {boolean} [needsReview]
 * @property {object[]} [lines]
 */

import { layoutBlocksToExtracted } from '../layout/block-extractor.js';
import {
  createClassifiedBlock,
  classifyBlocks,
  buildClassifiedBlocks,
  countByType,
  blocksToReviewItems,
  BLOCK_TYPES,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
} from './block-classifier.js';
import { runP0Pipeline as runBlockPipeline } from '../pipeline/p0-pipeline.js';

export const DOCUMENT_BLOCK_TYPES = [...BLOCK_TYPES];

export {
  BLOCK_TYPES as DOCUMENT_BLOCK_TYPES_LIST,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  countByType,
  blocksToReviewItems,
};

/**
 * Canonical DocumentBlock fields required by the PDF block engine.
 * @param {object} block
 * @returns {DocumentBlock}
 */
export function toCanonicalDocumentBlock(block) {
  const b = block || {};
  const bbox = b.bbox || {};
  const page = Number(b.page ?? b.sourcePage ?? 1);
  const x = Number(b.x ?? bbox.x ?? 0);
  const y = Number(b.y ?? bbox.y ?? 0);
  const width = Number(b.width ?? bbox.width ?? 0);
  const height = Number(b.height ?? bbox.height ?? 0);
  const lineSource = (b.lines || [])[0]?.source;
  const source =
    String(b.source || lineSource || 'unknown').trim() || 'unknown';

  return {
    id: b.id || `doc-${page}-${Math.round(x)}-${Math.round(y)}`,
    text: String(b.text || '').trim(),
    page,
    x,
    y,
    width,
    height,
    confidence: Math.round(Math.max(0, Math.min(100, Number(b.confidence) || 75))),
    source,
    type: b.type || b.bucket || 'unknown',
    bucket: b.bucket || b.type || 'unknown',
    bbox: { x, y, width, height },
    accepted: b.accepted,
    needsReview: b.needsReview,
    lines: b.lines || [],
    sectionHint: b.sectionHint || null,
    column: b.column || null,
    readingOrder: b.readingOrder ?? null,
  };
}

/**
 * PDF positioned lines → classified DocumentBlock[] (layout engine).
 * @param {object[]} lines — ExtractedLine with x/y
 * @param {object} [opts]
 */
export function buildDocumentBlocksFromPdfLines(lines, opts = {}) {
  return buildDocumentBlocks({
    lines,
    ...opts,
    layoutType: opts.layoutType,
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
  });
}

/**
 * @param {object} raw
 */
export function createDocumentBlock(raw) {
  const block = createClassifiedBlock({
    ...raw,
    page: raw.page ?? raw.sourcePage ?? 1,
    bbox: raw.bbox ?? {
      x: raw.x ?? 0,
      y: raw.y ?? 0,
      width: raw.width ?? 0,
      height: raw.height ?? 0,
    },
  });
  return toCanonicalDocumentBlock({
    ...block,
    sourcePage: block.page,
    source: raw.source || raw.lines?.[0]?.source,
  });
}

/**
 * Build DocumentBlock[] from layout blocks or full document lines.
 * @param {object} opts — { layoutBlocks, lines, rawText, cleanedText, layoutType, ... }
 */
export function buildDocumentBlocks(opts = {}) {
  if (opts.lines?.length && !opts.layoutBlocks?.length) {
    const pipeline = runBlockPipeline(
      {
        lines: opts.lines,
        rawText: opts.rawText,
        cleanedText: opts.cleanedText,
        layoutType: opts.layoutType,
        columnSplit: opts.columnSplit,
        ocrLayout: opts.ocrLayout,
      },
      { skipStructuredResume: true }
    );
    const documentBlocks = (pipeline.blocks || []).map((b) =>
      toCanonicalDocumentBlock({ ...b, source: b.source || opts.source })
    );
    return formatDocumentBlocksStage(documentBlocks);
  }

  const layoutBlocks = opts.layoutBlocks || opts.blocks || [];
  const extracted = layoutBlocksToExtracted(layoutBlocks);
  const classified = buildClassifiedBlocks(extracted);
  const documentBlocks = classified.blocks.map((b) =>
    toCanonicalDocumentBlock({
      ...b,
      source: b.source || opts.source || b.lines?.[0]?.source,
    })
  );
  return formatDocumentBlocksStage(documentBlocks, classified);
}

function formatDocumentBlocksStage(documentBlocks, classified = null) {
  return {
    stage: 'document_blocks',
    documentBlocks,
    blockCount: documentBlocks.length,
    typeCounts: countByType(documentBlocks),
    acceptedCount: documentBlocks.filter((b) => b.accepted).length,
    reviewCount: documentBlocks.filter((b) => b.needsReview).length,
    threshold: CLASSIFICATION_CONFIDENCE_THRESHOLD,
    at: classified?.at || new Date().toISOString(),
  };
}

export function documentBlocksToReviewItems(documentBlocks = []) {
  return blocksToReviewItems(documentBlocks);
}

export { classifyBlocks, runBlockPipeline };
