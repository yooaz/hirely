/**
 * Per-line extraction archive — rawExtraction, cleanedText, confidence, source (P0).
 */

import { normalizeRawExtract, cleanExtractionLine } from '../parsing/clean.js';
import { isGarbageLine } from '../../data/dictionaries/garbagePatterns.js';
import {
  NATIVE_DEFAULT_CONFIDENCE,
  OCR_FALLBACK_CONFIDENCE,
} from './extracted-line.js';
import { compareLinesReadingOrder } from './reading-order.js';
import {
  isExactTranscriptionExtractionActive,
  trivialTranscriptionNormalize,
} from './exact-transcription-truth.js';

/**
 * @param {import('./extracted-line.js').ExtractedLine} line
 * @param {{ ocr?: boolean, dropGarbage?: boolean }} [opts]
 * @returns {import('./extracted-line.js').ExtractedLine|null}
 */
export function enrichExtractedLine(line, opts = {}) {
  const rawExtraction = String(line?.rawExtraction ?? line?.text ?? '').trim();
  if (!rawExtraction) return null;

  const source = line?.source === 'ocr' ? 'ocr' : 'native';
  const cleanedText = cleanExtractionLine(rawExtraction, {
    ocr: opts.ocr ?? source === 'ocr',
  });
  if (!cleanedText) return null;
  if (opts.dropGarbage !== false && isGarbageLine(cleanedText)) return null;

  const confidence = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        Number(line?.confidence) ||
          (source === 'ocr' ? OCR_FALLBACK_CONFIDENCE : NATIVE_DEFAULT_CONFIDENCE)
      )
    )
  );

  return {
    ...line,
    rawExtraction,
    cleanedText,
    text: cleanedText,
    confidence,
    source,
  };
}

/**
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 * @param {{ ocr?: boolean, dropGarbage?: boolean }} [opts]
 */
export function enrichExtractedLines(lines, opts = {}) {
  return (lines || []).map((ln) => enrichExtractedLine(ln, opts)).filter(Boolean);
}

/** Document-level raw text from line archive. */
export function linesToRawText(lines, pageSeparator = '\n\n') {
  const byPage = new Map();
  for (const ln of lines || []) {
    const p = ln.page || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(ln);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  return pages
    .map((p) => {
      const sorted = [...byPage.get(p)].sort(compareLinesReadingOrder);
      return sorted.map((l) => l.rawExtraction ?? l.text).join('\n');
    })
    .filter(Boolean)
    .join(pageSeparator);
}

/** Document-level cleaned text from line archive. */
export function linesToCleanedText(lines, pageSeparator = '\n\n') {
  const byPage = new Map();
  for (const ln of lines || []) {
    const p = ln.page || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(ln);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  return pages
    .map((p) => {
      const sorted = [...byPage.get(p)].sort((a, b) => a.line - b.line || b.y - a.y || a.x - b.x);
      return sorted.map((l) => l.cleanedText ?? l.text).join('\n');
    })
    .filter(Boolean)
    .join(pageSeparator);
}

/**
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 * @param {{ ocr?: boolean }} [opts]
 */
export function buildDocumentTextsFromLines(lines, opts = {}) {
  if (opts.preserveRaw || isExactTranscriptionExtractionActive()) {
    const kept = (lines || []).filter((ln) => {
      const raw = String(ln?.rawExtraction ?? ln?.text ?? '');
      return raw.length > 0 && raw.trim().length > 0;
    });
    const pass = kept.map((ln) => {
      const raw = String(ln.rawExtraction ?? ln.text ?? '');
      return {
        ...ln,
        rawExtraction: raw,
        cleanedText: raw,
        text: raw,
      };
    });
    const joined = linesToRawText(pass);
    const plain = trivialTranscriptionNormalize(joined);
    return {
      lines: pass,
      rawExtraction: plain,
      cleanedText: plain,
    };
  }
  const enriched = enrichExtractedLines(lines, opts);
  return {
    lines: enriched,
    rawExtraction: normalizeRawExtract(linesToRawText(enriched)),
    cleanedText: normalizeRawExtract(linesToCleanedText(enriched)),
  };
}
