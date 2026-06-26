/**
 * P0 — OCR micro-garbage cleanup before finalResumeData.
 * Partial words and polluted language/contact fragments → reviewQueue, not preview.
 */

import { normalizeLanguageDisplayLine } from '../parsing/strict-language-extraction.js';

export const OCR_MICRO_GARBAGE_CLEANUP_V1 = 'OCR_MICRO_GARBAGE_CLEANUP_V1';

export const MICRO_GARBAGE_CONFIDENCE_MIN = 72;

/** Standalone OCR junk tokens (never render). */
export const MICRO_GARBAGE_TOKEN_RE =
  /^(?:am|co|n|m|20|@|:|pej|nee|puf|ttt)$/i;

/** Trailing junk glued to otherwise valid text. */
export const TRAILING_OCR_FRAGMENT_RE =
  /\s+(?:am|co|n|m|20|@|:)\s*$/i;

/** Polluted proficiency lines (e.g. "Native am", "Fluent analyse"). */
export const POLLUTED_LANGUAGE_RE =
  /\b(native|fluent|bilingual|courant|bilingue|natif)\s+(?:am|co|analyse|analysis|analyz|n|m|20)\b/i;

const LANGUAGE_NAME_RE =
  /\b(french|english|spanish|german|italian|portuguese|dutch|mandarin|chinese|japanese|korean|arabic|russian|français|francais|anglais|espagnol|allemand|italien|portugais|néerlandais|nederlands)\b/i;

const LANGUAGE_PROFICIENCY_RE =
  /\b(native|fluent|bilingual|conversational|professional|intermediate|courant|bilingue|natif|maternelle|basic|advanced|beginner|working)\b/i;

const EXACT_SHORT_LANGUAGE_NAMES = new Set(
  [
    'french',
    'english',
    'german',
    'spanish',
    'italian',
    'dutch',
    'arabic',
    'russian',
    'korean',
    'chinese',
    'mandarin',
    'japanese',
    'portuguese',
    'français',
    'francais',
    'anglais',
    'espagnol',
    'allemand',
    'italien',
    'portugais',
    'néerlandais',
    'nederlands',
  ].map((x) => x.toLowerCase())
);

const CONTACT_FRAGMENT_RE =
  /(?:^|[\s·|])(?:am|co)\b(?=[\s·|]|$)|@[a-z]{0,2}\b|:\s*$/i;

/**
 * @param {string} text
 */
export function stripTrailingOcrFragments(text) {
  let s = String(text || '').trim();
  if (!s) return '';
  s = s.replace(TRAILING_OCR_FRAGMENT_RE, '');
  s = s.replace(/\s+@\s*$/g, '');
  s = s.replace(/\s+:\s*$/g, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

/**
 * @param {string} line
 */
export function isMicroGarbageOnlyLine(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  const low = s.toLowerCase();
  if (MICRO_GARBAGE_TOKEN_RE.test(low)) return true;
  if (s.length < 4 && !EXACT_SHORT_LANGUAGE_NAMES.has(low)) return true;
  if (/^[@:]{1,2}$/.test(s)) return true;
  if (/^[a-z]{1,2}$/i.test(s) && !EXACT_SHORT_LANGUAGE_NAMES.has(low)) return true;
  return false;
}

/**
 * @param {string} line
 */
export function isAcceptableLanguageLine(line) {
  const raw = String(line || '').trim();
  if (!raw || isMicroGarbageOnlyLine(raw)) return false;
  if (POLLUTED_LANGUAGE_RE.test(raw)) return false;
  const s = stripTrailingOcrFragments(raw);
  if (!s || isMicroGarbageOnlyLine(s)) return false;
  if (POLLUTED_LANGUAGE_RE.test(s)) return false;
  if (CONTACT_FRAGMENT_RE.test(s)) return false;
  if (s.length < 4 && !EXACT_SHORT_LANGUAGE_NAMES.has(s.toLowerCase())) return false;
  if (!LANGUAGE_NAME_RE.test(s)) return false;
  return true;
}

/**
 * @param {string} line
 */
export function sanitizeLanguageLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return { ok: false, display: '', source: raw, reason: 'empty' };
  if (POLLUTED_LANGUAGE_RE.test(raw)) {
    return { ok: false, display: '', source: raw, reason: 'polluted_language' };
  }
  const stripped = stripTrailingOcrFragments(raw);
  if (!isAcceptableLanguageLine(stripped)) {
    return {
      ok: false,
      display: '',
      source: raw,
      reason: POLLUTED_LANGUAGE_RE.test(raw)
        ? 'polluted_language'
        : isMicroGarbageOnlyLine(raw)
          ? 'micro_garbage'
          : 'invalid_language_pattern',
    };
  }
  const display = normalizeLanguageDisplayLine(stripped);
  if (!display || !isAcceptableLanguageLine(display)) {
    return { ok: false, display: '', source: raw, reason: 'normalize_failed' };
  }
  return { ok: true, display, source: raw, reason: 'ok' };
}

/**
 * @param {string} text
 */
export function stripMicroGarbageFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (isMicroGarbageOnlyLine(raw)) return '';
  const stripped = stripTrailingOcrFragments(raw);
  if (!stripped || isMicroGarbageOnlyLine(stripped)) return '';
  if (POLLUTED_LANGUAGE_RE.test(stripped)) return '';
  return stripped;
}

