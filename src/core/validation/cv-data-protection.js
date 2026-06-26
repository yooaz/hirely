/**
 * Empty CV protection — block Review / Style / Export when CV data is unusable.
 */
import { isValidImportName } from './extraction-reliability.js';
import {
  isUnblockEverythingActive,
  isTextSufficientForFlow,
} from '../import/unblock-everything.js';
import {
  resumeObjectExists,
  applyReviewGuaranteeToValidation,
} from './review-screen-guarantee.js';
import { applyTemplateIsolationToValidation } from '../../ui/templates/template-isolation.js';
import { applyExportIsolationToValidation } from '../export/export-rewrite.js';

export const CV_DATA_PROTECTION_V1 = 'CV_DATA_PROTECTION_V1';

export const CV_DATA_STATUS = Object.freeze({
  VALID: 'VALID',
  PARTIAL: 'PARTIAL',
  INVALID: 'INVALID',
});

const SECTION_KEYS = Object.freeze([
  'experiences',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
]);

function sectionTotal(counts = {}) {
  return SECTION_KEYS.reduce((n, k) => n + (Number(counts[k]) || 0), 0);
}

function countExperience(cv, counts = {}) {
  if (Number(counts.experiences) > 0) return Number(counts.experiences);
  const exp = cv?.experience || [];
  return exp.filter((x) => {
    if (x && typeof x === 'object') {
      return !!(x.role || x.company || (x.bullets || []).filter(Boolean).length);
    }
    return String(x || '').trim().length > 0;
  }).length;
}

function resolveName(cv, finalResumeData) {
  return String(cv?.name || finalResumeData?.identity?.name || '').trim();
}

function resolveSummary(cv, finalResumeData) {
  return String(cv?.summary || finalResumeData?.summary || '').trim();
}

function countUnsorted(cv) {
  return (
    (cv?.unsorted || []).filter((s) => String(s || '').trim()).length +
    (cv?.toClassify || []).filter((s) => String(s || '').trim()).length
  );
}

/**
 * @param {{ previewLive?: boolean, previewText?: string }} input
 */
function previewIsEmpty(input) {
  if (input.previewLive) return false;
  const text = String(input.previewText || '').replace(/\s+/g, ' ').trim();
  return text.length < 80;
}

/**
 * @param {object} [input]
 * @param {object|null} [input.cvData]
 * @param {object|null} [input.finalResumeData]
 * @param {object} [input.sectionCounts]
 * @param {boolean} [input.previewLive]
 * @param {string} [input.previewText]
 * @param {boolean} [input.finalResumeValid]
 * @param {boolean} [input.cvRenderable]
 */
