/**
 * Fast multi-preprocess OCR — pick best of 3 passes (no full 4-pass UI fusion).
 * Used for scanned PDFs when HIRELY_OCR_FUSION is off.
 */

import { runOcrPass, OCR_PASS_DEFS } from './ocr-multipass.js';
import { scoreOcrCandidate } from './ocr-fusion.js';
import { OCR_FALLBACK_CONFIDENCE } from './extracted-line.js';

const PDF_BEST_PASSES = OCR_PASS_DEFS.filter((p) =>
  ['A', 'B', 'C'].includes(p.id)
);

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
  }));
}

/**
 * Run standard + high_contrast + large_font; return highest-scoring result.
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 */
export async function runOcrBestPass(canvas, opts = {}) {
  const page = opts.page || 1;
  const candidates = [];

  for (const passDef of PDF_BEST_PASSES) {
    try {
      const out = await runOcrPass(canvas, passDef, opts);
      const scores = scoreOcrCandidate(out);
      candidates.push({
        passId: passDef.id,
        passLabel: passDef.label,
        text: out.text,
        lines: out.lines,
        scores,
      });
    } catch (e) {
      console.warn('HIRELY OCR best-pass', passDef.id, e);
    }
  }

  if (!candidates.length) {
    return { text: '', lines: [], winnerPass: null, scores: scoreOcrCandidate({ text: '' }) };
  }

  candidates.sort((a, b) => {
    const ta = b.scores?.total ?? 0;
    const tb = a.scores?.total ?? 0;
    if (ta !== tb) return ta - tb;
    return (b.scores?.charCount ?? 0) - (a.scores?.charCount ?? 0);
  });

  const winner = candidates[0];
  return {
    text: winner.text,
    lines: winner.lines?.length ? winner.lines : mapLines({ lines: [] }, page),
    winnerPass: winner.passId,
    scores: winner.scores,
    allPasses: candidates.map((c) => ({
      id: c.passId,
      total: c.scores?.total,
      chars: c.scores?.charCount,
    })),
  };
}

export function isOcrBestPassEnabled(opts = {}) {
  if (opts.bestPass === false) return false;
  if (opts.bestPass === true) return true;
  if (typeof globalThis !== 'undefined') {
    if (globalThis.HIRELY_OCR_BEST_PASS === '0') return false;
    if (globalThis.HIRELY_OCR_BEST_PASS === '1') return true;
  }
  return true;
}
