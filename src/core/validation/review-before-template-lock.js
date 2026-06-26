/**
 * P0 — Review before template lock.
 * Templates and export unlock only after critical review items are resolved.
 */

import {
  isUncertainIdentityEmail,
  isUncertainIdentityName,
  isUncertainIdentityPhone,
} from '../display/undetected-label.js';
import { resumeObjectExists } from './review-screen-guarantee.js';
import { pendingReviewItems } from '../parsing/review-queue.js';
import { reviewQueueHasField } from './no-fake-data-policy.js';
import { isV1AtsBlockersDisabled } from '../import/v1-scope-lock.js';

export const REVIEW_BEFORE_TEMPLATE_LOCK_V1 = 'REVIEW_BEFORE_TEMPLATE_LOCK_V1';

export const CRITICAL_REVIEW_KINDS = Object.freeze([
  'uncertain_name',
  'uncertain_email',
  'uncertain_phone',
  'uncertain_experience',
  'ocr_fallback_required',
]);

export const CRITICAL_REVIEW_ACTIONS = Object.freeze(['accept', 'edit', 'reject']);

const EXPERIENCE_RELIABILITY_MARKERS = [
  'fakeExperienceGate',
  'experienceReliability',
  'educationReliability',
  'placeholderGuard',
  'fakeExp',
  'preview_sanity',
];

const CRITICAL_REASON_FR = Object.freeze({
  uncertain_name: 'Nom à confirmer avant de choisir un modèle.',
  uncertain_email: 'E-mail à confirmer avant de choisir un modèle.',
  uncertain_phone: 'Téléphone à confirmer avant de choisir un modèle.',
  uncertain_experience: 'Expérience à valider (confiance faible ou rejetée).',
  ocr_fallback_required: 'Import OCR incomplet — collez le texte du CV pour continuer.',
});

const CRITICAL_REASON_EN = Object.freeze({
  uncertain_name: 'Confirm your name before choosing a template.',
  uncertain_email: 'Confirm your email before choosing a template.',
  uncertain_phone: 'Confirm your phone before choosing a template.',
  uncertain_experience: 'Validate experience (low confidence or rejected row).',
  ocr_fallback_required: 'OCR import incomplete — paste your CV text to continue.',
});

/**
 * @param {object} item
 * @returns {string|null}
 */
export function classifyCriticalReviewItem(item) {
  if (!item || item.status !== 'pending') return null;

  const field = String(item.field || item.detectedType || '').toLowerCase();
  const conf = Number(item.confidence ?? 100);
  const reason = String(item.reason || '').toLowerCase();

  if (field === 'identity.name' || (field.includes('name') && field.includes('identity'))) {
    return 'uncertain_name';
  }
  if (field === 'identity.email' || (field.includes('email') && field.includes('identity'))) {
    return 'uncertain_email';
  }
  if (field === 'identity.phone' || (field.includes('phone') && field.includes('identity'))) {
    return 'uncertain_phone';
  }

  const experienceField = /^(experiences?|experience)$/.test(field);
  const experienceMarker = EXPERIENCE_RELIABILITY_MARKERS.some((k) => item[k]);
  const experienceReason =
    /expérience|experience|fake|invented|generic|duplicate|company_only|guessed|rejetée|rejected/i.test(
      reason
    );

  if (experienceField || experienceMarker || (experienceReason && experienceField)) {
    if (conf < 72 || experienceMarker || experienceReason || item.action === 'corruption') {
      return 'uncertain_experience';
    }
    if (experienceField) return 'uncertain_experience';
  }

  if (experienceMarker) return 'uncertain_experience';

  return null;
}

/**
 * @param {string} kind
 * @param {'fr'|'en'} [lang]
 */
export function criticalReviewReason(kind, lang = 'fr') {
  const table = lang === 'en' ? CRITICAL_REASON_EN : CRITICAL_REASON_FR;
  return table[kind] || table.uncertain_experience;
}

/**
 * @param {object[]} critical
 */
function buildCriticalActions(critical = []) {
  const actions = new Set();
  for (const entry of critical) {
    if (entry.kind === 'ocr_fallback_required') {
      actions.add('paste_fallback');
      continue;
    }
    if (entry.kind?.startsWith('uncertain_')) {
      actions.add('accept');
      actions.add('edit');
      actions.add('reject');
    }
  }
  return [...actions];
}

/**
 * @param {object} [opts]
 * @param {object[]} [opts.reviewQueue]
 * @param {object} [opts.identity]
 * @param {boolean} [opts.ocrFallbackRequired]
 * @param {boolean} [opts.importFallbackLock]
 * @param {boolean} [opts.exportReady]
 * @param {'fr'|'en'} [opts.lang]
 */
export function buildReviewBeforeTemplateLockReport(opts = {}) {
  if (isV1AtsBlockersDisabled()) {
    return {
      version: REVIEW_BEFORE_TEMPLATE_LOCK_V1,
      templateReady: true,
      exportReady: true,
      templateIsolation: true,
      criticalCount: 0,
      critical: [],
      actions: [],
      reasons: [],
      pendingCount: 0,
      v1ScopeLock: true,
    };
  }
  const queue = opts.reviewQueue || [];
  const pending = pendingReviewItems(queue);
  const identity = opts.identity || {};
  const lang = opts.lang === 'en' ? 'en' : 'fr';

  /** @type {{ kind: string, item: object|null, action: string }[]} */
  const critical = [];
  const seen = new Set();

  const push = (kind, item = null, action = 'review') => {
    if (!kind || seen.has(kind)) return;
    seen.add(kind);
    critical.push({ kind, item, action });
  };

  for (const item of pending) {
    const kind = classifyCriticalReviewItem(item);
    if (kind) push(kind, item, 'review');
  }

  if (isUncertainIdentityName(identity.name) || reviewQueueHasField(queue, 'identity.name')) {
    push('uncertain_name', null, 'edit_identity');
  }
  if (isUncertainIdentityEmail(identity.email) || reviewQueueHasField(queue, 'identity.email')) {
    push('uncertain_email', null, 'edit_identity');
  }
  if (isUncertainIdentityPhone(identity.phone) || reviewQueueHasField(queue, 'identity.phone')) {
    push('uncertain_phone', null, 'edit_identity');
  }

  const ocrFallbackRequired = !!(opts.ocrFallbackRequired || opts.importFallbackLock);
  if (ocrFallbackRequired) push('ocr_fallback_required', null, 'paste_fallback');

  const templateReady =
    resumeObjectExists(opts.resumeData) || critical.length === 0;
  const exportReady = templateReady && opts.exportReady !== false;

  return {
    version: REVIEW_BEFORE_TEMPLATE_LOCK_V1,
    templateReady,
    exportReady,
    templateIsolation: resumeObjectExists(opts.resumeData),
    criticalCount: critical.length,
    critical,
    actions: buildCriticalActions(critical),
    reasons: critical.map((c) => criticalReviewReason(c.kind, lang)),
    pendingCount: pending.length,
  };
}

/**
 * @param {object|null} report
 */
export function isTemplateReady(report) {
  return !!(report && report.templateReady);
}

/**
 * @param {object|null} report
 */
export function isExportReadyAfterReview(report) {
  return !!(report && report.exportReady);
}
