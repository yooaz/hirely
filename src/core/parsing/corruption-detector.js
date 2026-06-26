/**
 * OCR / encoding corruption detector — lines flagged for review, blocked from export.
 */

import {
  isGarbageLine,
  isOcrNameGarbage,
  OCR_NAME_GARBAGE_RE,
} from '../../data/dictionaries/garbagePatterns.js';
import { strictStructuredResume } from '../pipeline/pipeline-contract.js';
import { SYMBOL_HANDLE_OCR_RE } from './ocr-classification-rules.js';

/** Score ≥ this → corrupted (review queue, no CV export). */
export const CORRUPTION_BLOCK_SCORE = 40;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\.|\.(com|fr|net|org|io)\b/i;

/** Known OCR corruption needles (encoding / symbol fusion). */
export const KNOWN_CORRUPTION_RE =
  /\b(a>o\s+n['']?\$?ak6|ce\s+frei\s+re|ra\s+coe\s+pcl)\b|a>o\s+n['']?\$?ak6\.f|îô°/i;

const SYMBOL_HEAVY_RE = /[|¦‖§¶†‡•◦▪▫■□<>{}[\]\\^`~@#$%*=+]{2,}/;
const UNUSUAL_UNICODE_RE = /[^\x20-\x7E\u00A0-\u024F\u0300-\u036F]/;
const DUPLICATE_PREFIX_RE = /^\s*([A-Z])\1{1,2}\s+(?=[A-Z])/;

/**
 * @typedef {{ score: number, corrupted: boolean, reasons: string[], flags: Record<string, boolean> }} CorruptionAnalysis
 */

const CORRUPTION_LINE_MAX = 480;

function tokenize(line) {
  return String(line || '')
    .slice(0, CORRUPTION_LINE_MAX)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 48);
}

function countLetters(token) {
  let n = 0;
  const t = String(token || '');
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      (c >= 192 && c <= 591)
    ) {
      n++;
    }
  }
  return n;
}

function symbolRatio(s) {
  const t = String(s || '').slice(0, CORRUPTION_LINE_MAX);
  if (!t.length) return 0;
  let symbols = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (!/[A-Za-zÀ-ÿ0-9\s.,''\-–—@+()]/.test(ch)) symbols++;
  }
  return symbols / t.length;
}

function hasMixedEncodingToken(token) {
  const t = String(token || '');
  if (t.length < 3) return false;
  if (EMAIL_RE.test(t) || URL_RE.test(t)) return false;
  if (/[A-Za-z]+[<>$'°][A-Za-z0-9]/.test(t)) return true;
  if (/[A-Z]>[a-z]/.test(t)) return true;
  if (/[0-9]+['$][A-Za-z]/.test(t)) return true;
  if (/['$][0-9]/.test(t) && /[A-Za-z]/.test(t)) return true;
  if (/\.f\s*$/i.test(t) && /[A-Za-z]{2,}/.test(t) && /[^.\w]/.test(t.replace(/\.f$/i, ''))) return true;
  return false;
}

function hasImpossibleWordStructure(line) {
  const sample = String(line || '').slice(0, CORRUPTION_LINE_MAX);
  const tokens = tokenize(sample);
  if (!tokens.length) return false;

  let bad = 0;
  for (const tok of tokens) {
    if (EMAIL_RE.test(tok) || URL_RE.test(tok) || PHONE_RE.test(tok)) continue;
    if (tok.length === 1 && /[A-Za-z]/.test(tok)) bad++;
    if (/^(?:[A-Za-z]\.){2,}[A-Za-z]?$/.test(tok)) bad++;
    if (tok.length >= 4 && countLetters(tok) < tok.length * 0.5) bad++;
    if (hasMixedEncodingToken(tok)) bad++;
    if (/^[A-Z]{4,}$/.test(tok) && !/^(HTML|CSS|JSON|PDF|MBA|BFA|PHD|AWS|GCP)$/i.test(tok)) bad += 0.5;
  }
  if (tokens.length >= 4 && bad / tokens.length > 0.35) return true;
  let singleLetterRuns = 0;
  for (const tok of tokens) {
    if (tok.length === 1 && /[A-Za-z]/.test(tok)) singleLetterRuns++;
    else singleLetterRuns = 0;
    if (singleLetterRuns >= 5) return true;
  }
  return bad >= 2;
}

function hasUnusualUnicode(line) {
  const s = String(line || '').slice(0, CORRUPTION_LINE_MAX);
  if (!UNUSUAL_UNICODE_RE.test(s)) return false;
  if (KNOWN_CORRUPTION_RE.test(s)) return true;
  let hits = 0;
  for (let i = 0; i < s.length; i++) {
    if (UNUSUAL_UNICODE_RE.test(s[i])) hits++;
    if (hits >= 2) return true;
  }
  if (hits >= 1 && symbolRatio(s) > 0.12) return true;
  return false;
}

function hasTooManySymbols(line) {
  const s = String(line || '');
  if (EMAIL_RE.test(s) || PHONE_RE.test(s)) return false;
  const ratio = symbolRatio(s);
  if (ratio >= 0.22) return true;
  if (SYMBOL_HEAVY_RE.test(s)) return true;
  if (/[<>$'°]{2,}/.test(s)) return true;
  if (/^[\u00A2\u00A3\u20AC©®™¢]/.test(s)) return true;
  return false;
}

/**
 * @param {string} line
 * @returns {CorruptionAnalysis}
 */
export function analyzeLineCorruption(line) {
  const text = String(line || '').trim().slice(0, CORRUPTION_LINE_MAX);
  const reasons = [];
  const flags = {
    tooManySymbols: false,
    mixedEncoding: false,
    unusualUnicode: false,
    impossibleStructure: false,
    knownPattern: false,
    garbage: false,
  };

  if (!text || text.length < 2) {
    return { score: 0, corrupted: false, reasons: [], flags };
  }

  if (EMAIL_RE.test(text) || PHONE_RE.test(text)) {
    return { score: 0, corrupted: false, reasons: [], flags };
  }

  let score = 0;

  if (isGarbageLine(text) || isOcrNameGarbage(text)) {
    flags.garbage = true;
    score += 55;
    reasons.push('OCR garbage pattern');
  }
  if (KNOWN_CORRUPTION_RE.test(text) || SYMBOL_HANDLE_OCR_RE.test(text) || OCR_NAME_GARBAGE_RE.test(text)) {
    flags.knownPattern = true;
    score += 50;
    reasons.push('Known corruption signature');
  }
  if (hasTooManySymbols(text)) {
    flags.tooManySymbols = true;
    score += 28;
    reasons.push('Too many symbols');
  }
  if (tokenize(text).some(hasMixedEncodingToken)) {
    flags.mixedEncoding = true;
    score += 32;
    reasons.push('Mixed encoding in token');
  }
  if (hasUnusualUnicode(text)) {
    flags.unusualUnicode = true;
    score += 30;
    reasons.push('Unusual Unicode');
  }
  if (hasImpossibleWordStructure(text)) {
    flags.impossibleStructure = true;
    score += 26;
    reasons.push('Impossible word structure');
  }
  if (DUPLICATE_PREFIX_RE.test(text)) {
    score += 45;
    reasons.push('OCR duplicate letter prefix');
  }
  if (/^\s*¢\s*/.test(text) && URL_RE.test(text)) {
    score += 25;
    reasons.push('Corrupted URL prefix');
  }

  score = Math.min(100, score);
  const corrupted = score >= CORRUPTION_BLOCK_SCORE;

  return { score, corrupted, reasons: [...new Set(reasons)], flags };
}

/** @param {string} line */
export function scoreLineCorruption(line) {
  return analyzeLineCorruption(line).score;
}

/** @param {string} line */
export function isLineCorrupted(line) {
  try {
    return analyzeLineCorruption(line).corrupted;
  } catch {
    return false;
  }
}

/** Block from templates, PDF export, and formatCvAsStructuredText. */
export function isLineCorruptedForExport(line) {
  const s = String(line || '').trim().slice(0, CORRUPTION_LINE_MAX);
  if (
    /^\s*(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|present|présent|current)\s*$/i.test(s)
  ) {
    return false;
  }
  try {
    return isLineCorrupted(s);
  } catch {
    return false;
  }
}

/**
 * @param {string} text
 */
export function corruptionScoreText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  if (!lines.length) return 0;
  const scores = lines.map((l) => scoreLineCorruption(l));
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(max * 0.65 + avg * 0.35);
}

/**
 * Strip corrupted strings from legacy cvData before render/export.
 * @param {object} cvData
 * @returns {object}
 */
function mergeIntoUnsorted(existing, lines) {
  const out = [...(existing || [])];
  const seen = new Set(out.map((x) => String(x).trim().toLowerCase()));
  for (const line of lines || []) {
    const t = String(line || '').trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function sanitizeCvDataForExport(cvData) {
  const d = { ...(cvData || {}) };
  const quarantined = [];
  const drop = (v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (isLineCorruptedForExport(s)) {
      quarantined.push(s);
      return '';
    }
    return s;
  };
  const dropList = (arr) => {
    const kept = [];
    for (const x of arr || []) {
      const s = String(x || '').trim();
      if (!s) continue;
      if (isLineCorruptedForExport(s)) quarantined.push(s);
      else kept.push(s);
    }
    return kept;
  };

  d.name = drop(d.name);
  d.title = drop(d.title);
  d.summary = drop(d.summary);
  d.email = drop(d.email);
  d.phone = drop(d.phone);
  d.location = drop(d.location);
  d.linkedin = drop(d.linkedin);
  d.portfolio = drop(d.portfolio);
  d.experience = dropList(d.experience);
  d.education = dropList(d.education);
  d.skills = dropList(d.skills);
  d.tools = dropList(d.tools);
  d.languages = dropList(d.languages);
  d.clients = dropList(d.clients);
  d.interests = dropList(d.interests);
  d.projects = dropList(d.projects);
  d.extra = dropList(d.extra);
  d.unsorted = mergeIntoUnsorted(dropList(d.unsorted), quarantined);

  if (d.structuredResume) {
    d.structuredResume = sanitizeStructuredForExport(d.structuredResume);
  }
  return d;
}

/**
 * @param {object} structured
 */
export function sanitizeStructuredForExport(structured) {
  const s = { ...(structured || {}) };
  const id = { ...(s.identity || {}) };
  const quarantined = [];
  const drop = (v) => {
    const t = String(v || '').trim();
    if (!t) return '';
    if (isLineCorruptedForExport(t)) {
      quarantined.push(t);
      return '';
    }
    return t;
  };
  const filterList = (arr) => {
    const kept = [];
    for (const x of arr || []) {
      const t = String(x || '').trim();
      if (!t) continue;
      if (isLineCorruptedForExport(t)) quarantined.push(t);
      else kept.push(t);
    }
    return kept;
  };
  id.name = drop(id.name);
  id.title = drop(id.title);
  id.email = drop(id.email);
  id.phone = drop(id.phone);
  id.location = drop(id.location);
  id.website = drop(id.website);
  id.linkedin = drop(id.linkedin);
  s.identity = id;
  s.summary = drop(s.summary);
  s.education = filterList(s.education);
  s.skills = filterList(s.skills);
  s.tools = filterList(s.tools);
  s.languages = filterList(s.languages);
  s.clients = filterList(s.clients);
  s.interests = filterList(s.interests);
  s.projects = filterList(s.projects);
  s.unsorted = mergeIntoUnsorted(filterList(s.unsorted), quarantined);
  s.experiences = (s.experiences || [])
    .map((e) => {
      const exp = { ...e };
      if (isLineCorruptedForExport(exp.role)) {
        quarantined.push(String(exp.role).trim());
        exp.role = '';
      }
      if (isLineCorruptedForExport(exp.company)) {
        quarantined.push(String(exp.company).trim());
        exp.company = '';
      }
      const bullets = [];
      for (const b of exp.bullets || []) {
        const t = String(b || '').trim();
        if (!t) continue;
        if (isLineCorruptedForExport(t)) quarantined.push(t);
        else bullets.push(t);
      }
      exp.bullets = bullets;
      if (!exp.role && !exp.company && !exp.bullets.length) return null;
      return exp;
    })
    .filter(Boolean);
  s.unsorted = mergeIntoUnsorted(s.unsorted, quarantined);
  return strictStructuredResume(s);
}

/**
 * Build review items for corrupted lines (internal queue).
 * @param {string} line
 * @param {{ extractionConfidence?: number }} [ctx]
 */
export function corruptionReviewItem(line, ctx = {}) {
  const a = analyzeLineCorruption(line);
  if (!a.corrupted && (ctx.extractionConfidence ?? 100) >= 60) return null;
  const conf = Number(ctx.extractionConfidence);
  const confidence = Number.isFinite(conf)
    ? Math.round(Math.max(0, Math.min(100, conf)))
    : Math.max(0, 100 - a.score);
  return {
    field: 'raw',
    detected: line,
    sourceText: line,
    sourceLines: [line],
    suggestion: 'Remove or retype corrupted OCR line',
    reason: a.reasons.length ? a.reasons.join('; ') : 'Low extraction confidence',
    action: 'corruption',
    corruptionScore: a.score,
    confidence,
    extractionConfidence: ctx.extractionConfidence ?? null,
  };
}
