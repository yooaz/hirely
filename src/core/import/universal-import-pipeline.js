/**
 * Universal import pipeline — honest outcomes + structured logging per file.
 *
 * Rules:
 * - selectedTextLength >= 300 → parse path
 * - scanned PDF with nativeTextLength === 0 → never stop on native alone; use OCR usability
 * - selectedTextLength < 300 and OCR not usable → IMPORT_NEEDS_PASTE
 * - Never fake success; never silent fail
 */

import { hirelyProductLog } from '../runtime/hirely-debug.js';
import { IMPORT_STATE } from './import-state.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
  selectedImportTextLength,
} from './real-cv-import-root.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from './ocr-fallback-v1.js';
import {
  assessOcrImportUsability,
  effectiveImportTextLength,
  isScannedPdfWithoutNativeText,
} from './ocr-import-usability.js';

export const UNIVERSAL_IMPORT_PIPELINE_VERSION = 'UNIVERSAL_IMPORT_PIPELINE_V1';

/**
 * @param {object} [ctx]
 */
export function inferIsScanned(ctx = {}) {
  const sourceType = String(ctx.fileType || ctx.sourceType || '').toLowerCase();
  const method = String(ctx.method || ctx.extractionMethod || '').toLowerCase();
  const pdfEx = ctx.pdfExtraction || {};
  return (
    sourceType === 'pdf_scanned' ||
    sourceType === 'pdf_image' ||
    sourceType === 'image' ||
    method === 'ocr' ||
    method === 'image-ocr' ||
    pdfEx.route === 'ocr_full' ||
    pdfEx.fileType === 'pdf_scanned' ||
    pdfEx.routing?.routingReason === 'scanned'
  );
}

/**
 * @param {object} [ctx]
 */
export function inferIsProtected(ctx = {}) {
  const blob = [
    ctx.pdfExtraction?.why,
    ctx.pdfExtraction?.decision,
    ...(ctx.errors || []),
    ...(ctx.warnings || []),
    String(ctx.fileName || ''),
  ].join(' ');
  return /encrypt|password|protected|protég|\/encrypt\b/i.test(blob);
}

/**
 * @param {object} [extracted]
 */
export function collectUniversalImportMetrics(extracted = {}) {
  const ent = extracted.enterprise || {};
  const meta = ent.metadata || {};
  const mf = meta.multiFormat || ent.multiFormat || meta;
  const pdfEx = extracted.pdfExtraction || ent.pdfExtraction || {};
  const raw = String(extracted.rawText || '').trim();
  const clean = String(extracted.cleanedText || '').trim();
  const selectedTextLength = selectedImportTextLength(raw, clean);
  const effectiveTextLength = effectiveImportTextLength(extracted);
  const usability = assessOcrImportUsability(extracted);
  const fileType =
    String(mf.sourceType || extracted.fileType || meta.fileType || '').trim() ||
    String(extracted.inputKind || '');

  return {
    nativeTextLength:
      Number(mf.nativeTextLength ?? meta.nativeTextLength ?? pdfEx.nativeTextLength ?? 0) ||
      0,
    ocrTextLength:
      Number(mf.ocrTextLength ?? meta.ocrTextLength ?? pdfEx.ocrTextLength ?? 0) || 0,
    selectedTextLength,
    fileType,
    pageCount:
      Number(pdfEx.pageCount ?? meta.pages ?? ent.pages ?? mf.pageCount ?? 0) || 0,
    isScanned: inferIsScanned({
      fileType,
      sourceType: fileType,
      method: extracted.extractionMethod || ent.method,
      pdfExtraction: pdfEx,
    }),
    isScannedWithoutNativeText: isScannedPdfWithoutNativeText({
      fileType,
      nativeTextLength:
        Number(mf.nativeTextLength ?? meta.nativeTextLength ?? pdfEx.nativeTextLength ?? 0) || 0,
      extractionMethod: extracted.extractionMethod || ent.method,
      enterprise: ent,
      pdfExtraction: pdfEx,
      ocrAttempted: extracted.ocrAttempted === true || usability.ocrAttempted,
    }),
    ocrAttempted: extracted.ocrAttempted === true || usability.ocrAttempted,
    ocrUsable: extracted.ocrUsable === true || usability.usable,
    effectiveTextLength,
    isProtected: inferIsProtected({
      pdfExtraction: pdfEx,
      errors: extracted.errors,
      warnings: extracted.warnings,
      fileName: extracted.file?.name,
    }),
    selectedSource: mf.selectedSource || meta.extractionSource || '',
    minRequired: REAL_CV_IMPORT_MIN_CHARS,
  };
}

/**
 * @param {object} metrics
 * @param {string} [importState]
 */
