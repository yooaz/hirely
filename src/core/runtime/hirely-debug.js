/**
 * Hirely debug gate — verbose logs only when ?debug=true (or HIRELY_DEBUG).
 */

/** @type {Set<string>} */
export const PRODUCT_IMPORT_LOGS = new Set([
  'IMPORT_STARTED',
  'EXTRACTION_DONE',
  'OCR_DONE',
  'OCR_TIMEOUT',
  'PARSER_DONE',
  'FINAL_RESUME_READY',
  'REVIEW_SCREEN_VISIBLE',
  'RENDER_DONE',
  'IMPORT_FINAL',
]);

/**
 * @returns {boolean}
 */
export function isHirelyDebug() {
  if (typeof globalThis !== 'undefined') {
    if (globalThis.HIRELY_DEBUG === true) return true;
    if (globalThis.HIRELY_DEBUG === false) return false;
  }
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === 'true' || q === '1' || q === 'forensic') return true;
  }
  return false;
}

/**
 * @param {...unknown} args
 */
export function hirelyDebugLog(...args) {
  if (isHirelyDebug()) console.log(...args);
}

/**
 * @param {...unknown} args
 */
export function hirelyDebugWarn(...args) {
  if (isHirelyDebug()) console.warn(...args);
}

/**
 * @param {...unknown} args
 */
export function hirelyDebugGroup(...args) {
  if (isHirelyDebug()) console.groupCollapsed(...args);
}

/**
 * @param {string} step
 * @returns {boolean}
 */
export function isProductImportLog(step) {
  const key = String(step || '').split(/\s/)[0];
  return PRODUCT_IMPORT_LOGS.has(key);
}

/**
 * Product console — always visible in normal mode (not gated by ?debug=true).
 * @param {string} step
 * @param {object} [detail]
 */
export function hirelyProductLog(step, detail = {}) {
  const key = String(step || '').split(/\s/)[0];
  if (!PRODUCT_IMPORT_LOGS.has(key) && key !== 'CORE_BOOT_OK') return;
  if (isHirelyDebug()) return;
  if (detail && Object.keys(detail).length) {
    console.log(key, detail);
  } else {
    console.log(key);
  }
}
