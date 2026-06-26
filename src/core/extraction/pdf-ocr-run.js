/**
 * Timed, cached full-document PDF OCR (browser Tesseract only in static mode).
 *
 * - OCR_UI_SOFT_TIMEOUT_MS: advisory only — never rejects when text exists.
 * - OCR_ABSOLUTE_MAX_MS: hard 20s ceiling — always resolves (success or OCR_TIMEOUT).
 */

import { logExtractionStep } from './file-buffer.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_TIMEOUT_USER_MSG,
  OCR_UX_PROGRESS_MS,
  OCR_UX_PATIENCE_MS,
  OCR_UX_EARLY_PASTE_MS,
  OCR_UX_PATIENCE_MSG,
  OCR_UX_EARLY_PASTE_MSG,
  OCR_HARD_FALLBACK_MS,
  OCR_ANALYZING_MSG,
  OCR_PARTIAL_REVIEW_MSG,
} from './pdf-extraction-timeout.js';
import {
  getOrRunCachedPdfOcr,
  resolveOcrPreprocessingMode,
  markPdfOcrTimedOut,
} from './pdf-ocr-cache-store.js';
import { logOcrPropagate } from './ocr-propagation-trace.js';
import { dispatchImportRunEvent, peekImportRunId } from '../import/import-run-guard.js';
import { shouldRunOcrForTextLength, logExtractionLockSkip } from './extraction-lock.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../import/real-cv-import-constants.js';
import { assessOcrImportUsability } from '../import/ocr-import-usability.js';
import { isOcrAutoImportEnabled } from '../import/ocr-auto-import.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from '../import/ocr-fallback-v1.js';
import { selectBestOcrRotation } from './ocr-rotation-select.js';
import {
  isOcrQualityAcceptable,
  evaluateOcrParserGate,
  OCR_QUALITY_FAIL_MSG,
} from './ocr-quality-score.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';
import {
  recordOcrFirstPageResult,
  recordOcrFinalResult,
  setOcrFailReason,
  setOcrDiagnostic,
} from './ocr-runtime-diagnostics.js';
import { coerceOcrExtractedLine } from './extracted-line.js';

export const OCR_SLOW_HINT_MS = OCR_UX_PATIENCE_MS;
export const OCR_UI_SOFT_TIMEOUT_MS = OCR_UX_EARLY_PASTE_MS;
export const OCR_HARD_TIMEOUT_MS = PDF_EXTRACTION_MAX_MS;
/** @deprecated Grace removed — absolute max fails immediately */
export const OCR_TIMEOUT_GRACE_MS = 0;
export const OCR_ABSOLUTE_MAX_MS = PDF_EXTRACTION_MAX_MS;
export const OCR_SLOW_HINT_MSG = OCR_UX_PATIENCE_MSG;
export const OCR_EARLY_PASTE_MSG = OCR_UX_EARLY_PASTE_MSG;
const OCR_TIMEOUT_ERR = OCR_PARTIAL_REVIEW_MSG;
/** Minimum chars to treat OCR as successful — V1 auto: > 100; else 300. */
function ocrSuccessMinChars() {
  return isOcrAutoImportEnabled()
    ? OCR_FALLBACK_V1_PASTE_MAX_CHARS + 1
    : REAL_CV_IMPORT_MIN_CHARS;
}

function ocrResultIsImportReady(text, lines) {
  const min = ocrSuccessMinChars();
  const len = String(text || '').trim().length;
  if (len < min) return false;
  if (isOcrAutoImportEnabled() && len > OCR_FALLBACK_V1_PASTE_MAX_CHARS) return true;
  return isOcrQualityAcceptable(text, lines);
}

const PDF_BEST_PASS_IDS = new Set(['A', 'B', 'C']);
const LN_CONFIDENCE_FALLBACK = 68;

function ocrPassIsReadableQuality(text, lines) {
  return isOcrQualityAcceptable(text, lines);
}

/** Best text seen from any in-flight OCR pass (updated after each tess pass). */
let bestOcrPassSnapshot = null;

