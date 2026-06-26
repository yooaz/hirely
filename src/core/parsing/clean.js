/**
 * CV text cleanup — conservative safeClean (default) vs strictClean (debug only).
 */

import {
  isGarbageLine,
  isPlaceholderLine,
  OCR_SYMBOL_RE,
} from '../../data/dictionaries/garbagePatterns.js';
import { passesExperienceGate } from './section-sanity.js';
import { postProcessOcrText } from './ocr-postprocess.js';
import { CREATIVE_ENTITY_RE } from '../../data/dictionaries/creative/index.js';
import { reconstructExtractedText } from './text-reconstruction.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const EMAIL_LINE_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

const PAGE_NUMBER_RE =
  /^(?:page\s*)?\d{1,3}\s*(?:\/|of|sur|de)\s*\d{1,3}$|^(?:page\s+)?\d{1,3}$/i;
const FOOTER_HEADER_PHRASES = [
  /^curriculum\s+vitae$/i,
  /^resume$/i,
  /^cv$/i,
  /^confidential$/i,
  /^strictly\s+private$/i,
  /^www\./i,
];

const SECTION_HEADER_WORDS = new Set([
  'profile',
  'profil',
  'summary',
  'about',
  'experience',
  'expérience',
  'education',
  'formation',
  'skills',
  'compétences',
  'competences',
  'tools',
  'languages',
  'langues',
  'clients',
  'contact',
  'location',
]);

const PROTECTED_LINE_RE =
  /\b(freelance|illustrator|designer|university|école|ecole|school|college|bachelor|master|mba|diploma|sorbonne|portfolio|project|client)\b/i;

/**
 * Fix DOCX/PDF runs glued without spaces (e.g. Year2007, 2009Visual).
 * @param {string} text
 */
export function repairCompactWordBoundaries(text) {
  let s = stripControlChars(String(text || ''));
  const emails = [];
  s = s.replace(EMAIL_RE, (m) => {
    emails.push(m);
    return `__HIRELY_EMAIL_${emails.length - 1}__`;
  });
  s = s
    .replace(/([A-Za-zÀ-ÿ]{2,})((?:19|20)\d{2}\b)/g, '$1 $2')
    .replace(/((?:19|20)\d{2})([A-ZÀ-Ö][a-zà-ö])/g, '$1 $2')
    .replace(/(\d{2,4})([A-ZÀ-Ö][a-zà-ö]{2,})/g, '$1 $2');
  s = s.replace(/__HIRELY_EMAIL_(\d+)__/g, (_, i) => emails[Number(i)] ?? '');
  return s.replace(/[ \t]+/g, ' ').trim();
}

/** @param {string} text */
export function normalizeRawExtract(text) {
  return repairCompactWordBoundaries(
    stripControlChars(text).replace(/[ \t]+/g, ' ').replace(/\n{4,}/g, '\n\n\n').trim()
  );
}

function stripControlChars(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
}

function normalizeEmailInLine(line) {
  return String(line || '').replace(EMAIL_RE, (m) =>
    m.replace(/\s+/g, '').replace(/\.fr$/i, '.fr').toLowerCase()
  );
}

function normalizePhoneInLine(line) {
  let l = String(line || '');
  const m = l.match(PHONE_RE);
  if (!m) return l;
  if (/\b(19|20)\d{2}\s*[-–—]/.test(l)) return l;
  const d = m[0].replace(/\D/g, '');
  if (d.length < 8 || d.length > 15) return l;
  let norm = m[0].trim();
  if (d.startsWith('33') && d.length >= 11) norm = `+${d}`;
  else if (d.length === 10 && d.startsWith('0')) norm = `+33${d.slice(1)}`;
  return l.replace(m[0], norm);
}

function normalizeLineContacts(line) {
  return normalizePhoneInLine(normalizeEmailInLine(line.replace(/\s+/g, ' ').trim()));
}

function collapseEmptyLines(text) {
  return String(text || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/\n{3}/g, '\n\n')
    .trim();
}

/**
 * Lines we never drop in safe or strict cleaning (experience, clients, schools, projects).
 */
