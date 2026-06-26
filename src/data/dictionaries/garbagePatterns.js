/**
 * OCR / template noise patterns — used during clean + validation only.
 */

import { ALL_CREATIVE_ENTITIES, isProtectedCreativeLine } from './creative/index.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

/** Creative dictionary entities — never treat as garbage (re-export). */
export { ALL_CREATIVE_ENTITIES as CREATIVE_PROTECTED_TERMS, isProtectedCreativeLine } from './creative/index.js';

const CREATIVE_PROTECTED_RE = new RegExp(
  `\\b(${ALL_CREATIVE_ENTITIES.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|')})\\b`,
  'i'
);

/** Corrupted unicode / private-use / replacement runs */
export const CORRUPTED_UNICODE_RE =
  /[\uFFFD\uFFF0-\uFFFF]|[\uE000-\uF8FF]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export const IMPOSSIBLE_SYMBOL_RUN_RE =
  /[|¦‖§¶†‡•◦▪▫■□▢▣]{3,}|[@#$%^&*]{4,}|[^\x20-\x7E\u00C0-\u024F\s.,:;()\-/'&+@]{6,}/;

export const BROKEN_PUNCTUATION_RE = /[,;:]{2,}|[-–—]{4,}|\.{4,}|\(\s*\)|\[\s*\]/;

/** V27-style OCR junk fragments */
export const OCR_JUNK_FRAGMENT_RE = [
  /\bPUF\b.*\b(?:MARI|EE|om|Tom)\b/i,
  /\bps\s*yoaz\d*\b/i,
  /\byoaz\d+\w*\b/i,
  /\b27voaz\b/i,
  /\bohotmai\b/i,
  /\bhotmai\s+l\b/i,
  /@[æø]/i,
  /\b(?:NEE|See|Isnowboard|isnowboard)\b/i,
  /\bmulti\s+ectoral\s+year\b/i,
  /\b(?:asdf|qwerty|lorem ipsum)\b/i,
];

/** Placeholder tokens from broken templates */
export const PLACEHOLDER_TOKENS = [
  '[body]',
  '[header]',
  '[footer]',
  '[name]',
  '[email]',
  'xxx',
  'tbd',
  'n/a',
];

/** Regex fragments for obvious OCR junk */
export const OCR_SYMBOL_RE = /[|¦‖§¶†‡•◦▪▫■□▢▣▤▥▦▧▨▩◆◇◈◉○●]|@@@|###/;

export const BROKEN_WORD_RE = /(?:\b[A-Za-z]\s+){5,}[A-Za-z]\b/;

export const REPEATED_FRAGMENT_RE = /(.{4,})\1{1,}/i;

export const LOREM_RE = /lorem ipsum|asdf|qwerty|undefined|null\b/i;

/** Known OCR misreads that look like names */
export const OCR_NAME_GARBAGE_RE =
  /\b(ce\s+frei\s+re|frei\s+re|a>o\s+n['']?\$?ak6|ra\s+coe\s+pcl)\b/i;

export function isOcrNameGarbage(line) {
  const l = String(line || '');
  if (CREATIVE_PROTECTED_RE.test(l)) return false;
  return OCR_NAME_GARBAGE_RE.test(l);
}

export function stripCorruptedUnicode(text) {
  return String(text || '')
    .replace(CORRUPTED_UNICODE_RE, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ');
}

export function hasImpossibleSymbolRun(line) {
  const l = String(line || '');
  if (EMAIL_RE.test(l) || PHONE_RE.test(l) || isProtectedCreativeLine(l)) return false;
  return IMPOSSIBLE_SYMBOL_RUN_RE.test(l) || BROKEN_PUNCTUATION_RE.test(l);
}

export function isPlaceholderLine(line) {
  const l = String(line || '').trim().toLowerCase();
  return PLACEHOLDER_TOKENS.some((t) => l === t || l.includes(t));
}

/** Phone or email appearing on a line that also looks like education */
export function isMixedPhoneEducation(line) {
  const l = String(line || '');
  const hasContact = EMAIL_RE.test(l) || PHONE_RE.test(l);
  if (!hasContact) return false;
  return /\b(school|university|école|ecole|formation|bachelor|master|diploma|degree|mba|lisaa|créapole|creapole)\b/i.test(
    l
  );
}

export function isBrokenWordLine(line) {
  const tokens = String(line || '').split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return false;
  const oneLetter = tokens.filter((t) => /^[a-zA-Z]$/.test(t)).length;
  return oneLetter / tokens.length > 0.45;
}

export function isRandomOcrSymbolLine(line) {
  const l = String(line || '');
  if (EMAIL_RE.test(l) || PHONE_RE.test(l)) return false;
  const symbolHeavy = (l.match(OCR_SYMBOL_RE) || []).length;
  return symbolHeavy >= 2 || (symbolHeavy >= 1 && l.length < 24);
}

export function isRepeatedFragmentLine(line) {
  const l = String(line || '').trim().slice(0, GARBAGE_LINE_MAX);
  if (l.length < 12) return false;
  let compact = '';
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') compact += ch;
  }
  return REPEATED_FRAGMENT_RE.test(compact);
}

const GARBAGE_LINE_MAX = 360;

/** Combined garbage check for clean-stage line dropping */
export function isGarbageLine(line) {
  const sample = String(line || '').slice(0, GARBAGE_LINE_MAX);
  if (!sample || sample.length < 2) return true;
  line = sample;
  if (isProtectedCreativeLine(line)) return false;
  if (EMAIL_RE.test(line) || PHONE_RE.test(line)) return false;
  if (isPlaceholderLine(line)) return true;
  if (isMixedPhoneEducation(line)) return true;
  if (hasImpossibleSymbolRun(line)) return true;
  if (OCR_JUNK_FRAGMENT_RE.some((re) => re.test(line))) return true;
  if (isBrokenWordLine(line)) return true;
  if (isRandomOcrSymbolLine(line)) return true;
  if (isRepeatedFragmentLine(line)) return true;
  if (LOREM_RE.test(line)) return true;
  if (isOcrNameGarbage(line)) return true;
  if (CORRUPTED_UNICODE_RE.test(line) && !CREATIVE_PROTECTED_RE.test(line)) return true;
  if (/^[\W\d\s]+$/.test(line)) return true;
  return false;
}

/** Stricter check for structured JSON fields post-parse */
export function structuredTextHasGarbage(blob) {
  const s = String(blob || '');
  if (LOREM_RE.test(s)) return true;
  if (OCR_SYMBOL_RE.test(s) && /@@@|###/.test(s)) return true;
  if (PLACEHOLDER_TOKENS.some((t) => s.toLowerCase().includes(t))) return true;
  if (BROKEN_WORD_RE.test(s)) return true;
  return false;
}