function averageConfidence(lines) {
  const list = lines || [];
  if (!list.length) return 0;
  const sum = list.reduce((a, ln) => a + (Number(ln?.confidence) || 0), 0);
  return Math.round(sum / list.length);
}

function recordOcrPassSnapshot(result, provider = 'tesseract') {
  const text = String(result?.text || '').trim();
  const lines = result?.lines || [];
  if (text.length === 0 && lines.length === 0) return;
  const prevLen = bestOcrPassSnapshot?.text?.length ?? 0;
  if (text.length < prevLen && lines.length <= (bestOcrPassSnapshot?.lines?.length ?? 0)) return;
  bestOcrPassSnapshot = {
    text,
    lines,
    confidence: averageConfidence(lines),
    provider: result?.provider || provider,
  };
  logExtractionStep('OCR_PASS_TEXT_CAPTURED', `textLength=${text.length}`);
}

function clearOcrPassSnapshots() {
  bestOcrPassSnapshot = null;
}

function getBestPassSnapshot() {
  if (!bestOcrPassSnapshot) return null;
  const text = String(bestOcrPassSnapshot.text || '').trim();
  if (text.length > 0 || (bestOcrPassSnapshot.lines?.length ?? 0) > 0) {
    return bestOcrPassSnapshot;
  }
  return null;
}

/**
 * Run OCR passes until one returns text — do not wait for slower passes after success.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 */
