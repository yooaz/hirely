/**
 * Legacy import status strings + mapping to deterministic IMPORT_STATE.
 */

import {
  IMPORT_STATE,
  importStateAllowsParser,
  importStateNeedsPaste,
} from './import-state.js';
import { OCR_QUALITY_FAIL_MSG } from '../extraction/ocr-quality-score.js';
import {
  OCR_PARTIAL_REVIEW_MSG,
  OCR_TIMEOUT_USER_MSG,
} from '../extraction/pdf-extraction-timeout.js';
import {
  IMPORT_FALLBACK_UX_LEAD,
  IMPORT_FALLBACK_UX_TITLE,
} from './import-fallback-ux.js';
import { OCR_FAILURE_PASTE_LEAD } from './v1-import-constants.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_RENDER_MIN_CHARS,
} from './real-cv-import-constants.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from './ocr-fallback-v1.js';
import {
  assessOcrImportUsability,
  hydrateExtractedImportText,
  importMustNotPasteAfterUsableOcr,
  importMustNotStopOnNativeEmpty,
  effectiveImportTextLength,
} from './ocr-import-usability.js';

/** @deprecated Use IMPORT_STATE — kept for extraction resolve + tests */
export const IMPORT_STATUS = {
  IMPORT_SUCCESS: 'IMPORT_SUCCESS',
  PARTIAL_TEXT_RECOVERED: 'PARTIAL_TEXT_RECOVERED',
  PDF_OCR_TIMEOUT: 'PDF_OCR_TIMEOUT',
  PDF_TEXT_EMPTY: 'PDF_TEXT_EMPTY',
  PASTE_FALLBACK_REQUIRED: 'PASTE_FALLBACK_REQUIRED',
};

const OCR_TIMEOUT_RE =
  /OCR_TIMEOUT|OCR du PDF trop lent|trop lent|Lecture automatique impossible/i;
const OCR_QUALITY_RE = /OCR_QUALITY|scanné ou mal orienté|mal orienté/i;
const MIN_SUCCESS_CHARS = REAL_CV_IMPORT_RENDER_MIN_CHARS;

/**
 * @param {string} legacy
 * @returns {string}
 */
export function mapLegacyStatusToImportState(legacy) {
  switch (legacy) {
    case IMPORT_STATUS.IMPORT_SUCCESS:
      return IMPORT_STATE.IMPORT_READY;
    case IMPORT_STATUS.PARTIAL_TEXT_RECOVERED:
      return IMPORT_STATE.IMPORT_PARTIAL;
    case IMPORT_STATUS.PDF_OCR_TIMEOUT:
    case IMPORT_STATUS.PDF_TEXT_EMPTY:
    case IMPORT_STATUS.PASTE_FALLBACK_REQUIRED:
      return IMPORT_STATE.IMPORT_NEEDS_PASTE;
    default:
      return IMPORT_STATE.IMPORT_FAILED;
  }
}

/**
 * @param {string} importState
 * @returns {string}
 */
export function mapImportStateToLegacy(importState) {
  switch (importState) {
    case IMPORT_STATE.IMPORT_READY:
      return IMPORT_STATUS.IMPORT_SUCCESS;
    case IMPORT_STATE.IMPORT_PARTIAL:
      return IMPORT_STATUS.PARTIAL_TEXT_RECOVERED;
    case IMPORT_STATE.IMPORT_NEEDS_PASTE:
      return IMPORT_STATUS.PASTE_FALLBACK_REQUIRED;
    case IMPORT_STATE.IMPORT_FAILED:
      return IMPORT_STATUS.PASTE_FALLBACK_REQUIRED;
    default:
      return IMPORT_STATUS.PASTE_FALLBACK_REQUIRED;
  }
}

/**
 * @param {string} rawText
 * @param {{ errors?: string[], method?: string, extractionMethod?: string, enterprise?: object, ocrUsable?: boolean, ocrAttempted?: boolean, fileType?: string, cleanedText?: string }} [ctx]
 * @returns {string} IMPORT_STATE
 */
export function resolveImportState(rawText, ctx = {}) {
  return mapLegacyStatusToImportState(resolveImportStatus(rawText, ctx));
}

/**
 * Final import status — OCR usability wins over native text for scanned PDFs.
 * nativeTextLength === 0 is expected on image-only PDFs and must never alone force paste.
 * @param {string} rawText
 * @param {{ errors?: string[], method?: string, extractionMethod?: string, enterprise?: object, ocrUsable?: boolean, ocrAttempted?: boolean, fileType?: string, cleanedText?: string }} [ctx]
 */
