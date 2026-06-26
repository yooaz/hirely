/**
 * STEP 1 — Input file type detection (extension/MIME).
 * PDF text vs scanned is resolved after native pdf.js probe (classifyPdfForExtraction).
 */

import { assessPdfTextLayer, detectPdfDocumentKind } from './pdf-text-quality.js';

/** @typedef {'txt'|'docx'|'doc'|'rtf'|'image'|'pdf'|'unknown'} InputFileKind */

/** @typedef {'pdf_text'|'pdf_mixed'|'pdf_scanned'|'pdf_image'|'image'|'docx'|'doc'|'txt'|'rtf'} ResolvedFileType */

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;

const TEXT_LAYER_MIN_CHARS = 8;
const SELECTABLE_TEXT_MIN_CHARS = 80;

/**
 * @param {File|{ name?: string, type?: string }} file
 * @returns {{ kind: InputFileKind, mime: string, name: string }}
 */
export function detectInputFileType(file) {
  const name = String(file?.name || '').toLowerCase();
  const mime = String(file?.type || '').toLowerCase();

  if (name.endsWith('.txt') || mime.includes('text/plain')) {
    return { kind: 'txt', mime, name };
  }
  if (name.endsWith('.rtf') || mime.includes('rtf')) {
    return { kind: 'rtf', mime, name };
  }
  if (name.endsWith('.doc') && !name.endsWith('.docx')) {
    return { kind: 'doc', mime, name };
  }
  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
    return { kind: 'docx', mime, name };
  }
  if (name.endsWith('.pdf') || mime.includes('pdf')) {
    return { kind: 'pdf', mime, name };
  }
  if (IMAGE_EXT.test(name) || mime.startsWith('image/')) {
    return { kind: 'image', mime, name };
  }
  return { kind: 'unknown', mime, name };
}

/**
 * STEP 2 — After native pdf.js extraction: text layer vs scanned.
 * @param {Array<{ charCount?: number, lines?: unknown[] }>} pages
 * @param {string} allNativeText
 */
export function classifyPdfForExtraction(pages, allNativeText) {
  const nativeCharCount = String(allNativeText || '').trim().length;
  const pageList = pages || [];
  const pagesWithLayer = pageList.filter(
    (p) => (p.charCount || 0) > 0 || (p.lines || []).length > 0
  ).length;
  const fullQuality = assessPdfTextLayer(allNativeText);
  const docKind = detectPdfDocumentKind(pageList, allNativeText);

  const textLayerFound =
    pagesWithLayer > 0 && nativeCharCount >= TEXT_LAYER_MIN_CHARS;

  /** Any pdf.js text layer with real content → native extraction only (never full-document OCR). */
  const hasSelectableText =
    textLayerFound &&
    nativeCharCount >= 24 &&
    (docKind.kind === 'native_pdf' ||
      fullQuality.usable ||
      fullQuality.strongTextLayer ||
      fullQuality.preferNativeText ||
      docKind.nativePageCount >= Math.max(1, pageList.length));

  const fileType =
    docKind.kind === 'native_pdf'
      ? 'pdf_text'
      : docKind.kind === 'pdf_mixed'
        ? 'pdf_mixed'
        : 'pdf_scanned';

  return {
    fileType,
    documentKind: docKind.kind,
    extractionRoute: docKind.route,
    nativePageCount: docKind.nativePageCount,
    textLayerFound,
    hasSelectableText,
    confidence: fullQuality.confidence,
    pages: pageList.length,
    nativeCharCount,
    quality: fullQuality,
  };
}

/**
 * Debug / UI label for extraction method.
 * @param {string} method
 * @returns {'Native PDF'|'OCR'|'Mixed'|string}
 */
export function extractionSourceLabel(method) {
  const m = String(method || '').toLowerCase();
  if (m === 'native_pdf' || m === 'pdf-text' || m === 'pdf_text') return 'Native PDF';
  if (m === 'mixed') return 'Mixed';
  if (m === 'ocr' || m === 'pdf-ocr' || m === 'image-ocr' || m === 'image') return 'OCR';
  if (m === 'txt' || m === 'docx' || m === 'paste') return 'Native PDF';
  return method || '—';
}

/**
 * @param {ResolvedFileType|string} fileType
 */
export function fileTypeLabel(fileType) {
  const t = String(fileType || '');
  if (t === 'pdf_text') return 'PDF with text layer';
  if (t === 'pdf_mixed') return 'Mixed PDF (native + OCR)';
  if (t === 'pdf_scanned') return 'Scanned PDF';
  if (t === 'image') return 'Image';
  if (t === 'docx') return 'DOCX';
  if (t === 'doc') return 'DOC';
  if (t === 'txt') return 'TXT';
  if (t === 'rtf') return 'RTF';
  if (t === 'pdf_image') return 'Image-based PDF';
  return t || '—';
}
