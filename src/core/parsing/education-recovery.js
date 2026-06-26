/**
 * SAFE_EDUCATION_RECOVERY — strict education recovery without destroying phone-mixed rows.
 */

import { extractDateRangeFromText, splitMergedEducationLine } from './parser-recovery.js';
import {
  parseEducationLineWithContact,
  repairEducationOcrDates,
} from './classification-fixes.js';
import {
  scoreEducationConfidence,
  EDUCATION_FORCE_THRESHOLD,
} from './education-confidence.js';
import { scoreEducationLine } from '../validation/confidence-gate.js';
import { isValidEducationItem } from './field-sanitize.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { findBestEntity, SCHOOL_RECOGNIZER } from '../../data/dictionaries/entity-catalog.js';
import { normalizeAllEducation } from './education-normalization-layer.js';
import { dedupeEducationEntries } from './education-dedupe.js';

export { dedupeEducationEntries } from './education-dedupe.js';

export const SAFE_EDUCATION_RECOVERY = 'SAFE_EDUCATION_RECOVERY';
export const SAFE_EDUCATION_CONFIDENCE_MIN = 85;

function canonicalSchoolName(line) {
  const hit = findBestEntity(line, SCHOOL_RECOGNIZER);
  if (hit?.canonical) return hit.canonical;
  return findLongestDictionaryTerm(line, SCHOOL_TERMS) || '';
}

