/**
 * HIRELY OCR Fallback V1 — PDF only.
 * Native pdf.js first; OCR when native < 300 chars; paste when OCR <= 100 chars.
 */

/** Native text layer sufficient — skip OCR. */
export const OCR_FALLBACK_V1_NATIVE_MIN = 300;

/** OCR must exceed this to reach Review (paste if <=). */
export const OCR_FALLBACK_V1_PASTE_MAX_CHARS = 100;

/** Hard OCR budget — single pass, no retry loop. */
export const OCR_FALLBACK_V1_OCR_MAX_MS = 20000;

/**
 * @param {string} text
 */
export function ocrFallbackV1NativeSufficient(text) {
  return String(text || '').trim().length >= OCR_FALLBACK_V1_NATIVE_MIN;
}

/**
 * @param {string} text
 * @param {{ ocrAttempted?: boolean }} [ctx]
 */
export function ocrFallbackV1TextUsable(text, ctx = {}) {
  const len = String(text || '').trim().length;
  if (ctx.ocrAttempted) return len > OCR_FALLBACK_V1_PASTE_MAX_CHARS;
  return len >= OCR_FALLBACK_V1_NATIVE_MIN;
}

/**
 * @param {string} text
 */
export function ocrFallbackV1NeedsPaste(text) {
  return String(text || '').trim().length <= OCR_FALLBACK_V1_PASTE_MAX_CHARS;
}
