/**
 * Hirely P0 pipeline — layout reconstruction + block classification only.
 *
 * Document → Layout → Columns → Blocks → Reading Order → Classification → Resume JSON
 * Never parseCV(raw). Confidence < 70 → review queue. Confidence >= 70 → render.
 *
 * Frozen: templates, ATS, export, UI
 */

import { reconstructDocument } from '../layout/document-reconstruction.js';
import { detectLayout } from '../layout/detect-layout.js';
import { detectColumns } from '../layout/detect-columns.js';
import { extractGeometricBlocks, layoutBlocksToExtracted } from '../layout/block-extractor.js';
import { applyReadingOrder } from '../layout/reading-order.js';
import { classifyBlocks } from '../parsing/block-classifier.js';
import { applyConfidenceGate, P0_CONFIDENCE_THRESHOLD } from '../parsing/confidence-scoring.js';
import { buildStructuredResumeFromBlocks } from '../parsing/structured-resume-from-blocks.js';
import { mergeReviewQueues, buildBlockReviewItems } from '../parsing/review-queue.js';
import {
  buildDocumentUnderstandingDebug,
  attachDocumentUnderstandingDebug,
  isDocumentUnderstandingDebugEnabled,
} from '../../debug/document-understanding-debug.js';

/**
 * @typedef {object} P0Document
 * @property {object[]} [lines]
 * @property {string} [rawText]
 * @property {string} [cleanedText]
 * @property {string} [source] — pdf | docx | txt | paste | ocr
 * @property {object} [ocrLayout]
 */

/**
 * @param {P0Document} document
 * @param {object} [opts]
 */
export function runP0Pipeline(document = {}, opts = {}) {
  let lines = document.lines || [];
  const isPdfSource = /pdf|native_pdf|mixed|pdf_/i.test(String(document.source || ''));

  if (!lines.length && document.rawText?.length >= 10) {
    if (isPdfSource) {
      return {
        pipelineVersion: 'p0-layout',
        neverRawParseCv: true,
        parseSource: 'p0_blocks',
        error: 'PDF_BLOCK_ENGINE_REQUIRES_POSITIONED_LINES',
        layout: { layoutType: 'unknown', confidence: 0, signals: ['pdf-no-coordinates'] },
        columns: null,
        blocks: { blocks: [], blockCount: 0 },
        reading: { orderedBlocks: [], orderedLines: [], blockCount: 0 },
        extractedBlocks: [],
        classifiedBlocks: { blocks: [] },
        confidence: { renderBlocks: [], reviewBlocks: [], threshold: opts.threshold },
        renderBlocks: [],
        reviewBlocks: [],
        structuredResume: null,
        threshold: opts.threshold,
        at: new Date().toISOString(),
      };
    }
    lines = String(document.rawText)
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t, i) => ({
        text: t,
        cleanedText: t,
        rawExtraction: t,
        confidence: 88,
        source: document.source || 'paste',
        page: 1,
        line: i,
        x: 0,
        y: 1000 - i * 16,
        width: 0,
        height: 14,
      }));
  }

  const reconstruction = reconstructDocument(lines, {
    lines,
    rawText: document.rawText,
    cleanedText: document.cleanedText,
    ocrLayout: document.ocrLayout,
    source: isPdfSource ? 'pdf' : document.source || 'paste',
    forbidPlainTextFallback: isPdfSource,
  });

  if (isPdfSource && reconstruction.ok !== true) {
    return {
      pipelineVersion: 'p0-layout',
      neverRawParseCv: true,
      neverParseRawPdfText: true,
      parseSource: 'document_reconstruction',
      documentReconstruction: false,
      error: reconstruction.error || 'DOCUMENT_RECONSTRUCTION_REQUIRES_LAYOUT',
      visualStructure: reconstruction.visualStructure,
      layout: reconstruction.layout,
      columns: reconstruction.columns,
      blocks: reconstruction.geometricBlocks || { blocks: [], blockCount: 0 },
      reading: reconstruction.reading || { orderedBlocks: [], orderedLines: [], blockCount: 0 },
      extractedBlocks: [],
      classifiedBlocks: { blocks: [] },
      confidence: { renderBlocks: [], reviewBlocks: [], threshold: opts.threshold },
      renderBlocks: [],
      reviewBlocks: [],
      structuredResume: null,
      threshold: opts.threshold,
      at: new Date().toISOString(),
    };
  }

  const layout = reconstruction.layout;
  const blocksStage = reconstruction.geometricBlocks;
  const columns = reconstruction.columns;
  const reading = reconstruction.reading;

  const extractedBlocks = layoutBlocksToExtracted(
    reading?.orderedBlocks?.length ? reading.orderedBlocks : reconstruction.orderedBlocks || []
  );
  const classified = classifyBlocks(extractedBlocks, {
    rawText: document.rawText || document.cleanedText,
    layoutType: layout.layoutType,
  });
  const confidence = applyConfidenceGate(classified, opts.threshold ?? P0_CONFIDENCE_THRESHOLD);

  const structuredResume = opts.skipStructuredResume
    ? null
    : buildStructuredResumeFromBlocks(confidence.renderBlocks, {
        ...opts,
        rawText: document.rawText,
        cleanedText: document.cleanedText,
        layoutType: layout.layoutType,
        extractionMethod: document.source,
        neverRawParseCv: true,
        parseSource: 'p0_blocks',
        extraReview: confidence.reviewItems,
        creativeMode: classified._creativeMode || null,
      });

  if (structuredResume) {
    const review = mergeReviewQueues(
      buildBlockReviewItems(confidence.reviewBlocks, confidence.threshold),
      confidence.reviewItems,
      structuredResume.needsReview || [],
      opts.extraReview || []
    );
    structuredResume.needsReview = review.slice(0, 48);
    structuredResume.reviewQueue = review;
    if (classified._creativeMode) {
      structuredResume.metadata.creativeParsingMode = classified._creativeMode.active === true;
      structuredResume.metadata.creativeMode = classified._creativeMode;
    }
  }

  const result = {
    pipelineVersion: 'p0-layout',
    neverRawParseCv: true,
    neverParseRawPdfText: isPdfSource,
    parseSource: 'document_reconstruction',
    documentReconstruction: reconstruction.ok === true,
    visualStructure: reconstruction.visualStructure,
    layout,
    columns,
    blocks: blocksStage,
    reading,
    extractedBlocks,
    classifiedBlocks: classified,
    confidence,
    blocksStage,
    documentBlocks: classified,
    renderBlocks: confidence.renderBlocks,
    reviewBlocks: confidence.reviewBlocks,
    structuredResume,
    threshold: confidence.threshold,
    at: new Date().toISOString(),
  };

  if (opts.debug || isDocumentUnderstandingDebugEnabled()) {
    result.debug = buildDocumentUnderstandingDebug(result);
    attachDocumentUnderstandingDebug(result, result);
  }

  return result;
}

export {
  detectLayout,
  detectColumns,
  extractGeometricBlocks,
  applyReadingOrder,
  classifyBlocks,
  applyConfidenceGate,
  P0_CONFIDENCE_THRESHOLD,
};
