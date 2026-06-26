/**
 * TEXT_RECONSTRUCTION_ENGINE — smart line/paragraph merge without losing meaning.
 * Fixes duplicate dates, entity duplication, OCR glue, section bleed, parser labels.
 */

import { passesExperienceGate } from './section-sanity.js';
import { semanticSimilarityForDedup, normalizeCompareString } from './dedupe-engine.js';
import { isFinalCvPlaceholder } from '../validation/final-cv-placeholder-guard.js';

export const TEXT_RECONSTRUCTION_VERSION = 'TEXT_RECONSTRUCTION_ENGINE_V2';

const SECTION_NAMES =
  'profile|profil|summary|about|experience|expérience|experiences|education|formation|skills|compétences|competences|tools|languages|langues|clients|projects|portfolio|contact|interests|awards|publications|certifications|references';

const SECTION_HEADER_RE = new RegExp(`^(${SECTION_NAMES})\\b[:\\s]*$`, 'i');

const EMBEDDED_SECTION_RE = new RegExp(`^(${SECTION_NAMES})\\s+(.{2,})$`, 'i');

const BULLET_RE = /^[-•*▪◦]\s+/;
const DATE_FRAGMENT_END_RE = /[-–—]\s*$/;
const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|actuel|aujourd'?hui|(?:19|20)\d{2})\b/gi;
const YEAR_RE = /\b((?:19|20)\d{2})\b/g;
const LANGUAGE_LINE_RE =
  /\b(english|anglais|french|français|francais|dutch|german|spanish|italian|portuguese|mandarin|chinese)\b/i;
const FLUENCY_RE = /\b(native|courant|fluent|bilingual|bilingue|professional|professionnel|advanced|avancé)\b/i;
const CLIENT_LINE_RE =
  /\b(clients?|marques?|brands?)\s*[:—-]?\s*/i;
const TOOL_LINE_RE =
  /\b(photoshop|indesign|figma|after effects|premiere|blender|sketch|xd|tools?|software|logiciels?)\b/i;
const JOB_TITLE_RE =
  /\b(freelance|designer|director|manager|lead|senior|illustrator|developer|engineer|consultant)\b/i;
const EDUCATION_LINE_RE =
  /\b(bachelor|master|mba|bts|dut|licence|degree|diploma|école|ecole|school|university|université|lisaa|hec|créapole|creapole)\b/i;

const FAKE_SENTENCE_RE =
  /\b(contributed\s+as\s+at|as\s+at\s+present|fluent\s+analyse|analyse\s+fluent)\b/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function isSectionHeaderLine(line) {
  const l = normSpace(line);
  if (!l || l.length > 48) return false;
  return SECTION_HEADER_RE.test(l);
}

/**
 * Split "Experience McCann Paris" → ["Experience", "McCann Paris"].
 * @param {string} line
 */
export function splitEmbeddedSectionHeader(line) {
  const l = normSpace(line);
  if (!l) return [];
  const m = EMBEDDED_SECTION_RE.exec(l);
  if (!m) return [l];
  const header = m[1].trim();
  const body = m[2].trim();
  if (!body || isSectionHeaderLine(body)) return [l];
  return [header, body];
}

/**
 * @param {string} line
 */
export function stripParserLabelsFromLine(line) {
  let s = normSpace(line);
  if (!s) return '';
  if (isFinalCvPlaceholder(s)) return '';

  s = s.replace(
    /\b(company|entreprise|role|rôle|poste|nom|name|title|date)\s+à\s+confirmer\b/gi,
    ''
  );
  s = s.replace(/\bà\s+confirmer\b/gi, '');
  s = s.replace(/\bto\s+confirm\b/gi, '');
  return normSpace(s.replace(/\s*[-–—|·]\s*$/g, '').replace(/^\s*[-–—|·]\s*/g, ''));
}

/**
 * @param {string} line
 * @returns {'header'|'experience'|'education'|'skills'|'tools'|'clients'|'languages'|'content'}
 */
