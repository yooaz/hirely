/**
 * Parser coverage — structured_chars / clean_chars (target ≥ 80%).
 */

import {
  flattenStructuredPreservedText,
  flattenStructuredFieldsOnly,
  flattenArchivePreservedText,
} from '../../debug/cv-preserved-text.js';
import { buildZeroTextLossAudit, isZeroTextLossMode } from './zero-text-loss.js';
import { isHirelyDebug } from '../runtime/hirely-debug.js';

export const PARSER_COVERAGE_TARGET_PCT = 80;
export const PARSER_CONFIDENCE_MIN = 80;
export const UNSORTED_DISPLAY_MAX = 14;

/**
 * @param {string} cleanedText
 * @param {object} structured
 * @param {object} [opts]
 */
export function buildParserCoverageReport(cleanedText, structured, opts = {}) {
  const cleanChars = Math.max(1, String(cleanedText || '').trim().length);
  const preservedChars = flattenStructuredPreservedText(structured || {}).length;
  const fieldsOnlyChars = flattenStructuredFieldsOnly(structured || {}).length;
  const coveragePercent = Math.min(100, Math.round((preservedChars / cleanChars) * 1000) / 10);
  const archive = [
    ...(structured?.metadata?.unsortedArchive || []),
    ...(structured?.unsortedArchive || []),
  ];
  const unsorted = structured?.unsorted || [];

  const rawForAudit = String(opts.rawText || structured?.rawExtraction || cleanedText || '').trim();
  const zeroLoss =
    isZeroTextLossMode() && rawForAudit
      ? structured?.metadata?.zeroTextLossAudit || buildZeroTextLossAudit(rawForAudit, structured)
      : null;

  return {
    cleanChars,
    structuredChars: zeroLoss?.structuredChars ?? fieldsOnlyChars,
    archivedChars: zeroLoss?.archivedChars ?? flattenArchivePreservedText(structured).length,
    rawChars: zeroLoss?.rawChars ?? rawForAudit.length,
    preservedChars,
    fieldsOnlyChars,
    coveragePercent,
    zeroTextLossBalanced: zeroLoss?.balanced ?? null,
    lossChars: zeroLoss?.lossChars ?? null,
    experienceCount: (structured?.experiences || []).length,
    educationCount: (structured?.education || []).length,
    skillsCount: (structured?.skills || []).length,
    toolsCount: (structured?.tools || []).length,
    unsortedCount: unsorted.length,
    unsortedArchiveCount: archive.length,
    meetsCoverageTarget: coveragePercent >= PARSER_COVERAGE_TARGET_PCT,
  };
}

/**
 * @param {string} cleanedText
 * @param {object} structured
 */
export function logParserCoverageTable(cleanedText, structured) {
  const report = buildParserCoverageReport(cleanedText, structured);
  if (isHirelyDebug()) {
    console.table({
    rawChars: report.rawChars,
    structuredChars: report.structuredChars,
    archivedChars: report.archivedChars,
    cleanChars: report.cleanChars,
    coveragePercent: report.coveragePercent,
    experienceCount: report.experienceCount,
    educationCount: report.educationCount,
    skillsCount: report.skillsCount,
    unsortedCount: report.unsortedCount,
    });
  }
  return report;
}
