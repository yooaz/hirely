/**
 * Extraction pipeline audit — detect text explosion and duplicate OCR loops.
 * Logs per-stage metrics; dedupes lines/text before parser input.
 */

import { normalizeLineKey, linesToPlainText, summarizeLines } from './extracted-line.js';
import { linesToRawText, linesToCleanedText } from './extraction-line-enrich.js';
import { hirelyDebugLog, isHirelyDebug } from '../runtime/hirely-debug.js';
import {
  dedupeTextLinesBySimilarity,
  semanticSimilarityForDedup,
  pickRicherStringLabel,
} from '../parsing/dedupe-engine.js';
import {
  reconstructExtractedText,
  reconstructExtractedLines,
  smartLineMerge,
} from '../parsing/text-reconstruction.js';
import {
  isExactTranscriptionExtractionActive,
  filterExactEmptyNoiseLines,
} from './exact-transcription-truth.js';

export const TEXT_EXPLOSION_CHAR_THRESHOLD = 20000;
export const DUPLICATE_RATIO_THRESHOLD = 0.3;
export const OCR_LOOP_LINE_REPEAT_THRESHOLD = 3;

/** @typedef {{ stage: string, pageCount?: number, rawChars: number, cleanChars: number, uniqueLines: number, duplicateLines: number, lineCount?: number, at?: string, note?: string }} ExtractionAuditStage */

let auditTrail = [];

export function clearExtractionAuditTrail() {
  auditTrail = [];
}

export function peekExtractionAuditTrail() {
  return auditTrail.map((s) => ({ ...s }));
}

/**
 * @param {string} stage
 * @param {{ text?: string, rawText?: string, cleanText?: string, lines?: import('./extracted-line.js').ExtractedLine[], pageCount?: number, note?: string }} input
 */
export function recordExtractionAuditStage(stage, input = {}) {
  const metrics = measureExtractionStage(input);
  const entry = {
    stage,
    pageCount: input.pageCount ?? metrics.pageCount,
    rawChars: metrics.rawChars,
    cleanChars: metrics.cleanChars,
    uniqueLines: metrics.uniqueLines,
    duplicateLines: metrics.duplicateLines,
    lineCount: metrics.lineCount,
    note: input.note || null,
    at: new Date().toISOString(),
  };
  auditTrail.push(entry);
  runExplosionDetectors(entry);
  detectOcrLoops(stage, metrics.lineTexts || []);
  return entry;
}

/**
 * @param {{ text?: string, rawText?: string, cleanText?: string, lines?: import('./extracted-line.js').ExtractedLine[] }} input
 */
export function measureExtractionStage(input = {}) {
  const lines = input.lines || [];
  const rawText =
    input.rawText != null
      ? String(input.rawText)
      : lines.length
        ? linesToRawText(lines)
        : String(input.text || '');
  const cleanText =
    input.cleanText != null
      ? String(input.cleanText)
      : lines.length
        ? linesToCleanedText(lines)
        : rawText;

  const lineTexts = lines.length
    ? lines.map((l) => String(l.cleanedText ?? l.text ?? l.rawExtraction ?? '').trim()).filter(Boolean)
    : cleanText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

  const { uniqueLines, duplicateLines, loopLines } = countLineDuplicates(lineTexts);
  const summary = lines.length ? summarizeLines(lines) : null;

  return {
    rawChars: rawText.length,
    cleanChars: cleanText.length,
    uniqueLines,
    duplicateLines,
    loopLines,
    lineTexts,
    lineCount: lineTexts.length,
    pageCount: summary?.pageCount ?? countPagesFromText(rawText),
  };
}

function countPagesFromText(text) {
  const parts = String(text || '').split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return Math.max(1, parts.length);
}

/**
 * @param {string[]} lineTexts
 */
