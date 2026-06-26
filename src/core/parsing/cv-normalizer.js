/**
 * P1 — CV Normalizer
 *
 * Pipeline position:
 *   OCR → RAW TEXT → NORMALIZER → ENTITY EXTRACTION → VALIDATION → STRUCTURED CV → TEMPLATE
 *
 * Composes existing OCR/clean modules into one deterministic layer so raw OCR
 * does not leak into templates.
 */

import { normalizeOcrDocument } from './ocr-normalization.js';
import { looksLikeOcrText } from './ocr-postprocess.js';
import {
  safeClean,
  stripHeaderFooterLines,
  repairCompactWordBoundaries,
  normalizeRawExtract,
} from './clean.js';
import {
  removeDuplicateLines,
  repairCommonOCRMistakes,
  repairSectionHeaders,
} from './line-cleaner.js';
import { normalizeReconstructedDates, dedupeEntitySegmentsInLine } from './text-reconstruction.js';
import { sanitizeEmailOcrArtifacts, validateEmailRfcStrict } from '../validation/email-strictness.js';
import { extractPhoneCandidate } from './phone-normalize.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const CV_NORMALIZER_V1 = 'CV_NORMALIZER_V1';

const PAGE_NUMBER_LINE_RE =
  /^(?:page\s*)?\d{1,3}\s*(?:\/|of|sur|de)\s*\d{1,3}$|^(?:page\s+)?\d{1,3}$/i;

const EMAIL_INLINE_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const OCR_SPACED_EMAIL_RE =
  /[a-z0-9][a-z0-9.\s_%+-]*\s*@\s*[a-z0-9][a-z0-9.\s_-]*\s*\.\s*[a-z]{2,}/gi;
const PHONE_INLINE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

/**
 * @param {object} [opts]
 */
function isOcrSource(opts = {}) {
  if (opts.ocr === true) return true;
  const m = String(opts.extractionMethod || opts.method || '').toLowerCase();
  return /ocr|mixed|scan|image|pdf_scan|pdf_mixed|pdf-ocr/i.test(m);
}

/**
 * @param {string} line
 */
export function isPageNumberLine(line) {
  return PAGE_NUMBER_LINE_RE.test(String(line || '').trim());
}

/**
 * @param {string[]} lines
 */
export function removePageNumberLines(lines = []) {
  return (lines || []).filter((l) => !isPageNumberLine(l));
}

/**
 * @param {string} line
 */
function normalizeEmailInLine(line) {
  let l = String(line || '');
  l = l.replace(OCR_SPACED_EMAIL_RE, (m) => {
    const cleaned = sanitizeEmailOcrArtifacts(m);
    return validateEmailRfcStrict(cleaned) ? cleaned : m.replace(/\s+/g, '').toLowerCase();
  });
  return l.replace(EMAIL_INLINE_RE, (m) => {
    const cleaned = sanitizeEmailOcrArtifacts(m);
    return validateEmailRfcStrict(cleaned) ? cleaned : m.replace(/\s+/g, '').toLowerCase();
  });
}

/**
 * @param {string} line
 */
function normalizePhoneInLine(line) {
  let l = String(line || '');
  if (/\b(19|20)\d{2}\s*[-–—]/.test(l)) return l;
  return l.replace(PHONE_INLINE_RE, (m) => {
    const norm = extractPhoneCandidate(m);
    return norm || m.trim();
  });
}

/**
 * @param {string} line
 */
