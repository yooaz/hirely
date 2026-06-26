/**
 * OCR text propagation trace — find where extracted text is lost.
 */

import { logExtractionStep } from './file-buffer.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

/**
 * @param {string} text
 * @param {unknown[]} [lines]
 */
export function joinedTextLength(text, lines = []) {
  const direct = String(text ?? '').trim();
  if (direct.length) return direct.length;
  const fromLines = (lines || [])
    .map((l) => String(l?.text ?? l?.cleanedText ?? l?.rawExtraction ?? '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
  return fromLines.length;
}

/**
 * @param {string} stage
 * @param {Record<string, number|string|null>} metrics
 */
export function logOcrPropagate(stage, metrics) {
  const parts = Object.entries(metrics)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${v}`);
  logExtractionStep(stage, parts.join(' '));
  if (typeof console !== 'undefined') {
    hirelyDebugLog(`[Hirely OCR propagate] ${stage}`, metrics);
  }
}

/**
 * @param {string} stage
 * @param {{ text?: string, lines?: unknown[], note?: string }} [payload]
 */
export function logOcrPropagation(stage, payload = {}) {
  const text = String(payload.text ?? '').trim();
  const lines = payload.lines || [];
  const lineTexts = lines.length
    ? lines.map((l) => String(l?.text ?? l?.cleanedText ?? l?.rawExtraction ?? '').trim())
    : text.split('\n').map((l) => l.trim()).filter(Boolean);

  logOcrPropagate(stage, {
    OCR_TEXT_LENGTH: joinedTextLength(text, lines),
    OCR_LINES_COUNT: lineTexts.length,
    note: payload.note || null,
  });
}