/**
 * @param {string} source
 * @param {string} field
 * @param {string} [section]
 * @param {string} [reason]
 */
export function buildMicroGarbageReviewItem(source, field, section = 'ocr', reason = '') {
  const src = String(source || '').trim();
  if (!src || src.length < 2) return null;
  return {
    id: `ocr-micro-${field}-${src.slice(0, 16).replace(/\W/g, '') || 'x'}`,
    field,
    section,
    sourceText: src,
    detected: src,
    status: 'pending',
    confidence: 45,
    category: 'ocr_cleanup',
    reason: reason || 'OCR micro-garbage — confirm before adding to CV',
  };
}

function sanitizeStringList(lines = [], field, reviewItems, stripped) {
  const out = [];
  const seen = new Set();
  for (const item of lines || []) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    const cleaned = stripMicroGarbageFromText(raw);
    if (!cleaned) {
      if (raw.length >= 2 && !isMicroGarbageOnlyLine(raw)) stripped.push(raw);
      const review = buildMicroGarbageReviewItem(raw, field, field, 'micro_garbage_fragment');
      if (review) reviewItems.push(review);
      continue;
    }
    if (cleaned !== raw) stripped.push(raw);
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function sanitizeLanguages(languages = [], reviewItems, stripped) {
  const out = [];
  const seen = new Set();
  for (const item of languages || []) {
    const result = sanitizeLanguageLine(item);
    if (!result.ok) {
      if (result.source) stripped.push(result.source);
      const review = buildMicroGarbageReviewItem(
        result.source,
        'languages',
        'languages',
        result.reason === 'polluted_language'
          ? 'Polluted language line (OCR fragment) — confirm language'
          : 'Language line below confidence — confirm language'
      );
      if (review) reviewItems.push(review);
      continue;
    }
    const key = result.display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result.display);
  }
  return out.slice(0, 6);
}

/**
 * @param {object} [resumeData]
 * @param {{ existingReviewItems?: object[] }} [opts]
 */
export function applyOcrMicroGarbageCleanup(resumeData = {}, opts = {}) {
  const rd = {
    ...resumeData,
    identity: { ...(resumeData.identity || {}) },
    unsorted: [...(resumeData.unsorted || [])],
  };
  const reviewItems = [...(opts.existingReviewItems || [])];
  const stripped = [];

  for (const field of ['name', 'title', 'email', 'phone', 'location']) {
    const raw = String(rd.identity[field] || '').trim();
    if (!raw) continue;
    const cleaned = stripMicroGarbageFromText(raw);
    if (!cleaned) {
      stripped.push(raw);
      rd.identity[field] = '';
      const review = buildMicroGarbageReviewItem(raw, `identity.${field}`, 'contact');
      if (review) reviewItems.push(review);
      continue;
    }
    if (cleaned !== raw) stripped.push(raw);
    rd.identity[field] = cleaned;
  }

  rd.languages = sanitizeLanguages(rd.languages, reviewItems, stripped);
  rd.skills = sanitizeStringList(rd.skills, 'skills', reviewItems, stripped);
  rd.tools = sanitizeStringList(rd.tools, 'tools', reviewItems, stripped);
  rd.clients = sanitizeStringList(rd.clients, 'clients', reviewItems, stripped);
  rd.projects = sanitizeStringList(rd.projects, 'projects', reviewItems, stripped);

  const cleanUnsorted = [];
  for (const item of rd.unsorted || []) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    if (isMicroGarbageOnlyLine(raw) || POLLUTED_LANGUAGE_RE.test(raw)) {
      stripped.push(raw);
      const review = buildMicroGarbageReviewItem(raw, 'unsorted', 'suggestions');
      if (review) reviewItems.push(review);
      continue;
    }
    const cleaned = stripMicroGarbageFromText(raw);
    if (!cleaned) {
      stripped.push(raw);
      const review = buildMicroGarbageReviewItem(raw, 'unsorted', 'suggestions');
      if (review) reviewItems.push(review);
      continue;
    }
    cleanUnsorted.push(cleaned);
  }
  rd.unsorted = cleanUnsorted;

  if (rd.summary) {
    const raw = String(rd.summary).trim();
    const cleaned = stripMicroGarbageFromText(raw);
    if (!cleaned && raw.length > 10) {
      stripped.push(raw);
      rd.summary = '';
    } else {
      rd.summary = cleaned || '';
    }
  }

  rd.meta = {
    ...(rd.meta || {}),
    ocrMicroGarbageCleanup: OCR_MICRO_GARBAGE_CLEANUP_V1,
    ocrMicroGarbageStripped: stripped.length,
  };

  return { resumeData: rd, reviewItems, stripped };
}
