/**
 * Hirely V1 scope freeze — supported formats and disabled product features.
 */

export const V1_SCOPE_LOCK_VERSION = 'V1_SCOPE_LOCK_V1';

/** @readonly */
export const V1_SUPPORTED_FORMATS = Object.freeze([
  'text_pdf',
  'docx',
  'txt',
  'pasted_text',
]);

/** @readonly */
export const V1_UNSUPPORTED_FEATURES = Object.freeze([
  'ocr',
  'scanned_pdf_automatic',
  'image_cv_automatic',
  'ai_rewriting',
  'ats_intelligence_blockers',
]);

export function isV1ScopeLocked() {
  if (globalThis.HIRELY_V1_SCOPE_LOCK === false) return false;
  return (
    globalThis.HIRELY_V1_SCOPE_LOCK === true ||
    globalThis.HIRELY_V1_IMPORT === true ||
    globalThis.HIRELY_SIMPLE_IMPORT_MODE === true
  );
}

export function isV1AtsBlockersDisabled() {
  return isV1ScopeLocked() || globalThis.HIRELY_V1_NO_ATS_BLOCKERS === true;
}
