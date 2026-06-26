/**
 * Post-OCR cleanup pipeline — runs before createResumeFromText.
 * Never invents data; uncertain lines route to "Contenu à vérifier".
 */
import { cleanupOcrText, isOcrNoiseLine, repairOcrTyposInLine } from '../parsing/ocr-cleanup.js';

export const OCR_CLEANUP_PIPELINE_VERSION = 'OCR_CLEANUP_PIPELINE_V1';
export const VERIFY_CONTENT_LABEL = 'Contenu à vérifier';

const MIN_YEAR = 1950;
const MAX_YEAR = 2035;

/** Extra OCR typo repairs (context-free). */
const INLINE_WORD_REPAIRS = [
  [/\bFraclancer\b/gi, 'Freelancer'],
  [/\bfraclancer\b/gi, 'freelancer'],
  [/\bFreelacer\b/gi, 'Freelancer'],
  [/\bIllustator\b/gi, 'Illustrator'],
  [/\bDesinger\b/gi, 'Designer'],
  [/\bGraphi[qc]\s+Designer\b/gi, 'Graphic Designer'],
];

const SECTION_HEADER_CANON = [
  [/^\s*profil\s*$/i, 'PROFIL'],
  [/^\s*profile\s*$/i, 'PROFIL'],
  [/^\s*expériences?\s*$/i, 'EXPERIENCE'],
  [/^\s*experience\s*$/i, 'EXPERIENCE'],
  [/^\s*parcours\s*professionnel\s*$/i, 'EXPERIENCE'],
  [/^\s*work\s*experience\s*$/i, 'EXPERIENCE'],
  [/^\s*clients?\s*$/i, 'CLIENTS'],
  [/^\s*formation\s*$/i, 'FORMATION'],
  [/^\s*formations\s*$/i, 'FORMATION'],
  [/^\s*education\s*$/i, 'FORMATION'],
  [/^\s*études\s*$/i, 'FORMATION'],
  [/^\s*compétences\s*$/i, 'COMPETENCES'],
  [/^\s*competences\s*$/i, 'COMPETENCES'],
  [/^\s*skills?\s*$/i, 'COMPETENCES'],
  [/^\s*outils\s*$/i, 'OUTILS'],
  [/^\s*tools?\s*$/i, 'OUTILS'],
  [/^\s*software\s*$/i, 'OUTILS'],
  [/^\s*langues\s*$/i, 'LANGUES'],
  [/^\s*languages?\s*$/i, 'LANGUES'],
];

const ISOLATED_SYMBOL_RE = /^[\s\\|/,;.:·•*#@&%$!?+=\[\]{}()<>\-_~`"'^]+$/;
const GARBAGE_EDUCATION_RE =
  /^(page\s+\d|^\d{1,3}$|^\W+$|skills?|compétences|outils|tools|experience|formation|profil|clients?)$/i;

function isValidYear(year) {
  return Number.isFinite(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/**
 * Safely repair fused year tokens (e.g. 201223 → 2012–2023).
 * Does not guess when suffix is ambiguous (e.g. 201203).
 * @param {string} line
 */
export function repairFusedYearRangesInLine(line) {
  let l = String(line || '');

  l = l.replace(/\b(20\d{2})(20\d{2})\b/g, (match, a, b) => {
    const y1 = parseInt(a, 10);
    const y2 = parseInt(b, 10);
    if (!isValidYear(y1) || !isValidYear(y2) || y2 < y1 || y2 - y1 > 40) return match;
    return `${y1}–${y2}`;
  });

  l = l.replace(/\b((?:19|20)\d{2})(\d{2})\b/g, (match, startPart, suffix) => {
    const y1 = parseInt(startPart, 10);
    const suffixNum = parseInt(suffix, 10);
    if (!isValidYear(y1) || suffixNum < 10) return match;
    const century = Math.floor(y1 / 100);
    const y2 = century * 100 + suffixNum;
    if (!isValidYear(y2) || y2 <= y1 || y2 - y1 > 40) return match;
    return `${y1}–${y2}`;
  });

  return l;
}

/**
 * Contextual repair for usrat/os-style OCR fragments.
 * @param {string} line
 * @param {string} [contextBlob]
 */
export function repairContextualOcrWords(line, contextBlob = '') {
  let l = String(line || '');
  const ctx = `${contextBlob} ${l}`.toLowerCase();

  if (/\busrat\s*\/?\s*os\b/i.test(l)) {
    if (/\b(illustrat|draw|graphic|brand|creative|design)/i.test(ctx)) {
      l = l.replace(/\busrat\s*\/?\s*os\b/gi, () =>
        /\billustrat/i.test(ctx) ? 'Illustrator' : 'Designer'
      );
    }
  }

  for (const [re, rep] of INLINE_WORD_REPAIRS) {
    l = l.replace(re, rep);
  }

  return l;
}

/**
 * @param {string} line
 */
export function isIsolatedSymbolLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (l.length <= 2 && ISOLATED_SYMBOL_RE.test(l)) return true;
  if (ISOLATED_SYMBOL_RE.test(l)) return true;
  if (/^[\W\d]{1,4}$/.test(l) && !/\b(19|20)\d{2}\b/.test(l)) return true;
  return false;
}

/**
 * @param {string} line
 */
export function normalizeSectionHeaderLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return '';
  for (const [re, canon] of SECTION_HEADER_CANON) {
    if (re.test(trimmed)) return canon;
  }
  return trimmed;
}

/**
 * @param {string[]} lines
 */
export function dedupeLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = String(line || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(line).trim());
  }
  return out;
}