async function runPdfOcrReturnOnFirstPassText(pdf, opts = {}) {
  const { renderPdfPageToCanvas } = await import('./pdf-ocr-render.js');
  const { runOcrPass, OCR_PASS_DEFS } = await import('./ocr-multipass.js');
  const { ocrCanvasToLines } = await import('./ocr-lines.js');
  const { postProcessOcrText } = await import('../parsing/ocr-postprocess.js');
  const { recordExtractionAuditStage } = await import('./extraction-audit.js');
  const { isExactTranscriptionExtractionActive } = await import('./exact-transcription-truth.js');
  const exactMode = isExactTranscriptionExtractionActive();

  const passDefs = OCR_PASS_DEFS.filter((p) => PDF_BEST_PASS_IDS.has(p.id));
  const allLines = [];
  const pageTexts = [];
  /** @type {Record<number, object[]>} */
  const ocrWordsByPage = {};

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (opts.deadlineAt && Date.now() >= opts.deadlineAt) {
      setOcrFailReason('OCR_DEADLINE');
      throw Object.assign(new Error('OCR_DEADLINE'), { code: 'OCR_ABSOLUTE_TIMEOUT' });
    }
    if (pageNum === 1) {
      logExtractionStep('OCR_FIRST_PAGE_STARTED', '1');
      setOcrDiagnostic('OCR_FIRST_PAGE_STARTED', true);
    }
    const page = await pdf.getPage(pageNum);
    const vp1 = page.getViewport({ scale: 1 });
    const canvas = await renderPdfPageToCanvas(page, opts.scale);
    const renderWidth = canvas.width;
    const renderHeight = canvas.height;
    const renderScale = renderWidth / vp1.width;
    const rotationPick = await selectBestOcrRotation(canvas, {
      lang: opts.lang,
      page: pageNum,
      viewportWidth: vp1.width,
      viewportHeight: vp1.height,
      targetDpi: opts.targetDpi,
      deadlineAt: opts.deadlineAt,
      maxRotations:
        globalThis.HIRELY_OCR_FULL_ROTATION === true ? undefined : 1,
    });
    const ocrCanvas = rotationPick.canvas;

    if (pageNum === 1) {
      recordOcrFirstPageResult(rotationPick.text, rotationPick.lines);
      if (
        !exactMode &&
        pdf.numPages === 1 &&
        ocrResultIsImportReady(rotationPick.text, rotationPick.lines)
      ) {
        const polished = (rotationPick.lines || []).map((ln, i) =>
          coerceOcrExtractedLine(ln, {
            text: String(ln.text || '').trim(),
            page: pageNum,
            line: i,
          })
        );
        const text = String(rotationPick.text || '').trim();
        logExtractionStep('OCR_ROTATION_DIRECT_SUCCESS', `${text.length}c`);
        return { text, lines: polished };
      }
    }
    const passOpts = {
      ...opts,
      page: pageNum,
      viewportWidth: vp1.width,
      viewportHeight: vp1.height,
      renderWidth,
      renderHeight,
      renderScale,
      skipAutoRotate: true,
      rotationDeg: rotationPick.rotationDeg,
    };

    if (exactMode) {
      const exactOut = await ocrCanvasToLines(rotationPick.canvas, {
        ...passOpts,
        fusion: false,
        bestPass: false,
        preferredVariant: rotationPick.variant || 'exact_fidelity',
      });
      const rawText = String(exactOut?.text || '').trim();
      const rawLines = exactOut?.lines || [];
      if (exactOut?.words?.length) ocrWordsByPage[pageNum] = exactOut.words;
      if (rawText.length > 0 || rawLines.length > 0) {
        pageTexts.push(rawText);
        allLines.push(...rawLines);
        recordExtractionAuditStage(`ocr_page_${pageNum}`, {
          lines: rawLines,
          rawText,
          pageCount: 1,
          note: `page ${pageNum} exact_geometry words=${exactOut?.words?.length || 0}`,
        });
        if (pdf.numPages === 1 && ocrPassIsReadableQuality(rawText, rawLines)) {
          return { text: pageTexts.join('\n\n').trim(), lines: allLines, ocrWordsByPage };
        }
        continue;
      }
    }

    for (const passDef of passDefs) {
      const out = await runOcrPass(ocrCanvas, passDef, passOpts);
      const rawText = String(out?.text || '').trim();
      const rawLines = out?.lines || [];
      recordOcrPassSnapshot(
        { text: rawText, lines: rawLines, provider: out?.provider || 'tesseract' },
        out?.provider || 'tesseract'
      );

      if (rawText.length > 0 || rawLines.length > 0) {
        if (out?.words?.length) ocrWordsByPage[pageNum] = out.words;
        const polished = rawLines
          .map((ln) => {
            const raw = String(ln.rawExtraction ?? ln.text ?? '').trim();
            const cleaned = postProcessOcrText(raw) || raw;
            if (!cleaned) return null;
            return { ...ln, text: cleaned, cleanedText: cleaned, rawExtraction: raw };
          })
          .filter(Boolean);
        let text = polished.map((l) => l.text).join('\n').trim();
        let lines = polished;
        if (!text && rawText) {
          text = postProcessOcrText(rawText) || rawText;
          lines = text.split('\n').map((t, i) =>
            coerceOcrExtractedLine({ text: t }, { text: t, rawExtraction: t, page: pageNum, line: i })
          );
        }
        pageTexts.push(text);
        allLines.push(...lines);
        recordExtractionAuditStage(`ocr_page_${pageNum}`, {
          lines,
          rawText: text,
          pageCount: 1,
          note: `page ${pageNum} pass=${passDef.id}`,
        });
        if (pdf.numPages === 1 && ocrPassIsReadableQuality(text, lines)) {
          logOcrPropagate('OCR_ALL_PAGES', {
            OCR_LINES_COUNT: allLines.length,
            OCR_JOINED_TEXT_LENGTH: text.length,
            OCR_RESULT_TEXT_LENGTH: text.length,
            pages: pdf.numPages,
            note: `early-pass=${passDef.id}`,
          });
          return { text: pageTexts.join('\n\n').trim(), lines: allLines, ocrWordsByPage };
        }
        logExtractionStep('OCR_PASS_LOW_QUALITY', `pass=${passDef.id} textLength=${text.length}`);
        break;
      }
    }

    const snap = getBestPassSnapshot();
    if (pdf.numPages === 1 && snap && ocrPassIsReadableQuality(snap.text, snap.lines)) {
      const text = String(snap.text || '').trim();
      return {
        text: pageTexts.length ? pageTexts.join('\n\n').trim() : text,
        lines: snap.lines?.length ? snap.lines : allLines,
        ocrWordsByPage,
      };
    }

    if (!opts.variant && opts.allowSecondPass) {
      const { ocrCanvasToLines } = await import('./ocr-lines.js');
      const retry = await ocrCanvasToLines(ocrCanvas, {
        ...passOpts,
        variant: 'high_contrast',
        bestPass: false,
      });
      const retryText = String(retry?.text || '').trim();
      if (retryText.length > 0 || (retry?.lines?.length ?? 0) > 0) {
        if (retry?.words?.length) ocrWordsByPage[pageNum] = retry.words;
        recordOcrPassSnapshot(retry, 'tesseract');
        pageTexts.push(retryText);
        allLines.push(...(retry.lines || []));
        return { text: pageTexts.join('\n\n').trim(), lines: allLines, ocrWordsByPage };
      }
    }
  }

  const merged = pageTexts.join('\n\n').trim();
  const snap = getBestPassSnapshot();
  if (snap?.text) {
    return {
      text: String(snap.text).trim(),
      lines: snap.lines?.length ? snap.lines : allLines,
      ocrWordsByPage,
    };
  }
  return { text: merged, lines: allLines, ocrWordsByPage };
}

