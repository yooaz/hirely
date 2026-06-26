/**
 * DATE_NORMALIZER — clamp impossible future years and flag long durations.
 */

import { extractDateRangeFromText } from './parser-recovery.js';

export const DATE_NORMALIZER = 'DATE_NORMALIZER';
export const DATE_NORMALIZER_MAX_YEAR = 2026;
export const DATE_NORMALIZER_LONG_DURATION_YEARS = 20;

const PRESENT_RE = /^present|présent|current|now|actuel|aujourd'?hui$/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string|number|null|undefined} value
 */
export function parseYearValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (PRESENT_RE.test(raw)) return null;
  const n = parseInt(raw.replace(/\D/g, '').slice(0, 4), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * @param {string} value
 */
export function isPresentEnd(value) {
  return PRESENT_RE.test(String(value || '').trim());
}

/**
 * @param {string|number|null|undefined} startDate
 * @param {string|number|null|undefined} endDate
 * @param {object} [opts]
 */
export function normalizeYearRange(startDate, endDate, opts = {}) {
  const maxYear = opts.maxYear ?? DATE_NORMALIZER_MAX_YEAR;
  const longDurationYears = opts.longDurationYears ?? DATE_NORMALIZER_LONG_DURATION_YEARS;

  const start = parseYearValue(startDate);
  const endRaw = String(endDate ?? '').trim();
  const originalEndYear = parseYearValue(endDate);
  let endPresent = isPresentEnd(endRaw);
  let end = endPresent ? null : parseYearValue(endRaw);
  let endWasFuture = false;

  if (!endPresent && end !== null && end > maxYear) {
    endWasFuture = true;
    endPresent = true;
    end = null;
  }

  let needsReview = false;
  let reviewReason = '';
  const durationEnd = originalEndYear ?? (endPresent ? maxYear : end) ?? start;
  if (start !== null && durationEnd !== null && durationEnd - start + 1 > longDurationYears) {
    needsReview = true;
    reviewReason = 'duration_exceeded_20_years';
  }

  const normalizedStart = start !== null ? String(start) : normSpace(startDate);
  const normalizedEnd = endPresent ? 'Present' : end !== null ? String(end) : normSpace(endDate);
  const dates =
    normalizedStart && normalizedEnd
      ? `${normalizedStart}–${normalizedEnd}`
      : normalizedStart || normalizedEnd || '';

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    dates,
    endWasFuture,
    needsReview,
    reviewReason,
  };
}

/**
 * @param {string} line
 * @param {object} [opts]
 */
export function normalizeDateRangeInText(line, opts = {}) {
  const text = normSpace(line);
  if (!text) return { line: text, needsReview: false, reviewReason: '', dates: '' };

  const extracted = extractDateRangeFromText(text);
  if (!extracted.startDate) {
    return { line: text, needsReview: false, reviewReason: '', dates: '' };
  }

  const norm = normalizeYearRange(extracted.startDate, extracted.endDate, opts);
  const replaced = text.replace(
    /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i,
    norm.dates
  );

  return {
    line: normSpace(replaced),
    ...norm,
  };
}

function buildReviewItem(field, original, normalized, reason) {
  return {
    field,
    detected: original,
    suggestion: normalized.dates || normalized.line || '',
    reason,
    action: 'review',
    source: DATE_NORMALIZER,
  };
}

/**
 * @param {object} cvData
 * @param {object} [opts]
 */
export function applyDateNormalizationToCvData(cvData, opts = {}) {
  if (!cvData || typeof cvData !== 'object') return cvData;

  const d = { ...cvData };
  const reviewItems = [];

  d.experience = (d.experience || []).map((raw) => {
    const original = String(raw || '').trim();
    if (!original) return original;
    const normalized = normalizeDateRangeInText(original, opts);
    if (normalized.needsReview) {
      reviewItems.push(
        buildReviewItem('experience', original, normalized, normalized.reviewReason)
      );
    }
    return normalized.line;
  });

  if (Array.isArray(d._experienceMeta)) {
    d._experienceMeta = d._experienceMeta.map((meta) => {
      const norm = normalizeYearRange(meta?.startDate, meta?.endDate, opts);
      if (norm.needsReview) {
        reviewItems.push(
          buildReviewItem(
            'experience',
            [meta?.role, meta?.company, meta?.dates].filter(Boolean).join(' — '),
            norm,
            norm.reviewReason
          )
        );
      }
      const dates = norm.dates || meta?.dates || '';
      return {
        ...meta,
        startDate: norm.startDate || meta?.startDate || '',
        endDate: norm.endDate || meta?.endDate || '',
        dates,
      };
    });
  }

  if (Array.isArray(d._educationQuality)) {
    d._educationQuality = d._educationQuality.map((entry) => {
      const norm = normalizeYearRange(entry.startYear || entry.startDate, entry.endYear || entry.endDate, opts);
      if (norm.needsReview) {
        reviewItems.push(
          buildReviewItem('education', entry.display || '', norm, norm.reviewReason)
        );
      }
      const display = String(entry.display || '').replace(
        /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i,
        norm.dates
      );
      return {
        ...entry,
        startYear: norm.startDate,
        endYear: norm.endDate,
        display: normSpace(display),
      };
    });
    d.education = d._educationQuality.map((e) => e.display).filter(Boolean);
  } else {
    d.education = (d.education || []).map((raw) => {
      const original = String(raw || '').trim();
      if (!original) return original;
      const normalized = normalizeDateRangeInText(original, opts);
      if (normalized.needsReview) {
        reviewItems.push(
          buildReviewItem('education', original, normalized, normalized.reviewReason)
        );
      }
      return normalized.line;
    });
  }

  d._dateNormalizer = DATE_NORMALIZER;
  if (reviewItems.length) {
    d._dateReview = reviewItems;
    d._parserReview = [...(d._parserReview || []), ...reviewItems];
  }

  return d;
}

/**
 * Return true when text contains a year beyond maxYear.
 * @param {string} text
 * @param {number} [maxYear]
 */
export function textHasFutureYearBeyondMax(text, maxYear = DATE_NORMALIZER_MAX_YEAR) {
  const years = [...String(text || '').matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => parseInt(m[1], 10));
  return years.some((y) => y > maxYear);
}
