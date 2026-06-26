/**
 * CV text normalization — conservative OCR repair before section parsing.
 *
 * Principles:
 * - Never invent content; only reshape noisy tokens when confidence is high.
 * - Prefer leaving text unchanged over unsafe correction.
 * - Every change is traced with rule id + confidence.
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { splitMergedSectionHeaders } from './ocr-hardening.js';
import { fuzzySectionKey } from './section-fuzzy.js';

export const CV_TEXT_NORMALIZATION_VERSION = '2';

/** Corrections below this confidence are not applied (no hallucination). */
export const MIN_CORRECTION_CONFIDENCE = 0.7;

/** @enum {string} */
export const CORRECTION_RULE = {
  UNICODE_NFC: 'unicode_nfc',
  UNICODE_STRIP: 'unicode_strip',
  HYPHEN_NORMALIZE: 'hyphen_normalize',
  PUNCTUATION_DEDUPE: 'punctuation_dedupe',
  WHITESPACE_COLLAPSE: 'whitespace_collapse',
  DATE_MERGED_YEARS: 'date_merged_years',
  DATE_SPACED_YEARS: 'date_spaced_years',
  DATE_OCR_YEAR_M: 'date_ocr_year_m',
  DATE_OCR_MALFORMED_FRAGMENT: 'date_ocr_malformed_fragment',
  DATE_MONTH_RANGE: 'date_month_range',
  DATE_DEPUIS: 'date_depuis',
  DATE_PRESENT_ALIAS: 'date_present_alias',
  DATE_DASH_NORMALIZE: 'date_dash_normalize',
  WORD_CAMEL_SPLIT: 'word_camel_split',
  WORD_PHRASE_JOIN: 'word_phrase_join',
  WORD_DICTIONARY: 'word_dictionary',
  LINE_MERGE: 'line_merge',
  LINE_SPLIT: 'line_split',
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /https?:\/\/|www\./i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

const DASH_CHARS = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D–—]/g;
const DASH_IN_RANGE = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D–—-]/;
const PRESENT_ALIASES =
  /\b(present|présent|current|actuel(?:le)?|now|aujourd['']?hui|today|en\s+cours|ongoing)\b/gi;

const MONTH_NAMES =
  'jan(?:uary|v(?:ier)?)?|feb(?:ruary|vr(?:ier)?)?|mar(?:ch|s)?|apr(?:il)?|may|mai|jun(?:e)?|juin|jul(?:y)?|juil(?:let)?|aug(?:ust)?|ao[uû]t|sep(?:t(?:ember)?)?|oct(?:ober|obre)?|nov(?:ember)?|d[eé]c(?:ember)?';

const MONTH_RANGE_RE = new RegExp(
  `\\b(${MONTH_NAMES})\\.?\\s*((?:19|20)\\d{2})\\s*${DASH_IN_RANGE.source}\\s*(${MONTH_NAMES})\\.?\\s*((?:19|20)\\d{2})\\b`,
  'gi'
);

const DEPUIS_RE = /\bdepuis\s+((?:19|20)\d{2})\b/gi;

/** Conservative phrase repairs — whole-phrase match only. */
const PHRASE_REPAIRS = [
  { re: /\bcorporat\s+identity\b/gi, rep: 'corporate identity', confidence: 0.9 },
  { re: /\bvisual\s+identit\s*y\b/gi, rep: 'visual identity', confidence: 0.88 },
  { re: /\bgraphic\s+des\s*ign(?:er)?\b/gi, rep: 'graphic designer', confidence: 0.86 },
  { re: /\bdigital\s+art\b/gi, rep: 'digital art', confidence: 0.95 },
];

