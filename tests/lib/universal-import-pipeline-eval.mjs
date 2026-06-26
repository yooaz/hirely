/**
 * Universal import pipeline — shared QA evaluation.
 */
import { IMPORT_STATE } from '../../src/core/import/import-status.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../../src/core/import/real-cv-import-root.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from '../../src/core/import/ocr-fallback-v1.js';
import { classifyImportOutcome } from './import-outcome-classifier.mjs';

export const UNIVERSAL_IMPORT_EVAL_VERSION = 'UNIVERSAL_IMPORT_PIPELINE_EVAL_V2';

const FORBIDDEN = new Set(['IMPORT_CRASH', 'IMPORT_STUCK']);

/**
 * @param {object} row
 */
export function rowIsExactTranscriptionResult(row) {
  const canon = row.canonical || row;
  return (
    canon.exactTranscription === true ||
    canon.importStatus === 'EXACT_TRANSCRIPTION_READY' ||
    Boolean(canon.transcription)
  );
}

/**
 * @param {object} row
 */
export function rowExactTranscriptionTextLength(row) {
  const canon = row.canonical || row;
  const plain = String(canon.transcription?.plain_text || canon.rawText || '').trim();
  const lines = Number(canon.transcription?.line_count) || 0;
  return Math.max(plain.length, lines > 0 ? 1 : 0);
}

/**
 * @param {object} row
 */
export function rowHasOcrUsableOutput(row) {
  const log = extractPipelineLog(row);
  const canon = row.canonical || row;
  return Boolean(
    log?.ocrUsable ||
      canon.ocrUsable ||
      (row.ocrTextLength ?? log?.ocrTextLength ?? 0) > OCR_FALLBACK_V1_PASTE_MAX_CHARS
  );
}

/**
 * @param {object} row
 */
export function extractPipelineLog(row) {
  return (
    row.universalImportLog ||
    row.extractionMeta?.universalImport ||
    row.canonical?.universalImportLog ||
    row.canonical?.extractionMeta?.universalImport ||
    null
  );
}

/**
 * @param {object} row
 */
export function rowHasRequiredLogFields(row) {
  const log = extractPipelineLog(row);
  if (!log) return false;
  const required = [
    'nativeTextLength',
    'ocrTextLength',
    'selectedTextLength',
    'fileType',
    'pageCount',
    'isScanned',
    'isProtected',
    'status',
  ];
  return required.every((k) => log[k] !== undefined && log[k] !== null);
}

/**
 * @param {object} row
 */
export function rowEnforcesTextLengthRule(row) {
  const len = row.selectedTextLength ?? extractPipelineLog(row)?.selectedTextLength ?? 0;
  const status = row.qaOutcome || row.importState || '';
  const exact = rowIsExactTranscriptionResult(row);
  const ocrUsable = rowHasOcrUsableOutput(row);
  const effectiveLen = exact ? Math.max(len, rowExactTranscriptionTextLength(row)) : len;

  if (effectiveLen < REAL_CV_IMPORT_MIN_CHARS && status === IMPORT_STATE.IMPORT_READY) {
    if (exact && (ocrUsable || effectiveLen > OCR_FALLBACK_V1_PASTE_MAX_CHARS)) {
      return true;
    }
    if (ocrUsable) return true;
    return false;
  }
  if (effectiveLen >= REAL_CV_IMPORT_MIN_CHARS && status === IMPORT_STATE.IMPORT_NEEDS_PASTE) {
    return row.hasResumeData !== true;
  }
  return true;
}

/**
 * @param {object} row
 */
export function rowHasClearPasteReason(row) {
  if (row.qaOutcome !== IMPORT_STATE.IMPORT_NEEDS_PASTE) return true;
  const log = extractPipelineLog(row);
  const hasReason =
    Boolean(row.importFallback?.reason || row.importFallback?.lead) ||
    Boolean(log?.failureReason) ||
    (row.errors || []).length > 0 ||
    (row.warnings || []).length > 0;
  return hasReason;
}

/**
 * @param {object} row
 * @param {string} expectStatus
 */
export function evaluateUniversalImportCase(row, expectStatus) {
  const reasons = [];
  const outcome = classifyImportOutcome(row);

  if (FORBIDDEN.has(outcome)) reasons.push(outcome);
  if (!rowHasRequiredLogFields(row)) reasons.push('missing_pipeline_log');
  if (!rowEnforcesTextLengthRule({ ...row, qaOutcome: outcome })) {
    reasons.push('text_length_rule_violation');
  }
  if (row.resumeData && outcome === IMPORT_STATE.IMPORT_NEEDS_PASTE && !row.selectedTextLength) {
    reasons.push('fake_paste_with_resume');
  }
  if (!row.resumeData && outcome === IMPORT_STATE.IMPORT_READY && !rowIsExactTranscriptionResult(row)) {
    reasons.push('fake_ready_without_resume');
  }

  if (expectStatus === IMPORT_STATE.IMPORT_READY) {
    if (outcome !== IMPORT_STATE.IMPORT_READY) reasons.push(`expected_READY_got_${outcome}`);
    const exact = rowIsExactTranscriptionResult(row);
    const effectiveLen = exact
      ? Math.max(row.selectedTextLength ?? 0, rowExactTranscriptionTextLength(row))
      : row.selectedTextLength ?? 0;
    if (
      effectiveLen < REAL_CV_IMPORT_MIN_CHARS &&
      !rowHasOcrUsableOutput(row) &&
      !(exact && effectiveLen > OCR_FALLBACK_V1_PASTE_MAX_CHARS)
    ) {
      reasons.push('ready_below_300');
    }
    if (!row.resumeData && !exact) reasons.push('ready_no_resume');
  }

  if (expectStatus === IMPORT_STATE.IMPORT_NEEDS_PASTE) {
    if (outcome !== IMPORT_STATE.IMPORT_NEEDS_PASTE) {
      reasons.push(`expected_PASTE_got_${outcome}`);
    }
    if (row.resumeData) reasons.push('paste_has_resume');
    if (!rowHasClearPasteReason({ ...row, qaOutcome: outcome })) {
      reasons.push('paste_no_clear_reason');
    }
  }

  return {
    outcome,
    pass: reasons.length === 0,
    reasons,
  };
}