export function inferLineSection(line) {
  const l = normSpace(line);
  if (!l) return 'content';
  if (isSectionHeaderLine(l)) return 'header';
  const low = l.toLowerCase();
  if (/^(clients?|marques?|brands?)\b/.test(low) || CLIENT_LINE_RE.test(l)) return 'clients';
  if (/^(experience|expérience|experiences)\b/.test(low)) return 'experience';
  if (/^(tools?|software|logiciels?)\b/.test(low)) return 'tools';
  if (
    TOOL_LINE_RE.test(l) &&
    /[·,|]/.test(l) &&
    !lineHasDateRange(l) &&
    !passesExperienceGate(l)
  ) {
    return 'tools';
  }
  if (passesExperienceGate(l) || lineHasDateRange(l) || JOB_TITLE_RE.test(l)) return 'experience';
  if (/^(education|formation)\b/.test(low) || EDUCATION_LINE_RE.test(l)) return 'education';
  if (/^(skills?|compétences|competences)\b/.test(low)) return 'skills';
  if (/^(languages?|langues)\b/.test(low) || LANGUAGE_LINE_RE.test(l)) return 'languages';
  if (TOOL_LINE_RE.test(l) && !JOB_TITLE_RE.test(l)) return 'tools';
  return 'content';
}

function lineHasDateRange(line) {
  DATE_RANGE_RE.lastIndex = 0;
  return DATE_RANGE_RE.test(String(line || ''));
}

function isDateFragment(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (DATE_FRAGMENT_END_RE.test(l)) return true;
  if (/^\d{4}\s*[-–—]?\s*\d{0,4}$/.test(l)) return true;
  if (lineHasDateRange(l) && l.length <= 24) return true;
  return false;
}

function primaryDateRange(line) {
  DATE_RANGE_RE.lastIndex = 0;
  const m = DATE_RANGE_RE.exec(String(line || ''));
  if (!m) return '';
  const end = /present|présent|current|now|actuel/i.test(m[2]) ? 'Present' : m[2];
  return `${m[1]}–${end}`;
}

function isBulletLine(line) {
  return BULLET_RE.test(String(line || '').trim());
}

function startsContinuation(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (isBulletLine(l)) return false;
  if (isSectionHeaderLine(l)) return false;
  if (/^[a-zà-öø-ÿ(]/.test(l)) return true;
  if (/^\d{1,2}[,.)]/.test(l)) return true;
  return false;
}

function endsIncomplete(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (DATE_FRAGMENT_END_RE.test(l)) return true;
  if (/[,;:]$/.test(l)) return true;
  if (/\b(and|or|&|\/|—|-)$/i.test(l)) return true;
  return false;
}

function sectionsCompatible(prev, next) {
  const a = inferLineSection(prev);
  const b = inferLineSection(next);
  if (a === 'header' || b === 'header') return false;
  if (a === b) return true;
  if (a === 'content' || b === 'content') return true;
  return false;
}

/**
 * Whether two consecutive lines should merge (same semantic unit).
 * @param {string} prev
 * @param {string} next
 */
export function shouldMergeLines(prev, next) {
  const a = normSpace(prev);
  const b = normSpace(next);
  if (!a || !b) return false;

  if (isSectionHeaderLine(a) || isSectionHeaderLine(b)) return false;
  if (!sectionsCompatible(a, b)) return false;
  if (isBulletLine(a) !== isBulletLine(b)) return false;

  if (endsIncomplete(a)) return true;

  if (startsContinuation(b) && a.length < 120) return true;

  if (DATE_FRAGMENT_END_RE.test(a) && YEAR_RE.test(b)) return true;

  const aHasDate = lineHasDateRange(a);
  const bHasDate = lineHasDateRange(b);
  if (aHasDate && bHasDate) {
    const sim = semanticSimilarityForDedup(a, b);
    if (sim < 0.72) return false;
  }

  if (passesExperienceGate(a) && passesExperienceGate(b)) {
    const sim = semanticSimilarityForDedup(a, b);
    if (sim < 0.8) return false;
    if (a.length > 36 && b.length > 36) return false;
  }

  if (a.length > 48 && b.length > 48) {
    const sim = semanticSimilarityForDedup(a, b);
    if (sim < 0.85) return false;
  }

  if (LANGUAGE_LINE_RE.test(a) && !LANGUAGE_LINE_RE.test(b) && b.length <= 24) return false;

  if (isDateFragment(b) && !isSectionHeaderLine(a)) return true;

  return false;
}

/**
 * Join two lines without duplicating dates or entities.
 * @param {string} a
 * @param {string} b
 */
