/**
 * PDF OCR cache — compatibility facade (boot-safe).
 *
 * Static re-exports only — no imports, no import-run-guard, no side effects.
 * Implementation lives in pdf-ocr-cache-store.js (leaf module).
 *
 * Do not slim this facade: extraction/index.js and browser boot depend on every
 * symbol below. Product file settlement uses pdf-ocr-settlement.js instead.
 */

export {
  resolveOcrPreprocessingMode,
  getPdfOcrFileBaseKey,
  getPdfOcrCacheKey,
  getCachedPdfOcrIfReady,
  clearPdfOcrCache,
  markPdfOcrTimedOut,
  clearPdfOcrTimedOut,
  isPdfOcrTimedOut,
  getOrRunCachedPdfOcr,
  setOcrInFlightPromise,
  clearOcrInFlightPromise,
  peekOcrInFlightPromise,
  awaitOcrSettlementForFile,
} from './pdf-ocr-cache-store.js';
