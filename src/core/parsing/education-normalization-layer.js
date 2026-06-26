/**
 * Education Normalization Layer — School / Program / Dates with contact & OCR stripping.
 */

import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import { repairEducationOcrDates } from './classification-fixes.js';
import { findBestEntity, SCHOOL_RECOGNIZER } from '../../data/dictionaries/entity-catalog.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { isCorruptEducationLine } from './education-confidence.js';
import { stripContactFromProse, isValidEducationItem } from './field-sanitize.js';
import { sanitizeDictionaryTerm } from '../../data/dictionaries/match-utils.js';
import { LABEL_PAREN_HANDLE_RE } from './ocr-classification-rules.js';

export const EDUCATION_NORMALIZATION_LAYER = 'EDUCATION_NORMALIZATION_LAYER';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_STRIP_RE =
  /(?:\+?(?:33|31|32|1|41|49|34|39|44)[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}|\+\d{1,3}[\s.-]?\d[\d\s().-]{6,16}\d/gi;
const PHONE_LEAK_RE =
  /(?:\+?(?:33|31|32|1|41|49|34|39|44)[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}|\+\d{1,3}[\s.-]?\d[\d\s().-]{6,16}\d/i;
const EMAIL_LEAK_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const PROGRAM_RULES = [
  { pattern: /\bweb\s*(?:&|and)\s*motion\s*design\b/i, label: 'Web & Motion Design' },
  { pattern: /\bweband\s*motion\s*design\b/i, label: 'Web & Motion Design' },
  { pattern: /\bweb\s*(?:&|and)\s*motion\b/i, label: 'Web & Motion Design' },
  { pattern: /\bvisual\s+communication\b/i, label: 'Visual Communication' },
  { pattern: /\bproduct\s+design\b/i, label: 'Product Design' },
  { pattern: /\bgraphic\s+design\b/i, label: 'Graphic Design' },
  { pattern: /\bfine\s+arts\b/i, label: 'Fine Arts' },
  { pattern: /\banimation\b/i, label: 'Animation' },
  { pattern: /\billustration\b/i, label: 'Illustration' },
  { pattern: /\bfashion\s+design\b/i, label: 'Fashion Design' },
  { pattern: /\barchitecture\b/i, label: 'Architecture' },
  { pattern: /\bcommunication\s+design\b/i, label: 'Communication Design' },
  { pattern: /\bdigital\s+design\b/i, label: 'Digital Design' },
  { pattern: /\bmotion\s+design\b/i, label: 'Motion Design' },
];

const EDU_OCR_GARBAGE_RES = [
  LABEL_PAREN_HANDLE_RE,
  /\b[a-z]{1,3}\)\s*:?/gi,
  /@\s*man\b/gi,
  /\bcreation\s+school\s+management\b/gi,
  /\bobservation,?\s*maquette,?\s*packaging\.?\b/gi,
  /\bign\s+fin\b/gi,
  /\bmustrator\b/gi,
  /\bincesion\b/gi,
  /\bwustrator\b/gi,
  /\bgradric\b/gi,
  /\b20[MN]\b/gi,
];

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function preserveYearSpans(s) {
  const placeholders = [];
  let text = String(s || '');
  const stash = (label) => {
    const token = `__YR${placeholders.length}__`;
    placeholders.push(label);
    return token;
  };
  text = text.replace(
    /\b((?:19|20)\d{2})\s*([-–—]|to)\s*((?:19|20)\d{2})\b/gi,
    (_m, y1, _sep, y2) => stash(`${y1}–${y2}`)
  );
  text = text.replace(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/g, (_m, y1, y2) => stash(`${y1}–${y2}`));
  return { text, placeholders };
}

function restoreYearSpans(s, placeholders) {
  let out = String(s || '');
  placeholders.forEach((label, i) => {
    out = out.replace(`__YR${i}__`, label);
  });
  return out;
}

function canonicalSchool(line) {
  const hit = findBestEntity(line, SCHOOL_RECOGNIZER);
  if (hit?.canonical) return hit.canonical;
  return findLongestDictionaryTerm(line, SCHOOL_TERMS) || '';
}

function removeInsensitivePhrase(text, phrase) {
  const p = sanitizeDictionaryTerm(phrase) || String(phrase || '').trim().slice(0, 80);
  if (!p || p.length < 2) return text;
  let s = String(text || '');
  const low = s.toLowerCase();
  const needle = p.toLowerCase();
  let idx = low.indexOf(needle);
  while (idx !== -1) {
    s = `${s.slice(0, idx)} ${s.slice(idx + p.length)}`;
    idx = s.toLowerCase().indexOf(needle, idx + 1);
  }
  return s;
}

function stripCandidateName(text, identity = {}) {
  let s = String(text || '');
  const name = String(identity.name || '').trim().slice(0, 80);
  if (name.length >= 3) {
    s = removeInsensitivePhrase(s, name);
    for (const part of name.split(/\s+/).filter((p) => p.length >= 3 && p.length <= 40)) {
      s = removeInsensitivePhrase(s, part);
    }
  }
  const emailLocal = String(identity.email || '').split('@')[0]?.slice(0, 40);
  if (emailLocal && emailLocal.length >= 3) {
    s = removeInsensitivePhrase(s, emailLocal);
  }
  return normSpace(s);
}

/**
 * Remove emails, phones, candidate names, and OCR fragments from education text.
 * @param {string} line
 * @param {object} [identity]
 */
let stripEducationLeaksDepth = 0;
const STRIP_EDUCATION_MAX_DEPTH = 3;

export function stripEducationLeaks(line, identity = {}) {
  if (stripEducationLeaksDepth >= STRIP_EDUCATION_MAX_DEPTH) {
    return normSpace(String(line || '').trim());
  }
  stripEducationLeaksDepth++;
  let s = repairEducationOcrDates(String(line || '').trim());
  if (!s) {
    stripEducationLeaksDepth--;
    return '';
  }

  const preserved = preserveYearSpans(s);
  s = preserved.text;

  s = stripContactFromProse(s);
  s = s.replace(EMAIL_RE, ' ').replace(PHONE_STRIP_RE, ' ');
  if (identity.email) s = s.replace(identity.email, ' ');
  if (identity.phone) s = s.replace(identity.phone, ' ');

  s = stripCandidateName(s, identity);

  for (const re of EDU_OCR_GARBAGE_RES) {
    s = s.replace(re, ' ');
  }

  s = restoreYearSpans(s, preserved.placeholders);

  s = s
    .replace(/\bweband\b/gi, 'Web and')
    .replace(/^\s*[|:)\]]+\s*/g, '')
    .replace(/\s*[|:)\]]+\s*$/g, '')
    .replace(/\s*—\s*—\s*/g, ' — ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  stripEducationLeaksDepth--;
  return s;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function canonicalizeEducationProgram(text) {
  const blob = normSpace(text);
  if (!blob) return '';

  for (const rule of PROGRAM_RULES) {
    if (rule.pattern.test(blob)) return rule.label;
  }

  let program = blob
    .replace(/\b(19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/^[\s:,\-–—()]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (program.length < 4) return '';
  if (/^(program|degree|diploma)$/i.test(program)) return '';

  return titleCaseProfessional(program).slice(0, 80);
}

function extractProgramFromLine(line, school, cleanedLine = '') {
  /** Never re-enter stripEducationLeaks — caller passes cleaned text from normalizeEducationEntry. */
  let rest = cleanedLine || normSpace(String(line || '').trim());
  if (school) {
    rest = rest.replace(new RegExp(school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  rest = rest
    .replace(/\b(19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const fromRules = canonicalizeEducationProgram(rest);
  if (fromRules) return fromRules;

  const segments = String(line || '')
    .split(/\s*[—–-]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (segments.length >= 2) {
    const middle = segments
      .slice(1)
      .filter((p) => !/^(?:19|20)\d{2}(?:\s*[-–—]\s*(?:19|20)\d{2})?$/i.test(p))
      .join(' — ');
    const canon = canonicalizeEducationProgram(middle);
    if (canon) return canon;
  }

  return '';
}

function extractEducationDates(line) {
  const s = String(line || '');
  const dates = extractDateRangeFromText(s);
  const twin = s.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  const start = dates.startDate || twin?.[1] || '';
  let end = dates.endDate || twin?.[2] || '';
  if (!end && start) {
    const years = [...new Set([...s.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => m[1]))];
    if (years.length >= 2) {
      const nums = years.map((y) => parseInt(y, 10)).filter((n) => !Number.isNaN(n));
      return { startDate: String(Math.min(...nums)), endDate: String(Math.max(...nums)) };
    }
  }
  return { startDate: start, endDate: end || start };
}

/**
 * @param {{ school?: string, program?: string, startDate?: string, endDate?: string }} parts
 * @returns {string}
 */
export function formatNormalizedEducationLine(parts) {
  const school = String(parts.school || '').trim();
  const program = String(parts.program || '').trim();
  const start = String(parts.startDate || '').trim();
  const end = String(parts.endDate || '').trim();
  const dateLabel = start && end && start !== end ? `${start}–${end}` : start || end || '';
  if (school && program && dateLabel) return `${school} — ${program} — ${dateLabel}`;
  if (school && program) return `${school} — ${program}`;
  if (school && dateLabel) return `${school} — ${dateLabel}`;
  return school || program || '';
}

/**
 * @param {string|object} entry
 * @param {object} [opts]
 * @returns {{ school: string, program: string, startDate: string, endDate: string, dates: string, display: string }|null}
 */
export function normalizeEducationEntry(entry, opts = {}) {
  const identity = opts.identity || {};
  const raw =
    typeof entry === 'object'
      ? String(entry.display || entry.education || [entry.school, entry.program, entry.dates].filter(Boolean).join(' — ') || '')
      : String(entry || '').trim();
  if (!raw || raw.length < 3) return null;

  const datesFromRaw = extractEducationDates(raw);
  const cleaned = opts.alreadyStripped ? normSpace(raw) : stripEducationLeaks(raw, identity);
  if (!cleaned || isCorruptEducationLine(cleaned)) return null;

  const base = cleaned;

  const school = canonicalSchool(base) || canonicalSchool(cleaned);
  const extracted = extractEducationDates(base || cleaned);
  const startDate = extracted.startDate || datesFromRaw.startDate;
  const endDate = extracted.endDate || datesFromRaw.endDate;
  const program = extractProgramFromLine(base || cleaned, school, cleaned);
  if (!school && !program) return null;
  const display = formatNormalizedEducationLine({
    school,
    program,
    startDate,
    endDate,
  });

  if (!display || !isValidEducationItem(display)) return null;
  if (EMAIL_LEAK_RE.test(display) || (display.includes('+') && PHONE_LEAK_RE.test(display))) {
    return null;
  }

  const dates = startDate && endDate && startDate !== endDate ? `${startDate}–${endDate}` : startDate || endDate || '';

  return {
    school,
    program,
    startDate,
    endDate,
    dates,
    display,
    educationNormalization: EDUCATION_NORMALIZATION_LAYER,
  };
}

function educationDedupeKey(entry) {
  const n = normalizeEducationEntry(entry);
  if (!n) return String(entry || '').trim().toLowerCase();
  return `${n.school.toLowerCase()}|${n.program.toLowerCase()}|${n.startDate}|${n.endDate}`;
}

/**
 * @param {Array<string|object>} education
 * @param {object} [opts]
 * @returns {string[]}
 */
export function normalizeAllEducation(education = [], opts = {}) {
  const displays = [];
  const seen = new Set();
  for (const item of education || []) {
    const normalized = normalizeEducationEntry(item, opts);
    if (!normalized?.display || seen.has(normalized.display)) continue;
    seen.add(normalized.display);
    displays.push(normalized.display);
  }
  return displays;
}
