/**
 * OCR hardening — generic text repairs after OCR (no candidate-specific rules).
 * Hyphen joins, spaced letters, dedupe, header/footer noise, column-merge splits.
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { normalizeHeaderText } from './section-fuzzy.js';

const SOFT_HYPHEN_BREAK_RE = /([A-Za-zÀ-ÿ]{2,})-\s*\n\s*([a-zà-ö]{2,})/g;
const HARD_HYPHEN_BREAK_RE = /([A-Za-zÀ-ÿ]{2,})-\s*\n\s*([A-Za-zÀ-ÿ]{2,})/g;

const PAGE_NUMBER_RE =
  /^(?:page\s*)?\d{1,3}\s*(?:\/|of|sur|de)\s*\d{1,3}$|^(?:page\s+)?\d{1,3}$/i;

const FOOTER_PHRASE_RE =
  /^(?:curriculum\s+vitae|resume|résumé|cv|confidential|strictly\s+private|www\.)\b/i;

const SECTION_HEADER_TOKENS = [
  'profile',
  'work experience',
  'professional experience',
  'experience',
  'education',
  'formation',
  'skills',
  'competences',
  'tools',
  'languages',
  'langues',
  'clients',
  'contact',
  'interests',
  'interest',
  'summary',
  'projects',
];

const MERGED_HEADER_RE = new RegExp(
  `\\b(${SECTION_HEADER_TOKENS.map((t) => t.replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'gi'
);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /https?:\/\/|www\./i;

function normalizeDedupeKey(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212–—]/g, '-')
    .replace(/[^\p{L}\p{N}\s@.+#%-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Join words broken across lines with hyphen (soft/hard line break).
 * @param {string} text
 */
export function repairHyphenatedLineBreaks(text) {
  let s = String(text || '');
  s = s.replace(SOFT_HYPHEN_BREAK_RE, '$1$2');
  s = s.replace(HARD_HYPHEN_BREAK_RE, '$1$2');
  return s;
}

function collapseSpacedLetterGroup(fragment) {
  const raw = String(fragment || '').trim();
  if (!raw) return '';
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return raw;
  const singles = tokens.filter((t) => /^[A-Za-zÀ-ÿ0-9]$/.test(t)).length;
  if (singles / tokens.length < 0.45) return raw;
  const words = [];
  let buf = '';
  for (const t of tokens) {
    if (/^[A-Za-zÀ-ÿ0-9]$/.test(t)) buf += t;
    else {
      if (buf) {
        words.push(buf);
        buf = '';
      }
      words.push(t);
    }
  }
  if (buf) words.push(buf);
  return words.join(' ');
}

/**
 * Collapse OCR spaced-letter runs: "M a r i e   D u p o n t" → "Marie Dupont".
 * @param {string} line
 */
export function collapseOcrSpacedLetters(line) {
  const raw = String(line || '').trim();
  if (!raw || EMAIL_RE.test(raw) || URL_RE.test(raw)) return raw;
  const groups = raw.split(/\s{2,}/).map((g) => g.trim()).filter(Boolean);
  if (groups.length >= 2) {
    return groups.map(collapseSpacedLetterGroup).join(' ');
  }
  return collapseSpacedLetterGroup(raw);
}

/**
 * @param {string} line
 */
export function lineHasOcrSpacedLetters(line) {
  const tokens = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return false;
  const singles = tokens.filter((t) => /^[A-Za-zÀ-ÿ0-9]$/.test(t)).length;
  return singles / tokens.length >= 0.45;
}

/**
 * Split lines where two section headers were merged (column OCR).
 * @param {string} line
 * @returns {string[]}
 */
export function splitMergedSectionHeaders(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 8) return [s];

  const hits = [];
  let m;
  const re = new RegExp(MERGED_HEADER_RE.source, 'gi');
  while ((m = re.exec(s)) !== null) {
    hits.push({ start: m.index, end: m.index + m[0].length, text: m[0].trim() });
  }
  if (hits.length < 2) return [s];

  const out = [];
  const before = s.slice(0, hits[0].start).trim();
  if (before.length > 2) out.push(before);

  for (let i = 0; i < hits.length; i++) {
    out.push(hits[i].text);
    const midStart = hits[i].end;
    const midEnd = i + 1 < hits.length ? hits[i + 1].start : s.length;
    const mid = s.slice(midStart, midEnd).trim();
    if (mid.length > 2) out.push(mid);
  }

  return out.length ? out : [s];
}

/**
 * Split a line that looks like two columns glued with a wide gap.
 * @param {string} line
 * @returns {string[]}
 */