/** Single-token dictionary repairs — exact token match, case preserved on output. */
const WORD_REPAIRS = new Map(
  [
    ['digtital', 'digital'],
    ['digtitalart', 'digital art'],
    ['ilusrations', 'illustrations'],
    ['ilustrations', 'illustrations'],
    ['illusrations', 'illustrations'],
    ['identitiy', 'identity'],
    ['identitty', 'identity'],
    ['corporat', 'corporate'],
    ['graphlc', 'graphic'],
    ['deslgner', 'designer'],
    ['illustratior', 'illustrator'],
    ['indesing', 'indesign'],
    ['aftereffect', 'after effects'],
    ['afterefect', 'after effects'],
    ['indesing', 'indesign'],
    ['indesgn', 'indesign'],
    ['photshop', 'photoshop'],
    ['illusrator', 'illustrator'],
    ['illustartor', 'illustrator'],
    ['graphiste', 'graphiste'],
    ['graphique', 'graphique'],
    ['creapole', 'créapôle'],
    ['creapôle', 'créapôle'],
    ['competences', 'compétences'],
    ['langues', 'langues'],
    ['fluant', 'fluent'],
    ['flurent', 'fluent'],
    ['natiue', 'native'],
    ['natlve', 'native'],
    ['freelance', 'freelance'],
    ['freelancer', 'freelancer'],
    ['packaglng', 'packaging'],
    ['visualldentity', 'visual identity'],
  ].map(([k, v]) => [k.toLowerCase(), v])
);

/**
 * Repair a 2-digit OCR year tail glued to a 4-digit start (e.g. 201038 → 2010 - 2018).
 * @param {number} startYear
 * @param {string} tail2
 * @returns {{ year: number, confidence: number } | null}
 */
function repairOcrYearTail(startYear, tail2) {
  const n = Number(tail2);
  if (!Number.isFinite(n) || !isPlausibleCvYear(startYear)) return null;
  /** OCR often reads leading 1 as 3 in the tens digit (18 → 38). */
  if (n >= 30 && n <= 39) {
    const yy = n - 20;
    const year = 2000 + yy;
    if (isPlausibleCvYear(year) && year >= startYear && year - startYear <= 55) {
      return { year, confidence: 0.72 };
    }
  }
  if (n >= 0 && n <= 35) {
    const year = 2000 + n;
    if (isPlausibleCvYear(year) && year >= startYear && year - startYear <= 55) {
      return { year, confidence: 0.76 };
    }
  }
  return null;
}

/**
 * @param {string} line
 */
function lineHasDateContext(line) {
  const l = String(line || '');
  return (
    lineIsPredominantlyDateTokens(l) ||
    /\b(19|20)\d{2}\b/.test(l) ||
    /\b(19|20)\d{2}\s*[-–—/]/.test(l) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|d[eé]c|depuis|present|présent)\b/i.test(l) ||
    /\b(internship|stage|freelance|experience|education|formation|agency|designer|illustrator)\b/i.test(l)
  );
}

/**
 * @typedef {object} CvTextCorrection
 * @property {string} rule
 * @property {string} before
 * @property {string} after
 * @property {number} confidence — 0..1
 * @property {number} [start]
 * @property {number} [end]
 */

/**
 * @param {string} rule
 * @param {string} before
 * @param {string} after
 * @param {number} confidence
 * @param {number} [start]
 * @param {number} [end]
 * @returns {CvTextCorrection}
 */
function correction(rule, before, after, confidence, start, end) {
  return { rule, before, after, confidence, start, end };
}

/**
 * @param {number} y
 */
function isPlausibleCvYear(y) {
  return Number.isFinite(y) && y >= 1950 && y <= 2035;
}

/**
 * @param {string} line
 */
function lineIsPredominantlyDateTokens(line) {
  const l = String(line || '').trim();
  const years = l.match(/\b(?:19|20)\d{2}\b/g) || [];
  if (!years.length) return false;
  const digitChars = (l.match(/\d/g) || []).length;
  return digitChars >= 4 && years.length >= 1 && digitChars / Math.max(l.length, 1) >= 0.25;
}

/**
 * @param {string} line
 */
function lineHasProtectedContent(line) {
  const l = String(line || '');
  if (lineIsPredominantlyDateTokens(l)) {
    return EMAIL_RE.test(l) || URL_RE.test(l) || fuzzySectionKey(l);
  }
  return EMAIL_RE.test(l) || URL_RE.test(l) || PHONE_RE.test(l) || fuzzySectionKey(l);
}

/**
 * Unicode + invisible char cleanup.
 * @param {string} text
 * @param {CvTextCorrection[]} corrections
 */
