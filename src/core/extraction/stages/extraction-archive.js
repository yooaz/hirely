/**
 * Stage 3 — Extraction archive: never drop original text; per-line raw/clean/confidence/page/section.
 */

import { normalizeRawExtract } from '../../parsing/clean.js';
import { isSectionHeaderLine } from '../../parsing/rich-parser.js';
import { fuzzySectionKey } from '../../parsing/section-fuzzy.js';
import {
  buildDocumentTextsFromLines,
  linesToRawText,
  linesToCleanedText,
} from '../extraction-line-enrich.js';
import { summarizeLines } from '../extracted-line.js';
import { recordExtractionAuditStage } from '../extraction-audit.js';
import { flattenCvDataPreservedText } from '../../../debug/cv-preserved-text.js';

export const CONTENT_RETENTION_TARGET_PCT = 80;

/**
 * Assign rolling section labels from headers (content is never removed).
 * @param {import('../extracted-line.js').ExtractedLine[]} lines
 */
export function assignLineSections(lines) {
  let current = 'header';
  return (lines || []).map((ln) => {
    const raw = String(ln.rawExtraction ?? ln.text ?? '').trim();
    const cleaned = String(ln.cleanedText ?? ln.text ?? raw).trim();
    const lineText = cleaned || raw;
    if (lineText && isSectionHeaderLine(lineText)) {
      const key = fuzzySectionKey(lineText);
      if (key) current = key;
      return { ...ln, section: key || 'header' };
    }
    return { ...ln, section: current || 'body' };
  });
}

/**
 * @param {import('../extracted-line.js').ExtractedLine[]} lines
 */
export function mergeLinesPreservingRaw(existing, incoming) {
  const byKey = new Map();
  const keyOf = (ln) =>
    `${ln.page || 1}|${ln.line ?? 0}|${String(ln.rawExtraction ?? ln.text ?? '')
      .slice(0, 120)
      .toLowerCase()}`;

  for (const ln of existing || []) {
    const k = keyOf(ln);
    if (!byKey.has(k)) byKey.set(k, ln);
  }
  for (const ln of incoming || []) {
    const k = keyOf(ln);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, ln);
      continue;
    }
    byKey.set(k, {
      ...prev,
      ...ln,
      rawExtraction: prev.rawExtraction || ln.rawExtraction || ln.text,
      cleanedText: ln.cleanedText ?? prev.cleanedText ?? ln.text,
      confidence: Math.max(prev.confidence || 0, ln.confidence || 0),
    });
  }
  return [...byKey.values()].sort(
    (a, b) => (a.page || 1) - (b.page || 1) || (a.line || 0) - (b.line || 0)
  );
}

/**
 * @param {object} enterprise
 * @param {string} [rawFallback]
 */
export function buildExtractionArchiveStage(enterprise, rawFallback = '') {
  const incoming = enterprise?.lines || [];
  const docTexts = buildDocumentTextsFromLines(incoming, {
    ocr: /ocr|mixed|image/i.test(String(enterprise?.method || '')),
    dropGarbage: false,
  });
  const withSections = assignLineSections(docTexts.lines);
  const lines = mergeLinesPreservingRaw([], withSections);

  const rawFromLines = normalizeRawExtract(linesToRawText(lines));
  const cleanFromLines = normalizeRawExtract(linesToCleanedText(lines));
  const rawExtraction = normalizeRawExtract(
    enterprise?.rawExtraction || rawFallback || rawFromLines
  );
  let cleanedText = normalizeRawExtract(enterprise?.cleanedText || cleanFromLines);
  if (!cleanedText.trim() && rawExtraction.trim()) {
    console.error('CLEANED_TEXT_EMPTY_FALLBACK_USED', { rawLength: rawExtraction.length });
    cleanedText = rawExtraction;
  }

  const rawLen = rawExtraction.length;
  const cleanLen = cleanedText.length;
  const lineRawLen = rawFromLines.length;
  const retentionPct =
    rawLen > 0 ? Math.min(100, Math.round((lineRawLen / rawLen) * 1000) / 10) : 100;

  const summary = summarizeLines(lines);
  const avgConfidence = summary.lineCount
    ? Math.round(lines.reduce((s, l) => s + (l.confidence || 0), 0) / summary.lineCount)
    : 0;

  recordExtractionAuditStage('line_archive_merge', {
    lines,
    rawText: rawExtraction,
    cleanText: cleanedText,
    pageCount: summary.pageCount,
  });

  return {
    stage: 3,
    rawExtraction,
    cleanedText,
    lines,
    lineCount: summary.lineCount,
    pageCount: summary.pageCount,
    avgConfidence,
    retentionPct,
    meetsRetentionTarget: retentionPct >= CONTENT_RETENTION_TARGET_PCT || rawLen < 80,
    summary,
    method: enterprise?.method || 'paste',
    at: new Date().toISOString(),
  };
}

/**
 * Compare archive text to preserved structured + unsorted content (no silent drops).
 * @param {string} rawText
 * @param {string} cleanedText
 * @param {object} cvData
 * @param {import('../extracted-line.js').ExtractedLine[]} [lines]
 */
export function measureTextRetention(rawText, cleanedText, cvData, lines = []) {
  const rawLen = Math.max(1, String(rawText || '').trim().length);
  const cleanLen = Math.max(1, String(cleanedText || '').trim().length || rawLen);
  let preserved = flattenCvDataPreservedText(cvData);
  if (lines?.length) {
    const lineBlob = lines
      .map((l) => l.rawExtraction ?? l.cleanedText ?? l.text ?? '')
      .filter(Boolean)
      .join('\n');
    if (lineBlob.length > preserved.length) preserved = lineBlob;
  }
  const structuredLen = preserved.length;
  const lossFromRaw = Math.max(0, Math.round((1 - structuredLen / rawLen) * 1000) / 10);
  const lossFromClean = Math.max(0, Math.round((1 - structuredLen / cleanLen) * 1000) / 10);
  const retentionFromRaw = Math.min(100, Math.round((structuredLen / rawLen) * 1000) / 10);
  const retentionFromClean = Math.min(100, Math.round((structuredLen / cleanLen) * 1000) / 10);
  const retentionPct = Math.max(retentionFromRaw, retentionFromClean);
  const lossPct = Math.min(lossFromRaw, lossFromClean);
  return {
    rawLength: rawLen,
    cleanLength: cleanLen,
    structuredLength: structuredLen,
    lossPct,
    retentionPct,
    retentionFromClean,
    lossFromClean,
    meetsTarget: retentionFromClean >= CONTENT_RETENTION_TARGET_PCT,
  };
}