function extractProgramFromSchoolLine(line, school) {
  let program = String(line || '');
  if (school) {
    program = program.replace(new RegExp(school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  program = program
    .replace(/\+\d[\d\s().-]{8,}/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/^[\s:,\-–—@()]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (program.length < 4) return '';
  return program.charAt(0).toUpperCase() + program.slice(1);
}

/**
 * Dictionary-driven school education recovery (OCR-corrupted lines with dates).
 * @param {string} line
 * @returns {string|null}
 */
export function tryRecoverSchoolEducation(line) {
  const s = repairEducationOcrDates(String(line || '').trim());
  if (/^.+\s+—\s+.+\s+—\s+(?:19|20)\d{2}/.test(s)) return s;
  const school = canonicalSchoolName(s);
  if (!school) return null;

  const dates = extractDateRangeFromText(s);
  const twin = s.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  const startDate = dates.startDate || twin?.[1] || '';
  if (!startDate) return null;
  const endDate = dates.endDate || twin?.[2] || startDate;

  const program = extractProgramFromSchoolLine(s, school);
  if (program) return `${school} — ${program} — ${startDate}–${endDate}`;
  return `${school} — ${startDate}–${endDate}`;
}

function normalizeSchoolLabel(school) {
  const s = String(school || '').trim();
  if (!s) return '';
  return canonicalSchoolName(s) || s;
}

function parseEducationParts(line) {
  const raw = String(line || '').trim();
  const normalized = tryRecoverSchoolEducation(raw) || raw;
  const segments = normalized.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  const school = normalizeSchoolLabel(segments[0] || '');
  const dates = extractDateRangeFromText(normalized);
  const twin = normalized.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
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

function formatEducationDisplay({ school, program, start, end }) {
  const dateLabel = start && end ? `${start}–${end}` : start || '';
  if (school && program && dateLabel) return `${school} — ${program} — ${dateLabel}`;
  if (school && program) return `${school} — ${program}`;
  return school || program || '';
}

/**
 * @param {string} line
 * @param {object} [opts]
 * @returns {{ education: string, phone?: string, email?: string, parser: string }|null}
 */
const DEGREE_MARKERS_RE =
  /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|m\.?\s*b\.?\s*a\.?|mba|ph\.?\s*d\.?|bachelor|master|diploma|licence|license)\b/i;

export function formatSafeEducationEntry(line, opts = {}) {
  const repaired = repairEducationOcrDates(String(line || '').trim());
  if (!repaired || repaired.length < 4) return null;

  const minConf = opts.minConfidence ?? SAFE_EDUCATION_CONFIDENCE_MIN;
  const hasDegreeYear = DEGREE_MARKERS_RE.test(repaired) && /\b(19|20)\d{2}\b/.test(repaired);
  if (hasDegreeYear) {
    const segments = repaired.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
    const schoolLead = segments[0] || '';
    if (schoolLead && schoolLead.length >= 2 && schoolLead.length <= 56) {
      const dates = extractDateRangeFromText(repaired);
      const twin = repaired.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
      const start = dates.startDate || twin?.[1] || '';
      const end = dates.endDate || twin?.[2] || '';
      const program = segments.slice(1).filter((p) => !/^(19|20)\d{2}$/.test(p)).join(' — ').trim();
      const dateLabel = start && end ? `${start}–${end}` : start || '';
      let education = program ? `${schoolLead} — ${program}` : schoolLead;
      if (dateLabel) education = `${education} — ${dateLabel}`;
      if (education.length >= 6 && scoreEducationLine(education) >= Math.min(minConf, 55)) {
        return { education: education.slice(0, 200), parser: 'degree_year_lead' };
      }
    }
  }

  const dictSchool = canonicalSchoolName(repaired);
  if (dictSchool && /\s*[—–-]\s*/.test(repaired)) {
    const conf = scoreEducationLine(repaired);
    if (conf >= (opts.minConfidence ?? SAFE_EDUCATION_CONFIDENCE_MIN)) {
      return { education: repaired.slice(0, 200), parser: 'formatted_education' };
    }
  }

  const parsed = parseEducationLineWithContact(repaired);
  if (parsed?.education) {
    const conf = scoreEducationLine(parsed.education);
    if (conf >= (opts.minConfidence ?? SAFE_EDUCATION_CONFIDENCE_MIN)) {
      return {
        education: parsed.education,
        phone: parsed.phone,
        email: parsed.email,
        parser: 'parseEducationLineWithContact',
      };
    }
  }

  const recovered = tryRecoverSchoolEducation(repaired);
  if (recovered && scoreEducationLine(recovered) >= (opts.minConfidence ?? SAFE_EDUCATION_CONFIDENCE_MIN)) {
    return { education: recovered, parser: 'tryRecoverSchoolEducation' };
  }

  const edu = scoreEducationConfidence(repaired);
  if (!edu.schoolMatch && !edu.forceEducation) return null;
  if (edu.confidence < EDUCATION_FORCE_THRESHOLD && !edu.forceEducation) return null;

  const schoolTerm = findLongestDictionaryTerm(repaired, SCHOOL_TERMS);
  const dates = extractDateRangeFromText(repaired);
  const twin = repaired.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  const start = dates.startDate || twin?.[1] || '';
  const end = dates.endDate || twin?.[2] || '';
  const school = schoolTerm || canonicalSchoolName(repaired) || '';
  if (!school) return null;

  let program = extractProgramFromSchoolLine(repaired, school);
  if (!program) program = 'Program';

  const dateLabel = start && end ? `${start}–${end}` : start || '';
  const education = dateLabel
    ? `${school} — ${program} (${dateLabel})`
    : `${school} — ${program}`;

  if (!isValidEducationItem(education)) return null;
  if (scoreEducationLine(education) < (opts.minConfidence ?? SAFE_EDUCATION_CONFIDENCE_MIN)) return null;

  return { education: education.slice(0, 200), parser: 'scoreEducationConfidence' };
}

function eduDedupeKey(line) {
  const s = String(line || '').trim().toLowerCase();
  const school = s.split(/[—–-]/)[0].trim().slice(0, 24);
  const dates = extractDateRangeFromText(s);
  const twin = s.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  const start = dates.startDate || twin?.[1] || '';
  const end = dates.endDate || twin?.[2] || '';
  return `${school}|${start}|${end}`;
}

/**
 * @deprecated Use dedupeEducationEntries — kept for existing imports.
 * @param {string[]} education
 * @param {object} [opts]
 */
export function dedupeEducationBySchoolAndDates(education, opts = {}) {
  return dedupeEducationEntries(education, opts);
}

function pushUniqueEducation(education, entry, sourceLine) {
  const edu = String(entry || '').trim();
  if (!edu || !isValidEducationItem(edu)) return false;
  const key = eduDedupeKey(edu);
  if ((education || []).some((e) => eduDedupeKey(e) === key)) return false;
  education.push(edu);
  void sourceLine;
  return true;
}

/**
 * @param {{ education?: string[], unsorted?: string[], identity?: object }} container
 * @param {{ lines?: string[], nearbyLines?: string[] }} [opts]
 */
export function recoverSafeParsedEducation(container, opts = {}) {
  if (!container || typeof container !== 'object') {
    return { recovered: false, count: 0, items: [], container };
  }
  if (!Array.isArray(container.education)) container.education = [];
  if (!container.identity) container.identity = {};

  const sources = [];
  const seen = new Set();
  const pushSrc = (line) => {
    const t = String(line || '').trim();
    if (!t || t.length < 6 || seen.has(t)) return;
    seen.add(t);
    sources.push(t);
  };

  for (const line of opts.lines || []) pushSrc(line);
  for (const line of container.unsorted || []) pushSrc(line);

  const items = [];
  let count = 0;
  const consumed = new Set();

  for (const line of sources) {
    const chunks = splitMergedEducationLine(line);
    const linesToTry = chunks.length ? chunks : [line];
    for (const chunk of linesToTry) {
    const hit = formatSafeEducationEntry(chunk, opts);
    if (!hit?.education) continue;
    if (hit.phone && !container.identity.phone) container.identity.phone = hit.phone;
    if (hit.email && !container.identity.email) container.identity.email = hit.email;
    if (pushUniqueEducation(container.education, hit.education, chunk)) {
      count++;
      items.push({
        sourceLine: chunk,
        education: hit.education,
        parser: hit.parser,
        confidence: scoreEducationLine(hit.education),
      });
      consumed.add(line);
    }
    }
  }

  container.education = dedupeEducationEntries(
    normalizeAllEducation(container.education, {
      identity: container.identity,
    }),
    { identity: container.identity }
  );

  if (consumed.size && Array.isArray(container.unsorted)) {
    container.unsorted = container.unsorted.filter((l) => !consumed.has(String(l || '').trim()));
  }

  return { recovered: count > 0, count, items, container };
}