export function resolveUniversalImportDecision(metrics, importState = '') {
  const effective = Math.max(
    Number(metrics.effectiveTextLength) || 0,
    Number(metrics.selectedTextLength) || 0,
    Number(metrics.ocrTextLength) || 0
  );
  const ocrUsable = metrics.ocrUsable === true;
  const scannedNoNative = metrics.isScannedWithoutNativeText === true;

  const shouldParse = effective >= REAL_CV_IMPORT_MIN_CHARS;
  let status = importState || IMPORT_STATE.IMPORT_IDLE;

  if (ocrUsable || effective > OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
    if (shouldParse) {
      status = IMPORT_STATE.IMPORT_READY;
    } else if (
      status === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
      status === IMPORT_STATE.IMPORT_IDLE ||
      status === IMPORT_STATE.IMPORT_READING ||
      status === IMPORT_STATE.IMPORT_EXTRACTING
    ) {
      status = IMPORT_STATE.IMPORT_PARTIAL;
    }
  } else if (!shouldParse && !(scannedNoNative && metrics.ocrAttempted === false && metrics.ocrTextLength === 0)) {
    if (!scannedNoNative || metrics.ocrAttempted === true) {
      status = IMPORT_STATE.IMPORT_NEEDS_PASTE;
    }
  } else if (
    shouldParse &&
    (!status ||
      status === IMPORT_STATE.IMPORT_IDLE ||
      status === IMPORT_STATE.IMPORT_READING ||
      status === IMPORT_STATE.IMPORT_EXTRACTING ||
      status === IMPORT_STATE.IMPORT_PARSING)
  ) {
    status = IMPORT_STATE.IMPORT_READY;
  }

  return { shouldParse, status, effectiveTextLength: effective, ocrUsable };
}

/**
 * @param {object} [extracted]
 * @param {object} [outcome]
 */
export function buildUniversalImportLog(extracted = {}, outcome = {}) {
  const metrics = collectUniversalImportMetrics(extracted);
  const status =
    outcome.importState ||
    extracted.importState ||
    metrics.status ||
    IMPORT_STATE.IMPORT_IDLE;
  const decision = resolveUniversalImportDecision(metrics, status);

  return {
    version: UNIVERSAL_IMPORT_PIPELINE_VERSION,
    fileName: extracted.file?.name || outcome.fileName || '',
    ...metrics,
    status: status || decision.status,
    shouldParse: decision.shouldParse,
    hasResumeData: outcome.resumeData != null,
    failureReason:
      outcome.importFailureReason ||
      extracted.importFailureReason ||
      outcome.extractionMeta?.failureReason ||
      '',
  };
}

/**
 * @param {object} log
 */
export function logUniversalImportPipeline(log) {
  hirelyProductLog('UNIVERSAL_IMPORT_PIPELINE', log);
  return log;
}

/**
 * Attach universal import log to any terminal import result.
 * @param {object} result
 * @param {object} [extracted]
 */
export function attachUniversalImportMeta(result, extracted = {}) {
  const log = buildUniversalImportLog(
    {
      ...extracted,
      rawText: extracted.rawText ?? result.rawText,
      cleanedText: extracted.cleanedText ?? result.cleanedText,
      fileType: extracted.fileType ?? result.fileType,
      extractionMethod: extracted.extractionMethod ?? result.extractionMethod,
      enterprise: extracted.enterprise ?? result.enterprise,
      pdfExtraction: extracted.pdfExtraction ?? result.pdfExtraction,
      errors: extracted.errors ?? result.errors,
      warnings: extracted.warnings ?? result.warnings,
      importFailureReason:
        extracted.importFailureReason ?? result.importFailureReason,
      importState: extracted.importState ?? result.importState,
      file: extracted.file ?? result.file,
    },
    result
  );
  logUniversalImportPipeline(log);
  return {
    ...result,
    extractionMeta: {
      ...(result.extractionMeta || {}),
      universalImport: log,
    },
    universalImportLog: log,
  };
}

/**
 * Enforce 300-char gate — thin text never returns IMPORT_READY unless OCR is usable on scans.
 * @param {string} importState
 * @param {number} selectedTextLength
 * @param {{ ocrUsable?: boolean, isScannedWithoutNativeText?: boolean }} [opts]
 */
export function enforceTextLengthGate(importState, selectedTextLength, opts = {}) {
  if (selectedTextLength >= REAL_CV_IMPORT_MIN_CHARS) return importState;
  if (opts.ocrUsable === true) {
    return importState === IMPORT_STATE.IMPORT_READY
      ? IMPORT_STATE.IMPORT_PARTIAL
      : importState || IMPORT_STATE.IMPORT_PARTIAL;
  }
  if (opts.isScannedWithoutNativeText === true && importState === IMPORT_STATE.IMPORT_NEEDS_PASTE) {
    return IMPORT_STATE.IMPORT_PARTIAL;
  }
  if (importState === IMPORT_STATE.IMPORT_READY) {
    return IMPORT_STATE.IMPORT_NEEDS_PASTE;
  }
  return importState || IMPORT_STATE.IMPORT_NEEDS_PASTE;
}
