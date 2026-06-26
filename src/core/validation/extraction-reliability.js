/**
 * Extraction reliability — honest import/export gates (no fake success).
 */
import { REAL_CV_IMPORT_MIN_CHARS } from '../import/real-cv-import-constants.js';
import { IMPORT_STATE } from '../import/import-state.js';
import { isUnblockEverythingActive } from '../import/unblock-everything.js';
import { SIMPLE_IMPORT_MIN_CHARS } from '../import/v1-import-constants.js';
import { NAME_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';
import { resolveIdentityContact } from './identity-contact.js';
import {
  hydrateExtractedImportText,
  effectiveImportTextLength,
  importMustNotPasteAfterUsableOcr,
} from '../import/ocr-import-usability.js';

export const EXTRACTION_RELIABILITY_V1 = 'EXTRACTION_RELIABILITY_V1';

const PLACEHOLDER_NAME_RE =
  /^(nom incertain|nom à confirmer|name uncertain|votre nom|candidate|your name|poste à compléter|nom à compléter)$/i;

/**
 * @param {string} name
 */
export function isValidImportName(name) {
  const n = String(name || '').trim();
  if (!n || n.length < 2 || n.length > 80) return false;
  if (PLACEHOLDER_NAME_RE.test(n)) return false;
  if (n === NAME_UNCERTAIN_LABEL || n === 'Nom à compléter' || n === 'Nom à confirmer') return false;
  return true;
}

/**
 * @param {object} [identity]
 */
export function hasImportContact(identity = {}) {
  const contact = resolveIdentityContact(identity);
  return contact.hasEmail || contact.hasPhone;
}

/**
 * @param {object} resumeData
 */
function hasResumeBody(resumeData) {
  return (
    (resumeData.experiences || []).length > 0 ||
    (resumeData.education || []).length > 0 ||
    (resumeData.clients || []).length > 0 ||
    (resumeData.projects || []).length > 0
  );
}

/**
 * Partial import: enough text + at least one reviewable section — advance to Review, not paste.
 * @param {object|null|undefined} resumeData
 * @param {string} [rawText]
 */
export function resumeDataAllowsPartialReview(resumeData, rawText = '') {
  const probe = String(rawText || '').trim();
  if (!textMeetsRealCvMinimum(probe)) return false;
  if (!resumeData || typeof resumeData !== 'object') return false;
  const id = resumeData.identity && typeof resumeData.identity === 'object' ? resumeData.identity : {};
  const hasName = isValidImportName(id.name) || String(id.name || '').trim().length >= 2;
  const hasExp = (resumeData.experiences || []).length > 0;
  const hasEdu = (resumeData.education || []).length > 0;
  const hasSkills =
    (resumeData.skills || []).length > 0 || (resumeData.tools || []).length > 0;
  const hasUnsorted = (resumeData.unsorted || []).some((s) => String(s || '').trim().length > 0);
  const hasSummary = String(resumeData.summary || '').trim().length >= 20;
  return hasName || hasExp || hasEdu || hasSkills || hasUnsorted || hasSummary;
}

/**
 * @param {object|null|undefined} resumeData
 */
export function assessResumeDataReliability(resumeData) {
  if (!resumeData || typeof resumeData !== 'object') {
    return {
      version: EXTRACTION_RELIABILITY_V1,
      ok: false,
      importReady: false,
      exportReady: false,
      missing: ['resume_data'],
      warnings: [],
    };
  }

  const id =
    resumeData.identity && typeof resumeData.identity === 'object' ? resumeData.identity : {};
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const warnings = [];

  if (!isValidImportName(id.name)) missing.push('name');
  if (!hasImportContact(id)) missing.push('contact');

  const hasExp = (resumeData.experiences || []).length > 0;
  const hasEdu = (resumeData.education || []).length > 0;
  if (!hasResumeBody(resumeData)) missing.push('experience_or_education');

  const hasSkills =
    (resumeData.skills || []).length > 0 || (resumeData.tools || []).length > 0;
  if (!hasSkills) warnings.push('skills');
  if (!hasExp) warnings.push('experience');
  if (!hasEdu) warnings.push('education');

  const importReady = missing.length === 0;

  return {
    version: EXTRACTION_RELIABILITY_V1,
    ok: importReady,
    importReady,
    exportReady: importReady,
    missing,
    warnings,
  };
}

/**
 * @param {string} text
 */
export function textMeetsRealCvMinimum(text) {
  return String(text || '').trim().length >= REAL_CV_IMPORT_MIN_CHARS;
}

/**
 * Map pipeline outcomes to IMPORT_READY | IMPORT_NEEDS_PASTE only.
 * @param {{
 *   proposedState?: string|null,
 *   rawText?: string,
 *   cleanedText?: string,
 *   resumeData?: object|null,
 *   ocrUsable?: boolean,
 *   ocrAttempted?: boolean,
 *   enterprise?: object|null,
 * }} [opts]
 */
export function resolveHonestImportState(opts = {}) {
  const hydrated = hydrateExtractedImportText({
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    enterprise: opts.enterprise,
    ocrAttempted: opts.ocrAttempted,
    ocrUsable: opts.ocrUsable,
    fileType: opts.fileType,
    extractionMethod: opts.extractionMethod,
  });
  const probe = String(
    hydrated.cleanedText || hydrated.rawText || opts.cleanedText || opts.rawText || ''
  ).trim();
  const effectiveLen = Math.max(probe.length, effectiveImportTextLength(hydrated));
  const ocrCtx = { ...hydrated, ...opts, rawText: probe, cleanedText: probe };
  const ocrMustContinue = importMustNotPasteAfterUsableOcr(ocrCtx);

  if (isUnblockEverythingActive() && probe.length > SIMPLE_IMPORT_MIN_CHARS) {
    return {
      state: IMPORT_STATE.IMPORT_READY,
      reason: 'unblock_everything',
      missing: [],
      assessment: assessResumeDataReliability(opts.resumeData),
      warnings: [],
    };
  }
  const assessment = assessResumeDataReliability(opts.resumeData);

  const meetsTextMinimum =
    textMeetsRealCvMinimum(probe) || effectiveLen >= REAL_CV_IMPORT_MIN_CHARS;

  if (!meetsTextMinimum) {
    if (ocrMustContinue) {
      return {
        state: IMPORT_STATE.IMPORT_PARTIAL,
        reason: 'ocr_usable_continue',
        missing: ['text_length'],
        assessment,
        warnings: assessment.warnings,
      };
    }
    if (resumeDataAllowsPartialReview(opts.resumeData, probe)) {
      return {
        state: IMPORT_STATE.IMPORT_PARTIAL,
        reason: 'partial_review',
        missing: assessment.missing,
        assessment,
        warnings: assessment.warnings,
      };
    }
    return {
      state: IMPORT_STATE.IMPORT_NEEDS_PASTE,
      reason: 'thin_text',
      missing: ['text_length'],
      assessment,
      warnings: assessment.warnings,
    };
  }

  if (!assessment.importReady) {
    if (ocrMustContinue) {
      return {
        state: IMPORT_STATE.IMPORT_PARTIAL,
        reason: 'ocr_usable_weak_parse',
        missing: assessment.missing,
        assessment,
        warnings: assessment.warnings,
      };
    }
    if (resumeDataAllowsPartialReview(opts.resumeData, probe)) {
      return {
        state: IMPORT_STATE.IMPORT_PARTIAL,
        reason: 'partial_review',
        missing: assessment.missing,
        assessment,
        warnings: assessment.warnings,
      };
    }
    return {
      state: IMPORT_STATE.IMPORT_NEEDS_PASTE,
      reason: 'weak_resume_data',
      missing: assessment.missing,
      assessment,
      warnings: assessment.warnings,
    };
  }

  return {
    state: IMPORT_STATE.IMPORT_READY,
    reason: 'reliable',
    missing: [],
    assessment,
    warnings: assessment.warnings,
  };
}

/**
 * @param {object|null|undefined} resumeData
 */
export function resumeDataMeetsImportMinimum(resumeData) {
  return assessResumeDataReliability(resumeData).importReady;
}

/**
 * Pre-export reliability (DOM + structured data).
 * @param {{
 *   finalResumeData?: object|null,
 *   cvData?: object|null,
 *   cvMetrics?: object|null,
 *   domText?: string,
 * }} [input]
 */
export function validateExtractionReliabilityForExport(input = {}) {
  const errors = [];
  const frd = input.finalResumeData || null;
  const assessment = assessResumeDataReliability(frd);

  if (!assessment.importReady) {
    for (const key of assessment.missing) {
      errors.push(`MISSING_${String(key).toUpperCase()}`);
    }
  }

  const metrics = input.cvMetrics;
  if (metrics && typeof metrics === 'object') {
    if (metrics.hasEmptyState) errors.push('EMPTY_PREVIEW');
    if ((metrics.textLength || 0) < 40) errors.push('PREVIEW_TOO_SHORT');
    if (metrics.headerClipped) errors.push('HEADER_CLIPPED');
  }

  const dom = String(input.domText || '').trim();
  const domLen = dom.length || (metrics?.textLength || 0);
  if (domLen < 40) errors.push('PREVIEW_EMPTY');

  const name = String(frd?.identity?.name || input.cvData?.name || '').trim();
  if (name && domLen >= 20) {
    const token = name.split(/\s+/).find((t) => t.length >= 3) || name.slice(0, 8);
    if (token && !dom.toLowerCase().includes(token.toLowerCase())) {
      errors.push('HEADER_NOT_VISIBLE');
    }
  }

  return { ok: errors.length === 0, errors, assessment, version: EXTRACTION_RELIABILITY_V1 };
}
