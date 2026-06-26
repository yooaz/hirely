/**
 * Scanned PDF / image OCR — Vision → cloud proxy → Tesseract fallback.
 */

import { PDF_OCR_RENDER_SCALE, getLastOcrMetrics, tryVisionApi, runOcrOnCanvas } from './ocr-pipeline.js';
import { ocrPdfPages } from './pdf-ocr-pages.js';
import { tryCloudOcr, cloudOcrConfigured } from './cloud-ocr.js';

export { concatPageOcrTexts, PAGE_SEPARATOR } from './pdf-ocr-pages.js';

export { ensureTesseract } from './ocr-tesseract.js';
export { getLastOcrMetrics, tryVisionApi, PDF_OCR_RENDER_SCALE };

const DEFAULT_LANG = 'fra+eng';

export function isBrowser() {
  return typeof globalThis.document !== 'undefined';
}

export async function ocrCanvas(canvas, lang = DEFAULT_LANG) {
  return runOcrOnCanvas(canvas, { lang });
}

export async function ocrImageFile(file, lang = DEFAULT_LANG) {
  if (cloudOcrConfigured()) {
    const cloud = await tryCloudOcr(file, { lang });
    if (cloud && cloud.length >= 20) return cloud;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return await runOcrOnCanvas(c, { lang, file });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function ocrPdfDocument(pdf, lang = DEFAULT_LANG) {
  if (cloudOcrConfigured() && pdf?.getData) {
    try {
      const data = await pdf.getData();
      const blob = new Blob([data], { type: 'application/pdf' });
      const cloud = await tryCloudOcr(blob, { lang });
      if (cloud && cloud.length >= 40) return cloud;
    } catch (e) {
      console.warn('HIRELY cloud OCR (PDF) skipped', e);
    }
  }

  const { text } = await ocrPdfPages(pdf, { lang });
  return text;
}
