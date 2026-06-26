/**
 * OCR quality scoring — pick readable CV text over reversed/gibberish OCR.
 */

import { isGarbageLine } from '../../data/dictionaries/garbagePatterns.js';

export const OCR_QUALITY_MIN_PASS = 42;

/** Below this score — warn user but never block import (P0 OCR auto). */
export const OCR_CONFIDENCE_WARN_THRESHOLD = 60;

export const OCR_QUALITY_FAIL_MSG =
  'Le PDF est scanné ou mal orienté. Essayez DOCX/TXT ou collez le texte.';

const CV_WORDS = [
  'experience',
  'expérience',
  'education',
  'formation',
  'profile',
  'profil',
  'skills',
  'compétences',
  'competences',
  'contact',
  'work',
  'freelancer',
  'freelance',
  'designer',
  'illustrator',
  'graphic',
  'summary',
  'languages',
  'langues',
];

const LANGUAGE_WORDS = ['english', 'french', 'français', 'fluent', 'native', 'bilingual', 'courant'];

const TOOL_WORDS = [
  'photoshop',
  'illustrator',
  'indesign',
  'procreate',
  'figma',
  'after effects',
  'premiere',
];

const KNOWN_BAD_FRAGMENTS = ['ION3IIHIAXI', 'NOILY3NQ3', 'YOLVEISNTN', 'BUIPEOY', 'ILLUSTHATCH'];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const YEAR_RE = /\b(20(?:0\d|1\d|2[0-6])|19(?:9[89]))\b/g;
const WORD_RE = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g;

function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text) {
  return String(text || '')
    .split(/\s+/)
    .map((t) => t.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9@.+_-]+$/g, ''))
    .filter((t) => t.length >= 2);
}

function vowelRatio(word) {
  const letters = String(word || '').replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letters.length) return 0;
  const vowels = (letters.match(/[aeiouyAEIOUYàâéèêëïîôùûüœ]/g) || []).length;
  return vowels / letters.length;
}

function looksReversedOrGibberishWord(word) {
  const w = String(word || '').trim();
  if (w.length < 4) return false;
  const upper = w.toUpperCase();
  if (KNOWN_BAD_FRAGMENTS.some((b) => upper.includes(b))) return true;
  if (/^(19|20)\d{2}$/.test(w)) return false;
  if (/[0-9]/.test(w) && /[A-Z]{2,}/.test(w) && w.length >= 5) return true;
  if (/^[A-Z0-9]{6,}$/.test(w) && !/^(INDESIGN|PHOTOSHOP|ILLUSTRATOR|LIGHTROOM)$/i.test(w)) return true;
  const letters = w.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length >= 5 && vowelRatio(letters) < 0.12) return true;
  if (letters.length >= 6 && /^[A-ZÀ-Ÿ]+$/.test(letters) && vowelRatio(letters) < 0.22) return true;
  return false;
}

function isPlausibleWord(word) {
  const w = normalizeForMatch(word);
  if (!w || w.length < 2) return false;
  if (EMAIL_RE.test(word) || PHONE_RE.test(word)) return true;
  if (/^(19|20)\d{2}$/.test(w)) return true;
  if (CV_WORDS.includes(w) || LANGUAGE_WORDS.includes(w) || TOOL_WORDS.includes(w)) return true;
  if (looksReversedOrGibberishWord(word)) return false;
  if (w.length <= 2 && /^[a-z]{1,2}$/.test(w)) return true;
  if (vowelRatio(w) >= 0.22) return true;
  if (w.length >= 4 && /[bcdfghjklmnpqrstvwxyz]{1,}[aeiouy][bcdfghjklmnpqrstvwxyz]*/i.test(w)) return true;
  return w.length >= 3 && w.length <= 24;
}

function countKeywordHits(text, words) {
  const norm = normalizeForMatch(text);
  let hits = 0;
  for (const kw of words) {
    if (norm.includes(kw)) hits++;
  }
  return hits;
}

