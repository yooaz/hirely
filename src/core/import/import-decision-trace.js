/**
 * IMPORT_DECISION trace — delegates to import-decision-final.js
 */
import {
  IMPORT_DECISION_REASON,
  resolveImportDecision,
  resolveAutomaticImportRoute,
  logImportDecision,
  decideAndLogImport,
  isOcrReadyForPolicyRoute,
  coerceImpossibleStructuredFromOcrRoute,
} from './import-decision-final.js';
import { buildImportDecisionFromExtracted, enrichImportDecisionContext } from './ocr-import-usability.js';
import { IMPORT_DECISION_DESTINATION } from './import-decision-final.js';

export {
  IMPORT_DECISION_REASON,
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_NATIVE_MIN,
  IMPORT_DECISION_REVIEW_MIN,
  AUTOMATIC_IMPORT_TEXT_MIN,
  resolveImportDecision,
  resolveAutomaticImportRoute,
  buildAutomaticImportRouteInput,
  logImportDecision,
  logImportUiRoute,
  decideAndLogImport,
  isOcrReadyForPolicyRoute,
  coerceImpossibleStructuredFromOcrRoute,
} from './import-decision-final.js';

/** @deprecated use IMPORT_DECISION_REASON */
export const PASTE_MODE_REASON = Object.freeze({
  RAW_TEXT_TOO_SHORT: IMPORT_DECISION_REASON.RAW_TEXT_TOO_SHORT,
  PDF_IMAGE_ONLY: IMPORT_DECISION_REASON.PDF_IMAGE_ONLY,
  OCR_TEXT_TOO_SHORT: IMPORT_DECISION_REASON.OCR_TEXT_TOO_SHORT,
  UNSUPPORTED_FILE: IMPORT_DECISION_REASON.UNSUPPORTED_FILE,
  NO_SECTIONS_FOUND: IMPORT_DECISION_REASON.RAW_TEXT_TOO_SHORT,
  PARSER_FAILED: IMPORT_DECISION_REASON.RAW_TEXT_TOO_SHORT,
  VALIDATION_FAILED: IMPORT_DECISION_REASON.RAW_TEXT_TOO_SHORT,
});

/**
 * @param {object|null} resumeData
 * @param {Record<string, number>|null} sectionCounts
 * @returns {string[]}
 */
export function collectDetectedSections(resumeData, sectionCounts) {
  const sections = [];
  if (sectionCounts && typeof sectionCounts === 'object') {
    if ((sectionCounts.experiences || sectionCounts.experience || 0) > 0) sections.push('experience');
    if ((sectionCounts.education || 0) > 0) sections.push('education');
    if ((sectionCounts.skills || 0) > 0) sections.push('skills');
    if ((sectionCounts.tools || 0) > 0) sections.push('tools');
    if ((sectionCounts.languages || 0) > 0) sections.push('languages');
    if ((sectionCounts.projects || 0) > 0) sections.push('projects');
    if ((sectionCounts.clients || 0) > 0) sections.push('clients');
    if ((sectionCounts.summary || 0) > 0) sections.push('summary');
    if (sections.length) return sections;
  }
  const rd = resumeData && typeof resumeData === 'object' ? resumeData : {};
  if ((rd.experiences || []).length) sections.push('experience');
  if ((rd.education || []).length) sections.push('education');
  if ((rd.skills || []).length) sections.push('skills');
  if ((rd.tools || []).length) sections.push('tools');
  if ((rd.languages || []).length) sections.push('languages');
  if ((rd.projects || []).length) sections.push('projects');
  if ((rd.clients || []).length) sections.push('clients');
  if (String(rd.summary || '').trim().length >= 20) sections.push('summary');
  if ((rd.unsorted || []).some((s) => String(s || '').trim().length > 0)) sections.push('unsorted');
  return sections;
}

/**
 * @param {object} ctx
 * @returns {string}
 */
export function resolveReasonForPasteMode(ctx) {
  const decision = resolveImportDecision(buildImportDecisionFromExtracted(ctx, ctx));
  if (decision.destination !== 'paste') {
    return decision.reason;
  }
  return decision.reason;
}

/**
 * @param {object} ctx
 * @returns {string}
 */
export function traceImportDecision(ctx) {
  const decisionCtx = enrichImportDecisionContext(ctx);
  const decision = resolveImportDecision(decisionCtx);
  return logImportDecision(decision, decisionCtx);
}