export function countLineDuplicates(lineTexts) {
  const counts = new Map();
  for (const line of lineTexts || []) {
    const key = normalizeLineKey(line);
    if (!key || key.length < 2) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let uniqueLines = 0;
  let duplicateLines = 0;
  const loopLines = [];
  for (const [key, n] of counts) {
    uniqueLines += 1;
    if (n > 1) duplicateLines += n - 1;
    if (n > OCR_LOOP_LINE_REPEAT_THRESHOLD) loopLines.push({ key, count: n });
  }
  const total = lineTexts?.length || 0;
  const duplicateRatio = total > 0 ? duplicateLines / total : 0;
  return { uniqueLines, duplicateLines, duplicateRatio, loopLines, total };
}

/**
 * @param {ExtractionAuditStage} entry
 */
export function runExplosionDetectors(entry) {
  const maxChars = Math.max(entry.rawChars || 0, entry.cleanChars || 0);
  if (maxChars > TEXT_EXPLOSION_CHAR_THRESHOLD) {
    console.error('TEXT_EXPLOSION_DETECTED', {
      stage: entry.stage,
      rawChars: entry.rawChars,
      cleanChars: entry.cleanChars,
      pageCount: entry.pageCount,
      lineCount: entry.lineCount,
    });
  }
  const total = (entry.uniqueLines || 0) + (entry.duplicateLines || 0);
  const duplicateRatio = total > 0 ? (entry.duplicateLines || 0) / total : 0;
  if (duplicateRatio > DUPLICATE_RATIO_THRESHOLD) {
    console.error('DUPLICATE_TEXT_DETECTED', {
      stage: entry.stage,
      duplicateLines: entry.duplicateLines,
      uniqueLines: entry.uniqueLines,
      duplicateRatio: Math.round(duplicateRatio * 1000) / 10,
    });
  }
}

/**
 * Run loop detector on raw line list (same normalized line > 3×).
 * @param {string} stage
 * @param {string[]} lineTexts
 */
export function detectOcrLoops(stage, lineTexts) {
  const { loopLines } = countLineDuplicates(lineTexts);
  for (const { key, count } of loopLines) {
    console.error('OCR_LOOP_DETECTED', { stage, line: key.slice(0, 120), count });
  }
  return loopLines;
}

/**
 * Deduplicate extracted lines — first occurrence wins (page → line order).
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 */
export function dedupeExtractedLines(lines) {
  if (isExactTranscriptionExtractionActive()) {
    const kept = filterExactEmptyNoiseLines(lines);
    return {
      lines: kept,
      removedLines: Math.max(0, (lines || []).length - kept.length),
      removedPages: 0,
      before: (lines || []).length,
      after: kept.length,
    };
  }
  const sorted = [...(lines || [])].sort(
    (a, b) => (a.page || 1) - (b.page || 1) || (a.line || 0) - (b.line || 0)
  );
  const seenPage = new Set();
  const out = [];
  let duplicateLines = 0;
  let duplicatePages = 0;
  const byPage = new Map();

  for (const ln of sorted) {
    const p = ln.page || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(ln);
  }

  const pages = [...byPage.keys()].sort((a, b) => a - b);
  for (const page of pages) {
    const pageLines = byPage.get(page) || [];
    const pageKeys = [];
    /** @type {{ ln: object, key: string, text: string }[]} */
    const kept = [];

    for (const ln of pageLines) {
      const text = String(ln.cleanedText ?? ln.text ?? ln.rawExtraction ?? '').trim();
      const key = normalizeLineKey(text);
      if (!key) continue;
      pageKeys.push(key);

      let merged = false;
      for (let i = 0; i < kept.length; i++) {
        const prev = kept[i];
        const score = semanticSimilarityForDedup(prev.text, text);
        if (prev.key === key || score >= 0.92) {
          duplicateLines += 1;
          const richer = pickRicherStringLabel(prev.text, text);
          kept[i] = {
            ln: { ...prev.ln, ...ln, text: richer, cleanedText: richer },
            key: normalizeLineKey(richer),
            text: richer,
          };
          merged = true;
          break;
        }
      }
      if (!merged) {
        kept.push({ ln: { ...ln, text, cleanedText: text }, key, text });
      }
    }

    const pageSig = pageKeys.join('\u0001');
    if (pageSig && seenPage.has(pageSig)) {
      duplicatePages += 1;
      continue;
    }
    if (pageSig) seenPage.add(pageSig);
    out.push(...kept.map((row) => row.ln));
  }

  return {
    lines: out,
    removedLines: duplicateLines,
    removedPages: duplicatePages,
    before: sorted.length,
    after: out.length,
  };
}

/**
 * Deduplicate plain text: repeated pages (\\n\\n), paragraphs, and lines.
 * @param {string} text
 */
export function dedupePlainText(text) {
  if (isExactTranscriptionExtractionActive()) {
    const s = String(text || '');
    return { text: s, beforeChars: s.length, afterChars: s.length, removedPages: 0, removedLines: 0 };
  }
  let s = String(text || '');
  const pageParts = s.split(/\n{2,}/);
  const seenPage = new Set();
  const uniquePages = [];
  let removedPages = 0;

  for (const page of pageParts) {
    const trimmed = page.trim();
    if (!trimmed) continue;
    const pageKey = normalizeLineKey(trimmed);
    if (seenPage.has(pageKey)) {
      removedPages += 1;
      continue;
    }
    seenPage.add(pageKey);
    const paras = trimmed.split(/\n{2,}/);
    const seenPara = new Set();
    const uniqueParas = [];
    for (const para of paras) {
      const p = para.trim();
      if (!p) continue;
      const pk = normalizeLineKey(p);
      if (seenPara.has(pk)) continue;
      seenPara.add(pk);
      const rawLines = p
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const uniqueLines = dedupeTextLinesBySimilarity(rawLines);
      uniqueParas.push(uniqueLines.join('\n'));
    }
    uniquePages.push(uniqueParas.join('\n\n'));
  }

  s = uniquePages.join('\n\n');
  return { text: s, removedPages, beforeChars: String(text || '').length, afterChars: s.length };
}

/**
 * Hard sanitize before parser: dedupe lines + text; cap runaway size.
 * @param {string} cleanedText
 * @param {import('./extracted-line.js').ExtractedLine[]} [lines]
 */
export function sanitizeParserInput(cleanedText, lines = []) {
  const dedupedLines = lines?.length ? dedupeExtractedLines(lines) : null;
  let nextLines = dedupedLines?.lines?.length ? dedupedLines.lines : lines;
  let text = String(cleanedText || '');
  if (nextLines?.length) {
    nextLines = reconstructExtractedLines(nextLines);
    text = linesToCleanedText(nextLines);
  } else if (text) {
    const lineTexts = text.split('\n').map((l) => l.trim()).filter(Boolean);
    text = smartLineMerge(lineTexts).join('\n');
  }
  text = reconstructExtractedText(text);
  const dedupedText = dedupePlainText(text);
  text = dedupedText.text;

  const metrics = measureExtractionStage({ cleanText: text, lines: nextLines });
  detectOcrLoops('parser_input_sanitize', text.split('\n').filter(Boolean));

  const maxChars = TEXT_EXPLOSION_CHAR_THRESHOLD * 2;
  if (text.length > maxChars) {
    console.error('TEXT_EXPLOSION_DETECTED', {
      stage: 'parser_input_cap',
      rawChars: text.length,
      cap: maxChars,
    });
    text = text.slice(0, maxChars);
  }

  return {
    cleanedText: text,
    lines: nextLines,
    dedupe: dedupedLines,
    dedupeText: dedupedText,
    metrics,
  };
}

/**
 * Console summary required by extraction audit mission.
 * @param {{ rawChars?: number, cleanChars?: number, uniqueLines?: number, duplicateLines?: number, parserInputChars?: number }} summary
 */
export function printExtractionAuditSummary(summary = {}) {
  const trail = peekExtractionAuditTrail();
  const first = trail[0];
  const last = trail[trail.length - 1];
  const rawChars = summary.rawChars ?? first?.rawChars ?? 0;
  const cleanChars = summary.cleanChars ?? last?.cleanChars ?? 0;
  const uniqueLines = summary.uniqueLines ?? last?.uniqueLines ?? 0;
  const duplicateLines = summary.duplicateLines ?? last?.duplicateLines ?? 0;
  const parserInput = summary.parserInputChars ?? summary.finalParserInput ?? cleanChars;

  hirelyDebugLog('RAW_CHARS', rawChars);
  hirelyDebugLog('CLEAN_CHARS', cleanChars);
  hirelyDebugLog('UNIQUE_LINES', uniqueLines);
  hirelyDebugLog('DUPLICATE_LINES', duplicateLines);
  hirelyDebugLog('FINAL_PARSER_INPUT', parserInput);

  if (trail.length && isHirelyDebug()) {
    console.groupCollapsed('HIRELY EXTRACTION AUDIT (stages)');
    console.table(
      trail.map((s) => ({
        stage: s.stage,
        pages: s.pageCount,
        rawChars: s.rawChars,
        cleanChars: s.cleanChars,
        lines: s.lineCount,
        unique: s.uniqueLines,
        dup: s.duplicateLines,
      }))
    );
    console.groupEnd();
  }
}