function notifyOcrImportStatus(message) {
  const msg = String(message || '').trim();
  try {
    if (typeof globalThis.HIRELY_SET_IMPORT_LIVE_STATUS === 'function') {
      globalThis.HIRELY_SET_IMPORT_LIVE_STATUS(msg);
    }
  } catch {
    /* ignore */
  }
  dispatchImportRunEvent('hirely:ocr-status', { message: msg });
}

function ocrTextLength(result) {
  return String(result?.text || '').trim().length;
}

function hasValidOcrResult(result) {
  if (!result) return false;
  return ocrTextLength(result) > 0 || (result?.lines?.length ?? 0) > 0;
}

function formatOcrSuccess(result, provider = 'tesseract') {
  const text = String(result?.text || '').trim();
  const lines = result?.lines || [];
  return {
    status: 'success',
    text,
    lines,
    confidence: result?.confidence ?? averageConfidence(lines),
    provider: result?.provider || provider,
    ocrWordsByPage: result?.ocrWordsByPage || {},
  };
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {File|null|undefined} file
 * @param {object} [opts]
 */
export async function runCachedTimedPdfOcr(pdf, file, opts = {}) {
  const existingLen =
    Number(opts.existingTextLength ?? opts.ocrTextLength ?? 0) || 0;
  if (
    !shouldRunOcrForTextLength(existingLen, {
      weakNative: existingLen < REAL_CV_IMPORT_MIN_CHARS,
      usable: opts.usable,
      strongTextLayer: opts.strongTextLayer,
    })
  ) {
    logExtractionLockSkip('pdf_ocr_run', existingLen);
    const existingText = String(opts.existingText || '').trim();
    const existingLines = Array.isArray(opts.existingLines) ? opts.existingLines : [];
    logExtractionStep('OCR_SKIPPED_EXTRACTION_LOCK', `${existingLen}c`);
    return {
      ...formatOcrSuccess({ text: existingText, lines: existingLines }),
      recoveredAfterTimeout: false,
      extractionLockSkip: true,
    };
  }

  clearOcrPassSnapshots();

  const importRunId = opts.importRunId ?? peekImportRunId();
  logExtractionStep('OCR_STARTED', `run=${importRunId}`);
  setOcrDiagnostic('OCR_FIRST_PAGE_STARTED', true);
  logExtractionStep('OCR_FIRST_PAGE_STARTED', 'run');
  setOcrDiagnostic('OCR_FINAL_TEXT_LENGTH', 0);
  setOcrDiagnostic('OCR_FAIL_REASON', '');
  notifyOcrImportStatus(OCR_ANALYZING_MSG);
  const t0 = Date.now();
  const deadlineAt = t0 + OCR_ABSOLUTE_MAX_MS;
  const ocrOpts = { ...opts, deadlineAt };
  let progressTimer = null;
  let slowTimer = null;
  let uiSoftTimer = null;
  let absoluteTimer = null;
  let pollTimer = null;
  let uiSoftTimedOut = false;
  let softTimedOut = false;

  const pageCount = pdf?.numPages ?? 0;
  const preprocessingMode = resolveOcrPreprocessingMode(opts);

  const finishWithResult = (result, note = '') => {
    const success = formatOcrSuccess(result);
    const textLen = success.text.length;
    const lineCount = success.lines?.length ?? 0;

    logOcrPropagate('PDF_OCR_RUN', {
      OCR_RESULT_TEXT_LENGTH: textLen,
      OCR_LINES_COUNT: lineCount,
      OCR_JOINED_TEXT_LENGTH: textLen,
    });
    logExtractionStep('OCR_FINISHED', `${Date.now() - t0}ms${note ? ` ${note}` : ''}`);
    logExtractionStep('OCR_RESULT_RECEIVED', `textLength=${textLen}`);

    if (textLen === 0 && lineCount === 0) {
      logExtractionStep('OCR_RESULT_DISCARDED', 'empty_text');
      return success;
    }

    if (uiSoftTimedOut || softTimedOut) {
      logExtractionStep('OCR_TIMEOUT_IGNORED_BECAUSE_TEXT_EXISTS', `textLength=${textLen}`);
      logExtractionStep('OCR_RECOVERED_AFTER_TIMEOUT', `${textLen}c`);
      dispatchImportRunEvent('hirely:ocr-recovered', {
        importRunId,
        charCount: textLen,
        message: 'Texte récupéré — analyse en cours…',
      });
    }

    dispatchImportRunEvent('hirely:ocr-settled', {
      importRunId,
      charCount: textLen,
      recoveredAfterTimeout: uiSoftTimedOut || softTimedOut,
      message: 'Texte récupéré — analyse en cours…',
    });

    logExtractionStep('OCR_SUCCESS_RETURNED', `textLength=${textLen}`);
    logExtractionStep('OCR_CACHE_STORE_SUCCESS', `${textLen}c`);
    recordOcrFinalResult(success.text, success.lines);
    hirelyProductLog('OCR_DONE', `${Date.now() - t0}ms ${textLen}c`);
    notifyOcrImportStatus('');
    return {
      ...success,
      recoveredAfterTimeout: uiSoftTimedOut || softTimedOut,
    };
  };

  const onAdvisoryTimeout = (label) => {
    const snapLen = ocrTextLength(bestOcrPassSnapshot);
    if (snapLen >= ocrSuccessMinChars()) {
      logExtractionStep(
        'OCR_TIMEOUT_IGNORED_BECAUSE_TEXT_EXISTS',
        `textLength=${snapLen} ${label}`
      );
      return;
    }
    logExtractionStep('OCR_TIMEOUT', `${Date.now() - t0}ms ${label}`);
    if (label === 'ui-soft') {
      uiSoftTimedOut = true;
      dispatchImportRunEvent('hirely:ocr-early-paste', {
        importRunId,
        recoverable: true,
        message: OCR_EARLY_PASTE_MSG,
      });
    } else {
      softTimedOut = true;
    }
  };

  const clearTimers = () => {
    if (progressTimer) clearTimeout(progressTimer);
    if (slowTimer) clearTimeout(slowTimer);
    if (uiSoftTimer) clearTimeout(uiSoftTimer);
    if (absoluteTimer) clearTimeout(absoluteTimer);
    if (pollTimer) clearInterval(pollTimer);
    progressTimer =
      slowTimer =
      uiSoftTimer =
      absoluteTimer =
      pollTimer =
        null;
  };

  const ocrWork = () =>
    getOrRunCachedPdfOcr(
      file,
      { pageCount, preprocessingMode, opts: ocrOpts },
      () =>
        runPdfOcrReturnOnFirstPassText(pdf, {
          ...ocrOpts,
          allowSecondPass: opts.allowSecondPass === true,
        })
    );

  progressTimer = setTimeout(() => {
    logExtractionStep('OCR_PROGRESS', `${Date.now() - t0}ms`);
    dispatchImportRunEvent('hirely:ocr-progress', {
      importRunId,
      pct: 18,
      message: 'Lecture du scan PDF…',
    });
  }, OCR_UX_PROGRESS_MS);

  const workPromise = (async () => {
    slowTimer = setTimeout(() => {
      logExtractionStep('OCR_SLOW_HINT', `${Date.now() - t0}ms`);
      notifyOcrImportStatus(OCR_SLOW_HINT_MSG);
      dispatchImportRunEvent('hirely:ocr-patience', {
        importRunId,
        message: OCR_SLOW_HINT_MSG,
      });
    }, OCR_SLOW_HINT_MS);
    try {
      return await ocrWork();
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
    }
  })();

  uiSoftTimer = setTimeout(() => onAdvisoryTimeout('ui-soft'), OCR_UI_SOFT_TIMEOUT_MS);

  const earlyFromPassPromise = new Promise((resolve) => {
    pollTimer = setInterval(() => {
      const snap = getBestPassSnapshot();
      if (!snap || !ocrResultIsImportReady(snap.text, snap.lines)) return;
      clearTimers();
      resolve(finishWithResult(snap, 'early-pass'));
    }, 200);
    workPromise.finally(() => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    });
  });

  const absoluteFallbackPromise = new Promise((resolve, reject) => {
    absoluteTimer = setTimeout(async () => {
      const snap = getBestPassSnapshot();
      const snapLen = ocrTextLength(snap);
      if (snapLen >= ocrSuccessMinChars() && ocrResultIsImportReady(snap.text, snap.lines)) {
        uiSoftTimedOut = true;
        resolve(finishWithResult(snap, 'absolute-fallback'));
        return;
      }
      softTimedOut = true;
      setOcrFailReason(
        snapLen > 0
          ? `OCR_TIMEOUT_INSUFFICIENT_TEXT:${snapLen}c`
          : `OCR_TIMEOUT_NO_TEXT:${Date.now() - t0}ms`
      );
      dispatchImportRunEvent('hirely:ocr-wait-timeout', {
        importRunId,
        recoverable: true,
        terminal: false,
        settlement: 'timed_out_but_pending_result_not_committed',
        message: OCR_EARLY_PASTE_MSG,
      });
      hirelyProductLog('OCR_TIMEOUT', {
        ms: Date.now() - t0,
        reason: snapLen > 0 ? 'insufficient_text_pending' : 'no_text_pending',
        terminal: false,
      });
      logExtractionStep('OCR_SETTLEMENT_PENDING', `${Date.now() - t0}ms`);
      try {
        const settled = await workPromise;
        if (hasValidOcrResult(settled)) {
          resolve(finishWithResult(settled, 'settled-after-advisory-timeout'));
          return;
        }
        const lateSnap = getBestPassSnapshot();
        if (
          lateSnap &&
          ocrResultIsImportReady(lateSnap.text, lateSnap.lines)
        ) {
          resolve(finishWithResult(lateSnap, 'snap-after-advisory-timeout'));
          return;
        }
      } catch (workErr) {
        const lateSnap = getBestPassSnapshot();
        if (
          lateSnap &&
          ocrResultIsImportReady(lateSnap.text, lateSnap.lines)
        ) {
          resolve(finishWithResult(lateSnap, 'snap-after-work-error'));
          return;
        }
        if (workErr?.code === 'OCR_QUALITY_FAILED' || workErr?.code === 'OCR_EMPTY') {
          reject(workErr);
          return;
        }
      }
      dispatchImportRunEvent('hirely:ocr-wait-timeout', {
        importRunId,
        recoverable: false,
        terminal: true,
        settlement: 'timed_out_final',
        message: OCR_PARTIAL_REVIEW_MSG,
      });
      markPdfOcrTimedOut(file);
      reject(
        Object.assign(new Error('OCR_ABSOLUTE_TIMEOUT'), {
          code: 'OCR_ABSOLUTE_TIMEOUT',
          reason: snapLen > 0 ? 'insufficient_text' : 'no_text',
          textLength: snapLen,
          settlement: 'timed_out_final',
        })
      );
    }, OCR_ABSOLUTE_MAX_MS);
  });

  try {
    const result = await Promise.race([
      workPromise.then((r) => {
        if (hasValidOcrResult(r)) return finishWithResult(r, 'work');
        const snap = getBestPassSnapshot();
        if (snap) return finishWithResult(snap, 'work-snap');
        return finishWithResult(r, 'work-empty');
      }),
      earlyFromPassPromise,
      absoluteFallbackPromise,
    ]);
    clearTimers();
    if (!hasValidOcrResult(result)) {
      throw Object.assign(new Error('OCR_EMPTY'), {
        code: 'OCR_EMPTY',
        importStatus: 'PDF_TEXT_EMPTY',
      });
    }

    const gate = evaluateOcrParserGate(result.text, result.lines);
    const textLen = String(result.text || '').trim().length;
    const minChars = ocrSuccessMinChars();
    if (!gate.pass && !(isOcrAutoImportEnabled() && textLen > OCR_FALLBACK_V1_PASTE_MAX_CHARS)) {
      logExtractionStep('OCR_QUALITY_REJECTED', `${gate.qualityScore}`);
      setOcrFailReason(`OCR_QUALITY_FAILED:${gate.qualityScore}`);
      throw Object.assign(new Error(OCR_QUALITY_FAIL_MSG), {
        code: 'OCR_QUALITY_FAILED',
        importStatus: 'PDF_TEXT_EMPTY',
        ocrQuality: gate,
      });
    }

    const usability = assessOcrImportUsability({
      rawText: result.text,
      cleanedText: result.text,
      extractionMethod: 'ocr',
      ocrAttempted: true,
      enterprise: { lines: result.lines || [], method: 'ocr' },
    });
    if (!usability.usable && result.text.length < ocrSuccessMinChars()) {
      setOcrFailReason(`OCR_INSUFFICIENT_TEXT:${result.text.length}c`);
      throw Object.assign(new Error('OCR_INSUFFICIENT_TEXT'), {
        code: 'OCR_INSUFFICIENT_TEXT',
        importStatus: 'PDF_TEXT_EMPTY',
        textLength: result.text.length,
      });
    }

    return result;
  } catch (err) {
    clearTimers();

    if (err?.code === 'OCR_QUALITY_FAILED' || err?.code === 'OCR_EMPTY' || err?.code === 'OCR_INSUFFICIENT_TEXT') {
      throw err;
    }

    const snap = getBestPassSnapshot();
    if (snap && ocrResultIsImportReady(snap.text, snap.lines)) {
      logExtractionStep(
        'OCR_TIMEOUT_IGNORED_BECAUSE_TEXT_EXISTS',
        `textLength=${ocrTextLength(snap)}`
      );
      return finishWithResult(snap, 'catch-snap');
    }

    if (hasValidOcrResult(err?.result)) {
      const resultGate = evaluateOcrParserGate(err.result.text, err.result.lines);
      const catchLen = String(err.result.text || '').trim().length;
      const gateOk =
        resultGate.pass || (isOcrAutoImportEnabled() && catchLen > OCR_FALLBACK_V1_PASTE_MAX_CHARS);
      if (gateOk && catchLen >= ocrSuccessMinChars()) {
        return finishWithResult(err.result, 'catch-result');
      }
      logExtractionStep('OCR_CATCH_RESULT_REJECTED', `${resultGate.qualityScore}`);
    }

    if (err?.code === 'OCR_ABSOLUTE_TIMEOUT') {
      markPdfOcrTimedOut(file);
      hirelyProductLog('OCR_TIMEOUT', { ms: Date.now() - t0, reason: err?.reason });
      logExtractionStep('OCR_TIMEOUT', `${Date.now() - t0}ms absolute ${err?.reason || ''}`);
      setOcrFailReason(`OCR_TIMEOUT:${err?.reason || 'absolute'}:${err?.textLength ?? 0}c`);
      dispatchImportRunEvent('hirely:import-status', {
        importRunId,
        status: 'PARTIAL_TEXT_RECOVERED',
        message: OCR_PARTIAL_REVIEW_MSG,
        terminal: false,
      });
      throw Object.assign(new Error(OCR_PARTIAL_REVIEW_MSG), {
        code: 'OCR_TIMEOUT',
        importStatus: 'PDF_OCR_TIMEOUT',
        recoverable: true,
      });
    }

    logExtractionStep('OCR_RESULT_DISCARDED', err?.message || 'ocr_work_failed');
    throw err;
  }
}
