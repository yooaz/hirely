/**
 * BLOCK_BUILDER_V1 — OCR ordered lines → DocumentBlock[] before any field parsing.
 *
 * Input: OCR lines with order + text (string[], plain text, or ExtractedLine[]).
 * Output: DocumentBlock[] with signals (type starts as "unknown").
 */

import { isSectionHeaderLine } from './rich-parser.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import { isExperienceEntryStartLine } from './experience-split-parser.js';
import { hasEducationSchool } from './education-confidence.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { mergeFragmentedOcrLines } from './ocr-experience-merge.js';
import { isSpatialBlockArray, spatialBlocksToOcrLineInput } from '../layout/spatial-block.js';
import {
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
  SCHOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';

export const BLOCK_BUILDER_V1 = 'BLOCK_BUILDER_V1';

const DATE_ONLY_LINE_RE =
  /^\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)?\s*$/i;
const YEAR_TOKEN_RE = /^\s*((?:19|20)\d{2})\s*$/;

const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i;
const BULLET_RE = /^[-•*]\s+/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\.|\b(linkedin|behance|dribbble|portfolio)\b/i;
const ROLE_RE =
  /\b(designer|illustrator|director|manager|engineer|developer|consultant|analyst|intern|freelance|lead|senior|junior|graphiste)\b/i;
const SKILL_RE =
  /\b(python|javascript|sql|figma|photoshop|illustrator|indesign|leadership|branding|typography|agile|research)\b/i;
const COMPANY_LIKE_RE =
  /\b(inc\.?|ltd\.?|gmbh|llc|corp|agency|agence|studio|studios|group|paris|london|freelance)\b/i;

/**
 * @typedef {object} BlockBuilderLine
 * @property {string} text
 * @property {number} page
 * @property {number} lineIndex
 */

/**
 * @param {string|string[]|object[]} input
 * @returns {BlockBuilderLine[]}
 */
export function normalizeOcrLineInput(input) {
  if (!input) return [];
  if (isSpatialBlockArray(input)) {
    return spatialBlocksToOcrLineInput(input);
  }
  if (typeof input === 'string') {
    return String(input)
      .split(/\r?\n/)
      .map((text, i) => ({ text: text.trim(), lineIndex: i, page: 1 }))
      .filter((l) => l.text.length > 0);
  }
  if (!Array.isArray(input)) return [];
  return input
    .map((item, i) => {
      if (typeof item === 'string') {
        return { text: item.trim(), lineIndex: i, page: 1 };
      }
      const text = String(item?.text ?? item?.cleanedText ?? '').trim();
      return {
        text,
        page: Number(item?.page ?? 1) || 1,
        lineIndex: Number(item?.lineIndex ?? item?.line ?? i) || i,
      };
    })
    .filter((l) => l.text.length > 0);
}

function isHardBoundaryLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (fuzzySectionKey(l)) return true;
  if (isSectionHeaderLine(l)) return true;
  return false;
}

/**
 * @param {string} line
 */
export function isDateAnchorLine(line) {
  return isExperienceEntryStartLine(line);
}

/**
 * Merge wrapped role/title lines (e.g. "Graphic" + "Designer").
 * @param {string[]} lines
 */
export function mergeRoleContinuationLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    while (i + 1 < lines.length && shouldMergeContinuation(cur, lines[i + 1])) {
      cur = `${cur} ${lines[i + 1]}`.replace(/\s+/g, ' ').trim();
      i++;
    }
    out.push(cur);
  }
  return out;
}

function mergeBrokenLinesUntilBoundary(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    if (isHardBoundaryLine(cur) || isDateAnchorLine(cur)) {
      out.push(cur);
      continue;
    }
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (isHardBoundaryLine(next) || isDateAnchorLine(next)) break;
      if (shouldMergeContinuation(cur, next)) {
        cur = `${cur} ${next}`.replace(/\s+/g, ' ').trim();
        i++;
      } else break;
    }
    out.push(cur);
  }
  return out;
}