export function splitColumnMergedLine(line) {
  const s = String(line || '').trim();
  if (!s) return [s];

  const headerParts = splitMergedSectionHeaders(s);
  if (headerParts.length > 1) return headerParts;

  if (s.length < 24) return [s];
  if (EMAIL_RE.test(s) && s.length < 80) return [s];

  const gapParts = s.split(/\s{4,}/).map((p) => p.trim()).filter(Boolean);
  if (gapParts.length >= 2 && gapParts.every((p) => p.length >= 4)) {
    return gapParts;
  }

  const pipeParts = s.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  if (pipeParts.length >= 2 && pipeParts.every((p) => p.length >= 4)) {
    return pipeParts;
  }

  return [s];
}

/**
 * @param {string[]} lines
 */
export function dedupeConsecutiveLines(lines) {
  const out = [];
  let prev = '';
  for (const line of lines || []) {
    const t = String(line || '').trim();
    if (!t) continue;
    const key = normalizeDedupeKey(t);
    if (key && key === prev) continue;
    prev = key;
    out.push(t);
  }
  return out;
}

/**
 * Remove exact/near-duplicate lines (keep first occurrence).
 * @param {string[]} lines
 */
export function dedupeGlobalLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines || []) {
    const t = String(line || '').trim();
    if (!t) continue;
    const key = normalizeDedupeKey(t);
    if (!key || key.length < 4) {
      out.push(t);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Drop repeated footer/header boilerplate and page numbers.
 * @param {string[]} lines
 */
export function stripRepeatedFootersAndHeaders(lines) {
  const counts = new Map();
  const list = lines || [];
  const hasPageNumber = list.some((line) => PAGE_NUMBER_RE.test(String(line || '').trim()));
  for (const line of list) {
    const k = normalizeDedupeKey(line);
    if (k.length > 0 && k.length < 72) counts.set(k, (counts.get(k) || 0) + 1);
  }

  return list.filter((line) => {
    const t = String(line || '').trim();
    if (!t) return false;
    if (PAGE_NUMBER_RE.test(t)) return false;
    const k = normalizeDedupeKey(t);
    if (FOOTER_PHRASE_RE.test(t) && ((counts.get(k) || 0) >= 2 || hasPageNumber)) return false;
    if (t.length < 48 && (counts.get(k) || 0) >= 3 && !EMAIL_RE.test(t)) return false;
    return true;
  });
}

/**
 * Collapse consecutive duplicate section headers (OCR repeated labels).
 * @param {string[]} lines
 */
export function dedupeRepeatedSectionHeaders(lines) {
  const out = [];
  let lastHeaderKey = '';
  for (const line of lines || []) {
    const t = String(line || '').trim();
    if (!t) continue;
    const headerKey = fuzzySectionKey(t) || (MERGED_HEADER_RE.test(t) ? normalizeHeaderText(t) : '');
    if (headerKey && headerKey === lastHeaderKey && t.length < 40) {
      continue;
    }
    if (headerKey && t.length < 40) lastHeaderKey = headerKey;
    else lastHeaderKey = '';
    out.push(t);
  }
  return out;
}

/**
 * Full OCR hardening pass on plain text.
 * @param {string} text
 * @param {{ aggressive?: boolean }} [opts]
 * @returns {{ text: string, stats: Record<string, number> }}
 */
export function hardenOcrText(text, opts = {}) {
  const stats = {
    inputLines: 0,
    outputLines: 0,
    hyphenJoins: 0,
    spacedCollapsed: 0,
    columnSplits: 0,
    deduped: 0,
    footersRemoved: 0,
    headersCollapsed: 0,
  };

  const raw = String(text || '').replace(/\r/g, '\n');
  const hyphenMatches = (raw.match(SOFT_HYPHEN_BREAK_RE) || []).length + (raw.match(HARD_HYPHEN_BREAK_RE) || []).length;
  let s = repairHyphenatedLineBreaks(raw);
  stats.hyphenJoins = hyphenMatches;

  let lines = s.split('\n').map((l) => l.trim()).filter(Boolean);
  stats.inputLines = lines.length;

  const expanded = [];
  for (const line of lines) {
    let current = line;
    if (lineHasOcrSpacedLetters(current)) {
      const collapsed = collapseOcrSpacedLetters(current);
      if (collapsed !== current) {
        stats.spacedCollapsed += 1;
        current = collapsed;
      }
    }
    const parts = splitColumnMergedLine(current);
    if (parts.length > 1) stats.columnSplits += parts.length - 1;
    expanded.push(...parts);
  }
  lines = expanded;

  const beforeDedupe = lines.length;
  lines = dedupeConsecutiveLines(lines);
  lines = dedupeRepeatedSectionHeaders(lines);
  const afterHeader = lines.length;
  stats.headersCollapsed = Math.max(0, beforeDedupe - afterHeader);

  const beforeFooter = lines.length;
  lines = stripRepeatedFootersAndHeaders(lines);
  stats.footersRemoved = Math.max(0, beforeFooter - lines.length);

  const beforeGlobal = lines.length;
  lines = dedupeGlobalLines(lines);
  stats.deduped = Math.max(0, beforeGlobal - lines.length);

  stats.outputLines = lines.length;
  return { text: lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim(), stats };
}
