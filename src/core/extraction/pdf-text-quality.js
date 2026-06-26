/**
 * PDF text layer quality — prefer selectable text before OCR.
 */

import { isGarbageLine } from '../../data/dictionaries/garbagePatterns.js';

const MIN_CHARS = 80;
const MIN_WORDS = 25;
const MIN_WORDS_LENIENT = 12;
const MIN_ALPHA_RATIO = 0.42;
const MIN_AVG_WORD_LEN = 2.2;
const MAX_GARBAGE_LINE_RATIO = 0.55;

export function isPdfTextLayerUsable(text) {
  return assessPdfTextLayer(text).usable;
}

/**
 * @returns {{
 *   usable: boolean,
 *   charCount: number,
 *   wordCount: number,
 *   alphaRatio: number,
 *   avgWordLen: number,
 *   garbageLineRatio: number,
 *   confidence: number,
 *   reason: string
 * }}
 */
export function assessPdfTextLayer(text) {
  const s = String(text || '').trim();
  const charCount = s.length;
  const words = s.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(w));
  const wordCount = words.length;
  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const alphaRatio = charCount ? letters / charCount : 0;
  const avgWordLen = words.length
    ? words.reduce((a, w) => a + w.length, 0) / words.length
    : 0;

  const lines = s.split('\n').map((l) => l.trim()).filter(Boolean);
  const garbageLines = lines.filter((l) => isGarbageLine(l) || l.length < 3).length;
  const garbageLineRatio = lines.length ? garbageLines / lines.length : 1;

  const reasons = [];

  if (charCount < MIN_CHARS) {
    reasons.push(`text layer short (${charCount} chars < ${MIN_CHARS})`);
  }
  if (wordCount < MIN_WORDS) {
    reasons.push(`few words (${wordCount} < ${MIN_WORDS})`);
  }
  if (alphaRatio < MIN_ALPHA_RATIO) {
    reasons.push(`low alphabetic ratio (${Math.round(alphaRatio * 100)}%)`);
  }
  if (!words.length || avgWordLen < MIN_AVG_WORD_LEN) {
    reasons.push('words too fragmented for readable CV text');
  }
  if (lines.length && garbageLineRatio > MAX_GARBAGE_LINE_RATIO) {
    reasons.push(`too many garbage lines (${Math.round(garbageLineRatio * 100)}%)`);
  }

  /** Rich selectable layers (two-column / sidebar PDFs) often fail line garbage heuristics — still use text. */
  const strongTextLayer =
    charCount >= 200 &&
    wordCount >= 20 &&
    alphaRatio >= 0.38 &&
    avgWordLen >= MIN_AVG_WORD_LEN;

  let confidence = 0;
  if (charCount >= MIN_CHARS) confidence += 25;
  if (wordCount >= MIN_WORDS) confidence += 20;
  if (alphaRatio >= MIN_ALPHA_RATIO) confidence += 20;
  if (avgWordLen >= MIN_AVG_WORD_LEN) confidence += 15;
  if (garbageLineRatio <= MAX_GARBAGE_LINE_RATIO) confidence += 20;
  confidence = Math.min(100, confidence);

  let usable = reasons.length === 0;
  let reason = usable
    ? `Selectable text layer (${charCount} chars, ${wordCount} words, confidence ${confidence}%)`
    : reasons.join('; ');

  if (!usable && strongTextLayer) {
    const softFails = reasons.filter(
      (r) => !r.includes('garbage lines') && !r.includes('few words')
    );
    if (!softFails.length || (charCount >= 400 && wordCount >= 35)) {
      usable = true;
      confidence = Math.max(confidence, 78);
      reason = `Selectable text layer — rich PDF text preferred over OCR (${charCount} chars, ${wordCount} words, confidence ${confidence}%)`;
    }
  }

  /** Short but real CV headers (name, title, contact) — still prefer pdf-text over OCR. */
  const preferNativeText =
    charCount >= MIN_CHARS &&
    wordCount >= MIN_WORDS_LENIENT &&
    alphaRatio >= 0.35 &&
    letters >= 40 &&
    avgWordLen >= MIN_AVG_WORD_LEN;

  if (!usable && preferNativeText) {
    const hardFails = reasons.filter(
      (r) =>
        r.includes('text layer short') ||
        r.includes('low alphabetic') ||
        r.includes('fragmented')
    );
    if (!hardFails.length) {
      usable = true;
      confidence = Math.max(confidence, 72);
      reason = `Selectable text layer — native PDF text preferred over OCR (${charCount} chars, ${wordCount} words, confidence ${confidence}%)`;
    }
  }

  return {
    usable,
    charCount,
    wordCount,
    alphaRatio: Math.round(alphaRatio * 1000) / 1000,
    avgWordLen: Math.round(avgWordLen * 100) / 100,
    garbageLineRatio: Math.round(garbageLineRatio * 1000) / 1000,
    confidence,
    strongTextLayer,
    preferNativeText,
    reason,
  };
}

