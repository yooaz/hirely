/**
 * Enterprise extraction line model — preserves text, confidence, source, layout.
 * Reading order comes from reading-order.js (x/y), not PDF stream `line` index.
 */

import { compareLinesReadingOrder } from './reading-order.js';

export const EXTRACTION_LINE_REVIEW_THRESHOLD = 60;
export const NATIVE_DEFAULT_CONFIDENCE = 92;
export const OCR_FALLBACK_CONFIDENCE = 68;

/** @typedef {'native'|'ocr'} ExtractionLineSource */
/** @typedef {'native_pdf'|'ocr'|'mixed'|'txt'|'docx'|'image'|'paste'} EnterpriseExtractionMethod */

/**
 * @typedef {object} ExtractedLine
 * @property {string} text — cleaned line (same as cleanedText when enriched)
 * @property {string} [rawExtraction] — raw line before cleanup
 * @property {string} [cleanedText] — after safe clean / OCR postprocess
 * @property {number} confidence 0–100
 * @property {ExtractionLineSource} source
 * @property {number} page 1-based
 * @property {number} line 0-based within page (pdfIndex / OCR line id)
 * @property {number} [lineIndex] global 0-based after reading-order (layout memory)
 * @property {number} [readingOrder] same as lineIndex when set by layout memory
 * @property {number} x
 * @property {number} y
 * @property {string} [columnId] LEFT_COLUMN | RIGHT_COLUMN | FULL
 * @property {string} [region] left | right | full | main
 * @property {string} [zone] header | body | footer
 * @property {string} [candidate] OCR fusion pass id (A|B|C|D) when source is ocr
 */

export function normalizeLineKey(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {ExtractedLine[]} lines
 */
export function linesToPlainText(lines, pageSeparator = '\n\n') {
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
      return sorted.map((l) => l.cleanedText ?? l.text).join('\n');
    })
    .filter(Boolean)
    .join(pageSeparator);
}

/**
 * @param {ExtractedLine[]} lines
 */
export function buildLineConfidenceIndex(lines) {
  const index = new Map();
  for (const ln of lines || []) {
    const key = normalizeLineKey(ln.cleanedText ?? ln.text);
    if (!key || key.length < 2) continue;
    if (!index.has(key)) index.set(key, ln);
  }
  return index;
}

/**
 * @param {string} line
 * @param {Map<string, ExtractedLine>} index
 */
export function extractionConfidenceForLine(line, index) {
  if (!index || !index.size) return 100;
  const hit = index.get(normalizeLineKey(line));
  return hit?.confidence ?? 100;
}

/**
 * @param {ExtractedLine[]} lines
 */
export function resolveEnterpriseMethod(lines) {
  let native = 0;
  let ocr = 0;
  for (const ln of lines || []) {
    if (ln.source === 'ocr') ocr++;
    else native++;
  }
  if (native && ocr) return 'mixed';
  if (ocr) return 'ocr';
  return 'native_pdf';
}

/**
 * @param {ExtractedLine[]} lines
 */
export function summarizeLines(lines) {
  const list = lines || [];
  return {
    lineCount: list.length,
    nativeLineCount: list.filter((l) => l.source === 'native').length,
    ocrLineCount: list.filter((l) => l.source === 'ocr').length,
    lowConfidenceCount: list.filter((l) => l.confidence < EXTRACTION_LINE_REVIEW_THRESHOLD).length,
    pageCount: list.length ? Math.max(...list.map((l) => l.page || 1)) : 0,
  };
}

/**
 * Preserve Tesseract bbox on OCR lines — spatial bridge requires positioned coordinates.
 * @param {Partial<ExtractedLine> & { text?: string }} ln
 * @param {{ page?: number, line?: number, text?: string, cleanedText?: string, rawExtraction?: string, confidence?: number }} defaults
 */
export function coerceOcrExtractedLine(ln, defaults = {}) {
  const text = String(defaults.text ?? ln.cleanedText ?? ln.text ?? '').trim();
  const page = defaults.page ?? ln.page ?? 1;
  const line = defaults.line ?? ln.line ?? 0;
  const hasX = Number.isFinite(ln.x);
  const hasY = Number.isFinite(ln.y);
  const lineIndex = line;
  const syntheticY = 1400 - page * 2000 - lineIndex * 14;
  const indent = (String(defaults.rawExtraction ?? ln.rawExtraction ?? text).match(/^(\s+)/)?.[1]?.length || 0) * 10;
  return {
    ...ln,
    text,
    cleanedText: String(defaults.cleanedText ?? ln.cleanedText ?? text).trim(),
    rawExtraction: String(defaults.rawExtraction ?? ln.rawExtraction ?? text).trim(),
    confidence: Math.round(defaults.confidence ?? ln.confidence ?? OCR_FALLBACK_CONFIDENCE),
    source: 'ocr',
    page,
    line: lineIndex,
    x: hasX ? Number(ln.x) : 56 + indent,
    y: hasY ? Number(ln.y) : syntheticY,
  };
}
