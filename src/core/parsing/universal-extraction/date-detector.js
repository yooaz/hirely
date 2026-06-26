/**
 * UNIVERSAL_DATE_DETECTOR — OCR-tolerant date range extraction.
 */
import { UNIVERSAL_DATE_DETECTOR } from './types.js';

const MONTH_NAMES =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

const PRESENT_TOKEN =
  'present|présent|current|now|aujourd\'?hui|actuel|heden|ongoing|today';
const PRESENT_RE = new RegExp(`^(${PRESENT_TOKEN})$`, 'i');

const RANGE_SEP = '[\\-–—→]+';
const YEAR_RE = '(?:19|20)\\d{2}';

/** Repair common OCR digit glitches in year tokens. */
export function repairOcrYearToken(token) {
  let s = String(token || '').trim();
  if (!s) return '';
  s = s
    .replace(/[oO]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/[S]/g, '5')
    .replace(/[Z]/g, '2');
  const m = s.match(/\b((?:19|20)[0-9]{2})\b/);
  return m ? m[1] : '';
}

export function normalizePresentToken(token) {
  const t = String(token || '').trim();
  return PRESENT_RE.test(t) ? 'Present' : t;
}

/**
 * @param {string} text
 * @returns {{ startDate: string, endDate: string, raw: string, confidence: number, engine: string }}
 */
export function detectDatesInText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { startDate: '', endDate: '', raw: '', confidence: 0, engine: UNIVERSAL_DATE_DETECTOR };
  }

  const repaired = raw
    .replace(/(\d)[oO](\d)/g, '$10$2')
    .replace(/\b2[oO](\d{2})\b/g, '20$1')
    .replace(/\b([0-9oOlI]{4})\b/g, (m) => repairOcrYearToken(m) || m)
    .replace(/(\d{1,2})[\/\.]((?:19|20)\d{2})\b/g, '$2');

  // 2018-2020 / 2018 — Present / 2018 → Present
  const rangeArrow = repaired.match(
    new RegExp(`\\b(${YEAR_RE})\\s*${RANGE_SEP}\\s*(${YEAR_RE}|${PRESENT_TOKEN})\\b`, 'i')
  );
  if (rangeArrow) {
    const start = repairOcrYearToken(rangeArrow[1]) || rangeArrow[1];
    const end = normalizePresentToken(rangeArrow[2]);
    const endYear = repairOcrYearToken(end) || (/^\d{4}$/.test(end) ? end : '');
    return {
      startDate: start,
      endDate: endYear || end,
      raw,
      confidence: 0.92,
      engine: UNIVERSAL_DATE_DETECTOR,
    };
  }

  // Jan 2020 - Mar 2022
  const monthRange = repaired.match(
    new RegExp(
      `\\b(${MONTH_NAMES})\\.?\\s*(${YEAR_RE})\\s*${RANGE_SEP}\\s*(?:(${MONTH_NAMES})\\.?\\s*)?(${YEAR_RE}|${PRESENT_TOKEN})\\b`,
      'i'
    )
  );
  if (monthRange) {
    const start = repairOcrYearToken(monthRange[2]) || monthRange[2];
    const end = normalizePresentToken(monthRange[4]);
    const endYear = repairOcrYearToken(end) || (/^\d{4}$/.test(end) ? end : '');
    return {
      startDate: start,
      endDate: endYear || end,
      raw,
      confidence: 0.88,
      engine: UNIVERSAL_DATE_DETECTOR,
    };
  }

  // 06/2019 or 6.2019
  const slash = repaired.match(/\b(\d{1,2})[\/\-.]((?:19|20)\d{2})\b/);
  if (slash) {
    const y = repairOcrYearToken(slash[2]) || slash[2];
    return { startDate: y, endDate: y, raw, confidence: 0.75, engine: UNIVERSAL_DATE_DETECTOR };
  }

  // Standalone year on short line
  const years = [...repaired.matchAll(new RegExp(`\\b(${YEAR_RE})\\b`, 'g'))].map(
    (m) => repairOcrYearToken(m[1]) || m[1]
  );
  if (years.length === 1 && raw.length < 56) {
    return { startDate: years[0], endDate: '', raw, confidence: 0.62, engine: UNIVERSAL_DATE_DETECTOR };
  }
  if (years.length >= 2) {
    return {
      startDate: years[0],
      endDate: years[years.length - 1],
      raw,
      confidence: 0.7,
      engine: UNIVERSAL_DATE_DETECTOR,
    };
  }

  return { startDate: '', endDate: '', raw, confidence: 0, engine: UNIVERSAL_DATE_DETECTOR };
}

export function formatDateRange(dates) {
  if (!dates?.startDate && !dates?.endDate) return '';
  if (!dates.endDate) return dates.startDate || '';
  if (!dates.startDate) return dates.endDate;
  return `${dates.startDate} – ${dates.endDate}`;
}
