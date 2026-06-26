/**
 * Unified OCR: Google Vision (/api/ocr) → custom cloud → Tesseract (offline).
 */

import { tryCloudOcr, cloudOcrConfigured } from './cloud-ocr.js';
import { recognizeCanvas, recognizeCanvasWithLines, ensureTesseract } from './ocr-tesseract.js';
import { shouldSkipRemoteOcr } from '../runtime/static-mode.js';
import { logOcrPropagate } from './ocr-propagation-trace.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const PDF_OCR_RENDER_SCALE = 5;

let lastOcrMetrics = null;

export function getLastOcrMetrics() {
  return lastOcrMetrics;
}

function setMetrics(m) {
  lastOcrMetrics = m;
  if (typeof console !== 'undefined' && m) hirelyDebugLog('HIRELY OCR', m);
}

function defaultVisionUrl() {
  if (typeof globalThis === 'undefined' || !globalThis.location) return '';
  const { origin, pathname } = globalThis.location;
  if (!origin || origin === 'null') return '';
  const base = pathname.replace(/\/[^/]*$/, '/');
  return `${origin}${base}api/ocr`;
}

export async function tryVisionApi(blob, opts = {}) {
  if (shouldSkipRemoteOcr()) return null;
  const url = opts.visionUrl || globalThis.HIRELY_VISION_OCR_URL || defaultVisionUrl();
  if (!url || typeof fetch !== 'function') return null;

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const form = new FormData();
    form.append('file', blob, blob.name || 'page.png');
    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || !data?.text) return null;
    const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    return { text: String(data.text).trim(), provider: data.provider || 'google-vision', timingMs: data.timingMs || ms };
  } catch (e) {
    console.warn('Vision OCR', e);
    return null;
  }
}

async function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png', 0.95);
  });
}

export async function runOcrOnCanvas(canvas, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const blob = opts.file || (await canvasToPngBlob(canvas));

  let result = await tryVisionApi(blob, opts);
  if (!result?.text && cloudOcrConfigured()) {
    const cloud = await tryCloudOcr(blob, opts);
    if (cloud) result = { text: cloud, provider: 'cloud-proxy', timingMs: 0 };
  }
  if (!result?.text) {
    await ensureTesseract();
    const text = await recognizeCanvas(canvas, opts.lang || 'fra+eng', opts);
    const totalMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    result = { text, provider: 'tesseract', timingMs: totalMs };
  }

  const totalMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  setMetrics({
    provider: result.provider,
    charCount: result.text.length,
    timingMs: result.timingMs || totalMs,
    totalMs,
    preprocessed: true,
  });
  return result.text;
}

/**
 * OCR canvas → text + line confidences (Vision / cloud / Tesseract).
 * @returns {Promise<{ text: string, lines: Array<{ text: string, confidence: number, line: number, x: number, y: number }>, provider: string }>}
 */
export async function runOcrOnCanvasWithLines(canvas, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const blob = opts.file || (await canvasToPngBlob(canvas));

  let result = await tryVisionApi(blob, opts);
  if (!result?.text && cloudOcrConfigured()) {
    const cloud = await tryCloudOcr(blob, opts);
    if (cloud) result = { text: cloud, provider: 'cloud-proxy', timingMs: 0 };
  }
  if (!result?.text) {
    await ensureTesseract();
    const tess = await recognizeCanvasWithLines(canvas, opts.lang || 'fra+eng', opts);
    const totalMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    result = {
      text: tess.text,
      lines: tess.lines,
      words: tess.words || [],
      provider: 'tesseract',
      timingMs: totalMs,
    };
  } else {
    const lines = String(result.text || '')
      .split('\n')
      .map((t, i) => ({ text: t.trim(), confidence: 85, line: i, x: 0, y: 0 }))
      .filter((l) => l.text.length > 0);
    result = { ...result, lines };
  }

  const totalMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  setMetrics({
    provider: result.provider,
    charCount: result.text.length,
    timingMs: result.timingMs || totalMs,
    totalMs,
    preprocessed: true,
    lineCount: result.lines?.length || 0,
    preprocess: opts.preprocessMeta || null,
  });
  logOcrPropagate('OCR_PIPELINE', {
    OCR_RESULT_TEXT_LENGTH: result.text.length,
    OCR_LINES_COUNT: result.lines?.length || 0,
    provider: result.provider,
  });
  return result;
}
