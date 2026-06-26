/**
 * BEST_TEXT_SOURCE_SELECTION — score native / OCR / DOCX / paste and pick the best.
 * Never merges bad OCR into good native unless merge improves composite score.
 */

import { isImpossibleOcrTokenString } from '../parsing/clean.js';
import { isRandomOcrSymbolLine, OCR_SYMBOL_RE } from '../../data/dictionaries/garbagePatterns.js';
import { normalizeCompareString } from '../parsing/dedupe-engine.js';
import { linesToPlainText, normalizeLineKey } from './extracted-line.js';

export const BEST_TEXT_SOURCE_VERSION = 'BEST_TEXT_SOURCE_SELECTION_V1';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const DATE_RE =
  /\b(?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|actuel|(?:19|20)\d{2})\b|\b(?:19|20)\d{2}\b/gi;
const SECTION_HEADER_RE =
  /^(profile|profil|summary|about|experience|expérience|experiences|education|formation|skills|compétences|competences|tools|languages|langues|clients|projects|portfolio|contact)\b[:\s]*$/im;

const WORD_RE = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function letterRatio(text) {
  const s = String(text || '');
  if (!s.length) return 0;
  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return letters / s.length;
}

/** Reject OCR lines that should never be merged into a good native base. */
function isRejectOcrMergeLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 3) return true;
  if (isImpossibleOcrTokenString(l)) return true;
  if (isRandomOcrSymbolLine(l)) return true;
  if (letterRatio(l) < 0.25 && l.length > 6) return true;
  if (/[A-Za-zÀ-ÿ][<>|\\/_]{1,2}[A-Za-zÀ-ÿ]?/.test(l)) return true;
  if (new RegExp(OCR_SYMBOL_RE.source).test(l) && letterRatio(l) < 0.55) return true;

  if (!EMAIL_RE.test(l)) {
    for (const token of l.split(/\s+/)) {
      if (/^(19|20)\d{2}(?:[–—-]|$)/.test(token)) continue;
      if (/[A-Za-zÀ-ÿ]/.test(token) && /[0-9@#]/.test(token) && !PHONE_RE.test(token)) return true;
    }
  }
  return false;
}

/**
 * @param {string} text
 */
export function measurePlausibleWordRatio(text) {
  const s = String(text || '');
  const words = s.match(WORD_RE) || [];
  if (!words.length) return 0;
  const plausible = words.filter((w) => w.length >= 2 && !/^[^aeiouyàâéèêëîïôùûüœæ]{4,}$/i.test(w));
  return plausible.length / words.length;
}

/**
 * @param {string} text
 */
export function measureGarbageRatio(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return 0;
  let garbage = 0;
  for (const line of lines) {
    if (isImpossibleOcrTokenString(line)) {
      garbage += 1;
      continue;
    }
    if (new RegExp(OCR_SYMBOL_RE.source).test(line) && letterRatio(line) < 0.45) {
      garbage += 1;
      continue;
    }
    if (letterRatio(line) < 0.25 && line.length > 6) garbage += 1;
  }
  return garbage / lines.length;
}

/**
 * @param {string} text
 */
export function measureDuplicateRatio(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => normSpace(l).toLowerCase())
    .filter((l) => l.length > 2);
  if (!lines.length) return 0;

  const lineDup = lines.length - new Set(lines).size;
  const words = String(text || '')
    .toLowerCase()
    .match(WORD_RE) || [];
  const wordCounts = new Map();
  for (const w of words) {
    if (w.length < 4) continue;
    wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  }
  const repeatedWords = [...wordCounts.values()].filter((c) => c > 2).length;
  const lineRatio = lineDup / lines.length;
  const wordRatio = words.length ? repeatedWords / words.length : 0;
  return Math.min(1, lineRatio * 0.7 + wordRatio * 0.3);
}

/**
 * @param {string} text
 * @param {'native'|'ocr'|'docx'|'pasted'|'merged'} sourceId
 */
