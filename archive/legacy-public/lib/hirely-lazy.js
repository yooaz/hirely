/**
 * Block 12 — Lazy-load heavy CDN libraries (PDF, DOCX, OCR, export).
 */

const cache = new Map();

export function loadScript(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(el);
  });
  cache.set(src, p);
  return p;
}

export async function ensurePdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return window.pdfjsLib;
}

export async function ensureMammoth() {
  if (window.mammoth) return window.mammoth;
  await loadScript('https://unpkg.com/mammoth/mammoth.browser.min.js');
  return window.mammoth;
}

export async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  return window.Tesseract;
}

export async function ensureHtml2Pdf() {
  if (window.html2pdf) return window.html2pdf;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
  return window.html2pdf;
}

export async function ensureHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  return window.html2canvas;
}

export default {
  loadScript,
  ensurePdfJs,
  ensureMammoth,
  ensureTesseract,
  ensureHtml2Pdf,
  ensureHtml2Canvas
};
