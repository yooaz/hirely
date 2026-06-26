/**
 * Hybrid PDF extraction — per-page native vs OCR with runtime trace.
 */

import { corruptionScoreText } from '../parsing/corruption-detector.js';
import { assessPdfTextLayer } from './pdf-text-quality.js';
import { ocrPdfPageToLines } from './ocr-lines.js';
import {
  shouldRunOcrForTextLength,
  logExtractionLockSkip,
} from './extraction-lock.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../import/real-cv-import-constants.js';
import { isNativePageTrusted, isCorruptNativeText } from './native-text-trust.js';
import { linesToPlainText } from './extracted-line.js';
import { logExtractionStep } from './file-buffer.js';
import { remainingMs } from './pdf-extraction-timeout.js';

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {Array<{ page: number, lines: object[], usable?: boolean, charCount?: number, quality?: object }>} pages
 * @param {object} [opts]
 */
export async function extractHybridPdfPages(pdf, pages, opts = {}) {
  const hybridLines = [];
  const pageRuntimeTrace = [];
  const deadlineAt = opts.deadlineAt || null;
  const pageList = pages || [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const pageStart = Date.now();
    const pageData = pageList.find((p) => p.page === n) || pageList[n - 1];
    const pageText = (pageData?.lines || []).map((l) => l.text || '').join('\n');
    const pageQuality = assessPdfTextLayer(pageText);
    const pageCorrupt = isCorruptNativeText(pageText);
    const nativeTrusted = isNativePageTrusted(pageData);

    const trace = {
      page: n,
      nativeCharCount: pageText.length,
      nativeUsable: Boolean(pageData?.usable),
      corruptScore: corruptionScoreText(pageText),
      corruptNativeRejected: pageCorrupt && !nativeTrusted,
      method: null,
      durationMs: 0,
      lineCount: 0,
      bboxRecovered: false,
      ocrSkipped: false,
      error: null,
    };

    if (nativeTrusted) {
      hybridLines.push(...pageData.lines);
      trace.method = 'native';
      trace.durationMs = Date.now() - pageStart;
      trace.lineCount = pageData.lines.length;
      trace.bboxRecovered = pageData.lines.some(
        (l) => Number.isFinite(l.x) && Number.isFinite(l.y)
      );
      pageRuntimeTrace.push(trace);
      logExtractionStep('HYBRID_PAGE_NATIVE', `page=${n} lines=${trace.lineCount}`);
      continue;
    }

    const budgetLeft = deadlineAt ? remainingMs(deadlineAt) : Infinity;
    if (budgetLeft < 1500) {
      trace.method = 'ocr';
      trace.error = 'deadline_exceeded';
      trace.durationMs = Date.now() - pageStart;
      pageRuntimeTrace.push(trace);
      logExtractionStep('HYBRID_PAGE_OCR_DEADLINE', `page=${n} left=${budgetLeft}ms`);
      continue;
    }

    const docTextLen = linesToPlainText(hybridLines).trim().length;
    const shouldOcr = shouldRunOcrForTextLength(docTextLen, {
      weakNative: docTextLen < REAL_CV_IMPORT_MIN_CHARS,
      usable: pageQuality.usable,
      strongTextLayer: pageQuality.strongTextLayer,
    });

    if (!shouldOcr) {
      logExtractionLockSkip('hybrid_page', docTextLen);
      trace.method = 'skipped';
      trace.ocrSkipped = true;
      trace.durationMs = Date.now() - pageStart;
      if (nativeTrusted) {
        hybridLines.push(...pageData.lines);
        trace.lineCount = pageData.lines.length;
      } else if (pageCorrupt) {
        trace.error = 'corrupt_native_rejected';
        logExtractionStep('HYBRID_CORRUPT_NATIVE_REJECTED', `page=${n}`);
      }
      pageRuntimeTrace.push(trace);
      continue;
    }

    trace.method = 'ocr';
    try {
      const { lines: ocrPageLines, words: ocrPageWords } = await ocrPdfPageToLines(pdf, n, {
        ...opts,
        deadlineAt,
        existingTextLength: docTextLen,
        usable: pageQuality.usable,
        strongTextLayer: pageQuality.strongTextLayer,
      });
      trace.durationMs = Date.now() - pageStart;
      if (ocrPageLines?.length) {
        if (ocrPageWords?.length) {
          for (const ln of ocrPageLines) {
            ln.words = ocrPageWords.filter((w) => {
              if (!w?.bbox || !Number.isFinite(ln.y)) return false;
              const cy = w.bbox.y + (w.bbox.height || 0) / 2;
              const lh = ln.height || 14;
              return cy >= ln.y - lh && cy <= ln.y + 4;
            });
          }
        }
        hybridLines.push(...ocrPageLines);
        trace.lineCount = ocrPageLines.length;
        trace.wordCount = ocrPageWords?.length || 0;
        trace.ocrWords = ocrPageWords || [];
        trace.bboxRecovered = ocrPageLines.some(
          (l) => Number.isFinite(l.x) && Number.isFinite(l.y) && (l.x > 0 || l.y > 0)
        );
        logExtractionStep('HYBRID_PAGE_OCR_OK', `page=${n} lines=${trace.lineCount} bbox=${trace.bboxRecovered}`);
      } else {
        trace.error = 'ocr_empty';
        logExtractionStep('HYBRID_PAGE_OCR_EMPTY', `page=${n}`);
      }
    } catch (err) {
      trace.durationMs = Date.now() - pageStart;
      trace.error = String(err?.code || err?.message || 'ocr_failed');
      logExtractionStep('HYBRID_PAGE_OCR_FAIL', `page=${n} ${trace.error}`);
    }

    pageRuntimeTrace.push(trace);
  }

  return {
    lines: hybridLines,
    pageRuntimeTrace,
    ocrWordsByPage: pageRuntimeTrace.reduce((acc, t) => {
      if (t.ocrWords?.length) acc[t.page] = t.ocrWords;
      return acc;
    }, {}),
    ocrPages: pageRuntimeTrace.filter((t) => t.method === 'ocr' && t.lineCount > 0).length,
    nativePages: pageRuntimeTrace.filter((t) => t.method === 'native').length,
    corruptNativeRejectedPages: pageRuntimeTrace.filter((t) => t.corruptNativeRejected).length,
    deadlineExceeded: pageRuntimeTrace.some((t) => t.error === 'deadline_exceeded'),
  };
}
