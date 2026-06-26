/**
 * Build policy input from the richest available extraction context.
 * This must prefer live OCR/session data over stale result heuristics.
 */
import { buildAutomaticImportRouteInput } from './import-decision-final.js';
import { enrichImportDecisionContext } from './ocr-import-usability.js';

/**
 * @param {object} result
 * @param {object} [importOpts]
 */
export function buildEnrichedImportRouteInput(result = {}, importOpts = {}) {
  const enriched = enrichImportDecisionContext({
    ...result,
    fileType: result.fileType || importOpts.fileType,
    enterprise: result.enterprise || result.enterpriseExtraction,
    importMode: importOpts.importMode || importOpts.mode || result.importMode,
    mode: importOpts.mode || importOpts.importMode,
    exactTranscription: importOpts.exactTranscription ?? result.exactTranscription,
  });

  return buildAutomaticImportRouteInput({
    ...enriched,
    fileType: enriched.fileType || result.fileType || importOpts.fileType,
    nativeTextLength: Number(enriched.nativeTextLength ?? result.nativeTextLength) || 0,
    ocrTextLength: Number(enriched.ocrTextLength ?? result.ocrTextLength) || 0,
    ocrAttempted: enriched.ocrAttempted === true,
    ocrUsable: enriched.ocrUsable === true,
    ocrLineCount: Number(enriched.ocrLineCount) || 0,
    ocrWordCount: Number(enriched.ocrWordCount) || 0,
    ocrPageCount: Number(enriched.ocrPageCount) || 0,
    resumeData: result.resumeData ?? enriched.resumeData ?? null,
    structuredInput: result.structuredInput ?? enriched.structuredInput ?? null,
    ocrStructuredInput: result.ocrStructuredInput ?? enriched.ocrStructuredInput ?? null,
    unsupported: result.unsupported,
    extractionMethod: enriched.extractionMethod || result.extractionMethod,
    ocrSettled: result.ocrSettled ?? enriched.ocrSettled,
    ocrSettlement: result.ocrSettlement || enriched.ocrSettlement,
    ocrInFlight: result.ocrInFlight ?? enriched.ocrInFlight,
    enterprise: enriched.enterprise || result.enterprise || result.enterpriseExtraction,
    importMode: importOpts.importMode || importOpts.mode || result.importMode,
    mode: importOpts.mode || importOpts.importMode,
    exactTranscription: importOpts.exactTranscription ?? result.exactTranscription,
  });
}
