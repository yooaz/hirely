/**
 * Exact Transcription Mode — preserve OCR/native truth.
 * Only trivial unicode + line-ending normalization; no dedupe/merge/cleanup.
 */

/**
 * @returns {boolean}
 */
export function isExactTranscriptionExtractionActive() {
  if (typeof globalThis === 'undefined') return false;
  return (
    globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE === true ||
    globalThis.HIRELY_EXACT_TRANSCRIPTION === true
  );
}

/**
 * Trivial unicode / line-ending cleanup only (no space collapse, no dedupe).
 * @param {string} text
 */
export function trivialTranscriptionNormalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * @param {string} text
 */
export function isExactEmptyNoiseText(text) {
  const t = String(text ?? '');
  if (!t.length) return true;
  if (!t.trim()) return true;
  if (!t.replace(/[\s\u200b\u200c\u200d\ufeff]/g, '')) return true;
  return false;
}

/**
 * @param {object} line
 */
export function isExactEmptyNoiseLine(line) {
  return isExactEmptyNoiseText(line?.rawExtraction ?? line?.text ?? '');
}

/**
 * Drop only exact empty/noise lines — keep near-duplicates and all readable content.
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 */
export function filterExactEmptyNoiseLines(lines) {
  return (lines || []).filter((ln) => !isExactEmptyNoiseLine(ln));
}

/**
 * Concatenate native + OCR lines without semantic merge/dedupe.
 * @param {import('./extracted-line.js').ExtractedLine[]} nativeLines
 * @param {import('./extracted-line.js').ExtractedLine[]} ocrLines
 */
export function concatLinesExactTruth(nativeLines, ocrLines) {
  const combined = [...(nativeLines || []), ...(ocrLines || [])];
  return filterExactEmptyNoiseLines(combined);
}
