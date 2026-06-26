/**
 * Multi-pass OCR (A–D) + fusion winner — internal pipeline.
 */

import { runOcrOnCanvasWithLines } from './ocr-pipeline.js';
import { preprocessCanvasForOcr } from './ocr-preprocess.js';
import {
  scoreOcrCandidate,
  pickFusionWinner,
  buildFusionRecord,
  fuseOcrCandidatesToLines,
} from './ocr-fusion.js';
import { setLastOcrFusionInternal } from './extraction-session.js';
import { OCR_FALLBACK_CONFIDENCE } from './extracted-line.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { buildOcrGeometryTransform, normalizeOcrWordsToPageSpace } from './ocr-geometry.js';

export const OCR_PASS_DEFS = [
  { id: 'A', label: 'standard', variant: 'standard' },
  { id: 'B', label: 'high_contrast', variant: 'high_contrast' },
  { id: 'C', label: 'large_font', variant: 'large_font' },
  { id: 'D', label: 'layout', variant: 'layout' },
];

function fusionDisabled(opts = {}) {
  if (opts.fusion === false) return true;
  if (opts.fusion === true) return false;
  if (typeof globalThis !== 'undefined') {
    if (globalThis.HIRELY_OCR_FUSION === '1') return false;
    if (globalThis.HIRELY_OCR_FUSION === '0') return true;
  }
  /** Default off — multi-pass OCR is slow on multi-page PDFs; enable with ?fusion=1 or HIRELY_OCR_FUSION=1 */
  return true;
}

function mapLines(result, page) {
  return (result.lines || []).map((ln, i) => ({
    text: ln.text,
    rawExtraction: ln.text,
    confidence: Math.round(ln.confidence ?? OCR_FALLBACK_CONFIDENCE),
    source: 'ocr',
    page,
    line: ln.line ?? i,
    x: ln.x ?? 0,
    y: ln.y ?? 0,
    width: ln.width,
    height: ln.height,
    words: ln.words,
    columnId: ln.columnId,
    region: ln.region,
  }));
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 */
export async function runOcrPass(canvas, passDef, opts = {}) {
  const prep = preprocessCanvasForOcr(canvas, {
    viewportWidth: opts.viewportWidth || canvas.width,
    viewportHeight: opts.viewportHeight || canvas.height,
    renderWidth: opts.renderWidth || opts.viewportWidth || canvas.width,
    renderHeight: opts.renderHeight || opts.viewportHeight || canvas.height,
    targetDpi: opts.targetDpi,
    variant: passDef.variant,
    skipAutoRotate: opts.skipAutoRotate === true,
    rotationDeg: opts.rotationDeg || 0,
    debug: false,
    page: opts.page,
  });
  const result = await runOcrOnCanvasWithLines(prep.canvas, {
    lang: opts.lang || 'fra+eng',
    preprocessed: true,
    tessPsm: prep.meta.suggestedPsm,
    preprocessMeta: { ...prep.meta, pass: passDef.id },
  });
  const renderScale =
    opts.renderScale ||
    (opts.viewportWidth > 0 ? (opts.renderWidth || canvas.width) / opts.viewportWidth : 1);
  const transform = buildOcrGeometryTransform(prep.meta, {
    viewportWidth: opts.viewportWidth,
    viewportHeight: opts.viewportHeight,
    renderScale,
    rotationDeg: opts.rotationDeg || 0,
    renderWidth: opts.renderWidth,
    renderHeight: opts.renderHeight,
  });
  const words = normalizeOcrWordsToPageSpace(result.words || [], transform).map((w) => ({
    ...w,
    page: opts.page || 1,
  }));
  const lines = mapLines({ ...result, lines: result.lines }, opts.page || 1);
  const text = String(result.text || '').trim();
  const scores = scoreOcrCandidate({ text, lines });
  return { id: passDef.id, label: passDef.label, text, lines, words, scores, provider: result.provider };
}

/**
 * Four-pass OCR with winner selection.
 * @returns {Promise<{ text: string, lines: import('./extracted-line.js').ExtractedLine[], fusion: object }>}
 */
export async function runOcrWithFusion(canvas, opts = {}) {
  const candidates = {};
  for (const passDef of OCR_PASS_DEFS) {
    try {
      const out = await runOcrPass(canvas, passDef, opts);
      candidates[passDef.id] = out;
    } catch (e) {
      console.warn('HIRELY OCR pass', passDef.id, e);
      candidates[passDef.id] = { id: passDef.id, text: '', lines: [], scores: scoreOcrCandidate({ text: '' }) };
    }
  }

  const pick = pickFusionWinner(candidates);
  const record = buildFusionRecord(candidates, pick);
  record.page = opts.page || 1;
  setLastOcrFusionInternal(record);

  if (typeof console !== 'undefined' && globalThis.HIRELY_OCR_FUSION_LOG === '1') {
    hirelyDebugLog('HIRELY OCR fusion (internal)', record.winnerId, record.scores);
  }

  const fusedLines = fuseOcrCandidatesToLines(candidates, pick, {
    page: opts.page || 1,
    defaultConfidence: OCR_FALLBACK_CONFIDENCE,
  });
  const winner = pick.winner;
  const text =
    fusedLines.map((l) => l.text).join('\n') ||
    winner.text ||
    '';
  return {
    text,
    lines: fusedLines.length ? fusedLines : winner.lines || [],
    fusion: record,
  };
}

export function isOcrFusionEnabled(opts = {}) {
  return !fusionDisabled(opts);
}
