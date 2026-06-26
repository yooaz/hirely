/**
 * Post-OCR text repair: section headers, whitelist canonical hints for creative entities.
 * Dictionary entities are masked before char fixes — never auto-corrected.
 */

import {
  stripCorruptedUnicode,
  hasImpossibleSymbolRun,
  isProtectedCreativeLine,
} from '../../data/dictionaries/garbagePatterns.js';
import { repairOcrTyposInLine } from './ocr-cleanup.js';
import { normalizeOcrDocument } from './ocr-normalization.js';
import {
  maskCreativeEntities,
  unmaskCreativeEntities,
  transformPreservingCreativeEntities,
  applyCreativeOcrCanonicalHints,
  CREATIVE_OCR_CANONICAL_HINTS,
} from './creative-entity-guard.js';

const CHAR_FIXES = [
  [/\b0([a-z])/gi, 'O$1'],
  [/\b1([a-z])/gi, 'l$1'],
  [/\b([a-z])1\b/gi, '$1l'],
  [/\bRN\b/g, 'M'],
  [/\bVV/g, 'W'],
  [/ﬁ/g, 'fi'],
  [/ﬂ/g, 'fl'],
];

/** Generic French/role hints — never applied inside masked creative entities. */
const GENERIC_WORD_HINTS = [
  [/\bgraphi[qc]ue?\b/gi, 'graphique'],
  [/\billustrat[io]+n\b/gi, 'illustration'],
  [/\bdesign[eu]r\b/gi, 'designer'],
  [/\bdevelop+p?eur\b/gi, 'développeur'],
  [/\bmanage[ur]?\b/gi, 'manager'],
  [/\buniversit[ée]\b/gi, 'université'],
  [/\blinkedin\b/gi, 'LinkedIn'],
  [/\bohotmai\b/gi, 'hotmail'],
  [/\bhotmai\s*l\b/gi, 'hotmail'],
  [/\bGRADRIC\b/gi, 'GRAPHIC'],
  [/\bgradric\b/gi, 'graphic'],
  [/\bMustrator\b/gi, 'Illustrator'],
  [/\billustrat[io]+r\b/gi, 'Illustrator'],
];

const SECTION_ALIASES = [
  [/^\s*exp[éeè]?[ée]?r[i1l][ea]nce[s]?\s*$/gim, 'EXPÉRIENCE'],
  [/^\s*expéri[eé]nce[s]?\s*$/gim, 'EXPÉRIENCE'],
  [/^\s*education[s]?\s*$/gim, 'FORMATION'],
  [/^\s*formations?\s*$/gim, 'FORMATION'],
  [/^\s*comp[ée]tences?\s*$/gim, 'COMPÉTENCES'],
  [/^\s*skills?\s*$/gim, 'SKILLS'],
  [/^\s*langues?\s*$/gim, 'LANGUES'],
  [/^\s*languages?\s*$/gim, 'LANGUAGES'],
  [/^\s*outils?\s*$/gim, 'OUTILS'],
  [/^\s*tools?\s*$/gim, 'TOOLS'],
  [/^\s*clients?\s*$/gim, 'CLIENTS'],
  [/^\s*profil\s*$/gim, 'PROFIL'],
  [/^\s*summary\s*$/gim, 'SUMMARY'],
  [/^\s*contact\s*$/gim, 'CONTACT'],
];

function repairBrokenPunctuation(line) {
  return transformPreservingCreativeEntities(String(line || ''), (segment) => {
    let l = segment;
    l = l.replace(/[,;:]{2,}/g, ',');
    l = l.replace(/[-–—]{4,}/g, ' — ');
    l = l.replace(/\.{4,}/g, '...');
    l = l.replace(/\(\s*\)/g, '');
    l = l.replace(/\[\s*\]/g, '');
    return l.trim();
  });
}

function applyCharFixes(line) {
  return transformPreservingCreativeEntities(line, (segment) => {
    let l = segment;
    for (const [re, rep] of CHAR_FIXES) {
      l = l.replace(re, rep);
    }
    return l;
  });
}

function applyGenericHints(line) {
  return transformPreservingCreativeEntities(line, (segment) => {
    let l = segment;
    for (const [re, rep] of GENERIC_WORD_HINTS) {
      l = l.replace(re, rep);
    }
    return l;
  });
}

function cleanOcrLine(line) {
  let l = stripCorruptedUnicode(line);
  l = repairBrokenPunctuation(l);
  l = applyCharFixes(l);
  l = applyCreativeOcrCanonicalHints(l);
  l = applyGenericHints(l);
  return l.replace(/\s{2,}/g, ' ').trim();
}

function repairOcrEmailDomains(text) {
  return String(text || '')
    .replace(/([a-z0-9._%+-]+@hotmail)\s+fr\b/gi, '$1.fr')
    .replace(/([a-z0-9._%+-]+@gmail)\s+com\b/gi, '$1.com')
    .replace(/([a-z0-9._%+-]+@outlook)\s+fr\b/gi, '$1.fr')
    .replace(/([a-z0-9._%+-]+@yahoo)\s+fr\b/gi, '$1.fr');
}

/**
 * @param {string} text
 * @param {{ ocr?: boolean }} [opts] — apply heavier fixes when true
 */
export function postProcessOcrText(text, opts = {}) {
  let s = stripCorruptedUnicode(String(text || ''));
  if (!s.trim()) return s;

  s = s.replace(/\r/g, '\n').replace(/\t/g, ' ');
  s = repairOcrEmailDomains(s);

  if (opts.ocr !== false) {
    const normalized = normalizeOcrDocument(s, opts);
    s = normalized.text;
    if (normalized.stats && typeof globalThis !== 'undefined') {
      globalThis.__HIRELY_OCR_HARDEN_STATS = normalized.stats;
      globalThis.__HIRELY_OCR_NORMALIZATION = normalized;
    }
    const uncertainLines = (normalized.lines || [])
      .filter((l) => !l.accepted && l.normalizedLine)
      .map((l) => l.normalizedLine);
    if (uncertainLines.length) {
      globalThis.__HIRELY_OCR_UNCERTAIN_LINES = [
        ...(globalThis.__HIRELY_OCR_UNCERTAIN_LINES || []),
        ...uncertainLines,
      ];
    }
    const { masked, originals } = maskCreativeEntities(s);
    let work = masked;
    for (const [re, rep] of CREATIVE_OCR_CANONICAL_HINTS) {
      work = work.replace(re, rep);
    }
    s = unmaskCreativeEntities(work, originals);
  }

  const lines = s.split('\n').map((line) => {
    if (!line.trim()) return '';
    if (hasImpossibleSymbolRun(line) && !isProtectedCreativeLine(line)) return '';
    let l =
      opts.ocr !== false
        ? cleanOcrLine(repairOcrTyposInLine(line))
        : line.replace(/\s{2,}/g, ' ').trim();
    for (const [re, rep] of SECTION_ALIASES) {
      if (re.test(l)) {
        l = l.replace(re, rep);
        re.lastIndex = 0;
      }
    }
    return l;
  });

  return lines.filter(Boolean).join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

/** Heuristic: text likely came from OCR (noisy spacing / low punctuation density). */
export function looksLikeOcrText(text) {
  const s = String(text || '');
  if (s.length < 12) return false;
  if (/\b(profile\s+work\s+experience|20[MN]\b|GRADRIC|a>\s*n)\b/i.test(s)) return true;
  if (/\b([A-Za-zÀ-ÿ]\s){3,}[A-Za-zÀ-ÿ]/.test(s)) return true;
  const weird = (s.match(/[|0]{2,}/g) || []).length;
  return weird >= 2;
}