export function isProtectedContentLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (/^curriculum\s+vitae$/i.test(l) || /^resume$/i.test(l) || /^cv$/i.test(l) || /^confidential$/i.test(l)) {
    return false;
  }
  if (EMAIL_LINE_RE.test(l) || PHONE_RE.test(l)) return true;
  if (passesExperienceGate(l)) return true;
  if (PROTECTED_LINE_RE.test(l) || CREATIVE_ENTITY_RE.test(l)) return true;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length === 1 && l.length >= 2 && l.length <= 28 && /^[A-ZÀ-Ö]/.test(l)) return true;
  if (words.length >= 2 && words.length <= 5 && l.length <= 56 && /\b(19|20)\d{2}\b/.test(l)) return true;
  if (words.length >= 2 && l.length >= 10 && letterRatio(l) >= 0.55 && !isImpossibleOcrTokenString(l)) {
    return true;
  }
  return false;
}

function letterRatio(line) {
  const l = String(line || '');
  const letters = (l.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return l.length ? letters / l.length : 0;
}

export function isImpossibleOcrTokenString(line) {
  const l = String(line || '').trim();
  if (l.length < 8 || EMAIL_LINE_RE.test(l)) return false;
  const letters = (l.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const weird = (l.match(/[^A-Za-zÀ-ÿ0-9\s@.+'(),\-–—]/g) || []).length;
  return weird >= 3 && letters / l.length < 0.55 && weird / l.length > 0.28;
}

/** Obvious garbage only — strict mode / debug. */
export function isObviousStrictGarbage(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (isProtectedContentLine(l)) return false;
  if (isPlaceholderLine(l)) return true;
  if (/^\[body\]|\[header\]|\[footer\]/i.test(l)) return true;
  if (/^[\W\d\s]+$/.test(l)) return true;
  if (letterRatio(l) < 0.3) return true;
  if (/^[^\p{L}\p{N}\s@.+()\-–—]{2,}$/u.test(l)) return true;
  if (/([!?.,;:])\1{4,}/.test(l)) return true;
  if (isImpossibleOcrTokenString(l)) return true;
  if (new RegExp(OCR_SYMBOL_RE.source).test(l) && letterRatio(l) < 0.5) return true;
  return false;
}

/**
 * Conservative default — no word rewriting, no spaced-letter collapse, no camelCase splits.
 */
export function safeClean(text) {
  let s = repairCompactWordBoundaries(stripControlChars(text));
  s = s.replace(/\f/g, '\n');
  const lines = s.split('\n').map((l) => normalizeLineContacts(l)).filter((l) => l.length > 0);
  return reconstructExtractedText(collapseEmptyLines(lines.join('\n')));
}

/** Remove decorative symbols — used only by strictClean / debug. */
export function stripSpecialCharacters(text) {
  let s = stripControlChars(text);
  s = s.replace(new RegExp(OCR_SYMBOL_RE.source, 'g'), ' ');
  s = s.replace(/[“”«»]/g, '"').replace(/[’‘]/g, "'");
  s = s.replace(/[|¦‖§¶†‡]/g, ' ');
  s = s.replace(/([A-Za-zÀ-ÿ])[\|\\\/_]{1,3}([A-Za-zÀ-ÿ])/g, '$1 $2');
  s = s.replace(/[^\S\n\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF@.+()\-–—,:;!?%&#'"]/g, ' ');
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function collapseSpacedLetters(line) {
  if (/@/.test(line)) return line.replace(/\s+/g, '');
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return line;
  const single = tokens.filter((t) => /^[A-Za-zÀ-ÿ0-9]$/.test(t)).length;
  if (single / tokens.length < 0.45) return line;
  const words = [];
  let buf = '';
  for (const t of tokens) {
    if (/^[A-Za-zÀ-ÿ0-9]$/.test(t)) buf += t;
    else {
      if (buf) {
        words.push(buf);
        buf = '';
      }
      words.push(t);
    }
  }
  if (buf) words.push(buf);
  return words.join(' ');
}

export function normalizeSectionHeaderCasing(line) {
  const t = String(line || '').trim();
  if (!t || t.length > 48) return t;
  if (EMAIL_LINE_RE.test(t) || PHONE_RE.test(t)) return t;
  const bare = t.replace(/[:：|#•]+\s*$/, '').trim();
  if (bare !== bare.toUpperCase() || bare.length < 3) return t;
  const norm = bare.toLowerCase().replace(/\s+/g, ' ');
  const first = norm.split(/\s+/)[0];
  if (!SECTION_HEADER_WORDS.has(first) && !SECTION_HEADER_WORDS.has(norm)) return t;
  const titled = norm.replace(/\b[\p{L}\p{M}]/gu, (c) => c.toUpperCase());
  return t.replace(bare, titled);
}

export function stripHeaderFooterLines(lines) {
  if (!lines?.length) return [];
  const counts = new Map();
  for (const line of lines) {
    const k = line.toLowerCase().replace(/\s+/g, ' ').trim();
    if (k.length > 0 && k.length < 64) counts.set(k, (counts.get(k) || 0) + 1);
  }

  return lines.filter((line) => {
    const t = line.trim();
    if (!t) return false;
    if (isProtectedContentLine(t)) return true;
    if (EMAIL_LINE_RE.test(t) || PHONE_RE.test(t)) return true;
    if (PAGE_NUMBER_RE.test(t)) return false;
    if (FOOTER_HEADER_PHRASES.some((re) => re.test(t))) {
      const k = t.toLowerCase();
      if ((counts.get(k) || 0) >= 2) return false;
    }
    const k = t.toLowerCase().replace(/\s+/g, ' ');
    if (t.length < 56 && (counts.get(k) || 0) >= 3 && !/@/.test(t)) return false;
    return true;
  });
}

function mergeBrokenLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      const nextIsContact =
        EMAIL_LINE_RE.test(next) || PHONE_RE.test(next) || /^https?:\/\//i.test(next);
      const continues =
        /[,;:]$/.test(cur.trim()) ||
        (!/[.!?]$/.test(cur.trim()) &&
          /^[a-zà-ö0-9(]/.test(next) &&
          next.length < 140 &&
          !nextIsContact);
      if (continues) {
        cur = `${cur} ${next}`.replace(/\s+/g, ' ').trim();
        i++;
      } else break;
    }
    out.push(cur);
  }
  return out;
}

/**
 * Aggressive clean — debug / forensic only. Can rewrite spaced letters and drop lines.
 */
export function strictClean(text) {
  let s = stripSpecialCharacters(text);
  s = s.replace(/[•·▪●■◆]/g, '\n').replace(/\f/g, '\n');
  let lines = s
    .split('\n')
    .map((l) => collapseSpacedLetters(l.replace(/\s+/g, ' ').trim()))
    .map((l) => normalizeSectionHeaderCasing(l))
    .filter((l) => l.length > 0);

  lines = stripHeaderFooterLines(lines);
  lines = mergeBrokenLines(lines);

  const seen = new Set();
  lines = lines.filter((l) => {
    if (isObviousStrictGarbage(l) || isGarbageLine(l)) return false;
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return collapseEmptyLines(lines.join('\n'));
}

/** @deprecated debug — use strictClean */
export function cleanText(text) {
  return strictClean(text);
}

/**
 * Per-line safe clean (P0-2) — no spaced-letter collapse, preserves protected content.
 * @param {string} line
 * @param {{ ocr?: boolean }} [opts]
 */
export function cleanExtractionLine(line, opts = {}) {
  let s = repairCompactWordBoundaries(stripControlChars(String(line || '')));
  s = normalizeLineContacts(s.replace(/\s+/g, ' ').trim());
  if (!s) return '';
  if (opts.ocr) {
    s = postProcessOcrText(s, { ocr: true });
    s = s.split('\n').map((l) => l.trim()).filter(Boolean)[0] || s;
  }
  return s.trim();
}

/**
 * @returns {{ ratio: number, lossPct: number, warn: boolean }}
 */
export function measureCleanLoss(rawText, cleanedText) {
  const raw = String(rawText || '').trim();
  const clean = String(cleanedText || '').trim();
  const rawLen = Math.max(1, raw.length);
  const ratio = clean.length / rawLen;
  const lossPct = Math.round(Math.max(0, 1 - ratio) * 100);
  return {
    ratio,
    lossPct,
    warn: lossPct > 20,
  };
}
