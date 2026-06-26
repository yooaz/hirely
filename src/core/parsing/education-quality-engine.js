/**
 * EDUCATION_QUALITY_ENGINE — structured, validated education entries.
 *
 * Output shape per entry: { school, degree, startYear, endYear, confidence, display }
 */

import {
  normalizeEducationEntry,
  stripEducationLeaks,
  formatNormalizedEducationLine,
} from './education-normalization-layer.js';
import { isCorruptEducationLine } from './education-confidence.js';
import { EMAIL_RE, PHONE_RE, isValidEducationItem } from './field-sanitize.js';
import {
  EDUCATION_SANITIZER,
  educationRowForbiddenReason,
  sanitizeEducationRows,
} from './education-sanitizer.js';
import {
  DATE_NORMALIZER_MAX_YEAR,
  normalizeYearRange,
} from './date-normalizer.js';
import { LABEL_PAREN_HANDLE_RE, SYMBOL_HANDLE_OCR_RE } from './ocr-classification-rules.js';

export const EDUCATION_QUALITY_ENGINE = 'EDUCATION_QUALITY_ENGINE';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1950;
const MAX_DURATION_YEARS = 10;

const URL_RE = /https?:\/\/|www\./i;
const SOCIAL_RE = /instagram\.com|linkedin\.com|behance\.net|dribbble\.com|facebook\.com|twitter\.com|x\.com/i;

