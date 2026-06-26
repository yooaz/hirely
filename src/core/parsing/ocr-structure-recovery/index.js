/**
 * OCR_STRUCTURE_RECOVERY — rebuild CV sections from noisy OCR (never trust stream order).
 *
 * Signals: year clustering · spacing · line grouping · semantic grouping
 */

import { looksLikeOcrText } from '../ocr-postprocess.js';
import { groupOcrLines } from './line-grouper.js';
import { bucketGroupsBySection } from './semantic-grouper.js';
import { rebuildSectionsText, extractPreambleLines } from './section-rebuilder.js';
import { sortExperienceGroupsByYear } from './year-cluster.js';

export const OCR_STRUCTURE_RECOVERY = 'OCR_STRUCTURE_RECOVERY_V1';
export const OCR_EXPERIENCE_RECALL_GOAL = 0.85;

export {
  extractYearsFromLine,
  lineHasYearAnchor,
  isYearOnlyLine,
  yearClusterSortKey,
  sortExperienceGroupsByYear,
} from './year-cluster.js';
export { groupOcrLines } from './line-grouper.js';
export { inferGroupSection, bucketGroupsBySection, SECTION_ORDER } from './semantic-grouper.js';
export { rebuildSectionsText, extractPreambleLines } from './section-rebuilder.js';

/**
 * @param {string} text
 * @param {object} [opts]
 */
export function shouldRunOcrStructureRecovery(text, opts = {}) {
  if (opts.force === true) return true;
  if (opts.force === false) return false;
  const method = String(opts.extractionMethod || '').toLowerCase();
  if (/ocr|pdf_scanned|pdf-ocr|pdf_mixed/.test(method)) return true;
  const raw = String(opts.rawText || text || '');
  return looksLikeOcrText(text) || looksLikeOcrText(raw);
}

/**
 * Rebuild structured text from OCR — detect sections without trusting line order.
 *
 * @param {string} text — post-processed OCR text
 * @param {object} [opts]
 * @returns {{
 *   applied: boolean,
 *   engine: string,
 *   text: string,
 *   lines: string[],
 *   buckets: Record<string, { lines: string[] }[]>,
 *   groups: object[],
 *   stats: object,
 * }}
 */
export function runOcrStructureRecovery(text, opts = {}) {
  const input = String(text || '').trim();
  if (!input) {
    return {
      applied: false,
      engine: OCR_STRUCTURE_RECOVERY,
      text: '',
      lines: [],
      buckets: {},
      groups: [],
      stats: { reason: 'empty' },
    };
  }

  if (!shouldRunOcrStructureRecovery(input, opts)) {
    return {
      applied: false,
      engine: OCR_STRUCTURE_RECOVERY,
      text: input,
      lines: input.split('\n').map((l) => l.trim()).filter(Boolean),
      buckets: {},
      groups: [],
      stats: { reason: 'not_ocr' },
    };
  }

  const rawLines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const preamble = extractPreambleLines(rawLines);
  const bodyLines = rawLines.slice(preamble.length);

  const groups = groupOcrLines(bodyLines.length ? bodyLines : rawLines, {
    extractionLines: opts.extractionLines || opts.lines,
  });

  const experienceStacks = sortExperienceGroupsByYear(groups.filter((g) => g.kind === 'experience-stack'));
  const nonExperience = groups.filter((g) => g.kind !== 'experience-stack');
  const orderedGroups = [...nonExperience];
  const headerIdx = orderedGroups.findIndex(
    (g) => g.kind === 'header' && /experience|expérience/i.test(g.lines?.[0] || '')
  );
  if (headerIdx >= 0) {
    orderedGroups.splice(headerIdx + 1, 0, ...experienceStacks);
  } else {
    orderedGroups.push(...experienceStacks);
  }

  const buckets = bucketGroupsBySection(orderedGroups);
  const rebuilt = rebuildSectionsText(buckets, preamble);

  const lines = rebuilt.split('\n').map((l) => l.trim()).filter(Boolean);

  return {
    applied: true,
    engine: OCR_STRUCTURE_RECOVERY,
    text: rebuilt,
    lines,
    buckets,
    groups,
    stats: {
      inputLines: rawLines.length,
      outputLines: lines.length,
      groupCount: groups.length,
      experienceGroups: buckets.experience?.length || 0,
      educationGroups: buckets.education?.length || 0,
      skillsGroups: buckets.skills?.length || 0,
      languagesGroups: buckets.languages?.length || 0,
      neverTrustOcrOrder: true,
    },
  };
}
