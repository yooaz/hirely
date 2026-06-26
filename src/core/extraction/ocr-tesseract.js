/**
 * Offline Tesseract OCR — local /vendor/tesseract only (no CDN).
 */

import { preprocessCanvasForOcr } from './ocr-preprocess.js';
import {
  getLocalTesseractOptions,
  OcrUnavailableError,
} from '../../vendor/tesseract-runtime.js';
import { clusterOcrWordsIntoLineGroups } from './extraction-column-split.js';
import { extractEngineWordBbox, isValidWordBbox } from './ocr-geometry.js';

export { OcrUnavailableError };

const DEFAULT_LANG = 'fra+eng';

export async function ensureTesseract() {
  if (typeof globalThis.document === 'undefined') throw new Error('OCR requires a browser');
  if (globalThis.Tesseract) return globalThis.Tesseract;
  try {
    if (globalThis.HirelyLazy?.ensureTesseract) {
      await globalThis.HirelyLazy.ensureTesseract();
      return globalThis.Tesseract;
    }
    const mod = await import('../../vendor/csp-safe-loader.js');
    await mod.ensureTesseract();
    return globalThis.Tesseract;
  } catch (err) {
    if (err instanceof OcrUnavailableError || err?.code?.startsWith?.('OCR_')) throw err;
    throw new OcrUnavailableError(err?.message || 'OCR unavailable', 'OCR_UNAVAILABLE');
  }
}

function tesseractOptions(opts = {}) {
  const T = globalThis.Tesseract;
  const psm = opts.tessPsm || '3';
  return {
    ...getLocalTesseractOptions(),
    logger: () => {},
    tessedit_ocr_engine_mode: T?.OEM?.LSTM_ONLY ?? '1',
    tessedit_pageseg_mode: psm,
  };
}

export async function recognizeCanvas(canvas, lang = DEFAULT_LANG) {
  const out = await recognizeCanvasWithLines(canvas, lang);
  return out.text;
}

export function mapTesseractWords(data) {
  return (data?.words || [])
    .map((w) => {
      const text = String(w.text || '').trim();
      if (!text) return null;
      const bbox = extractEngineWordBbox(w);
      if (!bbox || !isValidWordBbox(bbox)) return null;
      return {
        text,
        confidence: Math.round(w.confidence ?? 70),
        bbox,
        source: 'ocr',
        inferred: false,
      };
    })
    .filter(Boolean);
}

/**
 * @returns {{ text: string, lines: Array<{ text: string, confidence: number, line: number, x: number, y: number }>, words: object[] }}
 */
export async function recognizeCanvasWithLines(canvas, lang = DEFAULT_LANG, opts = {}) {
  const Tesseract = await ensureTesseract();
  let target = canvas;
  if (!opts.preprocessed) {
    const prep = preprocessCanvasForOcr(canvas, { debug: false });
    target = prep.canvas;
  }
  const { data } = await Tesseract.recognize(target, lang, tesseractOptions(opts));
  const text = String(data?.text || '').trim();
  const pageWidth = target.width || canvas.width || 0;
  /** @type {Array<{ text: string, confidence: number, line: number, x: number, y: number, width?: number, height?: number }>} */
  let lines = [];

  const pushLine = (line, i) => {
    const t = String(line.text || '').trim();
    if (!t) return;
    lines.push({
      text: t,
      confidence: Math.round(line.confidence ?? 70),
      line: i,
      x: Math.round(line.x ?? line.bbox?.x0 ?? 0),
      y: Math.round(line.y ?? line.bbox?.y1 ?? 0),
      width: line.width,
      height: line.height,
    });
  };

  const src = data?.lines?.length ? data.lines : null;
  if (src) {
    src.forEach((line, i) => pushLine({
      text: line.text,
      confidence: line.confidence,
      x: line.bbox?.x0 ?? 0,
      y: line.bbox?.y1 ?? 0,
      width: Math.max(4, (line.bbox?.x1 ?? 0) - (line.bbox?.x0 ?? 0)),
      height: Math.max(8, (line.bbox?.y1 ?? 0) - (line.bbox?.y0 ?? 0)),
    }, i));
  }

  const positionedCount = lines.filter((l) => l.x > 0 || l.y > 0).length;
  if ((!lines.length || positionedCount < Math.min(3, lines.length)) && data?.words?.length) {
    const wordGroups = clusterOcrWordsIntoLineGroups(data.words, pageWidth);
    if (wordGroups.length) {
      lines = wordGroups.map((g, i) => ({
        text: g.text,
        confidence: 72,
        line: i,
        x: g.x,
        y: g.y,
        width: g.width,
        height: g.height,
      }));
    }
  }

  if (!lines.length && text) {
    text.split('\n').forEach((t, i) => {
      const s = t.trim();
      if (s) lines.push({ text: s, confidence: 70, line: i, x: 0, y: 0 });
    });
  }

  const words = mapTesseractWords(data);
  return { text, lines, words };
}
