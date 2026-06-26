/**
 * Universal OCR normalization — runs BEFORE clean / classify / structure.
 *
 * Pipeline: RAW OCR → normalize → (downstream clean → classify → structure)
 *
 * Preserves rawLine + normalizedLine per line. Dictionary-driven repairs only.
 */

import { stripCorruptedUnicode, hasImpossibleSymbolRun } from '../../data/dictionaries/garbagePatterns.js';
import { isProtectedCreativeLine } from '../../data/dictionaries/creative/index.js';
import {
  ENTITY_REGISTRY,
  TOOL_TERMS,
  ROLE_TERMS,
  DEGREE_TERMS,
  LANGUAGE_TERMS,
} from '../../data/dictionaries/entity-catalog.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { hardenOcrText } from './ocr-hardening.js';
import { isOcrNoiseLine, repairOcrTyposInLine } from './ocr-cleanup.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { normalizeCvDocument } from './cv-text-normalization.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EMAIL_MASK_TOKEN = '__HIRELY_EMAIL_MASK__';

/**
 * Mask emails so OCR dictionary fuzzy-match never rewrites local-parts (e.g. jordan → korean).
 * @param {string} line
 */
function maskEmailsInLine(line) {
  const emails = [];
  const masked = String(line || '').replace(EMAIL_RE, (m) => {
    const idx = emails.length;
    emails.push(m);
    return `${EMAIL_MASK_TOKEN}${idx}${EMAIL_MASK_TOKEN}`;
  });
  return { masked, emails };
}

function unmaskEmailsInLine(line, emails) {
  if (!emails.length) return String(line || '');
  return String(line || '').replace(
    new RegExp(`${EMAIL_MASK_TOKEN}(\\d+)${EMAIL_MASK_TOKEN}`, 'g'),
    (_, i) => emails[Number(i)] || ''
  );
}
const URL_RE = /https?:\/\/|www\./i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

const BROKEN_WORD_PATTERNS = [
  /\b([A-ZÀ-Ö])\s+([a-zà-ö]{3,})\b/g,
  /\b([A-Za-zÀ-ÿ]{2,4})\s+([a-zà-ö]{6,12})\b/g,
  /\b([A-Za-zÀ-ÿ]{2,5})\s+([a-zà-ö]{2,6})\b/g,
];

const WORD_TOKEN_RE = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'’-]*/g;

const CHAR_CONFUSION_REPAIRS = [
  [/\blll([a-z])/gi, 'Ill$1'],
  [/\b([A-Za-z])0([a-z]{2,})\b/g, '$1o$2'],
  [/(?<=[A-Za-z])1(?=[a-z])/g, 'l'],
  [/\b([A-Za-z])1\b/g, '$1l'],
  [/\bRN([a-z])/g, 'M$1'],
  [/\bVV([a-z])/g, 'W$1'],
  [/ﬁ/g, 'fi'],
  [/ﬂ/g, 'fl'],
  [/\bgraphi[qc]ue?\b/gi, 'graphique'],
  [/\billustrat[io]+r\b/gi, 'Illustrator'],
  [/\bdesign[eu]r\b/gi, 'Designer'],
  [/\bdevelop+p?eur\b/gi, 'développeur'],
];

const REPEATED_PUNCT_RE = /([!?.,;:])\1{3,}/g;
const ISOLATED_FRAGMENT_RE = /^[\W\d\s]{1,8}$/;
const REVERSED_NOISE_RE = /^[^A-Za-zÀ-ÿ]*[a-zà-ö]{4,}[^A-Za-zÀ-ÿ]*$/;

/** @type {Set<string>} */
let dictionaryLexicon = null;

function buildDictionaryLexicon() {
  if (dictionaryLexicon) return dictionaryLexicon;
  const terms = new Set();
  for (const t of [...TOOL_TERMS, ...ROLE_TERMS, ...DEGREE_TERMS, ...LANGUAGE_TERMS]) {
    const k = String(t || '').trim().toLowerCase();
    if (k.length >= 3) terms.add(k);
    for (const part of k.split(/[\s/·,&-]+/)) {
      if (part.length >= 4) terms.add(part);
    }
  }
  dictionaryLexicon = terms;
  return terms;
}