/**
 * @param {string} rawText
 * @param {object} [opts]
 * @returns {{
 *   text: string,
 *   uncertainLines: string[],
 *   droppedLines: string[],
 *   meta: { version: string, repairs: string[] }
 * }}
 */
export function applyOcrCleanupPipeline(rawText, opts = {}) {
  const repairs = [];
  const contextBlob = String(rawText || '').slice(0, 8000);

  const base = cleanupOcrText(rawText);
  const uncertain = [...(base.uncertainLines || [])];
  const dropped = [...(base.droppedLines || [])];
  const processed = [];

  for (const line of base.text.split('\n')) {
    const trimmed = String(line || '').trim();
    if (!trimmed) continue;

    let current = repairFusedYearRangesInLine(trimmed);
    if (current !== trimmed) repairs.push('fused_year');

    current = repairContextualOcrWords(current, contextBlob);
    current = repairOcrTyposInLine(current);
    current = normalizeSectionHeaderLine(current);

    if (isIsolatedSymbolLine(current)) {
      dropped.push(trimmed);
      continue;
    }

    if (isOcrNoiseLine(current)) {
      if (current.length >= 6 && /[A-Za-zÀ-ÿ]{3,}/.test(current)) {
        uncertain.push(current);
      } else {
        dropped.push(trimmed);
      }
      continue;
    }

    processed.push(current);
  }

  const deduped = dedupeLines(processed);
  const uncertainUnique = dedupeLines(uncertain);

  return {
    text: deduped.join('\n').trim(),
    uncertainLines: uncertainUnique,
    droppedLines: dropped,
    meta: {
      version: OCR_CLEANUP_PIPELINE_VERSION,
      repairs: [...new Set(repairs)],
      ocr: opts.ocr !== false,
    },
  };
}

/**
 * Filter garbage from education lines — no invented schools.
 * @param {string} line
 */
export function isEducationGarbageLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 3) return true;
  if (isIsolatedSymbolLine(l) || isOcrNoiseLine(l)) return true;
  if (GARBAGE_EDUCATION_RE.test(l)) return true;
  if (/^[\W\d\s]{1,8}$/.test(l)) return true;
  return false;
}

/**
 * Dedupe education entries by degree + school fingerprint.
 * @param {Array<{ degree?: string, school?: string, dates?: string, bullets?: string[] }>} entries
 */
export function dedupeEducationEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries || []) {
    const degree = String(entry?.degree || '').trim();
    const school = String(entry?.school || '').trim();
    const dates = String(entry?.dates || '').trim();
    const key = `${degree.toLowerCase()}|${school.toLowerCase()}|${dates}`;
    if (!degree && !school) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}