function normalizeLineContactsAndDates(line) {
  let s = repairSectionHeaders(String(line || '').trim());
  s = normalizeEmailInLine(s);
  s = normalizePhoneInLine(s);
  s = normalizeReconstructedDates(s);
  s = dedupeEntitySegmentsInLine(s);
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * @param {string} rawText
 * @param {object} [opts]
 */
export function normalizeCvText(rawText, opts = {}) {
  return normalizeCvDocument(rawText, opts).text;
}

/**
 * Full normalization pass with trace + stats.
 * @param {string} rawText
 * @param {{ rawText?: string, extractionMethod?: string, method?: string, ocr?: boolean }} [opts]
 */
export function normalizeCvDocument(rawText, opts = {}) {
  const archiveRaw = String(opts.rawText ?? rawText ?? '');
  let text = String(rawText || '').trim();
  const stats = {
    inputChars: text.length,
    inputLines: 0,
    outputChars: 0,
    outputLines: 0,
    pageNumbersRemoved: 0,
    duplicatesRemoved: 0,
    headersRemoved: 0,
    garbageDropped: 0,
    ocrRepairs: 0,
    datesNormalized: 0,
    contactsNormalized: 0,
    usedOcrEngine: false,
  };

  if (!text) {
    return {
      version: CV_NORMALIZER_V1,
      text: '',
      rawText: archiveRaw,
      lines: [],
      rejectedLines: [],
      uncertainLines: [],
      stats,
    };
  }

  text = repairCompactWordBoundaries(text);
  const ocr = isOcrSource(opts) || looksLikeOcrText(text);
  /** @type {Array<{ rawLine: string, normalizedLine: string, accepted?: boolean }>} */
  let trace = [];

  if (ocr) {
    const ocrNorm = normalizeOcrDocument(text, opts);
    text = ocrNorm.text || text;
    trace = (ocrNorm.lines || []).map((l) => ({
      rawLine: l.rawLine,
      normalizedLine: l.normalizedLine,
      accepted: l.accepted,
    }));
    stats.usedOcrEngine = true;
    stats.garbageDropped += ocrNorm.stats?.garbageDropped ?? 0;
    stats.ocrRepairs +=
      (ocrNorm.stats?.brokenWordsFixed ?? 0) + (ocrNorm.stats?.charRepairs ?? 0);
  } else {
    text = repairCommonOCRMistakes(text);
    text = safeClean(text);
  }

  let lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  stats.inputLines = lines.length;

  const beforePages = lines.length;
  lines = removePageNumberLines(lines);
  stats.pageNumbersRemoved = beforePages - lines.length;

  const beforeHeaders = lines.length;
  lines = stripHeaderFooterLines(lines);
  stats.headersRemoved = beforeHeaders - lines.length;

  const beforeDup = lines.length;
  lines = removeDuplicateLines(lines);
  stats.duplicatesRemoved = beforeDup - lines.length;

  const normalizedLines = [];
  const rejectedLines = [];
  const uncertainLines = [];

  for (const line of lines) {
    const before = line;
    const norm = normalizeLineContactsAndDates(line);
    if (norm !== before) {
      if (EMAIL_INLINE_RE.test(before) || PHONE_INLINE_RE.test(before)) {
        stats.contactsNormalized += 1;
      }
      if (/\b(19|20)\d{2}\b/.test(before)) stats.datesNormalized += 1;
    }
    if (!norm) {
      rejectedLines.push(before);
      continue;
    }
    normalizedLines.push(norm);
  }

  text = normalizeRawExtract(normalizedLines.join('\n'));
  stats.outputChars = text.length;
  stats.outputLines = normalizedLines.length;

  if (!trace.length) {
    trace = normalizedLines.map((l, i) => ({
      rawLine: lines[i] || l,
      normalizedLine: l,
      accepted: true,
    }));
  }

  hirelyDebugLog('CV_NORMALIZER', {
    version: CV_NORMALIZER_V1,
    ocr,
    stats,
    sample: normalizedLines.slice(0, 12),
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_CV_NORMALIZER = {
      version: CV_NORMALIZER_V1,
      text,
      rawText: archiveRaw,
      stats,
      trace,
    };
  }

  return {
    version: CV_NORMALIZER_V1,
    text,
    rawText: archiveRaw,
    lines: trace,
    normalizedLines,
    rejectedLines,
    uncertainLines,
    stats,
  };
}
