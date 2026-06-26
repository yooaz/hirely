/**
 * TEMPLATE ISOLATION — templates consume resume object only.
 * No ATS score, parser confidence, or OCR score as render inputs or gates.
 */
import { resumeDataToCvData, normalizeCvDataForTemplate, emptyResumeData } from '../../core/resume-data.js';
import { resumeObjectExists } from '../../core/validation/review-screen-guarantee.js';
import { stripTemplateCvData } from '../../core/pipeline/hirely-flow-lock.js';

export const TEMPLATE_ISOLATION_VERSION = 'TEMPLATE_ISOLATION_V1';

/** Keys that must never drive template render decisions. */
export const TEMPLATE_QUALITY_SIGNAL_KEYS = Object.freeze([
  'sectionConfidence',
  'atsScore',
  'ocrScore',
  'parserConfidence',
  'confidence',
  'confidenceReport',
  'score',
  'audit',
  '_extractionReview',
  '_parserReview',
  '_dataSanitization',
  '_dataSanitizationAudit',
  'extractionQuality',
  'ocrWarning',
  '_heldSections',
  'needsReview',
  'reviewQueue',
  '_pendingReview',
]);

export function isTemplateIsolationActive() {
  if (globalThis.HIRELY_TEMPLATE_ISOLATION === false) return false;
  return true;
}

/**
 * @param {object|null|undefined} cvData
 */
export function stripTemplateQualitySignals(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const out = stripTemplateCvData({ ...cvData });
  for (const key of TEMPLATE_QUALITY_SIGNAL_KEYS) {
    delete out[key];
  }
  delete out.meta;
  return out;
}

/**
 * Fold partial resume body into template-safe cv fields.
 * @param {object} resumeData
 * @param {object} cv
 */
function foldPartialResumeBody(resumeData, cv) {
  const out = { ...cv };
  const summary = String(resumeData.summary || out.summary || '').trim();
  const unsorted = Array.isArray(resumeData.unsorted)
    ? resumeData.unsorted.map((s) => String(s || '').trim()).filter(Boolean)
    : [];

  if (summary) out.summary = summary;

  const experiences = Array.isArray(resumeData.experiences) ? resumeData.experiences : [];
  if (!(out.experience || []).length && experiences.length) {
    out.experience = experiences
      .map((e) => {
        if (!e || typeof e !== 'object') return String(e || '').trim();
        const bullets = (e.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
        const head = [e.role, e.company, e.dates].filter(Boolean).join(' — ');
        if (bullets.length) return head ? `${head}: ${bullets.join(' · ')}` : bullets.join(' · ');
        return head;
      })
      .filter(Boolean);
    out.experiences = experiences;
  }

  if (!(out.experience || []).length && !(out.summary || '').trim() && unsorted.length) {
    out.summary = unsorted.slice(0, 12).join('\n');
  }

  if (!String(out.name || '').trim()) {
    out.name = String(resumeData.identity?.name || 'Nom à vérifier').trim() || 'Nom à vérifier';
  }
  if (!String(out.title || '').trim() && resumeData.identity?.title) {
    out.title = String(resumeData.identity.title).trim();
  }

  return out;
}

/**
 * Canonical template input — resume object in, cvData out. Never null.
 * @param {object|null|undefined} resumeData
 */
export function buildTemplateInputFromResume(resumeData) {
  const rd = resumeObjectExists(resumeData) ? resumeData : emptyResumeData();
  const cv = resumeDataToCvData(rd, { skipNormalize: true });
  const folded = foldPartialResumeBody(rd, cv);
  const normalized = normalizeCvDataForTemplate(folded);
  const out = stripTemplateQualitySignals({
    ...normalized,
    _fromResumeData: true,
    _templateIsolation: true,
    _templateMeta: {
      source: 'resumeData',
      isolation: TEMPLATE_ISOLATION_VERSION,
    },
  });
  return out;
}

/**
 * @param {object|null|undefined} resumeData
 */
export function canRenderTemplateFromResume(resumeData) {
  return resumeObjectExists(resumeData);
}

/**
 * CV protection must not block Style/templates when a resume object exists.
 * @param {ReturnType<typeof import('./cv-data-protection.js').validateCvData>} validation
 * @param {object|null|undefined} resumeData
 */
export function applyTemplateIsolationToValidation(validation, resumeData) {
  if (!canRenderTemplateFromResume(resumeData)) return validation;
  return {
    ...validation,
    status: validation?.status === 'INVALID' ? 'PARTIAL' : validation?.status || 'PARTIAL',
    blockReview: false,
    blockStyle: false,
    templateIsolation: true,
  };
}

/**
 * @param {object|null|undefined} cvData
 */
export function isIsolatedTemplateInput(cvData) {
  if (!cvData || typeof cvData !== 'object') return false;
  if (cvData._templateIsolation === true) return true;
  if (cvData._templateMeta?.isolation) return true;
  return isTemplateIsolationActive() && cvData._fromResumeData === true;
}
