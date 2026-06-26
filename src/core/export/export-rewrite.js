/**
 * EXPORT REWRITE — export only requires resume object exists.
 * No finalResumeValid, parserConfidence, or ATS requirements.
 */
import { resumeObjectExists } from '../validation/review-screen-guarantee.js';

export const EXPORT_REWRITE_VERSION = 'EXPORT_REWRITE_V1';

export function isExportRewriteActive() {
  if (globalThis.HIRELY_EXPORT_REWRITE === false) return false;
  return true;
}

/**
 * @param {object|null|undefined} resumeData
 */
export function canExportWithResume(resumeData) {
  return resumeObjectExists(resumeData);
}

/**
 * Resume-only export gate — visible CV technical checks only.
 * @param {object} [params]
 * @param {object|null} [params.resumeData]
 * @param {object|null} [params.finalResumeData]
 * @param {object} [params.cvMetrics]
 */
export function validateExportResumeOnly(params = {}) {
  const resumeData = params.resumeData || params.finalResumeData || null;
  /** @type {string[]} */
  const errors = [];

  if (!canExportWithResume(resumeData)) {
    errors.push('NO_RESUME_OBJECT');
  }

  const metrics = params.cvMetrics || {};
  if (metrics.hasEmptyState) errors.push('EMPTY_PREVIEW');
  if (!String(metrics.className || '').includes('cv--live')) errors.push('PREVIEW_NOT_LIVE');

  const unique = [...new Set(errors)];
  return {
    ok: unique.length === 0,
    version: EXPORT_REWRITE_VERSION,
    resumeOnly: true,
    errors: unique,
    resumeData: !!resumeData,
  };
}

/**
 * @param {ReturnType<typeof import('../validation/cv-data-protection.js').validateCvData>} validation
 * @param {object|null|undefined} resumeData
 */
export function applyExportIsolationToValidation(validation, resumeData) {
  if (!canExportWithResume(resumeData)) return validation;
  return {
    ...validation,
    status: validation?.status === 'INVALID' ? 'PARTIAL' : validation?.status || 'PARTIAL',
    blockReview: false,
    blockStyle: false,
    blockExport: false,
    exportIsolation: true,
  };
}
