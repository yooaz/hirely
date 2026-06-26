/**
 * PDF page OCR orchestration — render each page, OCR, concatenate (pdf.js).
 */

import { renderAllPdfPages } from './pdf-ocr-render.js';
import { runOcrOnCanvas } from './ocr-pipeline.js';

export const PAGE_SEPARATOR = '\n\n';

/**
 * Join per-page OCR text with stable separators (for tests + parsing).
 * @param {string[]} pageTexts
 */
export function concatPageOcrTexts(pageTexts) {
  return (pageTexts || [])
    .map((t) => String(t || '').trim())
    .filter((t) => t.length > 0)
    .join(PAGE_SEPARATOR);
}

/**
 * OCR every page of a pdf.js document.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {{ lang?: string }} [opts]
 */
export async function ocrPdfPages(pdf, opts = {}) {
  const canvases = await renderAllPdfPages(pdf, opts.scale);
  const pageTexts = [];
  for (let i = 0; i < canvases.length; i++) {
    const text = await runOcrOnCanvas(canvases[i], { lang: opts.lang || 'fra+eng' });
    if (text) pageTexts.push(text);
  }
  return {
    text: concatPageOcrTexts(pageTexts),
    pageCount: canvases.length,
    pageTexts,
  };
}
