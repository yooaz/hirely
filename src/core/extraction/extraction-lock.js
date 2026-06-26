/**
 * Extraction lock — OCR / preprocess / PDF reading stay frozen when enabled.
 * OCR runs only when existing text length is below the threshold (scanned PDFs, images).
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../import/real-cv-import-constants.js';

export const EXTRACTION_LOCK = true;

/** Minimum chars already present before OCR is skipped while locked. */
export const EXTRACTION_LOCK_OCR_MIN_CHARS = 500;

/**
 * @returns {boolean}
 */
export function isExtractionLocked() {
  if (typeof globalThis !== 'undefined' && globalThis.HIRELY_EXTRACTION_LOCK === false) {
    return false;
  }
  if (typeof globalThis !== 'undefined' && globalThis.HIRELY_EXTRACTION_LOCK === true) {
    return true;
  }
  return EXTRACTION_LOCK;
}

/**
 * @param {number} existingTextLength
 * @param {{ weakNative?: boolean, usable?: boolean, strongTextLayer?: boolean }} [opts]
 * @returns {boolean}
 */
export function shouldRunOcrForTextLength(existingTextLength, opts = {}) {
  if (!isExtractionLocked()) return true;
  const len = Number(existingTextLength) || 0;
  // Always OCR when native is below real-CV import minimum — garbled short layers are common.
  if (len < REAL_CV_IMPORT_MIN_CHARS) return true;
  if (opts.weakNative === true) return true;
  // Garbled or weak text layers must not block OCR just because char count is high.
  if (opts.usable === false || opts.strongTextLayer === false) return true;
  return len < EXTRACTION_LOCK_OCR_MIN_CHARS;
}

/**
 * @param {string} context
 * @param {number} existingTextLength
 */
export function logExtractionLockSkip(context, existingTextLength) {
  hirelyDebugLog('HIRELY EXTRACTION_LOCK skip OCR', {
    EXTRACTION_LOCK: isExtractionLocked(),
    context,
    existingTextLength: Number(existingTextLength) || 0,
    threshold: EXTRACTION_LOCK_OCR_MIN_CHARS,
  });
}
