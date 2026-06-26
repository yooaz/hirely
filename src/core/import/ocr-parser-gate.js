/**
 * OCR → parser quality gate — bad scans never reach buildResumeData.
 */

import {
  evaluateOcrParserGate,
  OCR_QUALITY_FAIL_MSG,
} from '../extraction/ocr-quality-score.js';
import { IMPORT_STATE } from './import-state.js';
import { mapImportStateToLegacy } from './import-status.js';
import { buildImportFallbackMeta } from './import-fallback-ux.js';
import {
  REAL_CV_IMPORT_FAILURE_REASONS,
  linesToRejectedGarbage,
} from './real-cv-import-root.js';
import { isUnblockEverythingActive } from './unblock-everything.js';
import { canContinueWithRawText } from './simple-import-mode.js';
import { isOcrAutoImportEnabled } from './ocr-auto-import.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from './ocr-fallback-v1.js';
import { assessOcrImportUsability, importMustNotPasteAfterUsableOcr, guardPasteImportResult } from './ocr-import-usability.js';

/**
 * @param {object} [ctx]
 */
export function isOcrSourcedImport(ctx = {}) {
  const method = String(ctx.method || ctx.extractionMethod || '').toLowerCase();
  const fileType = String(ctx.fileType || ctx.enterprise?.metadata?.fileType || '').toLowerCase();
  const entMethod = String(ctx.enterprise?.method || '').toLowerCase();
  return (
    method === 'ocr' ||
    method === 'image-ocr' ||
    method === 'pdf-ocr' ||
    method === 'mixed' ||
    entMethod === 'ocr' ||
    entMethod === 'mixed' ||
    fileType === 'pdf_scanned' ||
    fileType === 'image' ||
    ctx.enterprise?.metadata?.ocrDocument === true
  );
}

/**
 * @param {string} text
 * @param {object} [ctx]
 */
export function assessOcrBeforeParser(text, ctx = {}) {
  if (!isOcrSourcedImport(ctx)) {
    return { pass: true, skipped: true, message: '' };
  }
  const usability = assessOcrImportUsability({
    rawText: text,
    cleanedText: text,
    enterprise: ctx.enterprise,
    extractionMethod: ctx.method || ctx.extractionMethod,
    fileType: ctx.fileType,
    ocrAttempted: true,
  });
  if (usability.usable) {
    return {
      pass: true,
      skipped: false,
      ocrUsabilityBypass: true,
      qualityScore: 80,
      message: '',
    };
  }
  const gate = evaluateOcrParserGate(text, ctx.lines || ctx.enterprise?.lines);
  if (isOcrAutoImportEnabled() && String(text || '').trim().length > OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
    return {
      ...gate,
      pass: true,
      skipped: false,
      autoOcrBypass: true,
      lowConfidence: gate.qualityScore < 60,
    };
  }
  if (isUnblockEverythingActive() && canContinueWithRawText(text)) {
    return { pass: true, skipped: true, message: '', unblockBypass: true, qualityScore: gate.qualityScore };
  }
  return { ...gate, skipped: false };
}

/**
 * Blocked import payload — no parser, no resumeData.
 * @param {object} gate
 * @param {object} [base]
 */
export function buildOcrParserBlockedResult(gate, base = {}) {
  if (importMustNotPasteAfterUsableOcr({ ...base, ocrAttempted: true })) {
    const hydrated = guardPasteImportResult(
      {
        ...base,
        importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
        warnings: [...(base.warnings || []), 'OCR_PARSER_GATE_BYPASSED_USABLE'],
      },
      base
    );
    return {
      ...hydrated,
      structuredResume: base.structuredResume ?? null,
      templateData: base.templateData ?? null,
      resumeData: base.resumeData ?? null,
      ocrGate: gate,
    };
  }
  const message = String(gate?.message || OCR_QUALITY_FAIL_MSG);
  const raw = String(base.rawText || base.cleanedText || '').trim();
  const cleaned = String(base.cleanedText || raw).trim();
  const fallback = buildImportFallbackMeta({
    status: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    result: base,
    ocrFailure: true,
    reason: REAL_CV_IMPORT_FAILURE_REASONS.ocr_quality,
  });
  return {
    ...base,
    rawText: raw,
    cleanedText: cleaned,
    structuredResume: null,
    templateData: null,
    resumeData: null,
    rejectedGarbage: raw ? linesToRejectedGarbage(raw) : [],
    importFailureReason: REAL_CV_IMPORT_FAILURE_REASONS.ocr_quality,
    importFallback: fallback,
    blocks: [],
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    importStatus: mapImportStateToLegacy(IMPORT_STATE.IMPORT_NEEDS_PASTE),
    warnings: [...(base.warnings || []), 'OCR_PARSER_GATE_BLOCKED'],
    errors: [...(base.errors || []), message],
    ocrGate: gate,
    extractionMeta: {
      selectedTextLength: raw.length,
      failureReason: REAL_CV_IMPORT_FAILURE_REASONS.ocr_quality,
    },
  };
}