export function resolveImportStatus(rawText, ctx = {}) {
  const hydrated = hydrateExtractedImportText({
    rawText,
    cleanedText: ctx.cleanedText,
    enterprise: ctx.enterprise,
    extractionMethod: ctx.method || ctx.extractionMethod,
    ocrAttempted: ctx.ocrAttempted,
    ocrUsable: ctx.ocrUsable,
    fileType: ctx.fileType,
  });
  const raw = String(hydrated.rawText || hydrated.cleanedText || rawText || '').trim();
  const effectiveLen = Math.max(raw.length, effectiveImportTextLength(hydrated));
  const usability = assessOcrImportUsability(hydrated, ctx);
  const errors = ctx.errors || [];
  const errBlob = errors.join(' ');

  if (OCR_TIMEOUT_RE.test(errBlob)) {
    if (importMustNotPasteAfterUsableOcr(hydrated)) {
      return IMPORT_STATUS.PARTIAL_TEXT_RECOVERED;
    }
    return effectiveLen >= MIN_SUCCESS_CHARS
      ? IMPORT_STATUS.PARTIAL_TEXT_RECOVERED
      : IMPORT_STATUS.PDF_OCR_TIMEOUT;
  }

  if (OCR_QUALITY_RE.test(errBlob)) {
    if (importMustNotPasteAfterUsableOcr(hydrated)) {
      return IMPORT_STATUS.PARTIAL_TEXT_RECOVERED;
    }
    return IMPORT_STATUS.PDF_TEXT_EMPTY;
  }

  if (effectiveLen >= REAL_CV_IMPORT_MIN_CHARS) {
    return IMPORT_STATUS.IMPORT_SUCCESS;
  }

  if (usability.usable || ctx.ocrUsable === true) {
    return IMPORT_STATUS.PARTIAL_TEXT_RECOVERED;
  }

  if (importMustNotStopOnNativeEmpty(hydrated)) {
    return IMPORT_STATUS.PARTIAL_TEXT_RECOVERED;
  }

  if (/^(ocr|pdf-ocr|mixed)$/i.test(String(ctx.method || ctx.extractionMethod || ''))) {
    if (effectiveLen > OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
      return IMPORT_STATUS.PARTIAL_TEXT_RECOVERED;
    }
    if (effectiveLen >= REAL_CV_IMPORT_RENDER_MIN_CHARS) {
      return IMPORT_STATUS.PARTIAL_TEXT_RECOVERED;
    }
  }

  return IMPORT_STATUS.PASTE_FALLBACK_REQUIRED;
}

/**
 * @param {string} status — legacy or IMPORT_STATE
 */
export function importStatusRequiresPasteFallback(status) {
  if (Object.values(IMPORT_STATE).includes(status)) {
    return importStateNeedsPaste(status);
  }
  return (
    status === IMPORT_STATUS.PDF_OCR_TIMEOUT ||
    status === IMPORT_STATUS.PDF_TEXT_EMPTY ||
    status === IMPORT_STATUS.PASTE_FALLBACK_REQUIRED
  );
}

/**
 * @param {string} status — legacy or IMPORT_STATE
 */
export function importStatusAllowsParser(status) {
  if (Object.values(IMPORT_STATE).includes(status)) {
    return importStateAllowsParser(status);
  }
  return (
    status === IMPORT_STATUS.IMPORT_SUCCESS ||
    status === IMPORT_STATUS.PARTIAL_TEXT_RECOVERED
  );
}

export function ocrRecoveredMessage() {
  return 'Texte récupéré, utiliser ce résultat ?';
}

export const IMPORT_FALLBACK_TITLE = IMPORT_FALLBACK_UX_TITLE;

/** Shown when OCR could not read enough text from a scanned PDF. */
export const IMPORT_OCR_FAILURE_LEAD = OCR_FAILURE_PASTE_LEAD;

export const IMPORT_FALLBACK_LEAD =
  'Ce PDF semble être un scan ou une image. Collez le texte du CV, importez un DOCX/TXT, ou réessayez l\u2019OCR.';

/** Shown when PDF/OCR extraction exceeds the hard time budget. */
export const IMPORT_TIMEOUT_LEAD = OCR_TIMEOUT_USER_MSG;

export function pasteFallbackMessage(status) {
  const s = String(status || '').trim();
  if (s === IMPORT_STATUS.PDF_TEXT_EMPTY || s === 'PDF_TEXT_EMPTY') {
    return IMPORT_OCR_FAILURE_LEAD;
  }
  if (s === IMPORT_STATUS.PDF_OCR_TIMEOUT || s === 'PDF_OCR_TIMEOUT') {
    return IMPORT_TIMEOUT_LEAD;
  }
  return IMPORT_FALLBACK_UX_LEAD;
}

export function importStatusLogLabel(status) {
  return status || IMPORT_STATE.IMPORT_NEEDS_PASTE;
}

export {
  IMPORT_STATE,
  importStateAllowsParser,
  importStateNeedsPaste,
} from './import-state.js';