export function scoreTextSource(text, sourceId = 'native') {
  const raw = String(text || '').trim();
  const length = raw.length;
  const plausibleWordRatio = measurePlausibleWordRatio(raw);
  const hasEmail = EMAIL_RE.test(raw);
  const hasPhone = PHONE_RE.test(raw);
  const dateMatches = raw.match(DATE_RE) || [];
  const dateCount = dateMatches.length;
  const sectionHeaderCount = (raw.match(SECTION_HEADER_RE) || []).length;
  const garbageRatio = measureGarbageRatio(raw);
  const duplicateRatio = measureDuplicateRatio(raw);

  const lengthScore = Math.min(100, Math.round((Math.log10(Math.max(length, 1)) / Math.log10(3500)) * 100));
  const wordScore = Math.round(plausibleWordRatio * 100);
  const signalBonus =
    (hasEmail ? 8 : 0) +
    (hasPhone ? 8 : 0) +
    Math.min(15, dateCount * 4) +
    Math.min(12, sectionHeaderCount * 4);
  const garbagePenalty = Math.round(garbageRatio * 35);
  const duplicatePenalty = Math.round(duplicateRatio * 22);

  let sourceBias = 0;
  if (sourceId === 'native') sourceBias = 4;
  if (sourceId === 'docx') sourceBias = 3;
  if (sourceId === 'pasted') sourceBias = 2;
  if (sourceId === 'ocr') sourceBias = -2;
  if (sourceId === 'merged') sourceBias = 0;

  const compositeScore = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        lengthScore * 0.18 +
          wordScore * 0.32 +
          signalBonus +
          sourceBias -
          garbagePenalty -
          duplicatePenalty
      )
    )
  );

  return {
    sourceId,
    length,
    plausibleWordRatio: Math.round(plausibleWordRatio * 1000) / 1000,
    hasEmail,
    hasPhone,
    dateCount,
    sectionHeaderCount,
    garbageRatio: Math.round(garbageRatio * 1000) / 1000,
    duplicateRatio: Math.round(duplicateRatio * 1000) / 1000,
    compositeScore,
    breakdown: {
      lengthScore,
      wordScore,
      signalBonus,
      garbagePenalty,
      duplicatePenalty,
      sourceBias,
    },
  };
}

/**
 * Conservative line merge — native base + OCR lines not already present.
 * @param {string} nativeText
 * @param {string} ocrText
 */
export function mergeTextSourcesConservative(nativeText, ocrText) {
  const native = String(nativeText || '').trim();
  const ocr = String(ocrText || '').trim();
  if (!native) return ocr;
  if (!ocr) return native;

  const nativeKeys = new Set(
    native
      .split('\n')
      .map((l) => normalizeCompareString(l))
      .filter(Boolean)
  );
  const ocrLines = ocr.split('\n').map((l) => l.trim()).filter(Boolean);
  const additions = ocrLines.filter((l) => {
    if (isRejectOcrMergeLine(l)) return false;
    const key = normalizeCompareString(l);
    return key.length > 2 && !nativeKeys.has(key);
  });
  if (!additions.length) return native;
  return `${native}\n${additions.join('\n')}`;
}

/**
 * @param {import('./extracted-line.js').ExtractedLine[]} nativeLines
 * @param {import('./extracted-line.js').ExtractedLine[]} ocrLines
 */
