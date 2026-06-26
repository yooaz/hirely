/**
 * P0 — Runtime stability guards. No exception reaches UI.
 */

import { createStageResult, runStageSafe } from './pipeline-stage-result.js';
import { applySafeFallback, ensureExportableCv } from '../parsing/safe-fallback.js';
import { cleanExtraction, forceCvDataFromText, cvDataIsRenderable } from '../parsing/rich-parser.js';
import { coerceParserInputText, slimPipelineResult } from '../pipeline/pipeline-contract.js';

export { createStageResult, normalizeStageResult, runStageSafe } from './pipeline-stage-result.js';

/**
 * Production pipeline emergency fallback — always returns slimPipelineResult shape.
 * @param {string} rawText
 * @param {object} opts
 * @param {unknown} err
 */
export function buildProductionPipelineSafeFallback(rawText, opts = {}, err) {
  const raw = String(rawText || '');
  const cleaned = coerceParserInputText(cleanExtraction(raw), raw);
  let validatedCVData = forceCvDataFromText(cleaned || raw);
  validatedCVData = applySafeFallback(validatedCVData, {
    rawText: raw,
    cleanedText: cleaned,
    reviewQueue: [],
  });
  if (!cvDataIsRenderable(validatedCVData)) {
    validatedCVData = ensureExportableCv(validatedCVData, { rawText: raw, cleanedText: cleaned });
  }
  const msg = String(
    err && typeof err === 'object' && 'message' in err ? err.message : err || 'PIPELINE_FAILED'
  );
  return slimPipelineResult({
    rawText: raw,
    cleanedText: cleaned,
    structuredResume: null,
    validatedCVData,
    structured: validatedCVData,
    validation: { data: validatedCVData, ok: cvDataIsRenderable(validatedCVData) },
    errors: [msg],
    warnings: ['PIPELINE_SAFE_FALLBACK'],
    canGenerate: cleaned.length >= 20 || raw.length >= 20,
    extractionMethod: opts.extractionMethod || 'paste',
    productionPipeline: true,
    pipelineVersion: 'block-v1-safe',
  });
}

/**
 * Extraction failure object for extractFromFileDetailed.
 * @param {string} inputKind
 * @param {unknown} err
 * @param {object} [extra]
 */
export function buildExtractionSafeFallback(inputKind, err, extra = {}) {
  const msg = String(
    err && typeof err === 'object' && 'message' in err ? err.message : err || 'EXTRACTION_FAILED'
  );
  return createStageResult({
    success: false,
    data: {
      text: '',
      method: 'failed',
      fileType: inputKind || 'unknown',
      enterprise: {
        rawExtraction: '',
        cleanedText: '',
        lines: [],
        method: 'failed',
        metadata: { extractionFailed: true },
      },
      ...extra,
    },
    warnings: ['EXTRACTION_SAFE_FALLBACK'],
    errors: [msg],
  });
}

/**
 * PDF export safe result.
 * @param {string[]} errors
 */
export function buildPdfExportSafeResult(errors = []) {
  return {
    ok: false,
    success: false,
    errors: Array.isArray(errors) ? errors.map(String) : ['PDF_EXPORT_FAILED'],
    warnings: ['PDF_EXPORT_SAFE_FALLBACK'],
    data: {},
  };
}