function shouldMergeContinuation(cur, next) {
  const c = String(cur || '').trim();
  const n = String(next || '').trim();
  if (!c || !n) return false;
  if (isHardBoundaryLine(n) || isDateAnchorLine(n)) return false;
  if (BULLET_RE.test(n)) return false;
  if (EMAIL_RE.test(n) || PHONE_RE.test(n)) return false;
  if (/\b(19|20)\d{2}\b/.test(n) && n.length < 48) return false;
  const nextWords = n.split(/\s+/).filter(Boolean);
  if (nextWords.length > 6 || n.length > 72) return false;
  if (/\b(graphic|and|\/|&)\s*$/i.test(c)) return true;
  if (!/[.!?;:]$/.test(c) && /^[a-zà-ö]/.test(n)) return true;
  if (c.length < 48 && nextWords.length <= 4 && !/[.!?]$/.test(c)) return true;
  return false;
}

function explodeDatePrefixedLines(lines) {
  const out = [];
  for (const raw of lines) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const m = line.match(
      /^((?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel))\s+(.+)$/i
    );
    if (m) {
      out.push(m[1].trim());
      const tail = m[2].trim();
      const freelanceSplit = tail.match(/^(.+?)\s+(Independent\s*\/\s*Freelance)$/i);
      if (freelanceSplit) {
        out.push(freelanceSplit[1].trim(), freelanceSplit[2].trim());
      } else {
        out.push(tail);
      }
      continue;
    }
    out.push(line);
  }
  return out;
}

function isContactLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (DATE_ONLY_LINE_RE.test(l)) return false;
  if (DATE_RANGE_RE.test(l) && l.length < 28) return false;
  return EMAIL_RE.test(l) || PHONE_RE.test(l) || URL_RE.test(l);
}

function isClientListLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 6) return false;
  const commas = (l.match(/,/g) || []).length;
  if (commas >= 2 && findLongestDictionaryTerm(l, CLIENT_TERMS)) return true;
  if (commas >= 3 && l.length < 160) return true;
  return false;
}

function isSkillOrToolBlob(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 4) return false;
  const commas = (l.match(/[,;|·•]/g) || []).length;
  if (commas >= 2 && (SKILL_RE.test(l) || findLongestDictionaryTerm(l, TOOL_TERMS))) return true;
  if (commas >= 3 && l.length < 200 && l.split(/\s+/).length <= 24) return true;
  return false;
}

function isEducationLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  return hasEducationSchool(l) || !!findLongestDictionaryTerm(l, SCHOOL_TERMS) || /\b(bachelor|master|mba|phd|degree|bsc|msc)\b/i.test(l);
}

function shouldAttachToDateBlock(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 140) return false;
  if (isHardBoundaryLine(l) || isDateAnchorLine(l)) return false;
  if (isContactLine(l) || isClientListLine(l)) return false;
  if (isSkillOrToolBlob(l) && !ROLE_RE.test(l)) return false;
  if (BULLET_RE.test(l)) return true;
  if (ROLE_RE.test(l) || lineLooksLikeRole(l) || COMPANY_LIKE_RE.test(l)) return true;
  return l.length < 90;
}

function shouldAttachToEducationBlock(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (isHardBoundaryLine(l)) return false;
  if (isEducationLine(l)) return true;
  if (DATE_RANGE_RE.test(l) || /\b(19|20)\d{2}\b/.test(l)) return true;
  return l.length < 100 && !isSkillOrToolBlob(l);
}

function sectionHintFromHeader(line) {
  return fuzzySectionKey(line) || null;
}

/**
 * @param {string[]} lines
 * @param {BlockBuilderLine[]} sourceLines
 */
