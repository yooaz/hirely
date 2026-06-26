/** Shared word-boundary matching for dictionary terms — pure, no parser imports. */

export const DICTIONARY_TERM_MIN_LEN = 2;
export const DICTIONARY_TERM_MAX_LEN = 80;
export const DICTIONARY_REGEX_MAX_ALT = 120;

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

/**
 * @param {unknown} term
 * @returns {string|null}
 */
export function sanitizeDictionaryTerm(term) {
  const t = String(term ?? '').trim();
  if (!t || t.length < DICTIONARY_TERM_MIN_LEN || t.length > DICTIONARY_TERM_MAX_LEN) {
    return null;
  }
  return t;
}

/**
 * @param {unknown} s
 * @returns {string}
 */
export function escapeRegex(s) {
  return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {unknown} term
 * @param {string} [flags]
 * @returns {RegExp|null}
 */
export function safeRegex(term, flags = 'i') {
  const t = sanitizeDictionaryTerm(term);
  if (!t) return null;
  try {
    return new RegExp(`\\b${escapeRegex(t)}\\b`, flags);
  } catch {
    return null;
  }
}

/** @deprecated Prefer safeRegex / termMatchesHay — kept for callers that need a RegExp. */
export function termRegex(term) {
  return safeRegex(term) || /$^/;
}

/**
 * @param {string} hay
 * @param {number} start
 * @param {number} len
 */
function hasWordBoundary(hay, start, len) {
  const before = start > 0 ? hay[start - 1] : ' ';
  const after = start + len < hay.length ? hay[start + len] : ' ';
  return !WORD_CHAR_RE.test(before) && !WORD_CHAR_RE.test(after);
}

/**
 * Pure dictionary match — index scan, no RegExp engine recursion risk.
 * @param {unknown} text
 * @param {unknown} term
 */
export function termMatchesHay(text, term) {
  const t = sanitizeDictionaryTerm(term);
  if (!t) return false;
  const hay = String(text || '');
  if (!hay) return false;

  const h = hay.toLowerCase();
  const needle = t.toLowerCase();
  if (needle.length > h.length) return false;

  let pos = 0;
  while (pos <= h.length - needle.length) {
    const idx = h.indexOf(needle, pos);
    if (idx === -1) return false;
    if (hasWordBoundary(h, idx, needle.length)) return true;
    pos = idx + 1;
  }
  return false;
}

/**
 * @param {unknown} text
 * @param {unknown} terms
 * @returns {string[]}
 */
export function textContainsAny(text, terms) {
  const hay = String(text || '');
  return (terms || [])
    .map((t) => sanitizeDictionaryTerm(t))
    .filter(Boolean)
    .filter((t) => termMatchesHay(hay, t));
}

/**
 * @param {unknown} line
 * @param {unknown} terms
 */
export function lineContainsAny(line, terms) {
  return textContainsAny(line, terms).length > 0;
}

/**
 * Longest dictionary term in text (pure).
 * @param {unknown} text
 * @param {unknown} terms
 * @returns {string|null}
 */
export function findLongestMatchingTerm(text, terms) {
  const hay = String(text || '');
  if (!hay) return null;
  let best = null;
  for (const raw of terms || []) {
    const term = sanitizeDictionaryTerm(raw);
    if (!term || !termMatchesHay(hay, term)) continue;
    if (!best || term.length > best.length) best = term;
  }
  return best;
}

/**
 * @param {unknown} terms
 * @param {string} [flags]
 * @param {number} [maxAlt]
 */
export function buildAlternationRe(terms, flags = 'i', maxAlt = DICTIONARY_REGEX_MAX_ALT) {
  const parts = (terms || [])
    .map((t) => sanitizeDictionaryTerm(t))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .slice(0, maxAlt)
    .map(escapeRegex);
  if (!parts.length) return /$^/;
  try {
    return new RegExp(`\\b(?:${parts.join('|')})\\b`, flags);
  } catch {
    return /$^/;
  }
}
