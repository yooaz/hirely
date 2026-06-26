/**
 * PDF OCR cache store — leaf module (no import-layer deps).
 * Boot graph: settlement → store; facade (pdf-ocr-cache.js) → store (re-export only).
 */
import { logExtractionStep } from './file-buffer.js';

/**
 * @typedef {object} OcrCacheEntry
 * @property {string} text
 * @property {import('./extracted-line.js').ExtractedLine[]} lines
 * @property {number} confidence
 * @property {number} timingMs
 * @property {number} createdAt
 */

/** @type {Map<string, OcrCacheEntry>} */
const ocrResultCache = new Map();

/** @type {Map<string, Promise<{ lines: import('./extracted-line.js').ExtractedLine[], text: string }>>} */
const ocrInFlightByFile = new Map();

/** fileBase → full cache key (latest successful entry) */
const ocrFileIndex = new Map();

/** fileBase keys where OCR already hit hard timeout — skip re-OCR until user retry */
const ocrTimedOutBases = new Set();

/**
 * @param {object} [opts]
 * @returns {string}
 */
export function resolveOcrPreprocessingMode(opts = {}) {
  if (opts.bestPass === false) return 'single';
  if (opts.fusion === true) return 'fusion';
  if (opts.fusion === false) return 'bestpass';
  try {
    if (globalThis.HIRELY_OCR_FUSION === '1') return 'fusion';
    if (globalThis.HIRELY_OCR_FUSION === '0') return 'bestpass';
  } catch {
    /* ignore */
  }
  return 'bestpass';
}

/**
 * @param {File} file
 * @returns {string|null}
 */