function groupLinesIntoBlocks(lines, sourceLines) {
  /** @type {object[]} */
  const groups = [];
  let bucket = [];
  let bucketStart = 0;
  let bucketAnchor = 'continuation';
  let sectionHint = null;

  const lineMeta = (idx) => sourceLines[idx] || { page: 1, lineIndex: idx };

  const flushBucket = (endIdx) => {
    if (!bucket.length) return;
    groups.push({
      lines: [...bucket],
      startLine: bucketStart,
      endLine: endIdx,
      anchor: bucketAnchor,
      sectionHint,
      page: lineMeta(bucketStart).page,
    });
    bucket = [];
    bucketAnchor = 'continuation';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isHardBoundaryLine(line)) {
      flushBucket(i - 1);
      sectionHint = sectionHintFromHeader(line);
      groups.push({
        lines: [line],
        startLine: i,
        endLine: i,
        anchor: 'header',
        sectionHint,
        page: lineMeta(i).page,
      });
      continue;
    }

    if (isContactLine(line)) {
      flushBucket(i - 1);
      bucket = [line];
      bucketStart = i;
      bucketAnchor = 'contact';
      while (i + 1 < lines.length && isContactLine(lines[i + 1])) {
        bucket.push(lines[++i]);
      }
      flushBucket(i);
      continue;
    }

    if (isDateAnchorLine(line)) {
      flushBucket(i - 1);
      bucket = [line];
      bucketStart = i;
      bucketAnchor = sectionHint === 'education' ? 'education_date' : 'date';
      let attached = 0;
      while (i + 1 < lines.length && attached < 5) {
        const next = lines[i + 1];
        const attachFn =
          sectionHint === 'education' ? shouldAttachToEducationBlock : shouldAttachToDateBlock;
        if (!attachFn(next)) break;
        bucket.push(next);
        i++;
        attached++;
      }
      flushBucket(i);
      continue;
    }

    if (isClientListLine(line) || (sectionHint === 'clients' && line.includes(','))) {
      flushBucket(i - 1);
      bucket = [line];
      bucketStart = i;
      bucketAnchor = 'clients';
      while (i + 1 < lines.length && (isClientListLine(lines[i + 1]) || lines[i + 1].includes(','))) {
        bucket.push(lines[++i]);
      }
      flushBucket(i);
      continue;
    }

    if (
      isSkillOrToolBlob(line) ||
      sectionHint === 'skills' ||
      sectionHint === 'tools' ||
      sectionHint === 'languages'
    ) {
      if (isSkillOrToolBlob(line) || sectionHint === 'skills' || sectionHint === 'tools') {
        flushBucket(i - 1);
        bucket = [line];
        bucketStart = i;
        bucketAnchor = 'skills';
        while (
          i + 1 < lines.length &&
          (isSkillOrToolBlob(lines[i + 1]) ||
            (sectionHint === 'skills' && !isHardBoundaryLine(lines[i + 1]) && !isDateAnchorLine(lines[i + 1])))
        ) {
          bucket.push(lines[++i]);
        }
        flushBucket(i);
        continue;
      }
    }

    if (sectionHint === 'education' && (isEducationLine(line) || DATE_RANGE_RE.test(line))) {
      flushBucket(i - 1);
      bucket = [line];
      bucketStart = i;
      bucketAnchor = 'education';
      while (i + 1 < lines.length && shouldAttachToEducationBlock(lines[i + 1])) {
        bucket.push(lines[++i]);
      }
      flushBucket(i);
      continue;
    }

    if (BULLET_RE.test(line) && groups.length) {
      const prev = groups[groups.length - 1];
      prev.lines.push(line);
      prev.endLine = i;
      prev.text = prev.lines.join('\n');
      continue;
    }

    if (!bucket.length) {
      bucketStart = i;
      bucketAnchor = 'continuation';
    }
    bucket.push(line);

    const next = lines[i + 1];
    if (next && (isHardBoundaryLine(next) || isDateAnchorLine(next) || isContactLine(next))) {
      flushBucket(i);
    }
  }
  flushBucket(lines.length - 1);
  return groups;
}

/**
 * @param {string} text
 * @param {string[]} lines
 */