export function mergeLineArchivesConservative(nativeLines, ocrLines) {
  const native = nativeLines || [];
  const ocr = ocrLines || [];
  if (!native.length) return [...ocr];
  if (!ocr.length) return [...native];

  const nativeKeys = new Set(
    native.map((l) => normalizeLineKey(l.cleanedText ?? l.text ?? '')).filter(Boolean)
  );
  const out = [...native];
  for (const ln of ocr) {
    const text = String(ln.cleanedText ?? ln.text ?? '').trim();
    if (isRejectOcrMergeLine(text)) continue;
    const key = normalizeLineKey(text);
    if (!key || nativeKeys.has(key)) continue;
    nativeKeys.add(key);
    out.push(ln);
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} [opts.nativeText]
 * @param {string} [opts.ocrText]
 * @param {string} [opts.docxText]
 * @param {string} [opts.pastedText]
 * @param {import('./extracted-line.js').ExtractedLine[]} [opts.nativeLines]
 * @param {import('./extracted-line.js').ExtractedLine[]} [opts.ocrLines]
 */
export function selectBestTextSource(opts = {}) {
  const nativeText = String(opts.nativeText || '').trim();
  const ocrText = String(opts.ocrText || '').trim();
  const docxText = String(opts.docxText || '').trim();
  const pastedText = String(opts.pastedText || '').trim();

  /** @type {{ id: 'native'|'ocr'|'docx'|'pasted'|'merged', text: string }[]} */
  const singles = [
    { id: 'native', text: nativeText },
    { id: 'ocr', text: ocrText },
    { id: 'docx', text: docxText },
    { id: 'pasted', text: pastedText },
  ].filter((s) => s.text.length > 0);

  const scored = singles.map((s) => ({
    ...scoreTextSource(s.text, s.id),
    text: s.text,
    kind: 'single',
  }));

  const audit = {
    version: BEST_TEXT_SOURCE_VERSION,
    candidates: scored.map(({ sourceId, compositeScore, length, garbageRatio, duplicateRatio, breakdown }) => ({
      sourceId,
      compositeScore,
      length,
      garbageRatio,
      duplicateRatio,
      breakdown,
    })),
    mergeConsidered: false,
    mergeAccepted: false,
    mergeRejectedReason: null,
  };

  let mergeCandidate = null;
  if (nativeText && ocrText) {
    audit.mergeConsidered = true;
    const nativeScore = scored.find((s) => s.sourceId === 'native');
    const ocrScore = scored.find((s) => s.sourceId === 'ocr');
    const bestSingle = Math.max(
      nativeScore?.compositeScore || 0,
      ocrScore?.compositeScore || 0
    );

    const ocrTooBad =
      (ocrScore?.garbageRatio || 0) > 0.35 ||
      (ocrScore?.compositeScore || 0) < bestSingle * 0.55 ||
      (ocrScore?.plausibleWordRatio || 0) < 0.35;

    const mergedText = mergeTextSourcesConservative(nativeText, ocrText);
    const mergedLines = mergeLineArchivesConservative(opts.nativeLines, opts.ocrLines);
    const mergedFromLines = linesToPlainText(mergedLines);
    const finalMerged = mergedFromLines.length >= mergedText.length * 0.95 ? mergedFromLines : mergedText;
    const mergedScore = scoreTextSource(finalMerged, 'merged');

    const improves =
      mergedScore.compositeScore > bestSingle + 2 &&
      mergedScore.garbageRatio <= Math.min(nativeScore?.garbageRatio || 1, ocrScore?.garbageRatio || 1) + 0.08;

    if (!ocrTooBad && improves) {
      mergeCandidate = {
        ...mergedScore,
        text: finalMerged,
        lines: mergedLines,
        kind: 'merged',
      };
      audit.mergeAccepted = true;
    } else {
      audit.mergeRejectedReason = ocrTooBad
        ? 'ocr_quality_too_low'
        : 'merge_did_not_improve_score';
    }
  }

  const all = [...scored, mergeCandidate].filter(Boolean);
  all.sort(
    (a, b) =>
      b.compositeScore - a.compositeScore ||
      b.length - a.length ||
      (a.sourceId === 'native' ? 1 : 0) - (b.sourceId === 'native' ? 1 : 0)
  );

  const best = all[0] || {
    sourceId: 'native',
    text: nativeText || ocrText || docxText || pastedText || '',
    compositeScore: 0,
    kind: 'single',
  };

  return {
    selectedSource: best.sourceId,
    text: best.text,
    lines: best.lines,
    compositeScore: best.compositeScore,
    scores: Object.fromEntries(scored.map((s) => [s.sourceId, s])),
    mergedScore: mergeCandidate?.compositeScore ?? null,
    audit,
  };
}
