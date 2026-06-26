/**
 * OCR quality regression statuses — scanned PDF acceptance contract.
 */

import { evaluateOcrParserGate } from './ocr-quality-score.js';

export const OCR_STATUS = {
  OK: 'OCR_OK',
  FAILED_LOW_QUALITY: 'OCR_FAILED_LOW_QUALITY',
};

/** Known corrupted OCR fragments from low-quality scanned PDF rotation failures. */
export const GIBBERISH_MARKERS = ['ION3IIHIAXI', 'NOILY3NQ3', 'YOLVEISNTN', 'Buipeoy'];

/**
 * @param {string} text
 * @returns {string[]}
 */
export function countGibberishMarkers(text) {
  const upper = String(text || '').toUpperCase();
  return GIBBERISH_MARKERS.filter((m) => upper.includes(m.toUpperCase()));
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isMostlyGibberishOcr(text) {
  const hits = countGibberishMarkers(text);
  if (hits.length >= 2) return true;
  const tokens = String(text || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4);
  if (!tokens.length) return hits.length > 0;
  const badTokens = tokens.filter((t) =>
    GIBBERISH_MARKERS.some((m) => t.toUpperCase().includes(m.toUpperCase()))
  );
  return badTokens.length / tokens.length > 0.28 || (hits.length >= 1 && badTokens.length >= 2);
}

/**
 * @param {{
 *   text?: string,
 *   lines?: Array<{ text?: string }>,
 *   gatePass?: boolean,
 *   chosenRotation?: number|null,
 *   acceptedByParser?: boolean,
 * }} input
 * @returns {typeof OCR_STATUS.OK | typeof OCR_STATUS.FAILED_LOW_QUALITY}
 */
export function resolveOcrQualityStatus(input = {}) {
  const text = String(input.text || '').trim();
  const gate = evaluateOcrParserGate(text, input.lines);
  const gatePass = input.gatePass ?? gate.pass;
  const mostlyGibberish = isMostlyGibberishOcr(text);
  const accepted = input.acceptedByParser !== false && gatePass && !mostlyGibberish;

  if (!accepted || mostlyGibberish || !gatePass) {
    return OCR_STATUS.FAILED_LOW_QUALITY;
  }
  if (input.chosenRotation != null) {
    return OCR_STATUS.OK;
  }
  return OCR_STATUS.FAILED_LOW_QUALITY;
}
