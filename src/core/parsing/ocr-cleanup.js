/**
 * OCR cleanup — typo fixes and noise line routing before parser.
 * Never drops useful text: uncertain lines are kept for À classer.
 */

import { stripCorruptedUnicode, hasImpossibleSymbolRun } from '../../data/dictionaries/garbagePatterns.js';
import { isProtectedCreativeLine } from '../../data/dictionaries/creative/index.js';
import { fuzzySectionKey } from './section-fuzzy.js';

const WORD_RE = /[A-Za-zÀ-ÿ]{2,}/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EMAIL_MASK_TOKEN = '__HIRELY_EMAIL_MASK__';

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

/** Whole-line or inline OCR typo repairs */
const OCR_TYPO_REPAIRS = [
  [/\bHustration\b/gi, 'Illustration'],
  [/\bILLUSTHATCH\b/gi, 'Illustrator'],
  [/\bGRAPHIC\s+designer\b/gi, 'Graphic Designer'],
  [/\bgraphi[qc]\s+designer\b/gi, 'Graphic Designer'],
  [/\billustrat[io]+r\b/gi, 'Illustrator'],
  [/\bhotmai\s*l\b/gi, 'hotmail'],
  [/\bohotmai\b/gi, 'hotmail'],
  [/\bPeJ\b/g, 'fluent'],
  [/\bnative\s*\/\s*PeJ\b/gi, 'native / fluent'],
  [/\bEnglish\s+PeJ\b/gi, 'English — fluent'],
  [/\bFrench\s+PeJ\b/gi, 'French — native'],
];

const DROP_LINE_RE = [
  /^\s*NE\s+TTT\s*$/i,
  /^\s*NEE\s+See\b/i,
  /^\s*PUF\b/i,
  /^\s*A\s+Mail:\s*visual\b/i,
  /^\s*mail\s*:\s*visual\b/i,
];

const SECTION_HEADER_NORMALIZE = [
  [/^\s*work\s+experience\s*$/i, 'WORK EXPERIENCE'],
  [/^\s*professional\s+experience\s*$/i, 'WORK EXPERIENCE'],
  [/^\s*experience\s*$/i, 'WORK EXPERIENCE'],
  [/^\s*profile\s*$/i, 'PROFILE'],
  [/^\s*education\s*$/i, 'EDUCATION'],
  [/^\s*formation\s*$/i, 'EDUCATION'],
  [/^\s*skills?\s*$/i, 'SKILLS'],
  [/^\s*compétences\s*$/i, 'SKILLS'],
  [/^\s*tools?\s*$/i, 'TOOLS'],
  [/^\s*outils\s*$/i, 'TOOLS'],
  [/^\s*languages?\s*$/i, 'LANGUAGES'],
  [/^\s*langues\s*$/i, 'LANGUAGES'],
  [/^\s*clients?\s*$/i, 'CLIENTS'],
  [/^\s*interests?\s*$/i, 'INTEREST'],
  [/^\s*contact\s*$/i, 'CONTACT'],
];

function readableWordCount(line) {
  return (String(line || '').match(WORD_RE) || []).length;
}

function symbolRatio(line) {
  const s = String(line || '');
  if (!s.length) return 1;
  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const digits = (s.match(/\d/g) || []).length;
  const symbols = s.length - letters - digits - (s.match(/\s/g) || []).length;
  return symbols / s.length;
}

/**
 * @param {string} line
 */
export function isOcrNoiseLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return true;
  if (isProtectedCreativeLine(l)) return false;
  if (fuzzySectionKey(l)) return false;
  if (DROP_LINE_RE.some((re) => re.test(l))) return true;
  if (/^\\[,;.\s]*$/.test(l) || /^\\+\s*,/.test(l)) return true;
  if (hasImpossibleSymbolRun(l) && readableWordCount(l) < 2) return true;
  if (symbolRatio(l) > 0.42 && readableWordCount(l) < 3) return true;
  if (/^[\W\\|/,;]{3,}$/.test(l.replace(/\s/g, ''))) return true;
  if (/\bNE\s+TTT\b/i.test(l) && l.length < 24) return true;
  return false;
}

/**
 * @param {string} line
 */
export function repairOcrTyposInLine(line) {
  const { masked, emails } = maskEmailsInLine(line);
  let l = stripCorruptedUnicode(masked);
  l = l.replace(/^[\s\\|/,;]+/, '').replace(/[\s\\|/,;]+$/, '');
  for (const [re, rep] of OCR_TYPO_REPAIRS) {
    l = l.replace(re, rep);
  }
  l = l.replace(/\s{2,}/g, ' ').trim();
  for (const [re, rep] of SECTION_HEADER_NORMALIZE) {
    if (re.test(l)) {
      l = l.replace(re, rep);
      re.lastIndex = 0;
    }
  }
  return unmaskEmailsInLine(l, emails);
}

/**
 * @param {string} text
 * @returns {{ text: string, uncertainLines: string[], droppedLines: string[] }}
 */
export function cleanupOcrText(text) {
  const raw = stripCorruptedUnicode(String(text || '')).replace(/\r/g, '\n');
  if (!raw.trim()) return { text: '', uncertainLines: [], droppedLines: [] };

  const uncertainLines = [];
  const droppedLines = [];
  const kept = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const repaired = repairOcrTyposInLine(trimmed);
    if (!repaired) continue;

    if (isOcrNoiseLine(repaired)) {
      if (readableWordCount(repaired) >= 1 && repaired.length >= 6) {
        uncertainLines.push(repaired);
      } else {
        droppedLines.push(trimmed);
      }
      continue;
    }

    if (
      hasImpossibleSymbolRun(repaired) &&
      !isProtectedCreativeLine(repaired) &&
      readableWordCount(repaired) <= 2
    ) {
      uncertainLines.push(repaired);
      continue;
    }

    kept.push(repaired);
  }

  const uncertainUnique = [...new Set(uncertainLines.map((l) => l.trim()).filter(Boolean))];
  return {
    text: kept.join('\n').replace(/\n{4,}/g, '\n\n\n').trim(),
    uncertainLines: uncertainUnique,
    droppedLines,
  };
}
