/**
 * P0 — Strict language extraction: language name required, optional proficiency level.
 * Polluted OCR fragments → reviewQueue, never preview.
 */

import {
  isMicroGarbageOnlyLine,
  POLLUTED_LANGUAGE_RE,
  stripTrailingOcrFragments,
  buildMicroGarbageReviewItem,
} from '../validation/ocr-micro-garbage-cleanup.js';

export const STRICT_LANGUAGE_EXTRACTION_V1 = 'STRICT_LANGUAGE_EXTRACTION_V1';

/**
 * @param {string} line
 * @returns {string}
 */
export function normalizeLanguageDisplayLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return '';
  const dash = raw.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (dash.length >= 2) {
    const lang = dash[0].toLowerCase();
    const prof = dash[1].toLowerCase();
    if (/^(english|anglais)$/i.test(lang)) return `English — ${/native/i.test(prof) ? 'native' : 'fluent'}`;
    if (/^(french|français|francais)$/i.test(lang)) return `French — ${/native/i.test(prof) ? 'native' : 'fluent'}`;
    return `${dash[0]} — ${dash[1]}`;
  }
  const low = raw.toLowerCase();
  if (/^(english|anglais)$/i.test(low) || /\benglish\b/i.test(low)) return 'English — fluent';
  if (/^(french|français|francais)$/i.test(low) || /\bfrench\b/i.test(low)) return 'French — native';
  if (/\b(english|anglais)\b/i.test(low) && /\b(fluent|native|bilingual)\b/i.test(low)) {
    return `English — ${/\bnative\b/i.test(low) ? 'native' : 'fluent'}`;
  }
  if (/\b(french|français|francais)\b/i.test(low) && /\b(native|fluent|bilingual|natif|courant)\b/i.test(low)) {
    return `French — ${/\bnative|natif\b/i.test(low) ? 'native' : 'fluent'}`;
  }
  if (/\b(spanish|espagnol)\b/i.test(low)) {
    const level = /\bintermediate\b/i.test(low) ? 'intermediate' : /\bnative\b/i.test(low) ? 'native' : 'fluent';
    return `Spanish — ${level}`;
  }
  return raw;
}

export const STRICT_LANGUAGE_NAME_RE =
  /\b(french|english|spanish|german|italian|portuguese|dutch|mandarin|chinese|japanese|korean|arabic|russian|français|francais|anglais|espagnol|allemand|italien|portugais|néerlandais|nederlands)\b/i;

const VALID_PROFICIENCY_TOKENS = new Set(
  [
    'native',
    'fluent',
    'bilingual',
    'conversational',
    'professional',
    'intermediate',
    'courant',
    'bilingue',
    'natif',
    'maternelle',
    'basic',
    'advanced',
    'beginner',
    'working',
    'notions',
    'débutant',
    'intermédiaire',
    'vloeiend',
    'professionnel',
  ].map((x) => x.toLowerCase())
);

/** Proficiency glued to OCR junk (Native am, Fluent analyse, native co). */
export const FORBIDDEN_LANGUAGE_OCR_RE =
  /\b(native|fluent|bilingual|courant|bilingue|natif)\s+(am|co|analyse|analysis|analyz|n|m|20)\b/i;

/**
 * @param {string} line
 */
export function isForbiddenLanguageLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return true;
  if (isMicroGarbageOnlyLine(raw)) return true;
  if (POLLUTED_LANGUAGE_RE.test(raw)) return true;
  if (FORBIDDEN_LANGUAGE_OCR_RE.test(raw)) return true;
  if (/\bnative\s+co\b/i.test(raw)) return true;
  if (/\bfluent\s+analys/i.test(raw)) return true;
  return false;
}

/**
 * @param {string} token
 */
function isValidProficiencyToken(token) {
  const low = String(token || '').toLowerCase().trim();
  if (!low) return true;
  return VALID_PROFICIENCY_TOKENS.has(low);
}

/**
 * @param {string} line
 */
export function isStrictLanguageEntry(line) {
  const raw = String(line || '').trim();
  if (!raw || isForbiddenLanguageLine(raw)) return false;

  const s = stripTrailingOcrFragments(raw);
  if (!s || isForbiddenLanguageLine(s)) return false;
  if (!STRICT_LANGUAGE_NAME_RE.test(s)) return false;

  const dashed = s.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (dashed.length >= 2 && !isValidProficiencyToken(dashed[1])) return false;

  const spaced = s.match(
    /\b(french|english|spanish|german|italian|portuguese|dutch|mandarin|chinese|japanese|korean|arabic|russian|français|francais|anglais|espagnol|allemand|italien|portugais|néerlandais|nederlands)\s+([a-zà-ÿ]+)/i
  );
  if (spaced && !isValidProficiencyToken(spaced[2])) return false;

  return true;
}

/**
 * @param {string} line
 */
export function extractStrictLanguageLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return { ok: false, display: '', source: raw, reason: 'empty' };
  if (isForbiddenLanguageLine(raw)) {
    return { ok: false, display: '', source: raw, reason: 'forbidden_ocr_fragment' };
  }
  if (!STRICT_LANGUAGE_NAME_RE.test(raw)) {
    return { ok: false, display: '', source: raw, reason: 'missing_language_name' };
  }

  const stripped = stripTrailingOcrFragments(raw);
  if (!isStrictLanguageEntry(stripped)) {
    return {
      ok: false,
      display: '',
      source: raw,
      reason: isForbiddenLanguageLine(stripped) ? 'forbidden_ocr_fragment' : 'invalid_language_pattern',
    };
  }

  const display = normalizeLanguageDisplayLine(stripped);
  if (!display || !STRICT_LANGUAGE_NAME_RE.test(display) || !isStrictLanguageEntry(display)) {
    return { ok: false, display: '', source: raw, reason: 'normalize_failed' };
  }

  return { ok: true, display, source: raw, reason: 'ok' };
}

/**
 * @param {string} source
 * @param {string} [reason]
 */
export function buildStrictLanguageReviewItem(source, reason = '') {
  const src = String(source || '').trim();
  if (!src || src.length < 2) return null;
  return buildMicroGarbageReviewItem(
    src,
    'languages',
    'languages',
    reason === 'forbidden_ocr_fragment' || reason === 'polluted_language'
      ? 'Polluted language line (OCR fragment) — confirm language'
      : 'Language line below confidence — confirm language'
  );
}

/**
 * @param {string[]} [languages]
 * @param {{ existingReviewItems?: object[] }} [opts]
 */
export function applyStrictLanguageExtraction(languages = [], opts = {}) {
  const reviewItems = [...(opts.existingReviewItems || [])];
  const rejected = [];
  const out = [];
  const seen = new Set();

  for (const item of languages || []) {
    const result = extractStrictLanguageLine(item);
    if (!result.ok) {
      if (result.source) rejected.push(result.source);
      const review = buildStrictLanguageReviewItem(result.source, result.reason);
      if (review) reviewItems.push(review);
      continue;
    }
    const key = result.display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result.display);
  }

  return { languages: out.slice(0, 6), reviewItems, rejected };
}
