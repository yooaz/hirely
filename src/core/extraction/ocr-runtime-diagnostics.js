/**
 * Browser OCR runtime diagnostics — structured logs for import blocker audits.
 */

import { logExtractionStep } from './file-buffer.js';
import { TESSERACT_VENDOR_PATHS } from '../../vendor/tesseract-runtime.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';

const diag = {
  OCR_ASSET_PATH: TESSERACT_VENDOR_PATHS.main,
  OCR_WORKER_PATH: TESSERACT_VENDOR_PATHS.worker,
  OCR_WASM_PATH: `${TESSERACT_VENDOR_PATHS.core}/tesseract-core-simd-lstm.wasm`,
  OCR_LANG_PATH: TESSERACT_VENDOR_PATHS.lang,
  OCR_WORKER_LOADED: false,
  OCR_WASM_LOADED: false,
  OCR_LANG_LOADED: false,
  OCR_FIRST_PAGE_STARTED: false,
  OCR_FIRST_PAGE_TEXT_LENGTH: 0,
  OCR_FIRST_PAGE_CONFIDENCE: 0,
  OCR_FINAL_TEXT_LENGTH: 0,
  OCR_FINAL_CONFIDENCE: 0,
  OCR_FAIL_REASON: '',
};

/**
 * @returns {Record<string, string|number|boolean>}
 */
export function getOcrRuntimeDiagnostics() {
  return { ...diag };
}

/**
 * @param {string} key
 * @param {string|number|boolean} value
 */
export function setOcrDiagnostic(key, value) {
  if (Object.prototype.hasOwnProperty.call(diag, key)) {
    diag[key] = value;
  }
  logExtractionStep(key, String(value));
  hirelyProductLog(key, value);
  publishOcrDiagnostics();
}

export function publishOcrDiagnostics() {
  try {
    globalThis.HIRELY_OCR_DIAGNOSTICS = getOcrRuntimeDiagnostics();
  } catch {
    /* ignore */
  }
}

export function logOcrDiagnosticsSnapshot() {
  for (const [k, v] of Object.entries(diag)) {
    logExtractionStep(k, String(v));
  }
  publishOcrDiagnostics();
}

/**
 * @param {{ worker?: boolean, wasm?: boolean, lang?: boolean }} flags
 */
export function markOcrAssetsLoaded(flags = {}) {
  if (flags.worker) setOcrDiagnostic('OCR_WORKER_LOADED', true);
  if (flags.wasm) setOcrDiagnostic('OCR_WASM_LOADED', true);
  if (flags.lang) setOcrDiagnostic('OCR_LANG_LOADED', true);
}

/**
 * @param {string} text
 * @param {Array<{ confidence?: number }>} [lines]
 */
export function recordOcrFirstPageResult(text, lines = []) {
  const len = String(text || '').trim().length;
  setOcrDiagnostic('OCR_FIRST_PAGE_STARTED', true);
  setOcrDiagnostic('OCR_FIRST_PAGE_TEXT_LENGTH', len);
  const conf = averageLineConfidence(lines);
  setOcrDiagnostic('OCR_FIRST_PAGE_CONFIDENCE', conf);
}

/**
 * @param {string} text
 * @param {Array<{ confidence?: number }>} [lines]
 */
export function recordOcrFinalResult(text, lines = []) {
  const len = String(text || '').trim().length;
  const conf = averageLineConfidence(lines);
  setOcrDiagnostic('OCR_FINAL_TEXT_LENGTH', len);
  setOcrDiagnostic('OCR_FINAL_CONFIDENCE', conf);
  logOcrDiagnosticsSnapshot();
}

/**
 * @param {string} reason
 */
export function setOcrFailReason(reason) {
  setOcrDiagnostic('OCR_FAIL_REASON', String(reason || '').trim());
}

function averageLineConfidence(lines) {
  const list = lines || [];
  if (!list.length) return 0;
  const sum = list.reduce((a, ln) => a + (Number(ln?.confidence) || 0), 0);
  return Math.round(sum / list.length);
}

publishOcrDiagnostics();
