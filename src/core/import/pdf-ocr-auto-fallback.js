/**
 * HIRELY OCR Fallback V1 — PDF only.
 * Native pdf.js → if < 300 chars → Tesseract (max 20s) → Review if > 100 chars else paste.
 */
import { readFileBuffer, cloneArrayBuffer, logExtractionStep } from '../extraction/file-buffer.js';
import { extractNativePdfLines } from '../extraction/pdf-lines-native.js';
import { ocrPdfPagesWithRenderer } from '../extraction/pdf-ocr-page-renderer.js';
import { normalizeRawExtract } from '../parsing/clean.js';
import { ensureTesseract } from '../extraction/ocr-tesseract.js';
import { isOcrAutoImportEnabled, notifyOcrImportProgress } from './ocr-auto-import.js';
import {
  OCR_PROGRESS_ANALYZING,
  OCR_PROGRESS_RUNNING,
  OCR_PROGRESS_BUILDING,
} from './ocr-auto-import.js';
import {
  OCR_FALLBACK_V1_NATIVE_MIN,
  OCR_FALLBACK_V1_OCR_MAX_MS,
  ocrFallbackV1NativeSufficient,
  ocrFallbackV1TextUsable,
} from './ocr-fallback-v1.js';

export const PDF_OCR_AUTO_THRESHOLD = OCR_FALLBACK_V1_NATIVE_MIN;

function linesToPlain(lines) {
  return (lines || [])
    .map((l) => String(l.cleanedText || l.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function pageTextsToLines(ocrTextPerPage) {
  const lines = [];
  for (let p = 0; p < (ocrTextPerPage || []).length; p++) {
    const block = String(ocrTextPerPage[p] || '').trim();
    if (!block) continue;
    block.split('\n').forEach((ln, i) => {
      const t = ln.trim();
      if (t) {
        lines.push({
          text: t,
          cleanedText: t,
          page: p + 1,
          line: i,
          source: 'ocr',
        });
      }
    });
  }
  return lines;
}

function notifyProgress(message) {
  notifyOcrImportProgress(message);
}

/**
 * @param {File} file
 * @param {object} [opts]
 */
export async function extractPdfWithAutoOcrFallback(file, opts = {}) {
  const pdfjsLib = globalThis.pdfjsLib || globalThis.window?.pdfjsLib;
  if (!pdfjsLib) {
    return {
      fileType: 'pdf',
      rawText: '',
      cleanedText: '',
      extractionMethod: 'native_pdf',
      warnings: ['PDFJS_MISSING'],
      errors: ['PDF.js non chargé'],
      ocrAttempted: false,
    };
  }

  notifyProgress(OCR_PROGRESS_ANALYZING);
  logExtractionStep('PDF_OCR_AUTO_ANALYZE', file?.name || 'pdf');

  const master = await readFileBuffer(file);
  const pdfJsBuf = cloneArrayBuffer(master);
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: pdfJsBuf, isEvalSupported: false }).promise;
  } catch (err) {
    return {
      fileType: 'pdf',
      rawText: '',
      cleanedText: '',
      extractionMethod: 'native_pdf',
      warnings: ['PDF_OPEN_FAIL'],
      errors: [String(err?.message || 'PDF open failed')],
      ocrAttempted: false,
    };
  }

  const native = await extractNativePdfLines(pdf);
  const nativeLines = native.pages.flatMap((p) => p.lines || []);
  let text = linesToPlain(nativeLines);
  const nativeCharCount = text.length;
  let method = 'native_pdf';
  let ocrAttempted = false;
  let ocrResultLength = 0;

  if (ocrFallbackV1NativeSufficient(text)) {
    const cleaned = normalizeRawExtract(text);
    notifyProgress(OCR_PROGRESS_BUILDING);
    return {
      fileType: 'pdf',
      rawText: text,
      cleanedText: cleaned,
      extractionMethod: method,
      warnings: ['PDF_NATIVE_OK'],
      errors: [],
      ocrAttempted: false,
      ocrResultLength: 0,
      nativeCharCount,
      enterprise: {
        rawExtraction: cleaned,
        cleanedText: cleaned,
        lines: nativeLines,
        method,
        metadata: { fileType: 'pdf_text', nativeOnly: true },
        pdfExtraction: { method: 'native_pdf', decision: 'native', charCount: cleaned.length },
      },
    };
  }

  if (!isOcrAutoImportEnabled()) {
    return {
      fileType: 'pdf',
      rawText: text,
      cleanedText: normalizeRawExtract(text),
      extractionMethod: 'native_pdf',
      warnings: ['PDF_NATIVE_TOO_SHORT', 'OCR_AUTO_DISABLED'],
      errors: [],
      ocrAttempted: false,
      ocrResultLength: 0,
      nativeCharCount,
    };
  }

  notifyProgress(OCR_PROGRESS_RUNNING);
  logExtractionStep('PDF_OCR_AUTO_START', `${text.length}c native`);
  await ensureTesseract();

  let ocrOut;
  const rendered = await ocrPdfPagesWithRenderer(pdf, {
    maxMs: OCR_FALLBACK_V1_OCR_MAX_MS,
    scale: 2,
  });
  ocrOut = {
    text: rendered.rawText,
    lines: pageTextsToLines(rendered.ocrTextPerPage),
    recoveredAfterTimeout: rendered.timedOut && rendered.rawText.length > 0,
    pageRenderer: rendered,
  };

  ocrAttempted = true;
  ocrResultLength = String(ocrOut?.text || '').trim().length;
  const ocrLines = ocrOut?.lines || [];
  text = String(ocrOut?.text || linesToPlain(ocrLines)).trim();
  method = 'ocr';

  const cleaned = normalizeRawExtract(text);
  const usable = ocrFallbackV1TextUsable(cleaned, { ocrAttempted: true });
  notifyProgress(OCR_PROGRESS_BUILDING);

  logExtractionStep('PDF_OCR_AUTO_DONE', `${cleaned.length}c usable=${usable}`);

  return {
    fileType: 'pdf',
    rawText: text,
    cleanedText: cleaned,
    extractionMethod: method,
    warnings: usable ? ['PDF_OCR_AUTO_OK'] : ['PDF_OCR_PARTIAL', 'NO_RETRY'],
    errors: usable ? [] : ['OCR_TEXT_TOO_SHORT'],
    ocrAttempted,
    ocrResultLength,
    nativeCharCount: linesToPlain(nativeLines).length,
    enterprise: {
      rawExtraction: cleaned,
      cleanedText: cleaned,
      lines: ocrLines.length ? ocrLines : nativeLines,
      method,
      ocrDocument: true,
      metadata: {
        fileType: usable ? 'pdf_scanned' : 'pdf_text',
        ocrAutoFallback: true,
        ocrQualityScore: ocrOut?.confidence,
      },
      pdfExtraction: {
        method: 'ocr',
        decision: 'ocr_auto_fallback',
        charCount: cleaned.length,
        ocrPages: pdf.numPages,
        recoveredAfterTimeout: ocrOut?.recoveredAfterTimeout === true,
      },
    },
  };
}
