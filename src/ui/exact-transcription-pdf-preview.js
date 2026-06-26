/**
 * CSP-safe PDF page preview for Exact Transcription Mode.
 * Renders via PDF.js → canvas (no object/embed/blob plugin viewers).
 */

import { renderPdfPageToCanvas } from '../core/extraction/pdf-ocr-render.js';

const PREVIEW_MAX_WIDTH = 520;

/**
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @param {number} [maxWidth]
 */
export function resolvePreviewScale(pageWidth, pageHeight, maxWidth = PREVIEW_MAX_WIDTH) {
  const w = Number(pageWidth) || 612;
  const base = Math.min(2, maxWidth / w);
  return Math.max(0.75, base);
}

/**
 * @param {HTMLElement} container
 */
export async function ensurePdfJs() {
  if (typeof globalThis.pdfjsLib !== 'undefined') return globalThis.pdfjsLib;
  if (globalThis.HirelyLazy?.ensurePdf) {
    await globalThis.HirelyLazy.ensurePdf();
  }
  if (!globalThis.pdfjsLib) {
    throw new Error('PDF.js unavailable');
  }
  return globalThis.pdfjsLib;
}

/**
 * @param {HTMLElement} container
 * @param {File|Blob} file
 */
async function loadPdfDocument(container, file) {
  if (container._exactPdfDoc && container._exactPdfFile === file) {
    return container._exactPdfDoc;
  }
  const pdfjs = await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  container._exactPdfDoc = doc;
  container._exactPdfFile = file;
  container._exactPdfPageCache = new Map();
  return doc;
}

/**
 * Render one PDF page into container using canvas (CSP-safe).
 * @param {HTMLElement} container
 * @param {File|Blob|null} file
 * @param {number} pageNumber 1-based
 */
export async function renderExactTranscriptionPdfPage(container, file, pageNumber = 1) {
  if (!container) return { ok: false, reason: 'no_container' };
  container.innerHTML = '';
  if (!file) {
    const ph = document.createElement('p');
    ph.className = 'exactTranscriptionDocPlaceholder';
    ph.textContent = 'Aucun fichier source — transcription textuelle uniquement.';
    container.appendChild(ph);
    return { ok: false, reason: 'no_file' };
  }

  try {
    const doc = await loadPdfDocument(container, file);
    const pageIndex = Math.min(Math.max(1, pageNumber), doc.numPages);
    const cacheKey = `${pageIndex}:${container.clientWidth || PREVIEW_MAX_WIDTH}`;
    if (container._exactPdfPageCache?.has(cacheKey)) {
      container.appendChild(container._exactPdfPageCache.get(cacheKey).cloneNode(true));
      return { ok: true, page: pageIndex, cached: true, renderer: 'pdfjs-canvas' };
    }

    const page = await doc.getPage(pageIndex);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = resolvePreviewScale(vp1.width, vp1.height, container.clientWidth || PREVIEW_MAX_WIDTH);
    const canvas = await renderPdfPageToCanvas(page, scale);
    canvas.className = 'exactTranscriptionPdfCanvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      `Aperçu page ${pageIndex} — ${file.name || 'document'}`
    );

    if (!container._exactPdfPageCache) container._exactPdfPageCache = new Map();
    container._exactPdfPageCache.set(cacheKey, canvas);
    container.appendChild(canvas);

    return {
      ok: true,
      page: pageIndex,
      scale,
      width: canvas.width,
      height: canvas.height,
      renderer: 'pdfjs-canvas',
    };
  } catch (err) {
    const ph = document.createElement('p');
    ph.className = 'exactTranscriptionDocPlaceholder';
    ph.textContent = `Aperçu PDF indisponible: ${String(err?.message || err)}`;
    container.appendChild(ph);
    return { ok: false, reason: String(err?.message || err) };
  }
}

/**
 * @param {HTMLElement} container
 */
export function disposeExactTranscriptionPdfPreview(container) {
  if (!container) return;
  container._exactPdfDoc = null;
  container._exactPdfFile = null;
  container._exactPdfPageCache = null;
  container.innerHTML = '';
}
