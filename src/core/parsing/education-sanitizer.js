/**
 * EDUCATION_SANITIZER — reject contaminated education rows; require school or degree.
 */

import { EMAIL_RE, PHONE_RE, lineIsClientList } from './field-sanitize.js';
import { stripEducationLeaks } from './education-normalization-layer.js';
import { findBestEntity, SCHOOL_RECOGNIZER } from '../../data/dictionaries/entity-catalog.js';
import { hasEducationDegree, hasEducationSchool } from './education-confidence.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { lineMatchesSchool } from '../../data/dictionaries/schools.js';

export const EDUCATION_SANITIZER = 'EDUCATION_SANITIZER';

const FORBIDDEN_CHECKS = [
  { re: /@/, reason: 'at_symbol' },
  { re: /https?:\/\//i, reason: 'http' },
  { re: /\bwww\./i, reason: 'www' },
  { re: /\binstagram\b/i, reason: 'instagram' },
  { re: /\blinkedin\b/i, reason: 'linkedin' },
];

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function rowText(item) {
  if (!item) return '';
  if (typeof item === 'object') {
    return normSpace(
      item.display ||
        item.education ||
        [item.school, item.degree || item.program, item.startYear || item.startDate, item.endYear || item.endDate]
          .filter(Boolean)
          .join(' — ')
    );
  }
  return normSpace(item);
}

function hasPhoneContamination(text) {
  const stripped = String(text || '')
    .replace(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .trim();
  if (!PHONE_RE.test(stripped)) return false;
  return stripped.replace(/\D/g, '').length >= 8;
}

/**
 * @param {string} line
 * @returns {string} rejection reason or empty string
 */
export function educationRowForbiddenReason(line) {
  const s = normSpace(line);
  if (!s) return 'empty';

  for (const { re, reason } of FORBIDDEN_CHECKS) {
    if (re.test(s)) return reason;
  }
  if (EMAIL_RE.test(s)) return 'email';
  if (hasPhoneContamination(s)) return 'phone';
  if (lineIsClientList(s)) return 'clients';

  return '';
}

/**
 * @param {string} line
 * @param {object} [opts]
 */
export function educationRowHasSchoolOrDegree(line, opts = {}) {
  const identity = opts.identity || {};
  const cleaned = stripEducationLeaks(String(line || '').trim(), identity);
  if (!cleaned || cleaned.length < 3) return false;

  const school =
    findBestEntity(cleaned, SCHOOL_RECOGNIZER)?.canonical ||
    findLongestDictionaryTerm(cleaned, SCHOOL_TERMS) ||
    '';
  if (school || hasEducationSchool(cleaned) || lineMatchesSchool(cleaned)) return true;

  if (hasEducationDegree(cleaned)) return true;

  return false;
}

/**
 * @param {Array<string|object>} education
 * @param {object} [opts]
 */
export function sanitizeEducationRows(education = [], opts = {}) {
  const accepted = [];
  const rejectedLines = [];
  const audit = [];

  for (const item of education || []) {
    const raw = rowText(item);
    if (!raw) continue;

    const forbidden = educationRowForbiddenReason(raw);
    if (forbidden) {
      rejectedLines.push(raw);
      audit.push({ line: raw, action: 'reject', reason: forbidden });
      continue;
    }

    if (!educationRowHasSchoolOrDegree(raw, opts)) {
      rejectedLines.push(raw);
      audit.push({ line: raw, action: 'reject', reason: 'missing_school_or_degree' });
      continue;
    }

    accepted.push(item);
    audit.push({ line: raw, action: 'accept', reason: '' });
  }

  return {
    engine: EDUCATION_SANITIZER,
    education: accepted,
    rejectedLines,
    audit,
  };
}