const OCR_GARBAGE_RE =
  /\b20[MN]\b|@\s*man\b|ign\s+fin|mustrator|incesion|wustrator|gradric/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function parseYear(value) {
  const n = parseInt(String(value || '').replace(/\D/g, '').slice(0, 4), 10);
  return Number.isNaN(n) ? null : n;
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
 * @param {string} text
 */
export function educationHasContamination(text) {
  const s = normSpace(text);
  if (!s) return true;
  if (educationRowForbiddenReason(s)) return true;
  if (URL_RE.test(s)) return true;
  if (SOCIAL_RE.test(s)) return true;
  if (EMAIL_RE.test(s)) return true;
  if (hasPhoneContamination(s)) return true;
  if (OCR_GARBAGE_RE.test(s)) return true;
  if (SYMBOL_HANDLE_OCR_RE.test(s)) return true;
  if (LABEL_PAREN_HANDLE_RE.test(s)) return true;
  if (isCorruptEducationLine(s)) return true;
  return false;
}

/**
 * @param {number|string|null} startYear
 * @param {number|string|null} endYear
 */
export function validateEducationYears(startYear, endYear) {
  const start = parseYear(startYear);
  const end = parseYear(endYear);

  if (start !== null && start < MIN_YEAR) {
    return { ok: false, reason: 'start_before_min' };
  }
  if (end !== null && end > DATE_NORMALIZER_MAX_YEAR) {
    return { ok: false, reason: 'end_in_future' };
  }
  if (start !== null && start > DATE_NORMALIZER_MAX_YEAR) {
    return { ok: false, reason: 'start_in_future' };
  }
  if (start !== null && end !== null && start > end) {
    return { ok: false, reason: 'start_after_end' };
  }
  if (start !== null && end !== null && end - start + 1 > MAX_DURATION_YEARS) {
    return { ok: false, reason: 'duration_exceeded' };
  }
  return { ok: true, reason: '' };
}

function scoreEducationQuality(entry) {
  let score = 50;
  if (entry.school) score += 20;
  if (entry.degree) score += 15;
  if (entry.startYear) score += 8;
  if (entry.endYear) score += 7;
  return Math.min(99, score);
}

/**
 * @param {string|object} raw
 * @param {object} [opts]
 * @returns {{ school: string, degree: string, startYear: string, endYear: string, confidence: number, display: string }|null}
 */
export function buildQualityEducationEntry(raw, opts = {}) {
  const identity = opts.identity || {};
  const text =
    typeof raw === 'object'
      ? String(
          raw.display ||
            [raw.school, raw.degree || raw.program, raw.startYear || raw.startDate, raw.endYear || raw.endDate]
              .filter(Boolean)
              .join(' — ') ||
            ''
        )
      : String(raw || '').trim();

  if (!text || text.length < 3) return null;

  const cleaned = stripEducationLeaks(text, identity);
  if (!cleaned || cleaned.length < 3) return null;
  if (educationHasContamination(cleaned)) return null;

  const normalized = normalizeEducationEntry(cleaned, { identity, alreadyStripped: true });
  if (!normalized?.school && !normalized?.program) return null;

  const dateNorm = normalizeYearRange(
    normalized.startDate,
    normalized.endDate || normalized.startDate
  );
  const startYear = String(dateNorm.startDate || normalized.startDate || '').trim();
  const endYear = String(dateNorm.endDate || normalized.endDate || normalized.startDate || '').trim();
  const degree = String(normalized.program || '').trim();

  const display = formatNormalizedEducationLine({
    school: normalized.school,
    program: degree,
    startDate: startYear,
    endDate: endYear,
  });

  if (!display || !isValidEducationItem(display)) return null;
  if (educationHasContamination(display)) return null;

  const yearCheck = validateEducationYears(startYear, endYear);
  if (!yearCheck.ok) return null;

  const entry = {
    school: normalized.school,
    degree,
    startYear,
    endYear,
    confidence: scoreEducationQuality({ school: normalized.school, degree, startYear, endYear }),
    display,
    qualityEngine: EDUCATION_QUALITY_ENGINE,
  };

  return entry;
}

/**
 * @param {Array<string|object>} education
 * @param {object} [opts]
 */
function educationRowText(item) {
  if (!item) return '';
  if (typeof item === 'object') {
    return normSpace(
      item.display ||
        [item.school, item.degree || item.program, item.startYear || item.startDate, item.endYear || item.endDate]
          .filter(Boolean)
          .join(' — ')
    );
  }
  return normSpace(item);
}

export function applyEducationQuality(education = [], opts = {}) {
  const sanitized = sanitizeEducationRows(education, opts);
  const entries = [];
  const seen = new Set();
  const rejectedLines = [...sanitized.rejectedLines];

  for (const item of sanitized.education) {
    const entry = buildQualityEducationEntry(item, opts);
    if (!entry) {
      const raw = educationRowText(item);
      if (raw) rejectedLines.push(raw);
      continue;
    }

    const schoolYearKey = [entry.school.toLowerCase(), entry.startYear, entry.endYear].join('|');
    const fullKey = [schoolYearKey, entry.degree.toLowerCase()].join('|');

    if (seen.has(fullKey)) continue;

    const existingIdx = entries.findIndex(
      (e) =>
        e.school.toLowerCase() === entry.school.toLowerCase() &&
        e.startYear === entry.startYear &&
        e.endYear === entry.endYear
    );
    if (existingIdx >= 0) {
      const existing = entries[existingIdx];
      const keepNew =
        (entry.degree?.length || 0) > (existing.degree?.length || 0) ||
        entry.confidence > existing.confidence;
      if (keepNew) entries[existingIdx] = entry;
      seen.add(fullKey);
      seen.add(schoolYearKey);
      continue;
    }

    seen.add(fullKey);
    seen.add(schoolYearKey);
    entries.push(entry);
  }

  entries.sort((a, b) => parseYear(b.startYear) - parseYear(a.startYear));

  return {
    engine: EDUCATION_QUALITY_ENGINE,
    sanitizer: EDUCATION_SANITIZER,
    entries,
    displays: entries.map((e) => e.display),
    count: entries.length,
    rejectedLines: [...new Set(rejectedLines.map((l) => normSpace(l)).filter(Boolean))],
    sanitizerAudit: sanitized.audit,
  };
}

/**
 * @param {object} cvData
 */
export function applyEducationQualityToCvData(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;

  const d = { ...cvData };
  const identity = {
    name: d.name,
    email: d.email,
    phone: d.phone,
  };

  const result = applyEducationQuality(d.education || [], { identity });
  d.education = result.displays;
  d._educationQuality = result.entries;
  d._educationQualityEngine = EDUCATION_QUALITY_ENGINE;
  d._educationSanitizer = result.sanitizer;
  if (result.rejectedLines?.length) {
    d.rejectedLines = [...new Set([...(d.rejectedLines || []), ...result.rejectedLines])];
  }

  return d;
}
