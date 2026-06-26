/**
 * Native PDF text trust — reject garbled text layers that must not reach parser/preview.
 */

import { assessPdfTextLayer } from './pdf-text-quality.js';
import { corruptionScoreText } from '../parsing/corruption-detector.js';

export const NATIVE_CORRUPT_SCORE_THRESHOLD = 46;

/**
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.corruptThreshold]
 */
export function isCorruptNativeText(text, opts = {}) {
  const s = String(text || '').trim();
  if (!s) return false;
  const threshold = Number(opts.corruptThreshold) || NATIVE_CORRUPT_SCORE_THRESHOLD;
  const corrupt = corruptionScoreText(s);
  if (corrupt >= threshold) return true;
  const quality = assessPdfTextLayer(s);
  if (!quality.usable && corrupt >= 30) return true;
  if (!quality.usable && quality.garbageLineRatio >= 0.55) return true;
  return false;
}

/**
 * @param {object} [pageData]
 */
export function isNativePageTrusted(pageData) {
  if (!pageData?.lines?.length) return false;
  if (pageData.usable === false) return false;
  const text = (pageData.lines || []).map((l) => l.text || '').join('\n');
  if (!text.trim()) return false;
  if (isCorruptNativeText(text)) return false;
  const quality = pageData.quality || assessPdfTextLayer(text);
  return quality.confidence >= 52 && quality.usable !== false;
}

/**
 * Whether timeout / OCR-fail partial native recovery is allowed.
 * @param {string} text
 * @param {import('./extracted-line.js').ExtractedLine[]} [lines]
 */
export function isNativeTextRecoverable(text, lines = []) {
  const s = String(text || '').trim();
  if (s.length < 12) return false;
  if (isCorruptNativeText(s)) return false;
  const quality = assessPdfTextLayer(s);
  const hasContact = /@\w+\./.test(s) || /\+\d{9,}/.test(s);
  const hasNameLike = /\b[A-ZÀ-Ÿ][a-zà-ÿ]{2,}\s+[A-ZÀ-Ÿ][a-zà-ÿ]{2,}/.test(s);
  if (quality.usable || quality.strongTextLayer || quality.preferNativeText) {
    return true;
  }
  if (!quality.usable && quality.garbageLineRatio < 0.2 && hasContact && hasNameLike && s.length >= 80) {
    return true;
  }
  const nativeLines = (lines || []).filter((l) => l?.source === 'native' || !l?.source);
  if (nativeLines.length) {
    const corruptPages = new Set();
    for (const ln of nativeLines) {
      const p = ln.page || 1;
      if (!corruptPages.has(p) && isCorruptNativeText(String(ln.text || ''))) {
        corruptPages.add(p);
      }
    }
    const pages = new Set(nativeLines.map((l) => l.page || 1));
    if (corruptPages.size > 0 && corruptPages.size >= pages.size) return false;
  }
  return true;
}

/**
 * @param {string} text
 */
export function nativeTrustAudit(text) {
  const s = String(text || '').trim();
  const corrupt = corruptionScoreText(s);
  const quality = assessPdfTextLayer(s);
  return {
    corruptScore: corrupt,
    corrupt: corrupt >= NATIVE_CORRUPT_SCORE_THRESHOLD,
    usable: quality.usable,
    strongTextLayer: quality.strongTextLayer,
    garbageLineRatio: quality.garbageLineRatio,
    recoverable: isNativeTextRecoverable(s),
  };
}