export function mergeTwoLines(a, b) {
  let left = normSpace(a);
  let right = normSpace(b);
  if (!left) return right;
  if (!right) return left;

  if (lineHasDateRange(right)) {
    const range = primaryDateRange(right) || right;
    const leftClean = left
      .replace(DATE_FRAGMENT_END_RE, '')
      .replace(/\s*\d{4}\s*[-–—]?\s*$/, '')
      .trim();
    const leftIsOnlyDate = !leftClean || /^\d{4}\s*[-–—]?\s*\d{0,4}$/.test(leftClean);
    if (leftIsOnlyDate) return range;
    return normSpace(`${leftClean} — ${range}`);
  }

  if (DATE_FRAGMENT_END_RE.test(left)) {
    left = left.replace(DATE_FRAGMENT_END_RE, '').trim();
  }

  if (isDateFragment(right) && YEAR_RE.test(right)) {
    return normSpace(`${left} ${right}`.replace(/\s+/g, ' '));
  }

  const joiner = /[-–—]$/.test(left) || /^[-–—]/.test(right) ? '' : ' ';
  return normSpace(`${left}${joiner}${right}`);
}

/**
 * Collapse duplicate / impossible date ranges in a line.
 * @param {string} line
 */
export function normalizeReconstructedDates(line) {
  let s = normSpace(line);
  if (!s) return s;

  s = s.replace(/\b((?:19|20)\d{2})-((?:19|20)\d{2})\b/g, (full, a, b) => (a === b ? a : `${a}–${b}`));

  s = s.replace(/\b((?:19|20)\d{2})\s*[-–—]\s+\1(?:\s*[-–—]\s*\1)+\b/gi, '$1');

  s = s.replace(
    /(\b(?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|actuel|(?:19|20)\d{2})\b)(?:\s*[-–—|·]\s*\1)+/gi,
    '$1'
  );

  s = s.replace(/\b((?:19|20)\d{2})\s*[-–—]\s*\1\b/gi, '$1');

  s = s.replace(/\b((?:19|20)\d{2})\s*[-–—]\s+(?=(?:19|20)\d{2}\s*[-–—])/g, '');

  s = s.replace(/\b((?:19|20)\d{2})\s+\1\s*[-–—]\s*((?:19|20)\d{2})\b/gi, '$1–$2');

  s = s.replace(/\b(\d{4})\s*-\s*\1-(\d{4})\b/gi, '$1–$2');

  DATE_RANGE_RE.lastIndex = 0;
  const ranges = [...s.matchAll(DATE_RANGE_RE)];
  if (ranges.length >= 2) {
    const key = (m) => `${m[1]}|${String(m[2]).toLowerCase()}`;
    const first = key(ranges[0]);
    if (ranges.every((m) => key(m) === first)) {
      let seen = 0;
      DATE_RANGE_RE.lastIndex = 0;
      s = s.replace(DATE_RANGE_RE, (hit) => {
        seen += 1;
        return seen === 1 ? hit : '';
      });
      s = normSpace(s.replace(/\s*[-–—|·]\s*(?=[-–—|·])/g, ' '));
    }
  }

  return normSpace(s);
}

/**
 * Remove repeated entity segments (company/role duplicates).
 * @param {string} line
 */
export function dedupeEntitySegmentsInLine(line) {
  const parts = String(line || '')
    .split(/\s*[-–—|·]\s*/)
    .map((p) => stripParserLabelsFromLine(p))
    .filter(Boolean);
  if (parts.length < 2) return normSpace(parts[0] || stripParserLabelsFromLine(line));

  const seen = new Set();
  const kept = [];
  for (const part of parts) {
    const key = normalizeCompareString(part);
    if (!key || key.length < 2) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(part);
  }
  return kept.length ? kept.join(' — ') : normSpace(stripParserLabelsFromLine(line));
}

/**
 * Repair known OCR / merge glitches.
 * @param {string} line
 */
export function repairReconstructionGlitches(line) {
  let s = normSpace(stripParserLabelsFromLine(line));
  if (!s) return s;

  s = s.replace(/\bContributed\s+as\s+at\b/gi, 'Contributed at');
  s = s.replace(/\bas\s+at\s+(Present|Présent)\b/gi, 'at $1');
  s = s.replace(/\bFluent\s+analyse\b/gi, 'Fluent');
  s = s.replace(/\b(native|courant|fluent|bilingual)\s+analyse\b/gi, '$1');
  s = s.replace(/\b(analyse|analysis)\s+(native|courant|fluent)\b/gi, '$2');

  if (LANGUAGE_LINE_RE.test(s) && FLUENCY_RE.test(s)) {
    s = s.replace(/\s+analyse\b/gi, '');
  }

  s = s.replace(/\b(Experience|Education|Skills|Clients|Tools)\s+\1\b/gi, '$1');

  return normSpace(s);
}

/**
 * Reject lines that look like invented parser artifacts.
 * @param {string} line
 */