function extractTopWords(text, limit = 8) {
  const freq = new Map();
  for (const m of String(text || '').matchAll(WORD_RE)) {
    const w = m[0];
    if (w.length < 3) continue;
    const k = w.toLowerCase();
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([w]) => w);
}

/**
 * @param {{ text?: string, lines?: Array<{ text?: string }> }} input
 * @returns {{
 *   text: string,
 *   lines: string[],
 *   qualityScore: number,
 *   reasons: string[],
 *   topWords: string[],
 *   garbageRatio: number,
 *   reversedWordRatio: number,
 *   plausibleWordRatio: number,
 *   charCount: number,
 * }}
 */
export function scoreOcrQuality(input) {
  const text = String(input?.text || '').trim();
  const lines = (input?.lines?.length
    ? input.lines.map((l) => String(l.text || l.cleanedText || '').trim())
    : text.split('\n').map((l) => l.trim())
  ).filter(Boolean);

  const reasons = [];
  let score = 0;

  if (text.length < 20) {
    return {
      text,
      lines,
      qualityScore: 0,
      reasons: ['text too short'],
      topWords: [],
      garbageRatio: 1,
      reversedWordRatio: 1,
      plausibleWordRatio: 0,
      charCount: text.length,
    };
  }

  const cvHits = countKeywordHits(text, CV_WORDS);
  const langHits = countKeywordHits(text, LANGUAGE_WORDS);
  const toolHits = countKeywordHits(text, TOOL_WORDS);
  const yearHits = (text.match(YEAR_RE) || []).length;

  if (cvHits) {
    score += Math.min(28, cvHits * 5);
    reasons.push(`cv keywords (${cvHits})`);
  }
  if (yearHits) {
    score += Math.min(12, yearHits * 4);
    reasons.push(`valid years (${yearHits})`);
  }
  if (EMAIL_RE.test(text)) {
    score += 14;
    reasons.push('email found');
  }
  if (PHONE_RE.test(text)) {
    score += 10;
    reasons.push('phone found');
  }
  if (langHits) {
    score += Math.min(10, langHits * 4);
    reasons.push(`language words (${langHits})`);
  }
  if (toolHits) {
    score += Math.min(12, toolHits * 4);
    reasons.push(`tool words (${toolHits})`);
  }

  const tokens = tokenize(text);
  const plausible = tokens.filter(isPlausibleWord).length;
  const plausibleWordRatio = tokens.length ? plausible / tokens.length : 0;
  score += Math.round(plausibleWordRatio * 22);
  if (plausibleWordRatio >= 0.55) reasons.push('good word ratio');

  const garbageLines = lines.filter((l) => isGarbageLine(l) || l.length < 3).length;
  const garbageRatio = lines.length ? garbageLines / lines.length : 1;
  score -= Math.round(garbageRatio * 28);
  if (garbageRatio > 0.45) reasons.push(`high garbage lines (${Math.round(garbageRatio * 100)}%)`);

  const reversedWords = tokens.filter(looksReversedOrGibberishWord);
  const reversedWordRatio = tokens.length ? reversedWords.length / tokens.length : 0;
  score -= Math.round(reversedWordRatio * 35);
  if (reversedWords.length) reasons.push(`reversed/gibberish words (${reversedWords.length})`);

  const symbols = (text.match(/[^A-Za-zÀ-ÿ0-9\s.,:;()\-–—'@+&/]/g) || []).length;
  const symbolRatio = symbols / Math.max(text.length, 1);
  score -= Math.round(symbolRatio * 40);
  if (symbolRatio > 0.08) reasons.push('too many symbols');

  const digitConfused = tokens.filter((t) => /[0-9]/.test(t) && /[A-Za-z]{3,}/.test(t) && !/^(19|20)\d{2}$/.test(t)).length;
  if (digitConfused) {
    score -= Math.min(15, digitConfused * 3);
    reasons.push(`digit-confused words (${digitConfused})`);
  }

  const allLetters = (text.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const allVowels = (text.match(/[aeiouyAEIOUYàâéèêëïîôùûüœ]/gi) || []).length;
  const globalVowelRatio = allLetters ? allVowels / allLetters : 0;
  if (globalVowelRatio < 0.18) {
    score -= 12;
    reasons.push('low vowel ratio');
  }

  const emptyWordLines = lines.filter((l) => {
    const ws = tokenize(l);
    return ws.length > 0 && ws.filter(isPlausibleWord).length === 0;
  }).length;
  if (lines.length && emptyWordLines / lines.length > 0.5) {
    score -= 14;
    reasons.push('many lines without real words');
  }

  if (KNOWN_BAD_FRAGMENTS.some((b) => text.toUpperCase().includes(b))) {
    score -= 20;
    reasons.push('known corrupted OCR fragments');
  }

  const qualityScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    text,
    lines,
    qualityScore,
    reasons,
    topWords: extractTopWords(text),
    garbageRatio: Math.round(garbageRatio * 1000) / 1000,
    reversedWordRatio: Math.round(reversedWordRatio * 1000) / 1000,
    plausibleWordRatio: Math.round(plausibleWordRatio * 1000) / 1000,
    charCount: text.length,
  };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isOcrQualityAcceptable(text, lines) {
  return evaluateOcrParserGate(text, lines).pass;
}

/**
 * Detect reversed CV section headings (e.g. ECNEIREPXE for EXPERIENCE).
 * @param {string} text
 */
export function hasReversedCvHeadings(text) {
  const norm = normalizeForMatch(text);
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => normalizeForMatch(l.trim()))
    .filter((l) => l.length >= 5);
  for (const kw of CV_WORDS) {
    if (kw.length < 5) continue;
    const reversed = kw.split('').reverse().join('');
    if (norm.includes(reversed)) return true;
    if (lines.some((l) => l === reversed || l.startsWith(`${reversed} `))) return true;
  }
  return false;
}

/**
 * Hard gate before parser — blocks gibberish / reversed / anchor-less OCR.
 * @param {string} text
 * @param {Array<{ text?: string }>|string[]} [lines]
 * @returns {{
 *   pass: boolean,
 *   message: string,
 *   qualityScore: number,
 *   reasons: string[],
 *   hasCvAnchors: boolean,
 *   reversedHeadings: boolean,
 * }}
 */
export function evaluateOcrParserGate(text, lines) {
  const scored = scoreOcrQuality({ text, lines });
  const reasons = [...scored.reasons];
  const reversedHeadings = hasReversedCvHeadings(text);
  const hasEmail = EMAIL_RE.test(text);
  const hasPhone = PHONE_RE.test(text);
  const yearHits = (String(text || '').match(YEAR_RE) || []).length;
  const cvHits = countKeywordHits(text, CV_WORDS);
  const hasCvAnchors = cvHits > 0 || hasEmail || hasPhone || yearHits > 0;

  let pass = scored.qualityScore >= OCR_QUALITY_MIN_PASS;

  if (reversedHeadings) {
    pass = false;
    reasons.push('reversed CV headings');
  }
  if (!hasCvAnchors) {
    pass = false;
    reasons.push('no CV anchors (keywords, email, phone, year)');
  }
  if (scored.plausibleWordRatio < 0.38 && scored.reversedWordRatio > 0.22) {
    pass = false;
    reasons.push('low readable word ratio with gibberish');
  }
  if (scored.reversedWordRatio > 0.42) {
    pass = false;
    reasons.push('too many reversed/gibberish words');
  }
  if (scored.garbageRatio > 0.55) {
    pass = false;
    reasons.push('too many garbage lines');
  }

  return {
    pass,
    message: OCR_QUALITY_FAIL_MSG,
    qualityScore: scored.qualityScore,
    reasons,
    hasCvAnchors,
    reversedHeadings,
    plausibleWordRatio: scored.plausibleWordRatio,
    reversedWordRatio: scored.reversedWordRatio,
    garbageRatio: scored.garbageRatio,
  };
}
