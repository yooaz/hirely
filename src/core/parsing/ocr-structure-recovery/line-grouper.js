/**
 * OCR line grouping — spacing, continuation, company/role/year stacks.
 */

import {
  preserveSectionBoundaries,
  shouldMergeLines,
  mergeTwoLines,
  isSectionHeaderLine,
  inferLineSection,
} from '../text-reconstruction.js';
import { splitMergedSectionHeaders } from '../ocr-hardening.js';
import { lineHasYearAnchor, isYearOnlyLine } from './year-cluster.js';

const ROLE_LINE_RE =
  /\b(freelance|illustrator|designer|director|manager|lead|senior|developer|engineer|consultant|pm|product)\b/i;
const COMPANY_LINE_RE =
  /^[A-ZÀ-Ö][\w&.'\- ]{1,48}$/;

/**
 * @param {import('../../extraction/extracted-line.js').ExtractedLine[]} [positionedLines]
 */
function spacingBreakBefore(line, prevLine, positionedLines, lineIndex) {
  if (!prevLine) return false;
  const positioned = positionedLines?.[lineIndex];
  const prevPos = positionedLines?.[lineIndex - 1];
  if (
    positioned &&
    prevPos &&
    Number.isFinite(positioned.y) &&
    Number.isFinite(prevPos.y)
  ) {
    const gap = Math.abs(Number(prevPos.y) - Number(positioned.y));
    if (gap >= 22) return true;
  }
  return false;
}

/**
 * @param {string} line
 */
function isLikelyCompanyLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 64) return false;
  if (isSectionHeaderLine(l)) return false;
  if (lineHasYearAnchor(l)) return false;
  if (ROLE_LINE_RE.test(l) && l.split(/\s+/).length >= 3) return false;
  return COMPANY_LINE_RE.test(l) || /^[A-Z][\w&.'\-]+(?:\s+[A-Z][\w&.'\-]+){0,3}$/.test(l);
}

/**
 * @param {string} line
 */
function isLikelyRoleLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 90) return false;
  if (isSectionHeaderLine(l)) return false;
  return ROLE_LINE_RE.test(l);
}

/**
 * Group raw OCR lines into logical records (company + role + years).
 * @param {string[]} rawLines
 * @param {object} [opts]
 */
export function groupOcrLines(rawLines = [], opts = {}) {
  const positioned = opts.extractionLines || opts.lines || [];
  const expanded = [];
  for (const raw of rawLines || []) {
    const parts = splitMergedSectionHeaders(String(raw || '').trim());
    for (const part of parts.length ? parts : [raw]) {
      const cleaned = String(part || '').trim();
      if (cleaned) expanded.push(cleaned);
    }
  }
  const lines = preserveSectionBoundaries(expanded);

  /** @type {{ lines: string[], sectionHint: string|null, kind: string }[]} */
  const groups = [];
  let buffer = [];
  let activeSection = null;

  const flush = (kind = 'content') => {
    if (!buffer.length) return;
    groups.push({
      lines: [...buffer],
      sectionHint: activeSection,
      kind,
    });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (isSectionHeaderLine(line)) {
      flush('content');
      groups.push({ lines: [line], sectionHint: null, kind: 'header' });
      const headerSection = String(line).toLowerCase();
      if (/experience|expérience|work experience|professional experience/.test(headerSection)) {
        activeSection = 'experience';
      } else if (/education|formation/.test(headerSection)) {
        activeSection = 'education';
      } else if (/skills?|compétences/.test(headerSection)) {
        activeSection = 'skills';
      } else if (/tools?|software|outils/.test(headerSection)) {
        activeSection = 'tools';
      } else if (/languages?|langues/.test(headerSection)) {
        activeSection = 'languages';
      } else if (/clients?/.test(headerSection)) {
        activeSection = 'clients';
      } else if (/profile|summary|about|profil/.test(headerSection) && !/experience/.test(headerSection)) {
        activeSection = 'profile';
      } else {
        activeSection = null;
      }
      continue;
    }

    if (spacingBreakBefore(line, lines[i - 1], positioned, i) && buffer.length) {
      flush('content');
    }

    if (isYearOnlyLine(line) && buffer.length) {
      buffer.push(line);
      flush('experience-stack');
      continue;
    }

    if (
      buffer.length &&
      isLikelyCompanyLine(line) &&
      buffer.some((b) => isLikelyRoleLine(b) || lineHasYearAnchor(b))
    ) {
      flush('experience-stack');
    }

    if (
      buffer.length &&
      isLikelyCompanyLine(line) &&
      !buffer.some((b) => isLikelyCompanyLine(b))
    ) {
      flush('experience-stack');
    }

    if (buffer.length && shouldMergeLines(buffer[buffer.length - 1], line)) {
      buffer[buffer.length - 1] = mergeTwoLines(buffer[buffer.length - 1], line);
      continue;
    }

    buffer.push(line);
  }
  flush('content');

  return groups;
}