export function validateCvData(input = {}) {
  if (
    input.v1FlowUnlocked ||
    input.flowUnlocked ||
    (isUnblockEverythingActive() && isTextSufficientForFlow(input))
  ) {
    return {
      version: CV_DATA_PROTECTION_V1,
      status: CV_DATA_STATUS.VALID,
      reasons: [],
      blockReview: false,
      blockStyle: false,
      blockExport: false,
      showRecovery: false,
      v1FlowUnlocked: true,
      flowUnlocked: true,
    };
  }

  const cv = input.cvData || null;
  const frd = input.finalResumeData || null;
  const resumeData = frd || input.resumeData || null;
  const counts = input.sectionCounts || {};
  /** @type {string[]} */
  const reasons = [];

  if (!isValidImportName(resolveName(cv, frd))) reasons.push('name_missing');

  if (countExperience(cv, counts) === 0) reasons.push('experience_missing');

  const sections = sectionTotal(counts);
  const summary = resolveSummary(cv, frd);
  const unsorted = countUnsorted(cv);
  const hasBody = sections > 0 || summary.length >= 20 || unsorted > 0;
  if (!hasBody) reasons.push('all_sections_empty');

  if (
    !input.cvRenderable &&
    previewIsEmpty({
      previewLive: !!input.previewLive,
      previewText: input.previewText,
    })
  ) {
    reasons.push('preview_empty');
  }

  const hasRenderable = !!input.cvRenderable || hasBody;

  let result;

  if (reasons.length > 0) {
    if (hasRenderable) {
      result = {
        version: CV_DATA_PROTECTION_V1,
        status: CV_DATA_STATUS.PARTIAL,
        reasons,
        blockReview: false,
        blockStyle: false,
        blockExport: true,
        showRecovery: true,
      };
    } else {
      result = {
        version: CV_DATA_PROTECTION_V1,
        status: CV_DATA_STATUS.INVALID,
        reasons,
        blockReview: true,
        blockStyle: true,
        blockExport: true,
        showRecovery: true,
      };
    }
  } else {
    /** @type {string[]} */
    const partialReasons = [];
    if (!input.finalResumeValid) partialReasons.push('final_resume_invalid');
    if (input.cvRenderable === false) partialReasons.push('cv_not_renderable');

    if (partialReasons.length > 0) {
      result = {
        version: CV_DATA_PROTECTION_V1,
        status: CV_DATA_STATUS.PARTIAL,
        reasons: partialReasons,
        blockReview: false,
        blockStyle: true,
        blockExport: true,
        showRecovery: true,
      };
    } else {
      result = {
        version: CV_DATA_PROTECTION_V1,
        status: CV_DATA_STATUS.VALID,
        reasons: [],
        blockReview: false,
        blockStyle: false,
        blockExport: false,
        showRecovery: false,
      };
    }
  }

  if (input.v1FlowUnlocked) {
    return applyExportIsolationToValidation(
      applyTemplateIsolationToValidation(
        applyReviewGuaranteeToValidation(
          {
            ...result,
            status: result.reasons.length > 0 ? CV_DATA_STATUS.PARTIAL : CV_DATA_STATUS.VALID,
            blockReview: false,
            blockStyle: false,
            blockExport: false,
            showRecovery: result.reasons.length > 0 || result.showRecovery,
            v1FlowUnlocked: true,
          },
          resumeData
        ),
        resumeData
      ),
      resumeData
    );
  }

  return applyExportIsolationToValidation(
    applyTemplateIsolationToValidation(
      applyReviewGuaranteeToValidation(result, resumeData),
      resumeData
    ),
    resumeData
  );
}

const REASON_FIELD = Object.freeze({
  name_missing: 'name',
  experience_missing: 'experience',
  all_sections_empty: 'skills',
  preview_empty: 'identity',
  final_resume_invalid: 'identity',
  cv_not_renderable: 'identity',
});

/**
 * Shape for HirelyExtractionRecoveryPanel.
 * @param {ReturnType<typeof validateCvData>} validation
 * @param {(key: string) => string} [t]
 */
export function buildEmptyCvRecoveryReport(validation, t = (k) => k) {
  const reasonLabels = {
    name_missing: t('emptyCvReasonName') || 'Name is missing or invalid',
    experience_missing: t('emptyCvReasonExperience') || 'At least one experience is required',
    all_sections_empty: t('emptyCvReasonSections') || 'CV sections are empty',
    preview_empty: t('emptyCvReasonPreview') || 'CV preview has no content',
    final_resume_invalid: t('emptyCvReasonFinalResume') || 'CV data is incomplete',
    cv_not_renderable: t('emptyCvReasonNotRenderable') || 'CV cannot be rendered yet',
  };

  const missingSections = [];
  if (validation.reasons.includes('name_missing')) {
    missingSections.push({ id: 'name', label: t('emptyCvMissingName') || 'Name' });
  }
  if (validation.reasons.includes('experience_missing')) {
    missingSections.push({ id: 'experience', label: t('emptyCvMissingExperience') || 'Experience' });
  }
  if (validation.reasons.includes('all_sections_empty')) {
    missingSections.push({ id: 'skills', label: t('emptyCvMissingContent') || 'CV content' });
  }
  if (validation.reasons.includes('preview_empty')) {
    missingSections.push({ id: 'identity', label: t('emptyCvMissingPreview') || 'Preview' });
  }

  return {
    showRecovery: !!validation.showRecovery,
    blockRender: validation.status === CV_DATA_STATUS.INVALID && !validation.v1FlowUnlocked,
    outputSafe: validation.status === CV_DATA_STATUS.VALID || !!validation.v1FlowUnlocked,
    missingSections,
    detectedIssues: validation.reasons.map((r, i) => ({
      id: `cv-prot-${i}`,
      field: REASON_FIELD[r] || 'identity',
      message: reasonLabels[r] || r,
      action: 'edit',
    })),
    lowConfidenceFields: [],
    silentFailurePrevented: validation.status === CV_DATA_STATUS.INVALID,
  };
}