/**
 * @param {string} a
 * @param {string} b
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * @param {string} word
 */
function nearestDictionaryWord(word) {
  const lex = buildDictionaryLexicon();
  const w = String(word || '').toLowerCase();
  if (!w || w.length < 4) return null;
  if (lex.has(w)) return word;
  let best = null;
  let bestDist = 3;
  for (const term of lex) {
    if (Math.abs(term.length - w.length) > 2) continue;
    const d = levenshtein(w, term);
    if (d < bestDist) {
      bestDist = d;
      best = term;
      if (d === 0) break;
    }
  }
  if (!best || bestDist > 2) return null;
  return best[0].toUpperCase() + best.slice(1);
}

/**
 * @param {string} line
 */
function tryJoinBrokenWord(left, right) {
  const combined = `${left}${right}`;
  const lower = combined.toLowerCase();
  const lex = buildDictionaryLexicon();
  if (left.length >= 5 && lex.has(String(left).toLowerCase())) return null;
  if (lex.has(lower)) {
    return combined[0] === combined[0].toUpperCase()
      ? combined[0].toUpperCase() + combined.slice(1)
      : combined;
  }
  const fuzzy = nearestDictionaryWord(combined);
  if (fuzzy && levenshtein(lower, fuzzy.toLowerCase()) <= 1) return fuzzy;
  if (right.length <= 4 && combined.length >= 6 && /^[A-Za-zÀ-ÿ]+$/.test(combined)) {
    return combined;
  }
  return null;
}

/**
 * @param {string} line
 */
export function fixBrokenWordsInLine(line) {
  const { masked, emails } = maskEmailsInLine(line);
  let s = masked;
  if (!s.trim()) return String(line || '');

  for (let pass = 0; pass < 8; pass++) {
    /** @type {{ start: number, end: number, joined: string }[]} */
    const candidates = [];
    for (const re of BROKEN_WORD_PATTERNS) {
      re.lastIndex = 0;
      for (const m of s.matchAll(re)) {
        const joined = tryJoinBrokenWord(m[1], m[2]);
        if (!joined || m.index == null) continue;
        candidates.push({ start: m.index, end: m.index + m[0].length, joined });
      }
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => a.start - b.start || a.end - b.end - (a.end - a.start));
    const pick = candidates[0];
    s = `${s.slice(0, pick.start)}${pick.joined}${s.slice(pick.end)}`;
  }

  return unmaskEmailsInLine(s.replace(/\s{2,}/g, ' ').trim(), emails);
}

/**
 * @param {string} line
 */
export function repairCommonOcrMistakes(line) {
  const { masked, emails } = maskEmailsInLine(line);
  let s = masked;
  for (const [re, rep] of CHAR_CONFUSION_REPAIRS) {
    s = s.replace(re, rep);
  }
  s = s.replace(WORD_TOKEN_RE, (word) => {
    if (word.length < 6 || EMAIL_RE.test(word)) return word;
    if (/^[A-Z]{2,}$/.test(word)) return word;
    const lower = word.toLowerCase();
    const lex = buildDictionaryLexicon();
    if (lex.has(lower)) return word;
    const fixed = nearestDictionaryWord(word);
    const maxDist = word.length >= 9 ? 2 : word.length >= 5 ? 2 : 1;
    if (fixed && levenshtein(lower, fixed.toLowerCase()) <= maxDist) return fixed;
    return word;
  });
  return unmaskEmailsInLine(s.replace(/\s{2,}/g, ' ').trim(), emails);
}

/**
 * @param {string} line
 */
export function isReversedOcrNoiseLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 10 || EMAIL_RE.test(l) || URL_RE.test(l)) return false;
  if (isProtectedCreativeLine(l) || fuzzySectionKey(l)) return false;
  const forward = countDictionaryHits(l);
  const reversed = countDictionaryHits(l.split(/\s+/).reverse().join(' '));
  return reversed > forward + 1 && forward === 0;
}

