/**
 * EXPERIENCE_SPLIT_PARSER_V2 — date-anchored experience splitting and field extraction.
 *
 * A new experience entry starts when a line contains:
 * - a year range (2011-2014, 2017 — Present)
 * - a month + year range (Jan 2018 - Mar 2022)
 * - a standalone year on a short header line
 */

import { extractDateRangeFromText } from './parser-recovery.js';
import { buildExperienceEntryFromLineGroup } from './experience-parser.js';
import { detectSectionHeaderId } from './section-detect-v2.js';
import { isSectionHeaderLine } from './rich-parser.js';

export const EXPERIENCE_SPLIT_PARSER_V2 = 'EXPERIENCE_SPLIT_PARSER_V2';

const DATE_ONLY_LINE_RE =
  /^\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)?\s*$/i;
const YEAR_TOKEN_RE = /^\s*((?:19|20)\d{2})\s*$/;
const BULLET_RE = /^[-•*]\s+/;

export const YEAR_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\b/gi;

const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i;

const MONTH_YEAR_RANGE_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*(?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|actuel|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\b/i;

const MONTH_YEAR_TOKEN_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*(?:19|20)\d{2}\b/i;

const DESCRIPTION_LINE_RE =
  /\b(led|managed|built|developed|designed|delivered|created|implemented|collaborated|achieved|increased|reduced|launched|supported|coordinated|analyzed|researched|responsible for)\b/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function isHardBoundaryLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (detectSectionHeaderId(l)) return true;
  if (isSectionHeaderLine(l)) return true;
  return false;
}

/**
 * True when a line should start a new experience entry.
 * @param {string} line
 */
export function isExperienceEntryStartLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (BULLET_RE.test(l)) return false;

  if (DATE_ONLY_LINE_RE.test(l)) return true;
  if (YEAR_TOKEN_RE.test(l)) return true;
  if (MONTH_YEAR_RANGE_RE.test(l)) return true;

  if (DATE_RANGE_RE.test(l)) {
    if (l.length > 160) return false;
    if (DESCRIPTION_LINE_RE.test(l) && l.split(/\s+/).length > 14) return false;
    return true;
  }

  if (MONTH_YEAR_TOKEN_RE.test(l) && l.length < 96) return true;

  const years = l.match(/\b((?:19|20)\d{2})\b/g);
  if (years?.length === 1 && l.length < 56) return true;

  return false;
}

/**
 * Extract start/end dates including month+year ranges.
 * @param {string} text
 */
export function extractExperienceDateRange(text) {
  const s = String(text || '');
  const monthRange = s.match(
    /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*(?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|actuel|((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(?:19|20)\d{2}))\b/i
  );
  if (monthRange) {
    const startDate = monthRange[1].replace(/\s+/g, ' ').trim();
    const endDate = /present|présent|current|now|actuel/i.test(monthRange[2])
      ? 'Present'
      : monthRange[3].replace(/\s+/g, ' ').trim();
    return { startDate, endDate };
  }

  const dates = extractDateRangeFromText(s);
  if (dates.startDate) {
    return {
      startDate: dates.startDate,
      endDate: /present|présent|current|now|actuel/i.test(dates.endDate) ? 'Present' : dates.endDate || '',
    };
  }

  const loneYear = s.match(/\b((?:19|20)\d{2})\b/);
  if (loneYear) return { startDate: loneYear[1], endDate: '' };
  return { startDate: '', endDate: '' };
}

/**
 * Split one merged experience string on multiple date ranges.
 * @param {string} text
 */
export function splitMergedExperienceByDates(text) {
  const l = normSpace(text);
  if (!l) return [];

  const matches = [...l.matchAll(YEAR_RANGE_RE)];
  if (matches.length <= 1) return [l];

  const parts = [];
  for (let i = 0; i < matches.length; i++) {
    const start = i === 0 ? 0 : rangeGapStart(l, matches[i - 1]);
    const end = i < matches.length - 1 ? rangeGapStart(l, matches[i]) : l.length;
    const slice = normSpace(l.slice(start, end));
    if (slice.length >= 6) parts.push(slice);
  }

  return parts.length > 1 ? parts : [l];
}

function rangeGapStart(text, match) {
  let idx = match.index + match[0].length;
  while (idx < text.length && text[idx] === ' ') idx++;
  return idx;
}

/**
 * Split ordered lines into date-anchored experience groups.
 * @param {string[]} lines
 */
export function splitExperienceLines(lines) {
  const list = (lines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const groups = [];
  let current = [];

  const pushCurrent = () => {
    if (current.length) groups.push([...current]);
    current = [];
  };

  for (const line of list) {
    if (isHardBoundaryLine(line)) {
      pushCurrent();
      continue;
    }
    if (isExperienceEntryStartLine(line)) {
      pushCurrent();
      current = [line];
      continue;
    }
    if (!current.length) current = [line];
    else current.push(line);
  }
  pushCurrent();
  return groups.filter((g) => g.length);
}

/**
 * Parse one experience group into structured fields.
 * @param {string[]} group
 */
export function parseExperienceEntryV2(group) {
  const lines = (group || []).map((l) => String(l || '').trim()).filter(Boolean);
  if (!lines.length) return null;

  let entry = buildExperienceEntryFromLineGroup(lines);
  if (!entry) return null;

  entry.role = String(entry.role || '')
    .replace(/\s*[-–—|]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/\bfreelanc/i.test(entry.role) && (!entry.company || /^independent\b/i.test(entry.company))) {
    entry.company = 'Independent / Freelance';
  }
  if (/^freelance$/i.test(entry.role) && !entry.company) {
    entry.company = 'Independent / Freelance';
  }

  const blob = lines.join('\n');
  const dates = extractExperienceDateRange(blob);
  if (dates.startDate) {
    entry.startDate = dates.startDate;
    entry.endDate = dates.endDate || entry.endDate || '';
    entry.dates = `${dates.startDate}–${dates.endDate || 'Present'}`;
  }

  const description = (entry.bullets || []).map((b) => normSpace(b)).filter(Boolean).join(' ');

  return {
    title: entry.role || '',
    company: entry.company || '',
    startDate: entry.startDate || '',
    endDate: entry.endDate || '',
    description,
    role: entry.role || '',
    location: entry.location || '',
    dates: entry.dates || '',
    bullets: entry.bullets || [],
    confidence: entry.confidence ?? 0,
    parser: EXPERIENCE_SPLIT_PARSER_V2,
  };
}

/**
 * Parse lines or strings into distinct experience entries.
 * @param {string[]|string} input
 */
export function parseExperiencesV2(input) {
  const rawLines = Array.isArray(input)
    ? input.flatMap((item) => {
        const text = String(item || '').trim();
        if (!text) return [];
        return text.includes('\n') ? text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [text];
      })
    : String(input || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

  const expanded = [];
  for (const line of rawLines) {
    for (const part of splitMergedExperienceByDates(line)) {
      if (part.length >= 6) expanded.push(part);
    }
  }

  const lineGroups = splitExperienceLines(expanded);

  const entries = [];
  const seen = new Set();

  for (const group of lineGroups) {
    const entry = parseExperienceEntryV2(group);
    if (!entry) continue;
    const key = `${entry.title}|${entry.company}|${entry.startDate}`.toLowerCase();
    if (!key.replace(/\|/g, '').length || seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  return {
    engine: EXPERIENCE_SPLIT_PARSER_V2,
    entries,
    count: entries.length,
  };
}