export function getPdfOcrFileBaseKey(file) {
  if (!file?.name) return null;
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/**
 * @param {File} file
 * @param {{ pageCount?: number, preprocessingMode?: string, opts?: object }} [ctx]
 * @returns {string|null}
 */
export function getPdfOcrCacheKey(file, ctx = {}) {
  const base = getPdfOcrFileBaseKey(file);
  if (!base) return null;
  const pageCount = Number(ctx.pageCount) || 0;
  const mode = String(ctx.preprocessingMode || resolveOcrPreprocessingMode(ctx.opts || {}));
  return `${base}|${pageCount}|${mode}`;
}

function averageLineConfidence(lines) {
  const list = lines || [];
  if (!list.length) return 0;
  const sum = list.reduce((a, ln) => a + (Number(ln?.confidence) || 0), 0);
  return Math.round(sum / list.length);
}

/**
 * @param {OcrCacheEntry|null|undefined} entry
 */
function entryTextLen(entry) {
  return String(entry?.text || '').trim().length;
}

/**
 * @param {string} fileBase
 * @param {string} key
 * @param {OcrCacheEntry} entry
 */
function rememberFileIndex(fileBase, key, entry) {
  if (!fileBase || entryTextLen(entry) <= 0) return;
  const prevKey = ocrFileIndex.get(fileBase);
  if (!prevKey) {
    ocrFileIndex.set(fileBase, key);
    return;
  }
  const prev = ocrResultCache.get(prevKey);
  if (entryTextLen(entry) >= entryTextLen(prev)) {
    ocrFileIndex.set(fileBase, key);
  }
}

/**
 * @param {string} fileBase
 */
function purgeKeysForFileBase(fileBase) {
  if (!fileBase) return;
  for (const key of [...ocrResultCache.keys()]) {
    if (key.startsWith(`${fileBase}|`)) ocrResultCache.delete(key);
  }
  for (const key of [...ocrInFlightByFile.keys()]) {
    if (key.startsWith(`${fileBase}|`)) ocrInFlightByFile.delete(key);
  }
  ocrFileIndex.delete(fileBase);
}

/**
 * @param {OcrCacheEntry} entry
 * @returns {{ lines: import('./extracted-line.js').ExtractedLine[], text: string }}
 */
function cloneCacheHit(entry) {
  return {
    lines: (entry.lines || []).map((l) => ({ ...l })),
    text: entry.text,
  };
}

/**
 * @param {File|null|undefined} file
 * @param {{ pageCount?: number, preprocessingMode?: string, opts?: object }} [ctx]
 * @returns {{ lines: import('./extracted-line.js').ExtractedLine[], text: string }|null}
 */
export function getCachedPdfOcrIfReady(file, ctx = {}) {
  const key = getPdfOcrCacheKey(file, ctx);
  const fileBase = getPdfOcrFileBaseKey(file);
  const lookupKey = key && ocrResultCache.has(key) ? key : fileBase ? ocrFileIndex.get(fileBase) : null;
  if (!lookupKey || !ocrResultCache.has(lookupKey)) return null;
  const hit = ocrResultCache.get(lookupKey);
  if (entryTextLen(hit) <= 0) return null;
  logExtractionStep('OCR_CACHE_HIT', lookupKey);
  return cloneCacheHit(hit);
}

/**
 * @param {File} [file]
 */
export function clearPdfOcrCache(file = null) {
  if (file) {
    const fileBase = getPdfOcrFileBaseKey(file);
    purgeKeysForFileBase(fileBase);
    clearPdfOcrTimedOut(file);
    return;
  }
  ocrResultCache.clear();
  ocrInFlightByFile.clear();
  ocrFileIndex.clear();
  ocrTimedOutBases.clear();
}

/**
 * @param {File|null|undefined} file
 */
export function markPdfOcrTimedOut(file) {
  const fileBase = getPdfOcrFileBaseKey(file);
  if (!fileBase) return;
  ocrTimedOutBases.add(fileBase);
  logExtractionStep('OCR_TIMED_OUT_MARKED', fileBase);
}

/**
 * @param {File|null|undefined} file
 */
export function clearPdfOcrTimedOut(file) {
  const fileBase = getPdfOcrFileBaseKey(file);
  if (fileBase) ocrTimedOutBases.delete(fileBase);
}

/**
 * @param {File|null|undefined} file
 * @returns {boolean}
 */
export function isPdfOcrTimedOut(file) {
  const fileBase = getPdfOcrFileBaseKey(file);
  return fileBase ? ocrTimedOutBases.has(fileBase) : false;
}

/**
 * @param {string} key
 * @param {string|null} fileBase
 * @param {{ lines?: import('./extracted-line.js').ExtractedLine[], text?: string }} result
 * @param {number} timingMs
 */
function storeOcrCacheResult(key, fileBase, result, timingMs) {
  const existing = ocrResultCache.get(key);
  const textLen = String(result?.text || '').trim().length;

  if (textLen > 0) {
    const entry = {
      text: result.text,
      lines: (result.lines || []).map((l) => ({ ...l })),
      confidence: averageLineConfidence(result.lines),
      timingMs,
      createdAt: Date.now(),
    };
    ocrResultCache.set(key, entry);
    rememberFileIndex(fileBase, key, entry);
    logExtractionStep('OCR_CACHE_STORE_TEXT', `${textLen}c`);
    return;
  }

  if (entryTextLen(existing) > 0) {
    logExtractionStep('OCR_CACHE_STORE_TIMEOUT_BLOCKED', key);
  }
}

/**
 * Register an in-flight OCR promise for a cache key (source of truth).
 * @param {string|null|undefined} fileKey
 * @param {Promise<{ lines?: import('./extracted-line.js').ExtractedLine[], text?: string }>|null|undefined} promise
 */
export function setOcrInFlightPromise(fileKey, promise) {
  if (!fileKey) return;
  if (promise) ocrInFlightByFile.set(fileKey, promise);
}

/**
 * Clear in-flight OCR for a cache key (identity-safe).
 * @param {string|null|undefined} fileKey
 * @param {Promise<unknown>|null|undefined} promise
 */
export function clearOcrInFlightPromise(fileKey, promise) {
  if (!fileKey) return;
  const current = ocrInFlightByFile.get(fileKey);
  if (!promise || current === promise) ocrInFlightByFile.delete(fileKey);
}

/**
 * @param {string|null|undefined} fileKey
 * @returns {Promise<{ lines: import('./extracted-line.js').ExtractedLine[], text: string }>|null}
 */
export function peekOcrInFlightPromiseByKey(fileKey) {
  return fileKey ? ocrInFlightByFile.get(fileKey) ?? null : null;
}

/**
 * Await in-flight OCR for a cache key; clears the slot when this waiter finishes.
 * @param {string|null|undefined} fileKey
 */
export async function awaitOcrSettlementForCacheKey(fileKey) {
  const p = peekOcrInFlightPromiseByKey(fileKey);
  if (!p) return null;
  try {
    return await p;
  } finally {
    clearOcrInFlightPromise(fileKey, p);
  }
}

/** @deprecated Use awaitOcrSettlementForCacheKey — alias for cache-key settlement. */
export const awaitOcrSettlementForFile = awaitOcrSettlementForCacheKey;

/**
 * @param {File|string|null|undefined} fileOrKey
 * @param {{ pageCount?: number, preprocessingMode?: string, opts?: object }} [ctx]
 * @returns {Promise<{ lines: import('./extracted-line.js').ExtractedLine[], text: string }>|null}
 */
export function peekOcrInFlightPromise(fileOrKey, ctx = {}) {
  if (typeof fileOrKey === 'string') {
    return peekOcrInFlightPromiseByKey(fileOrKey);
  }
  const key = getPdfOcrCacheKey(fileOrKey, ctx);
  if (key) {
    const hit = peekOcrInFlightPromiseByKey(key);
    if (hit) return hit;
  }
  const fileBase = getPdfOcrFileBaseKey(fileOrKey);
  if (!fileBase) return null;
  for (const [k, p] of ocrInFlightByFile.entries()) {
    if (k.startsWith(`${fileBase}|`)) return p;
  }
  return null;
}

/**
 * @param {File|null|undefined} file
 * @param {{ pageCount?: number, preprocessingMode?: string, opts?: object }} [ctx]
 * @param {() => Promise<{ lines: import('./extracted-line.js').ExtractedLine[], text: string }>} run
 */
export async function getOrRunCachedPdfOcr(file, ctx, run) {
  let cacheCtx = ctx;
  let runner = run;
  if (typeof ctx === 'function') {
    runner = ctx;
    cacheCtx = {};
  }

  const key = getPdfOcrCacheKey(file, cacheCtx);
  const fileBase = getPdfOcrFileBaseKey(file);

  if (!key) {
    logExtractionStep('OCR_CACHE_MISS', 'no-file-key');
    return runner();
  }

  if (globalThis.HIRELY_FORCE_PDF_OCR_RETRY) {
    purgeKeysForFileBase(fileBase);
    clearPdfOcrTimedOut(file);
    globalThis.HIRELY_FORCE_PDF_OCR_RETRY = false;
    logExtractionStep('OCR_CACHE_MISS', 'force-retry');
  } else if (fileBase && ocrTimedOutBases.has(fileBase)) {
    const cached = ocrResultCache.get(key);
    if (entryTextLen(cached) > 0) {
      logExtractionStep('OCR_CACHE_HIT', `${key}:after-timeout`);
      return cloneCacheHit(cached);
    }
    logExtractionStep('OCR_SKIPPED_AFTER_TIMEOUT', fileBase);
    throw Object.assign(new Error('OCR_TIMEOUT'), {
      code: 'OCR_TIMEOUT',
      importStatus: 'PDF_OCR_TIMEOUT',
      recoverable: true,
      skippedAfterTimeout: true,
    });
  } else {
    const cached = ocrResultCache.get(key);
    if (entryTextLen(cached) > 0) {
      logExtractionStep('OCR_CACHE_HIT', key);
      return cloneCacheHit(cached);
    }
    const indexedKey = fileBase ? ocrFileIndex.get(fileBase) : null;
    if (indexedKey && indexedKey !== key) {
      const indexed = ocrResultCache.get(indexedKey);
      if (entryTextLen(indexed) > 0) {
        logExtractionStep('OCR_CACHE_HIT', indexedKey);
        return cloneCacheHit(indexed);
      }
    }
  }

  const inFlight = peekOcrInFlightPromiseByKey(key);
  if (inFlight) {
    logExtractionStep('OCR_CACHE_HIT', 'in-flight');
    return inFlight;
  }

  logExtractionStep('OCR_CACHE_MISS', key);
  const t0 = Date.now();
  const p = runner()
    .then((result) => {
      storeOcrCacheResult(key, fileBase, result, Date.now() - t0);
      clearOcrInFlightPromise(key, p);
      return result;
    })
    .catch((err) => {
      clearOcrInFlightPromise(key, p);
      throw err;
    });
  setOcrInFlightPromise(key, p);
  return p;
}