/**
 * @param {string} text
 */
function countDictionaryHits(text) {
  const hits = ENTITY_REGISTRY.recognizeAll(text) || [];
  return new Set(hits.map((h) => String(h.canonical || h.matched || '').toLowerCase())).size;
}

/**
 * @param {string} line
 */
export function isOcrGarbageFragment(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (isProtectedCreativeLine(l) || fuzzySectionKey(l)) return false;
  if (EMAIL_RE.test(l) || URL_RE.test(l) || PHONE_RE.test(l)) return false;
  if (ISOLATED_FRAGMENT_RE.test(l)) return true;
  if (REPEATED_PUNCT_RE.test(l) && l.length < 40) return true;
  if (hasImpossibleSymbolRun(l) && l.replace(/\s/g, '').length < 12) return true;
  if (isReversedOcrNoiseLine(l)) return true;
  if (REVERSED_NOISE_RE.test(l) && !/\b(19|20)\d{2}\b/.test(l)) return true;
  return isOcrNoiseLine(l);
}

function lineLooksLikePersonName(line) {
  const l = String(line || '').trim();
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4 || l.length > 48) return false;
  if (/\d/.test(l) || EMAIL_RE.test(l) || PHONE_RE.test(l)) return false;
  if (/\b(designer|developer|manager|engineer|director|illustrator|consultant)\b/i.test(l)) {
    return false;
  }
  return words.every((w) => /^[A-ZÀ-Ö][A-Za-zÀ-ÿ'’-]{1,}$/.test(w));
}

/**
 * @param {string} cur
 * @param {string} next
 */
function shouldMergeSplitLine(cur, next) {
  const a = String(cur || '').trim();
  const b = String(next || '').trim();
  if (!a || !b) return false;
  if (EMAIL_RE.test(a) || EMAIL_RE.test(b) || URL_RE.test(b) || PHONE_RE.test(b)) return false;
  if (fuzzySectionKey(b) || fuzzySectionKey(a)) return false;
  if (lineLooksLikePersonName(a)) return false;
  const professionRe =
    /\b(designer|developer|manager|engineer|director|illustrator|graphiste|graphique|consultant|analyst)\b/i;
  const aWords = a.split(/\s+/).filter(Boolean);
  if (
    professionRe.test(b) &&
    aWords.length === 2 &&
    a.length < 32 &&
    !professionRe.test(a) &&
    aWords.every((w) => /^[A-ZÀ-Ö]/.test(w))
  ) {
    return false;
  }
  if (/^[•·▪\-–—*]+\s/.test(b)) return false;
  const nextStartsLower = /^[a-zà-ö0-9(]/.test(b);
  const curEndsOpen = !/[.!?]$/.test(a);
  const curEndsComma = /[,;:]$/.test(a);
  if (curEndsComma) return true;
  if (curEndsOpen && nextStartsLower && b.length < 140) return true;
  const tail = a.split(/\s+/).pop() || '';
  if (curEndsOpen && /^[A-ZÀ-Ö][a-zà-ö]{1,4}$/.test(tail) && tail.length <= 5) return true;
  return false;
}

/**
 * @param {Array<{ rawLine: string, normalizedLine?: string }>} entries
 */
export function mergeSplitOcrLines(entries) {
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    let raw = entries[i].rawLine;
    let norm = entries[i].normalizedLine ?? raw;
    while (i + 1 < entries.length && shouldMergeSplitLine(norm, entries[i + 1].rawLine)) {
      const nxt = entries[i + 1];
      raw = `${raw}\n${nxt.rawLine}`;
      norm = `${norm} ${nxt.normalizedLine ?? nxt.rawLine}`.replace(/\s+/g, ' ').trim();
      i++;
    }
    out.push({ rawLine: raw, normalizedLine: norm, merged: raw.includes('\n') });
  }
  return out;
}

/**
 * @param {string} text
 */
function stripControlChars(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
}

/**
 * @param {string} rawText
 * @param {object} [opts]
 * @returns {{
 *   text: string,
 *   lines: Array<{ rawLine: string, normalizedLine: string, accepted: boolean, reason?: string }>,
 *   stats: Record<string, number>,
 *   dictionaryScore: number,
 * }}
 */
export function normalizeOcrDocument(rawText, opts = {}) {
  const stats = {
    inputChars: 0,
    outputChars: 0,
    inputLines: 0,
    outputLines: 0,
    brokenWordsFixed: 0,
    charRepairs: 0,
    linesMerged: 0,
    garbageDropped: 0,
    hardenHyphenJoins: 0,
    hardenSpacedCollapsed: 0,
  };

  const raw = stripControlChars(rawText);
  stats.inputChars = raw.length;
  if (!raw.trim()) {
    return { text: '', lines: [], stats, dictionaryScore: 1 };
  }

  const hardened = hardenOcrText(raw, opts);
  stats.hardenHyphenJoins = hardened.stats?.hyphenJoins ?? 0;
  stats.hardenSpacedCollapsed = hardened.stats?.spacedCollapsed ?? 0;

  const cvNormalized = normalizeCvDocument(hardened.text, {
    ...opts,
    debug: opts.debug ?? undefined,
  });
  stats.cvTextCorrections = cvNormalized.stats?.corrections ?? 0;
  stats.cvDateRepairs = cvNormalized.stats?.dateRepairs ?? 0;
  stats.cvWordRepairs = cvNormalized.stats?.wordRepairs ?? 0;
  stats.cvLinesMerged = cvNormalized.stats?.linesMerged ?? 0;
  stats.cvLinesSplit = cvNormalized.stats?.linesSplit ?? 0;

  const rawLines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const hardenedLines = cvNormalized.text.split('\n').map((l) => l.trim()).filter(Boolean);
  stats.inputLines = Math.max(rawLines.length, hardenedLines.length);

  let entries = cvNormalized.lines?.length
    ? cvNormalized.lines.map((l) => ({
        rawLine: l.rawLine,
        normalizedLine: l.normalizedLine,
      }))
    : hardenedLines.map((line, i) => ({
        rawLine: rawLines[i] ?? line,
        normalizedLine: line,
      }));

  const beforeMerge = entries.length;
  entries = mergeSplitOcrLines(entries);
  stats.linesMerged = Math.max(0, beforeMerge - entries.length);

  /** @type {Array<{ rawLine: string, normalizedLine: string, accepted: boolean, reason?: string }>} */
  const trace = [];

  for (const entry of entries) {
    const before = entry.normalizedLine;
    let norm = fixBrokenWordsInLine(before);
    if (norm !== before) stats.brokenWordsFixed += 1;

    const beforeChar = norm;
    norm = repairCommonOcrMistakes(norm);
    if (norm !== beforeChar) stats.charRepairs += 1;

    norm = repairOcrTyposInLine(norm);
    norm = norm.replace(REPEATED_PUNCT_RE, '$1$1').replace(/\s{2,}/g, ' ').trim();

    if (!norm) {
      trace.push({
        rawLine: entry.rawLine,
        normalizedLine: '',
        accepted: false,
        reason: 'empty_after_repair',
      });
      stats.garbageDropped += 1;
      continue;
    }

    if (isOcrGarbageFragment(norm)) {
      trace.push({
        rawLine: entry.rawLine,
        normalizedLine: norm,
        accepted: false,
        reason: 'ocr_garbage',
      });
      stats.garbageDropped += 1;
      continue;
    }

    trace.push({
      rawLine: entry.rawLine,
      normalizedLine: norm,
      accepted: true,
    });
  }

  const text = trace
    .filter((t) => t.accepted)
    .map((t) => t.normalizedLine)
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  stats.outputChars = text.length;
  stats.outputLines = trace.filter((t) => t.accepted).length;

  const dictionaryScore = measureLineDictionaryCoverage(text);

  hirelyDebugLog('OCR_NORMALIZATION_TRACE', {
    lineCount: trace.length,
    accepted: stats.outputLines,
    dropped: stats.garbageDropped,
    dictionaryScore,
    sample: trace.slice(0, 24).map((t) => ({
      raw: t.rawLine.slice(0, 80),
      norm: t.normalizedLine.slice(0, 80),
      accepted: t.accepted,
      reason: t.reason,
    })),
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_OCR_NORMALIZATION = { text, lines: trace, stats, dictionaryScore };
  }

  return { text, lines: trace, stats, dictionaryScore };
}

/**
 * Share of normalized lines that hit at least one dictionary entity (or are short metadata).
 * @param {string} text
 */
export function measureLineDictionaryCoverage(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return 1;
  let ok = 0;
  for (const line of lines) {
    if (countDictionaryHits(line) >= 1 || line.length <= 18 || EMAIL_RE.test(line)) ok += 1;
  }
  return Math.round((ok / lines.length) * 1000) / 1000;
}

/**
 * Corpus-driven repair score — primary acceptance metric (target ≥ 0.95).
 * @param {Array<{ corrupted: string, expect?: string, expectGarbage?: boolean }>} [cases]
 */
export function evaluateOcrNormalizationCorpus(cases = OCR_NORMALIZATION_CORPUS) {
  let hits = 0;
  for (const c of cases) {
    const out = normalizeOcrDocument(c.corrupted).text;
    if (c.expectGarbage) {
      if (!out || !/[@|]{2,}|NE\s+TTT/i.test(out)) hits += 1;
      continue;
    }
    const expect = String(c.expect || '').toLowerCase();
    if (!expect) {
      if (!out || out.length < 4) hits += 1;
      continue;
    }
    if (out.toLowerCase().includes(expect)) hits += 1;
  }
  const total = cases.length || 1;
  return { hits, total, score: Math.round((hits / total) * 1000) / 1000 };
}

/** @deprecated alias */
export function scoreNormalizedDictionary() {
  return evaluateOcrNormalizationCorpus().score;
}

/** Generic OCR repair corpus — dictionary terms only, no CV-specific literals. */
export const OCR_NORMALIZATION_CORPUS = [
  { corrupted: 'Ill ustrator', expect: 'Illustrator' },
  { corrupted: 'Gra phic Designer', expect: 'Graphic Designer' },
  { corrupted: 'Des igner', expect: 'Designer' },
  { corrupted: 'lllustrator', expect: 'Illustrator' },
  { corrupted: 'Deslgner', expect: 'Designer' },
  { corrupted: 'Phot0shop', expect: 'Photoshop' },
  { corrupted: 'Illustartor', expect: 'Illustrator' },
  { corrupted: 'Grafic Designer', expect: 'Graphic Designer' },
  { corrupted: 'M otion Designer', expect: 'Motion Designer' },
  { corrupted: 'Art Dire ctor', expect: 'Art Director' },
  { corrupted: 'Cre ative Director', expect: 'Creative Director' },
  { corrupted: 'InDes ign', expect: 'InDesign' },
  { corrupted: 'After Effe cts', expect: 'After Effects' },
  { corrupted: 'Premi ere Pro', expect: 'Premiere Pro' },
  { corrupted: 'Senior graph ic\ndesigner', expect: 'Senior graphic designer' },
  { corrupted: 'freel ance designer', expect: 'freelance designer' },
  { corrupted: 'pack aging designer', expect: 'packaging designer' },
  { corrupted: 'Visual Des igner', expect: 'Visual Designer' },
  { corrupted: 'Brand Des igner', expect: 'Brand Designer' },
  { corrupted: 'Product Des igner', expect: 'Product Designer' },
  { corrupted: 'Adobe Ill ustrator CC', expect: 'Adobe Illustrator' },
  { corrupted: 'Figma Protot yping', expect: 'Figma' },
  { corrupted: '||| NE TTT |||', expectGarbage: true },
  { corrupted: '@@@@@ repeated', expectGarbage: true },
  { corrupted: 'Ill ustrator · Phot0shop · InDes ign', expect: 'Illustrator' },
];

/**
 * Thin helper — normalized plain text only.
 * @param {string} rawText
 * @param {object} [opts]
 */
export function normalizeOcrText(rawText, opts = {}) {
  return normalizeOcrDocument(rawText, opts).text;
}
