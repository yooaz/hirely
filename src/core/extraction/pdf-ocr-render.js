/**
 * Render PDF pages to high-resolution canvases for OCR.
 * Memory-safe: caps edge length via getOcrDpiScale (P0-4).
 */

import {
  getOcrDpiScale,
  OCR_TARGET_DPI,
  OCR_MAX_CANVAS_EDGE,
  resolveOcrTargetDpi,
} from './ocr-preprocess.js';

/**
 * Dynamic scale for ~300 DPI with hard cap on longest edge.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {number} [targetDpi]
 */
export function resolveOcrRenderScale(page, targetDpi = resolveOcrTargetDpi()) {
  const vp1 = page.getViewport({ scale: 1 });
  return getOcrDpiScale(vp1.width, vp1.height, targetDpi);
}

export async function renderPdfPageToCanvas(page, scale) {
  const vp1 = page.getViewport({ scale: 1 });
  if (scale == null) {
    scale = resolveOcrRenderScale(page);
  }
  let viewport = page.getViewport({ scale });
  let edge = Math.max(viewport.width, viewport.height);
  if (edge > OCR_MAX_CANVAS_EDGE) {
    scale *= OCR_MAX_CANVAS_EDGE / edge;
    viewport = page.getViewport({ scale });
  }
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export async function renderAllPdfPages(pdf, scale = null) {
  const canvases = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    canvases.push(await renderPdfPageToCanvas(page, scale));
  }
  return canvases;
}