export function isFakeReconstructedSentence(line) {
  const s = normSpace(line);
  if (!s) return true;
  if (isFinalCvPlaceholder(s)) return true;
  if (FAKE_SENTENCE_RE.test(s)) return true;
  if (/^company\s+à\s+confirmer$/i.test(s)) return true;
  if (/\b((?:19|20)\d{2})\s*[-–—]\s*\1\b/i.test(s)) return true;
  return false;
}

/**
 * Full line normalization after merge.
 * @param {string} line
 */
export function normalizeReconstructedLine(line) {
  let s = normSpace(line);
  s = dedupeEntitySegmentsInLine(s);
  s = normalizeReconstructedDates(s);
  s = repairReconstructionGlitches(s);
  if (isFakeReconstructedSentence(s)) return '';
  return s;
}

/**
 * Isolate section headers; split embedded labels from content.
 * @param {string[]} lines
 */
export function preserveSectionBoundaries(lines = []) {
  const out = [];
  for (const raw of lines || []) {
    const parts = splitEmbeddedSectionHeader(raw);
    for (const part of parts) {
      const cleaned = normSpace(part);
      if (cleaned) out.push(cleaned);
    }
  }
  return out;
}

/**
 * Merge consecutive lines that belong to the same unit.
 * @param {string[]} lines
 */
export function smartLineMerge(lines = []) {
  const prepared = preserveSectionBoundaries(lines);
  const out = [];
  const list = prepared.map((l) => normSpace(l)).filter(Boolean);

  for (let i = 0; i < list.length; i++) {
    let current = list[i];
    while (i + 1 < list.length && shouldMergeLines(current, list[i + 1])) {
      i += 1;
      current = mergeTwoLines(current, list[i]);
    }
    let normalized = normalizeReconstructedLine(current);
    if (
      normalized &&
      i + 1 < list.length &&
      shouldMergeLines(normalized, list[i + 1])
    ) {
      i += 1;
      normalized = normalizeReconstructedLine(mergeTwoLines(normalized, list[i]));
    }
    if (normalized) out.push(normalized);
  }
  return out;
}

/**
 * Whether two paragraph blocks should merge.
 * @param {string} prev
 * @param {string} next
 */
export function shouldMergeParagraphs(prev, next) {
  const a = normSpace(prev);
  const b = normSpace(next);
  if (!a || !b) return false;
  if (isSectionHeaderLine(a) || isSectionHeaderLine(b)) return false;

  const aLines = a.split('\n').filter(Boolean);
  const bLines = b.split('\n').filter(Boolean);
  if (!aLines.length || !bLines.length) return false;

  const lastA = aLines[aLines.length - 1];
  const firstB = bLines[0];

  if (!sectionsCompatible(lastA, firstB)) return false;
  if (endsIncomplete(lastA)) return true;
  if (startsContinuation(firstB) && aLines.length <= 3) return true;
  if (DATE_FRAGMENT_END_RE.test(lastA) && YEAR_RE.test(firstB)) return true;

  return false;
}

/**
 * Merge paragraph blocks; re-run smart line merge inside each block.
 * @param {string} text
 */
export function smartParagraphMerge(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const paras = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const merged = [];

  for (let i = 0; i < paras.length; i++) {
    let block = paras[i];
    while (i + 1 < paras.length && shouldMergeParagraphs(block, paras[i + 1])) {
      i += 1;
      block = `${block}\n${paras[i]}`;
    }
    const lines = smartLineMerge(block.split('\n').map((l) => l.trim()).filter(Boolean));
    if (lines.length) merged.push(lines.join('\n'));
  }

  return merged.join('\n\n');
}

/**
 * End-to-end text reconstruction for parser input.
 * @param {string} text
 */
export function reconstructExtractedText(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  return smartParagraphMerge(raw);
}

/**
 * Apply reconstruction to extracted line archive.
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 */
export function reconstructExtractedLines(lines = []) {
  if (!lines?.length) return [];

  const byPage = new Map();
  for (const ln of lines) {
    const page = ln.page || ln.page_number || 1;
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page).push(ln);
  }

  const out = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageLines = byPage.get(page) || [];
    const texts = pageLines.map((ln) =>
      normSpace(ln.cleanedText ?? ln.text ?? ln.rawExtraction ?? '')
    );
    const merged = smartLineMerge(texts);
    merged.forEach((text, i) => {
      const src = pageLines[Math.min(i, pageLines.length - 1)] || {};
      out.push({
        ...src,
        page,
        text,
        cleanedText: text,
        rawExtraction: src.rawExtraction ?? text,
      });
    });
  }
  return out;
}
