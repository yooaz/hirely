/**
 * Document Reconstruction — PDF is layout, not text.
 *
 * Pipeline (before parsing / resumeData):
 *   columns → blocks → headings → sidebars → dates → lists → reading order → document blocks
 *
 * Never assemble structured resume from raw PDF text order.
 */

import { detectLayout } from './detect-layout.js';
import { detectColumns } from './detect-columns.js';
import { extractGeometricBlocks, layoutBlocksToExtracted } from './block-extractor.js';
import { applyReadingOrder } from './reading-order.js';
import { hasPositionedPdfLines, detectPdfTextLayer } from './pdf-block-engine.js';
import { buildDocumentBlocks, toCanonicalDocumentBlock } from '../parsing/document-block.js';
import { CLASSIFICATION_CONFIDENCE_THRESHOLD } from '../parsing/block-classifier.js';
import { annotateVisualStructure, summarizeVisualStructure, VISUAL_ROLES } from './visual-features.js';
import {
  classifyDocumentPageLayouts,
  buildPageLayoutDebug,
} from './page-layout.js';

export { VISUAL_ROLES };

export const RECONSTRUCTION_STAGES = [
  'columns',
  'blocks',
  'headings',
  'sidebars',
  'dates',
  'lists',
  'column_reconstruction',
  'reading_order',
  'document_blocks',
];

/**
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 * @param {object} [opts]
 */
export function reconstructDocument(lines = [], opts = {}) {
  const source = String(opts.source || opts.pdfExtraction?.method || 'pdf');
  const isPdf =
    opts.forbidPlainTextFallback === true ||
    /^pdf/i.test(source) ||
    String(opts.pdfExtraction?.fileType || '').startsWith('pdf');

  const positioned = hasPositionedPdfLines(lines);
  const hay = (lines || []).map((l) => String(l.cleanedText ?? l.text ?? '').trim()).join('\n');
  const textLayer = detectPdfTextLayer(opts.cleanedText || opts.rawText || hay);

  if (isPdf && !positioned) {
    return {
      ok: false,
      stage: 'document_reconstruction',
      error: 'DOCUMENT_RECONSTRUCTION_REQUIRES_LAYOUT',
      message: 'PDF must be reconstructed from positioned lines — never raw PDF text order.',
      textLayer,
      layout: {
        layoutType: 'unknown',
        confidence: 0,
        signals: ['pdf-missing-coordinates'],
      },
      columns: null,
      geometricBlocks: null,
      reading: null,
      visualStructure: null,
      documentBlocks: [],
      renderBlocks: [],
      neverParseRawPdfText: true,
      parseFromVisualStructureOnly: true,
      positionedLineCount: 0,
      at: new Date().toISOString(),
    };
  }

  const pageLayouts = classifyDocumentPageLayouts(lines);
  const pageLayoutDebug = buildPageLayoutDebug(pageLayouts);

  const layout = detectLayout({
    lines,
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    ocrLayout: opts.ocrLayout,
    pageLayouts,
  });

  const geometricStage = extractGeometricBlocks(lines, { pageLayouts });
  const columns = detectColumns(geometricStage.blocks, layout);

  const annotatedBlocks = annotateVisualStructure(geometricStage.blocks, layout, columns);

  const reading = applyReadingOrder({
    lines,
    layout,
    blocks: { ...geometricStage, blocks: annotatedBlocks },
    columns,
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    source: isPdf ? 'pdf' : source,
    forbidPlainTextFallback: isPdf,
  });

  if (isPdf && reading.pdfBlockEngineError) {
    return {
      ok: false,
      stage: 'document_reconstruction',
      error: reading.pdfBlockEngineError,
      textLayer,
      layout,
      columns,
      geometricBlocks: geometricStage,
      reading,
      visualStructure: summarizeVisualStructure({ layout, columns, blocks: annotatedBlocks }),
      documentBlocks: [],
      renderBlocks: [],
      neverParseRawPdfText: true,
      parseFromVisualStructureOnly: true,
      at: new Date().toISOString(),
    };
  }

  const orderedBlocks = reading.orderedBlocks?.length
    ? reading.orderedBlocks
    : layoutBlocksToExtracted(annotatedBlocks, layout.layoutType);

  const visualStructure = summarizeVisualStructure({
    layout,
    columns,
    blocks: orderedBlocks,
  });

  const docStage = buildDocumentBlocks({
    layoutBlocks: orderedBlocks,
    layoutType: layout.layoutType,
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    columnSplit: layout.columnSplit,
    ocrLayout: opts.ocrLayout,
  });

  const pdfSource =
    source.startsWith('pdf_') || source === 'pdf'
      ? source
      : lines[0]?.source === 'ocr'
        ? 'pdf_ocr'
        : 'pdf_native';

  const threshold = opts.threshold ?? CLASSIFICATION_CONFIDENCE_THRESHOLD;
  const documentBlocks = (docStage.documentBlocks || []).map((b) =>
    toCanonicalDocumentBlock({
      ...b,
      source: /^pdf_/.test(String(b.source || '')) ? b.source : pdfSource,
    })
  );

  const renderBlocks = documentBlocks.filter(
    (b) => b.accepted !== false && (b.confidence ?? 0) >= threshold
  );

  const orderedLines =
    reading.orderedLines?.length > 0
      ? reading.orderedLines
      : (lines || []).map((ln, i) => ({ ...ln, readingOrder: i }));

  return {
    ok: true,
    stage: 'document_reconstruction',
    pipeline: RECONSTRUCTION_STAGES,
    textLayer,
    layout,
    pageLayouts,
    pageLayoutDebug,
    columns,
    geometricBlocks: { ...geometricStage, blocks: annotatedBlocks },
    reading,
    visualStructure,
    orderedBlocks,
    documentBlocks,
    documentBlockStage: docStage,
    renderBlocks,
    lines: orderedLines,
    layoutType: layout.layoutType,
    neverParseRawPdfText: isPdf,
    neverRawPdfLineOrder: reading.usedRawPdfLineOrder !== true,
    parseFromVisualStructureOnly: true,
    parseFromDocumentBlocksOnly: true,
    readingOrderBeforeParse: true,
    usedGeometryReadingOrder: reading.usedGeometryReadingOrder === true,
    usedColumnReconstruction: reading.usedColumnReconstruction === true,
    positionedLineCount: lines.length,
    blockCount: documentBlocks.length,
    at: new Date().toISOString(),
  };
}

