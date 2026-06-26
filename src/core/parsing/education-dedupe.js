/**
 * dedupeEducationEntries — one row per school + program; merge overlapping years.
 */

import { extractDateRangeFromText, splitMergedEducationLine } from './parser-recovery.js';
import { isValidEducationItem } from './field-sanitize.js';
import { scoreEducationLine } from '../validation/confidence-gate.js';
import {
  normalizeEducationEntry,
  formatNormalizedEducationLine,
  canonicalizeEducationProgram,
} from './education-normalization-layer.js';
import { findBestEntity, SCHOOL_RECOGNIZER } from '../../data/dictionaries/entity-catalog.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { normalizeCompareString } from './dedupe-engine.js';

export const EDUCATION_DEDUPE = 'EDUCATION_DEDUPE';

function canonicalSchoolName(line) {
  const hit = findBestEntity(line, SCHOOL_RECOGNIZER);
  if (hit?.canonical) return hit.canonical;
  return findLongestDictionaryTerm(line, SCHOOL_TERMS) || '';
}

function parseEducationParts(line) {
  const raw = String(line || '').trim();
  const segments = raw.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  const school = canonicalSchoolName(segments[0] || '') || segments[0] || '';
  const dates = extractDateRangeFromText(raw);
  const twin = raw.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  const start = dates.startDate || twin?.[1] || '';
  const end = dates.endDate || twin?.[2] || '';

  let program = '';
  if (segments.length >= 3 && /\d{4}/.test(segments[segments.length - 1])) {
    program = segments.slice(1, -1).join(' — ');
  } else if (segments.length >= 2) {
    program = segments[1];
  }
  program = program
    .replace(/\(\s*(?:19|20)\d{2}[^)]*\)/g, '')
    .replace(/\b(19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/g, '')
    .trim();

  return { school, program, start, end, raw };
}

function parseYearSpan(start, end) {
  const s = parseInt(String(start || '').trim(), 10);
  let e = parseInt(String(end || start || '').trim(), 10);
  if (Number.isNaN(s)) return null;
  if (Number.isNaN(e)) e = s;
  return { start: Math.min(s, e), end: Math.max(s, e) };
}

function yearSpanOverlaps(a, b) {
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

function mergeYearSpans(a, b) {
  return { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
}

function programGroupKey(school, program) {
  const s = normalizeCompareString(school);
  const p = normalizeCompareString(program) || '_';
  return `${s}|${p}`;
}

function resolveEducationRow(item, opts = {}) {
  const normalized = normalizeEducationEntry(item, { identity: opts.identity });
  if (normalized?.school) {
    const program =
      canonicalizeEducationProgram(normalized.program || '') ||
      String(normalized.program || '').trim();
    return {
      school: normalized.school,
      program,
      span: parseYearSpan(normalized.startDate, normalized.endDate),
      start: normalized.startDate,
      end: normalized.endDate,
      display: normalized.display,
      confidence: scoreEducationLine(normalized.display),
    };
  }

  const parsed = parseEducationParts(String(item || '').trim());
  if (!parsed.school) return null;
  const program =
    canonicalizeEducationProgram(parsed.program || '') || String(parsed.program || '').trim();
  const display = parsed.program
    ? `${parsed.school} — ${program}${parsed.start ? ` — ${parsed.start}${parsed.end && parsed.end !== parsed.start ? `–${parsed.end}` : ''}` : ''}`
    : parsed.raw;
  return {
    school: parsed.school,
    program,
    span: parseYearSpan(parsed.start, parsed.end),
    start: parsed.start,
    end: parsed.end,
    display,
    confidence: scoreEducationLine(display || String(item)),
  };
}

/**
 * Merge duplicate education rows: same school + same program + overlapping years.
 * @param {string[]} education
 * @param {object} [opts]
 * @returns {string[]}
 */
export function dedupeEducationEntries(education = [], opts = {}) {
  const exactSeen = new Set();
  const exactPass = [];
  for (const item of education || []) {
    const raw = String(item || '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const exactKey = normalizeCompareString(raw);
    if (exactSeen.has(exactKey)) continue;
    exactSeen.add(exactKey);
    exactPass.push(raw);
  }

  const expanded = [];
  for (const item of exactPass) {
    const chunks = splitMergedEducationLine(String(item || '').trim());
    if (chunks.length) expanded.push(...chunks);
    else if (item) expanded.push(String(item).trim());
  }

  const byProgram = new Map();
  for (const item of expanded) {
    const row = resolveEducationRow(item, opts);
    if (!row?.school) continue;
    const key = programGroupKey(row.school, row.program);
    if (!byProgram.has(key)) byProgram.set(key, []);
    byProgram.get(key).push(row);
  }

  const out = [];
  for (const group of byProgram.values()) {
    group.sort((a, b) => (a.span?.start ?? 9999) - (b.span?.start ?? 9999));

    const clusters = [];
    for (const row of group) {
      if (!row.span) {
        const dup = clusters.find(
          (c) => !c.span && c.school === row.school && c.program === row.program
        );
        if (!dup) clusters.push({ ...row });
        continue;
      }

      let placed = false;
      for (const cluster of clusters) {
        if (!cluster.span || !yearSpanOverlaps(cluster.span, row.span)) continue;
        cluster.span = mergeYearSpans(cluster.span, row.span);
        cluster.start = String(cluster.span.start);
        cluster.end = String(cluster.span.end);
        if ((row.program || '').length > (cluster.program || '').length) {
          cluster.program = row.program;
        }
        if (row.confidence > cluster.confidence) cluster.display = row.display;
        cluster.confidence = Math.max(cluster.confidence, row.confidence);
        placed = true;
        break;
      }
      if (!placed) clusters.push({ ...row });
    }

    for (const cluster of clusters) {
      const display =
        formatNormalizedEducationLine({
          school: cluster.school,
          program: cluster.program,
          startDate: cluster.start || (cluster.span ? String(cluster.span.start) : ''),
          endDate: cluster.end || (cluster.span ? String(cluster.span.end) : ''),
        }) || cluster.display;
      if (display && isValidEducationItem(display)) out.push(display);
    }
  }

  out.sort((a, b) => {
    const ya = parseInt(extractDateRangeFromText(b).startDate || '0', 10);
    const yb = parseInt(extractDateRangeFromText(a).startDate || '0', 10);
    return ya - yb;
  });

  return out;
}