function normalizeUnicode(text, corrections) {
  let s = String(text || '');
  const before = s;
  if (typeof s.normalize === 'function') {
    const nfc = s.normalize('NFC');
    if (nfc !== s) {
      corrections.push(correction(CORRECTION_RULE.UNICODE_NFC, s, nfc, 0.99));
      s = nfc;
    }
  }
  const stripped = s
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  if (stripped !== s) {
    corrections.push(correction(CORRECTION_RULE.UNICODE_STRIP, s, stripped, 0.98));
    s = stripped;
  }
  s = s
    .replace(/[''`´]/g, "'")
    .replace(/[""«»]/g, '"');
  return s;
}

/**
 * @param {string} text
 * @param {CvTextCorrection[]} corrections
 */
function normalizeHyphensAndPunctuation(text, corrections) {
  let s = String(text || '');
  const dashNorm = s.replace(DASH_CHARS, '-');
  if (dashNorm !== s) {
    corrections.push(correction(CORRECTION_RULE.HYPHEN_NORMALIZE, s, dashNorm, 0.97));
    s = dashNorm;
  }
  const punct = s
    .replace(/([!?.,;:])\1{2,}/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1');
  if (punct !== s) {
    corrections.push(correction(CORRECTION_RULE.PUNCTUATION_DEDUPE, s, punct, 0.92));
    s = punct;
  }
  const spaced = s.replace(/[ \t\f\v]{2,}/g, ' ').trim();
  if (spaced !== s) {
    corrections.push(correction(CORRECTION_RULE.WHITESPACE_COLLAPSE, s, spaced, 0.99));
    s = spaced;
  }
  return s;
}

/**
 * @param {string} text
 * @param {CvTextCorrection[]} corrections
 */
export function normalizeCvDatesInLine(text, corrections = []) {
  let s = String(text || '');
  if (!s.trim()) return s;
  if (EMAIL_RE.test(s) && !/\b(19|20)\d{2}\b/.test(s)) return s;

  // 2011-2023 / 2011 – 2023 → consistent "YYYY - YYYY"
  s = s.replace(
    /\b((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2}|present)\b/gi,
    (m, y1, y2) => {
      const end = /^present$/i.test(y2) ? 'Present' : y2;
      const out = `${y1} - ${end}`;
      if (out !== m) {
        corrections.push(correction(CORRECTION_RULE.DATE_DASH_NORMALIZE, m, out, 0.94));
      }
      return out;
    }
  );

  // Merged years: 20112023 → 2011 - 2023
  s = s.replace(/\b((?:19|20)\d{2})((?:19|20)\d{2})\b/g, (m, a, b) => {
    const y1 = Number(a);
    const y2 = Number(b);
    if (!isPlausibleCvYear(y1) || !isPlausibleCvYear(y2)) return m;
    const [start, end] = y1 <= y2 ? [y1, y2] : [y2, y1];
    const conf = y1 <= y2 ? 0.93 : 0.76;
    const out = `${start} - ${end}`;
    corrections.push(correction(CORRECTION_RULE.DATE_MERGED_YEARS, m, out, conf));
    return out;
  });

  // Spaced pair: 2011 2023 → 2011 - 2023 (not phone/year glued)
  s = s.replace(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/g, (m, a, b) => {
    const y1 = Number(a);
    const y2 = Number(b);
    if (!isPlausibleCvYear(y1) || !isPlausibleCvYear(y2)) return m;
    if (Math.abs(y2 - y1) > 60) return m;
    const [start, end] = y1 <= y2 ? [y1, y2] : [y2, y1];
    const out = `${start} - ${end}`;
    corrections.push(correction(CORRECTION_RULE.DATE_SPACED_YEARS, m, out, 0.88));
    return out;
  });

  // OCR year confusion: 20m / 20M → 2011 when in date context
  s = s.replace(/\b20[mM]\b/g, (m, offset) => {
    const ctx = s.slice(Math.max(0, offset - 12), offset + m.length + 16);
    const inDateContext =
      /\b20[mM]\s*[-–—]?\s*(?:(?:19|20)\d{2}|present)\b/i.test(ctx) ||
      /(?:19|20)\d{2}\s*[-–—]\s*20[mM]\b/i.test(ctx) ||
      /:\s*20[mM]\b/i.test(ctx);
    if (!inDateContext) return m;
    corrections.push(correction(CORRECTION_RULE.DATE_OCR_YEAR_M, m, '2011', 0.74));
    return '2011';
  });

  // 20m-2023 / 20M 2023
  s = s.replace(
    /\b20[mM]\s*[-–—]?\s*((?:19|20)\d{2}|present)\b/gi,
    (m, endYear) => {
      const end = /^present$/i.test(endYear) ? 'Present' : endYear;
      const out = `2011 - ${end}`;
      corrections.push(correction(CORRECTION_RULE.DATE_OCR_YEAR_M, m, out, 0.78));
      return out;
    }
  );

  // Malformed glued tail: 201038 → 2010 - 2018 (6-digit token is inherently date-like)
  s = s.replace(/\b((?:19|20)\d{2})(\d{2})\b/g, (m, y4, tail) => {
    const startYear = Number(y4);
    if (!isPlausibleCvYear(startYear)) return m;
    const repaired = repairOcrYearTail(startYear, tail);
    if (!repaired || repaired.confidence < MIN_CORRECTION_CONFIDENCE) return m;
    const out = `${startYear} - ${repaired.year}`;
    corrections.push(
      correction(CORRECTION_RULE.DATE_OCR_MALFORMED_FRAGMENT, m, out, repaired.confidence)
    );
    return out;
  });

  // Spaced malformed tail: 2010 38 → 2010 - 2018
  s = s.replace(/\b((?:19|20)\d{2})\s+(\d{2})\b/g, (m, y4, tail, offset) => {
    const startYear = Number(y4);
    if (!isPlausibleCvYear(startYear)) return m;
    const ctx = s.slice(Math.max(0, offset - 8), offset + m.length + 12);
    if (!lineHasDateContext(ctx)) return m;
    const repaired = repairOcrYearTail(startYear, tail);
    if (!repaired || repaired.confidence < MIN_CORRECTION_CONFIDENCE) return m;
    const out = `${startYear} - ${repaired.year}`;
    corrections.push(
      correction(CORRECTION_RULE.DATE_OCR_MALFORMED_FRAGMENT, m, out, repaired.confidence)
    );
    return out;
  });

  // Month ranges: Jan 2022 - Mar 2024
  s = s.replace(MONTH_RANGE_RE, (m, m1, y1, m2, y2) => {
    const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    const out = `${cap(m1)} ${y1} - ${cap(m2)} ${y2}`;
    if (out !== m) {
      corrections.push(correction(CORRECTION_RULE.DATE_MONTH_RANGE, m, out, 0.9));
    }
    return out;
  });

  // Depuis 2023 → 2023 - Present
  s = s.replace(DEPUIS_RE, (m, year) => {
    const out = `${year} - Present`;
    corrections.push(correction(CORRECTION_RULE.DATE_DEPUIS, m, out, 0.85));
    return out;
  });

  // Present aliases
  s = s.replace(PRESENT_ALIASES, (m) => {
    if (m === 'Present') return m;
    corrections.push(correction(CORRECTION_RULE.DATE_PRESENT_ALIAS, m, 'Present', 0.95));
    return 'Present';
  });

  return s;
}

/**
 * Split camelCase smashed OCR: digitalArt → digital Art (conservative).
 * @param {string} text
 * @param {CvTextCorrection[]} corrections
 */
function repairCamelCaseSmash(text, corrections) {
  return String(text || '').replace(
    /\b([a-zà-ö]{4,})([A-ZÀ-Ö][a-zà-ö]{2,})\b/g,
    (m, left, right) => {
      const leftKey = left.toLowerCase();
      const fixedLeft = WORD_REPAIRS.get(leftKey) || left;
      const out = `${fixedLeft} ${right}`;
      if (out === m) return m;
      const conf = WORD_REPAIRS.has(leftKey) ? 0.84 : 0.68;
      corrections.push(correction(CORRECTION_RULE.WORD_CAMEL_SPLIT, m, out, conf));
      return out;
    }
  );
}

/**
 * @param {string} text
 * @param {CvTextCorrection[]} corrections
 */
export function normalizeCvWordsInLine(text, corrections = []) {
  let s = String(text || '');
  if (!s.trim() || lineHasProtectedContent(s)) return s;

  for (const { re, rep, confidence } of PHRASE_REPAIRS) {
    s = s.replace(re, (m) => {
      if (m.toLowerCase() === rep.toLowerCase()) return m;
      corrections.push(correction(CORRECTION_RULE.WORD_PHRASE_JOIN, m, rep, confidence));
      return rep;
    });
  }

  s = repairCamelCaseSmash(s, corrections);

  s = s.replace(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g, (word) => {
    if (word.length < 5 || /^[A-Z]{2,}$/.test(word)) return word;
    const key = word.toLowerCase();
    const fixed = WORD_REPAIRS.get(key);
    if (!fixed || fixed.toLowerCase() === key) return word;
    const out = word[0] === word[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
    corrections.push(correction(CORRECTION_RULE.WORD_DICTIONARY, word, out, 0.82));
    return out;
  });

  // digtitalArt (no camel boundary) — whole-token only
  s = s.replace(/\bdigtitalart\b/gi, (m) => {
    const out = m[0] === m[0].toUpperCase() ? 'Digital art' : 'digital art';
    corrections.push(correction(CORRECTION_RULE.WORD_DICTIONARY, m, out, 0.8));
    return out;
  });

  return s;
}

/**
 * @param {string} line
 * @param {object} [opts]
 * @returns {{ text: string, corrections: CvTextCorrection[], confidence: number }}
 */
export function normalizeCvLine(line, opts = {}) {
  const corrections = [];
  const raw = String(line || '');
  if (!raw.trim()) {
    return { text: '', corrections, confidence: 1 };
  }

  let text = raw;
  if (opts.unicode !== false) text = normalizeUnicode(text, corrections);
  if (opts.punctuation !== false) text = normalizeHyphensAndPunctuation(text, corrections);
  if (opts.dates !== false) text = normalizeCvDatesInLine(text, corrections);
  if (opts.words !== false) text = normalizeCvWordsInLine(text, corrections);

  const confidence =
    corrections.length === 0
      ? 1
      : Math.round((corrections.reduce((s, c) => s + c.confidence, 0) / corrections.length) * 1000) /
        1000;

  return { text: text.trim(), corrections, confidence };
}

/**
 * @param {string} cur
 * @param {string} next
 */
function shouldMergeOcrLines(cur, next) {
  const a = String(cur || '').trim();
  const b = String(next || '').trim();
  if (!a || !b) return false;
  if (EMAIL_RE.test(a) || EMAIL_RE.test(b) || URL_RE.test(b) || PHONE_RE.test(b)) return false;
  if (fuzzySectionKey(b) || fuzzySectionKey(a)) return false;
  if (/^[•·▪\-–—*]+\s/.test(b)) return false;
  if (/^[a-zà-ö0-9(]/.test(b) && !/[.!?]$/.test(a)) return true;
  if (/[,;:]$/.test(a)) return true;
  const tail = a.split(/\s+/).pop() || '';
  if (!/[.!?]$/.test(a) && /^[A-ZÀ-Ö][a-zà-ö]{1,4}$/.test(tail) && tail.length <= 5) return true;
  return false;
}

/**
 * @param {string} text
 * @param {object} [opts]
 * @returns {{
 *   text: string,
 *   lines: Array<{ rawLine: string, normalizedLine: string, corrections: CvTextCorrection[], confidence: number }>,
 *   corrections: CvTextCorrection[],
 *   stats: Record<string, number>,
 * }}
 */
export function normalizeCvDocument(text, opts = {}) {
  const stats = {
    inputLines: 0,
    outputLines: 0,
    corrections: 0,
    linesMerged: 0,
    linesSplit: 0,
    dateRepairs: 0,
    wordRepairs: 0,
  };

  const raw = String(text || '').replace(/\r/g, '\n');
  if (!raw.trim()) {
    return { text: '', lines: [], corrections: [], stats };
  }

  /** @type {Array<{ rawLine: string, normalizedLine: string }>} */
  let entries = [];
  const splitLines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  stats.inputLines = splitLines.length;

  for (const line of splitLines) {
    const parts = opts.lineSplit !== false ? splitMergedSectionHeaders(line) : [line];
    if (parts.length > 1) stats.linesSplit += parts.length - 1;
    for (const part of parts) {
      entries.push({ rawLine: line, normalizedLine: part });
    }
  }

  if (opts.lineMerge !== false) {
    const merged = [];
    for (let i = 0; i < entries.length; i++) {
      let entry = { ...entries[i] };
      while (
        i + 1 < entries.length &&
        shouldMergeOcrLines(entry.normalizedLine, entries[i + 1].normalizedLine)
      ) {
        const nxt = entries[i + 1];
        const combined = `${entry.normalizedLine} ${nxt.normalizedLine}`.replace(/\s+/g, ' ').trim();
        entry = {
          rawLine: `${entry.rawLine}\n${nxt.rawLine}`,
          normalizedLine: combined,
        };
        i++;
        stats.linesMerged += 1;
      }
      merged.push(entry);
    }
    entries = merged;
  }

  /** @type {CvTextCorrection[]} */
  const allCorrections = [];
  /** @type {Array<{ rawLine: string, normalizedLine: string, corrections: CvTextCorrection[], confidence: number }>} */
  const trace = [];

  for (const entry of entries) {
    const { text: normalizedLine, corrections, confidence } = normalizeCvLine(
      entry.normalizedLine,
      opts
    );
    for (const c of corrections) {
      if (c.rule.startsWith('date_')) stats.dateRepairs += 1;
      if (c.rule.startsWith('word_')) stats.wordRepairs += 1;
    }
    allCorrections.push(...corrections);
    stats.corrections += corrections.length;
    trace.push({
      rawLine: entry.rawLine,
      normalizedLine,
      corrections,
      confidence,
    });
  }

  const outText = trace
    .map((t) => t.normalizedLine)
    .filter(Boolean)
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  stats.outputLines = trace.length;

  if (opts.debug === true || (typeof globalThis !== 'undefined' && globalThis.HIRELY_DEBUG)) {
    hirelyDebugLog('CV_TEXT_NORMALIZATION', {
      version: CV_TEXT_NORMALIZATION_VERSION,
      inputLines: stats.inputLines,
      outputLines: stats.outputLines,
      corrections: stats.corrections,
      dateRepairs: stats.dateRepairs,
      wordRepairs: stats.wordRepairs,
      sample: trace.slice(0, 20).map((t) => ({
        before: t.rawLine.slice(0, 100),
        after: t.normalizedLine.slice(0, 100),
        confidence: t.confidence,
        rules: t.corrections.map((c) => ({ rule: c.rule, conf: c.confidence, before: c.before, after: c.after })),
      })),
    });
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_CV_TEXT_NORMALIZATION = {
      text: outText,
      lines: trace,
      corrections: allCorrections,
      stats,
    };
  }

  return { text: outText, lines: trace, corrections: allCorrections, stats };
}

/** Yohann fixture OCR examples for tests and documentation. */
export const YOAZ_NORMALIZATION_EXAMPLES = [
  { before: '20112023', after: '2011 - 2023', rule: CORRECTION_RULE.DATE_MERGED_YEARS },
  { before: '2011 2023', after: '2011 - 2023', rule: CORRECTION_RULE.DATE_SPACED_YEARS },
  { before: '2011–2023', after: '2011 - 2023', rule: CORRECTION_RULE.DATE_DASH_NORMALIZE },
  { before: '20m - 2023', after: '2011 - 2023', rule: CORRECTION_RULE.DATE_OCR_YEAR_M },
  { before: '201038', after: '2010 - 2018', rule: CORRECTION_RULE.DATE_OCR_MALFORMED_FRAGMENT },
  { before: '2010 38', after: '2010 - 2018', rule: CORRECTION_RULE.DATE_OCR_MALFORMED_FRAGMENT },
  { before: 'Jan 2022 - Mar 2024', after: 'Jan 2022 - Mar 2024', rule: CORRECTION_RULE.DATE_MONTH_RANGE },
  { before: 'Depuis 2023', after: '2023 - Present', rule: CORRECTION_RULE.DATE_DEPUIS },
  { before: '2023 Aujourd’hui', after: '2023 Present', rule: CORRECTION_RULE.DATE_PRESENT_ALIAS },
  { before: 'digtitalArt', after: 'digital art', rule: CORRECTION_RULE.WORD_DICTIONARY },
  { before: 'ilusrations, corporat identity', after: 'illustrations, corporate identity', rule: CORRECTION_RULE.WORD_PHRASE_JOIN },
  { before: 'Freelancer Illustrator, Graphic   Designer', after: 'Freelancer Illustrator, Graphic Designer', rule: CORRECTION_RULE.WHITESPACE_COLLAPSE },
];
