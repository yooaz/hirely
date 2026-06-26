/**
 * PDF OCR settlement — await in-flight OCR without circular imports.
 * Leaf module: pdf-ocr-cache-store (cache only) + ocr-settlement (flags only).
 */
import { logExtractionStep } from './file-buffer.js';
import { linesToPlainText } from './extracted-line.js';
import {
  getCachedPdfOcrIfReady,
  getPdfOcrCacheKey,
  peekOcrInFlightPromise,
  peekOcrInFlightPromiseByKey,
} from './pdf-ocr-cache-store.js';
import {
  OCR_SETTLEMENT,
  resolveOcrSettlementState,
  markPdfImageOnlyOcrSettled,
} from '../import/ocr-settlement.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_RENDER_MIN_CHARS,
} from '../import/real-cv-import-constants.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from '../import/ocr-fallback-v1.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';

const OCR_SETTLEMENT_MIN_LINES = 3;
const OCR_SETTLEMENT_MIN_WORDS = 8;

function entryTextLen(entry) {
  return String(entry?.text || '').trim().length;
}

/**
 * @param {object} extracted
 */
function assessOcrSettlementUsability(extracted = {}) {
  const lines = extracted.enterprise?.lines || [];
  const linePlain = linesToPlainText(lines).trim();
  const rawText = String(extracted.rawText || extracted.enterprise?.rawExtraction || '').trim();
  const cleanedText = String(
    extracted.cleanedText || extracted.enterprise?.cleanedText || rawText
  ).trim();
  const text = linePlain || cleanedText || rawText;
  const textLength = text.length;
  const lineCount = lines.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const pagesWithContent = lines.some((ln) => String(ln?.text || '').trim()) ? 1 : 0;
  const confidences = lines
    .map((ln) => Number(ln?.confidence) || 0)
    .filter((n) => n > 0);
  const avgConfidence = confidences.length
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0;
  const confidenceOk = avgConfidence === 0 || avgConfidence >= 40;
  const linesOk =
    lineCount >= OCR_SETTLEMENT_MIN_LINES &&
    textLength >= REAL_CV_IMPORT_RENDER_MIN_CHARS;
  const wordsOk = wordCount >= OCR_SETTLEMENT_MIN_WORDS && pagesWithContent >= 1;
  const usable =
    confidenceOk &&
    (textLength >= REAL_CV_IMPORT_MIN_CHARS ||
      linesOk ||
      wordsOk ||
      (textLength > OCR_FALLBACK_V1_PASTE_MAX_CHARS && lineCount > 0));

  return {
    usable,
    ocrAttempted: true,
    textLength,
    lineCount,
    wordCount,
    pagesWithContent,
    avgConfidence,
    nativeTextLength: 0,
    reason: usable ? 'OCR_SETTLEMENT_USABLE' : 'OCR_SETTLEMENT_NOT_USABLE',
  };
}

function emptySettlementUsability(ocrAttempted = false) {
  return {
    usable: false,
    ocrAttempted,
    textLength: 0,
    lineCount: 0,
    wordCount: 0,
    pagesWithContent: 0,
    avgConfidence: 0,
    nativeTextLength: 0,
    reason: 'OCR_SETTLEMENT_EMPTY',
  };
}

function buildSettlementFromOcrResult(result, meta = {}) {
  const text = String(result?.text || '').trim();
  const lines = result?.lines || [];
  const base = {
    rawText: text,
    cleanedText: text,
    extractionMethod: 'ocr',
    fileType: 'pdf',
    nativeTextLength: 0,
    enterprise: {
      lines,
      rawExtraction: text,
      cleanedText: text,
      method: 'ocr',
      pdfExtraction: { method: 'ocr', ocrCharCount: text.length },
    },
  };
  const usability = assessOcrSettlementUsability(base);
  const state = resolveOcrSettlementState(usability, { ...meta, inFlight: false });
  const extracted = markPdfImageOnlyOcrSettled(base, usability, state);
  return {
    state,
    usable: usability.usable,
    ocrAttempted: extracted.ocrAttempted === true,
    text,
    lines,
    usability,
    extracted,
    ocrWordsByPage: result?.ocrWordsByPage || {},
    recoveredAfterTimeout: result?.recoveredAfterTimeout === true,
  };
}

/**
 * Await OCR settlement before committing import paste.
 * @param {File|null|undefined} file
 * @param {{ pageCount?: number, preprocessingMode?: string, maxWaitMs?: number, timedOut?: boolean }} [opts]
 */
export async function awaitOcrSettlementForFile(file, opts = {}) {
  const ctx = {
    pageCount: opts.pageCount,
    preprocessingMode: opts.preprocessingMode,
  };
  const cached = getCachedPdfOcrIfReady(file, ctx);
  if (cached && entryTextLen(cached) > 0) {
    logExtractionStep('OCR_SETTLEMENT_CACHE_HIT', `${cached.text.length}c`);
    return buildSettlementFromOcrResult(cached, { timedOut: opts.timedOut === true });
  }

  const inFlight =
    peekOcrInFlightPromiseByKey(getPdfOcrCacheKey(file, ctx)) ??
    peekOcrInFlightPromise(file, ctx);
  if (!inFlight) {
    const state =
      opts.timedOut === true
        ? OCR_SETTLEMENT.TIMED_OUT_FINAL
        : OCR_SETTLEMENT.DONE_UNUSABLE;
    return {
      state,
      usable: false,
      ocrAttempted: opts.timedOut === true,
      text: '',
      lines: [],
      usability: emptySettlementUsability(opts.timedOut === true),
      extracted: null,
    };
  }

  const pendingState =
    opts.timedOut === true
      ? OCR_SETTLEMENT.TIMED_OUT_PENDING
      : OCR_SETTLEMENT.PENDING;
  logExtractionStep('OCR_SETTLEMENT_AWAIT_INFLIGHT', pendingState);
  hirelyProductLog('OCR_SETTLEMENT_AWAIT', { state: pendingState });

  const maxWait = Math.max(1000, Number(opts.maxWaitMs) || 120000);
  let timer;
  try {
    const result = await Promise.race([
      inFlight,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error('OCR_SETTLEMENT_WAIT_TIMEOUT'), {
                code: 'OCR_SETTLEMENT_WAIT_TIMEOUT',
              })
            ),
          maxWait
        );
      }),
    ]);
    return buildSettlementFromOcrResult(result, { timedOut: opts.timedOut === true });
  } catch (err) {
    const lateCached = getCachedPdfOcrIfReady(file, ctx);
    if (lateCached && entryTextLen(lateCached) > 0) {
      logExtractionStep('OCR_SETTLEMENT_LATE_CACHE', `${lateCached.text.length}c`);
      return buildSettlementFromOcrResult(lateCached, {
        timedOut: opts.timedOut === true,
      });
    }
    if (err?.code === 'OCR_SETTLEMENT_WAIT_TIMEOUT') {
      return {
        state: OCR_SETTLEMENT.TIMED_OUT_PENDING,
        usable: false,
        ocrAttempted: true,
        text: '',
        lines: [],
        usability: emptySettlementUsability(true),
        extracted: null,
        inFlight: true,
      };
    }
    return {
      state: OCR_SETTLEMENT.FAILED,
      usable: false,
      ocrAttempted: true,
      text: '',
      lines: [],
      usability: emptySettlementUsability(true),
      extracted: null,
      error: String(err?.message || err),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