/**
 * Map reconstruction result to legacy preparePdfLinesForParsing shape.
 * @param {object} recon
 */
export function reconstructionToParseReady(recon) {
  if (!recon?.ok) {
    return {
      layout: recon?.layout || null,
      reading: recon?.reading || null,
      pdfBlockEngine: recon,
      documentBlocks: [],
      renderBlocks: [],
      lines: [],
      layoutType: recon?.layout?.layoutType || 'unknown',
      readingOrderBeforeParse: true,
      usedGeometryReadingOrder: false,
      usedColumnReconstruction: false,
      neverRawPdfLineOrder: true,
      parseFromDocumentBlocksOnly: true,
      reconstructionError: recon?.error || 'DOCUMENT_RECONSTRUCTION_FAILED',
    };
  }
  return {
    layout: recon.layout,
    reading: recon.reading,
    pdfBlockEngine: recon,
    visualStructure: recon.visualStructure,
    documentBlocks: recon.documentBlocks,
    renderBlocks: recon.renderBlocks,
    lines: recon.lines,
    layoutType: recon.layoutType,
    readingOrderBeforeParse: recon.readingOrderBeforeParse,
    usedGeometryReadingOrder: recon.usedGeometryReadingOrder,
    usedColumnReconstruction: recon.usedColumnReconstruction,
    neverRawPdfLineOrder: recon.neverRawPdfLineOrder,
    parseFromDocumentBlocksOnly: recon.parseFromDocumentBlocksOnly,
    documentReconstruction: true,
  };
}
