/**
 * DATA_SANITIZATION_LAYER — final sanitation pass before template rendering.
 *
 * Header: no section titles (EDUCATION, FORMATION, COMPETENCES, LANGUES, CLIENTS).
 * Education: no instagram, linkedin, http, www, @.
 * Dates: years beyond 2026 are forbidden.
 */

import { applyHeaderCleaner, headerFieldsBlob, headerContainsForbiddenSection } from '../parsing/header-cleaner.js';
import { applyEducationQualityToCvData } from '../parsing/education-quality-engine.js';
import { educationRowForbiddenReason } from '../parsing/education-sanitizer.js';
import {
  applyDateNormalizationToCvData,
  DATE_NORMALIZER_MAX_YEAR,
  normalizeDateRangeInText,
  textHasFutureYearBeyondMax,
} from '../parsing/date-normalizer.js';
import { extractDateRangeFromText } from '../parsing/parser-recovery.js';
import { dedupeEducationStrings, dedupeCvExperienceLines } from '../parsing/dedupe-engine.js';
import { normalizeReconstructedLine } from '../parsing/text-reconstruction.js';
import { stripSectionLabelLeakageFromCvData } from './section-label-leakage-guard.js';

export const DATA_SANITIZATION_LAYER = 'DATA_SANITIZATION_LAYER';

const HEADER_FORBIDDEN_RE =
  /\b(education|formation|competences|compétences|langues|languages|clients)\b/i;

const EDUCATION_FORBIDDEN_RE = /\binstagram\b|linkedin|https?:\/\/|www\.|@/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} line
 * @param {number} [maxYear]
 */
export function experienceRowHasForbiddenFutureDate(line, maxYear = DATE_NORMALIZER_MAX_YEAR) {
  const text = normSpace(line);
  if (!text) return false;
  const extracted = extractDateRangeFromText(text);
  const start = parseInt(String(extracted.startDate || '').replace(/\D/g, '').slice(0, 4), 10);
  const end = parseInt(String(extracted.endDate || '').replace(/\D/g, '').slice(0, 4), 10);
  if (!Number.isNaN(start) && start > maxYear) return true;
  if (!Number.isNaN(end) && end > maxYear && !/present|présent|current/i.test(extracted.endDate || '')) {
    return true;
  }
  return textHasFutureYearBeyondMax(text, maxYear);
}

/**
 * @param {string[]} lines
 * @param {number} [maxYear]
 */
export function sanitizeExperienceFutureDates(lines = [], maxYear = DATE_NORMALIZER_MAX_YEAR) {
  const kept = [];
  const rejected = [];
  for (const raw of lines || []) {
    const line = normSpace(raw);
    if (!line) continue;
    const normalized = normalizeDateRangeInText(line, { maxYear });
    if (experienceRowHasForbiddenFutureDate(normalized.line, maxYear)) {
      rejected.push(line);
      continue;
    }
    kept.push(normalized.line);
  }
  return { experience: kept, rejected };
}

/**
 * @param {object} cvData
 */
export function auditDataSanitization(cvData) {
  const headerBlob = headerFieldsBlob(cvData || {});
  const education = (cvData?.education || []).map((x) => String(x || '').trim()).filter(Boolean);
  return {
    headerClean: !HEADER_FORBIDDEN_RE.test(headerBlob),
    educationClean: !education.some((line) => EDUCATION_FORBIDDEN_RE.test(line) || educationRowForbiddenReason(line)),
    noFutureDates:
      !(cvData?.experience || []).some((line) => experienceRowHasForbiddenFutureDate(line)) &&
      !education.some((line) => textHasFutureYearBeyondMax(line)),
  };
}

/**
 * Final sanitation pass on flat cvData before template render.
 * @param {object} cvData
 * @param {object} [opts]
 */
export function applyDataSanitizationLayer(cvData, opts = {}) {
  if (!cvData || typeof cvData !== 'object') return cvData;

  const maxYear = opts.maxYear ?? DATE_NORMALIZER_MAX_YEAR;
  let d = { ...cvData };
  const rejected = [...(d.rejectedLines || [])];

  d = applyHeaderCleaner(d);
  d = applyEducationQualityToCvData(d);
  d = applyDateNormalizationToCvData(d, { maxYear });

  const expResult = sanitizeExperienceFutureDates(
    (d.experience || []).map((line) => normalizeReconstructedLine(line)),
    maxYear
  );
  d.experience = dedupeCvExperienceLines(expResult.experience);
  if (expResult.rejected.length) {
    rejected.push(...expResult.rejected);
    if (!opts.templateMode) {
      d.unsorted = [...new Set([...(d.unsorted || []), ...expResult.rejected])].slice(0, 24);
    }
  }

  d.education = dedupeEducationStrings(
    (d.education || [])
      .map((line) => normSpace(line))
      .filter((line) => {
        if (!line) return false;
        if (educationRowForbiddenReason(line)) {
          rejected.push(line);
          return false;
        }
        if (textHasFutureYearBeyondMax(line, maxYear)) {
          rejected.push(line);
          return false;
        }
        return true;
      })
  );

  if (rejected.length && !opts.templateMode) {
    d.rejectedLines = [...new Set(rejected.map((l) => normSpace(l)).filter(Boolean))];
  }

  d = stripSectionLabelLeakageFromCvData(d);

  if (!opts.templateMode) {
    d._dataSanitization = DATA_SANITIZATION_LAYER;
    d._dataSanitizationAudit = auditDataSanitization(d);
  }
  return d;
}
