/**
 * HIRELY OCR Page Renderer — pdf.js page → canvas (scale 2) → PNG → Tesseract.
 * Processes pages in order; hard stop at maxMs (default 20s total).
 */
import { concatPageOcrTexts } from './pdf-ocr-pages.js';
import { ensureTesseract } from './ocr-tesseract.js';
import { getLocalTesseractOptions } from '../../vendor/tesseract-runtime.js';
import { logExtractionStep } from './file-buffer.js';
import { OCR_FALLBACK_V1_OCR_MAX_MS } from '../import/ocr-fallback-v1.js';

export const OCR_PAGE_RENDERER_VERSION = 'OCR_PAGE_RENDERER_V1';
export const OCR_PAGE_RENDER_SCALE = 2;
export const OCR_PAGE_RENDERER_MAX_MS = OCR_FALLBACK_V1_OCR_MAX_MS;
export const OCR_PAGE_RENDERER_LANG = 'fra+eng';

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {number} [scale]
 */
export async function renderPdfPageToCanvasAtScale(page, scale = OCR_PAGE_RENDER_SCALE) {
  if (typeof document === 'undefined') {
    throw new Error('OCR_PAGE_RENDERER_REQUIRES_BROWSER');
  }
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('CANVAS_TO_BLOB_FAILED'))),
      'image/png',
      0.92
    );
  });
}

/**
 * @param {Blob} blob
 * @param {string} [lang]
 */
export async function ocrPngBlobWithTesseract(blob, lang = OCR_PAGE_RENDERER_LANG) {
  const Tesseract = await ensureTesseract();
  const { data } = await Tesseract.recognize(blob, lang, {
    ...getLocalTesseractOptions(),
    logger: () => {},
    tessedit_ocr_engine_mode: Tesseract?.OEM?.LSTM_ONLY ?? '1',
    tessedit_pageseg_mode: '3',
  });
  return String(data?.text || '').trim();
}

function remainingBudgetMs(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

function disposeCanvas(canvas) {
  if (!canvas) return;
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    /* ignore */
  }
}

/**
 * Render each PDF page at scale 2, OCR via Tesseract, append text in page order.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {{ maxMs?: number, lang?: string, scale?: number }} [opts]
 * @returns {Promise<{
 *   pageCount: number,
 *   ocrAttempted: true,
 *   ocrTextPerPage: string[],
 *   totalOcrTextLength: number,
 *   rawText: string,
 *   pagesProcessed: number,
 *   timedOut: boolean,
 *   elapsedMs: number,
 * }>}
 */
export async function ocrPdfPagesWithRenderer(pdf, opts = {}) {
  const maxMs = Number(opts.maxMs) > 0 ? Number(opts.maxMs) : OCR_PAGE_RENDERER_MAX_MS;
  const scale = Number(opts.scale) > 0 ? Number(opts.scale) : OCR_PAGE_RENDER_SCALE;
  const lang = opts.lang || OCR_PAGE_RENDERER_LANG;
  const t0 = Date.now();
  const deadlineAt = t0 + maxMs;
  const pageCount = pdf?.numPages ?? 0;
  const ocrTextPerPage = [];

  if (!pageCount) {
    return {
      pageCount: 0,
      ocrAttempted: true,
      ocrTextPerPage: [],
      totalOcrTextLength: 0,
      rawText: '',
      pagesProcessed: 0,
      timedOut: false,
      elapsedMs: 0,
    };
  }

  await ensureTesseract();
  logExtractionStep('OCR_PAGE_RENDERER_START', `${pageCount}p scale=${scale}`);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    if (remainingBudgetMs(deadlineAt) <= 0) {
      logExtractionStep('OCR_PAGE_RENDERER_TIMEOUT', `before page ${pageNumber}`);
      break;
    }

    let canvas = null;
    try {
      const page = await pdf.getPage(pageNumber);
      canvas = await renderPdfPageToCanvasAtScale(page, scale);
      const blob = await canvasToPngBlob(canvas);
      const budget = remainingBudgetMs(deadlineAt);
      if (budget <= 0) {
        ocrTextPerPage.push('');
        break;
      }

      const text = await Promise.race([
        ocrPngBlobWithTesseract(blob, lang),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OCR_PAGE_BUDGET_EXCEEDED')), budget)
        ),
      ]).catch(() => '');

      ocrTextPerPage.push(String(text || '').trim());
      logExtractionStep(
        'OCR_PAGE_RENDERER_PAGE',
        `p${pageNumber}/${pageCount} ${ocrTextPerPage[ocrTextPerPage.length - 1].length}c`
      );
    } catch (err) {
      ocrTextPerPage.push('');
      logExtractionStep('OCR_PAGE_RENDERER_PAGE_FAIL', `p${pageNumber} ${err?.message || err}`);
    } finally {
      disposeCanvas(canvas);
    }
  }

  const rawText = concatPageOcrTexts(ocrTextPerPage);
  const elapsedMs = Date.now() - t0;
  const timedOut = elapsedMs >= maxMs || ocrTextPerPage.length < pageCount;

  logExtractionStep(
    'OCR_PAGE_RENDERER_DONE',
    `${ocrTextPerPage.length}/${pageCount}p ${rawText.length}c ${elapsedMs}ms`
  );

  return {
    pageCount,
    ocrAttempted: true,
    ocrTextPerPage,
    totalOcrTextLength: rawText.length,
    rawText,
    pagesProcessed: ocrTextPerPage.length,
    timedOut,
    elapsedMs,
  };
}