/** @typedef {'native_pdf'|'pdf_mixed'|'pdf_scanned'} PdfDocumentKind */

const PAGE_NATIVE_MIN_CHARS = 32;

/**
 * Classify PDF: native (full text layer), mixed (partial native + OCR pages), scanned.
 * Ported from V27 document-detect concepts.
 *
 * @param {Array<{ page?: number, charCount?: number, lines?: unknown[], usable?: boolean }>} pages
 * @param {string} allNativeText
 * @returns {{
 *   kind: PdfDocumentKind,
 *   nativePageCount: number,
 *   totalPages: number,
 *   quality: ReturnType<typeof assessPdfTextLayer>,
 *   route: 'native'|'hybrid'|'ocr'
 * }}
 */
export function detectPdfDocumentKind(pages, allNativeText) {
  const pageList = pages || [];
  const totalPages = Math.max(pageList.length, 1);
  const quality = assessPdfTextLayer(allNativeText);
  const nativeCharCount = String(allNativeText || '').trim().length;

  const nativePageCount = pageList.filter(
    (p) =>
      p.usable ||
      ((p.charCount || 0) >= PAGE_NATIVE_MIN_CHARS &&
        assessPdfTextLayer(
          (p.lines || []).map((l) => l.text || l).join('\n')
        ).confidence >= 50)
  ).length;

  const hasTextLayer =
    pageList.some((p) => (p.charCount || 0) >= 8 || (p.lines || []).length > 0) &&
    nativeCharCount >= 8;

  const selectableNative =
    quality.usable || quality.strongTextLayer || quality.preferNativeText;

  if (selectableNative && nativePageCount >= totalPages) {
    return {
      kind: 'native_pdf',
      nativePageCount,
      totalPages,
      quality,
      route: 'native',
    };
  }

  /** All pages carry native text — prefer pdf.js extraction over OCR even when quality heuristics are strict. */
  if (nativePageCount >= totalPages && hasTextLayer && nativeCharCount >= 24) {
    return {
      kind: 'native_pdf',
      nativePageCount,
      totalPages,
      quality,
      route: 'native',
    };
  }

  if (
    nativePageCount > 0 &&
    nativePageCount < totalPages &&
    hasTextLayer
  ) {
    return {
      kind: 'pdf_mixed',
      nativePageCount,
      totalPages,
      quality,
      route: 'hybrid',
    };
  }

  if (
    hasTextLayer &&
    nativeCharCount >= PAGE_NATIVE_MIN_CHARS &&
    !quality.usable &&
    nativePageCount > 0
  ) {
    return {
      kind: 'pdf_mixed',
      nativePageCount,
      totalPages,
      quality,
      route: 'hybrid',
    };
  }

  return {
    kind: 'pdf_scanned',
    nativePageCount,
    totalPages,
    quality,
    route: 'ocr',
  };
}