export function computeBlockSignals(text, lines = []) {
  const hay = `${String(text || '')}\n${(lines || []).join('\n')}`.trim();
  return {
    hasDate: DATE_RANGE_RE.test(hay) || /\b(19|20)\d{2}\b/.test(hay),
    hasEmail: EMAIL_RE.test(hay),
    hasPhone: PHONE_RE.test(hay),
    hasUrl: URL_RE.test(hay),
    hasRole: ROLE_RE.test(hay) || lineLooksLikeRole(hay),
    hasSchool: hasEducationSchool(hay) || !!findLongestDictionaryTerm(hay, SCHOOL_TERMS),
    hasCompanyLikeText: COMPANY_LIKE_RE.test(hay) || !!findLongestDictionaryTerm(hay, CLIENT_TERMS),
    hasSkillKeywords: SKILL_RE.test(hay) || !!findLongestDictionaryTerm(hay, TOOL_TERMS),
  };
}

/**
 * @param {object} group
 * @param {number} index
 * @param {object} [opts]
 */
function toDocumentBlock(group, index, opts = {}) {
  const lines = group.lines || [];
  const text = lines.join('\n').trim();
  const signals = computeBlockSignals(text, lines);
  return {
    id: `docblk-${index}`,
    page: group.page ?? opts.page ?? 1,
    startLine: group.startLine ?? index,
    endLine: group.endLine ?? index,
    text,
    lines,
    type: 'unknown',
    anchor: group.anchor || 'continuation',
    sectionHint: group.sectionHint || null,
    signals,
    source: opts.source || 'ocr',
    confidence: opts.confidence ?? 75,
  };
}

/**
 * @param {string|string[]|object[]} input
 * @param {object} [opts]
 */
export function buildDocumentBlocksFromOcrLines(input, opts = {}) {
  const sourceLines = normalizeOcrLineInput(input);
  let texts = sourceLines.map((l) => l.text);
  const rawLineCount = texts.length;

  if (opts.ocr || texts.some((t) => /\b20[MN]\b|GRADRIC|a>\s*n/i.test(t))) {
    texts = mergeFragmentedOcrLines(texts);
  }
  texts = mergeBrokenLinesUntilBoundary(texts);
  texts = mergeRoleContinuationLines(texts);
  texts = explodeDatePrefixedLines(texts);

  const metaByIndex = sourceLines.map((l, i) => ({
    page: l.page,
    lineIndex: l.lineIndex ?? i,
  }));

  const groups = groupLinesIntoBlocks(texts, metaByIndex);
  const documentBlocks = groups.map((g, i) => toDocumentBlock(g, i, opts));

  logBlockBuilderAudit(documentBlocks, {
    rawLineCount,
    mergedLineCount: texts.length,
  });

  return {
    engine: BLOCK_BUILDER_V1,
    documentBlocks,
    lines: texts,
    stats: {
      rawLineCount,
      mergedLineCount: texts.length,
      blockCount: documentBlocks.length,
    },
  };
}

/**
 * @param {object[]} documentBlocks
 * @param {object} [stats]
 */
export function logBlockBuilderAudit(documentBlocks, stats = {}) {
  const blocks = documentBlocks || [];
  hirelyDebugLog('BLOCKS_CREATED', {
    count: blocks.length,
    rawLines: stats.rawLineCount ?? null,
    mergedLines: stats.mergedLineCount ?? null,
    anchors: blocks.reduce((acc, b) => {
      const k = b.anchor || 'continuation';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  });
  hirelyDebugLog(
    'BLOCK_TEXT_SAMPLE',
    blocks.slice(0, 10).map((b) => ({
      id: b.id,
      lines: b.lines?.length ?? 0,
      text: String(b.text || '').slice(0, 88),
    }))
  );
  hirelyDebugLog(
    'BLOCK_SIGNALS',
    blocks.slice(0, 12).map((b) => ({
      id: b.id,
      type: b.type,
      signals: b.signals,
    }))
  );
}

export { buildDocumentBlocksFromOcrLines as buildBlocksV1 };
