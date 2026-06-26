/**
 * P0 — No fake data policy.
 * If Hirely is unsure, it must not invent. Wrong data is worse than empty.
 */

import {
  UNDETECTED_INFORMATION_LABEL,
  isUncertainIdentityName,
  isUncertainIdentityPhone,
  auditResumeDataForInventedContent,
} from '../display/undetected-label.js';
import {
  isValidIdentityName,
  looksLikeCompanyOrAgencyName,
  nameCollidesWithEmployers,
  IDENTITY_CONFIDENCE_MIN,
} from '../parsing/identity-extraction.js';
import {
  auditInventedExperience,
  isClientOnlyExperienceCompany,
  stripInventedExperiences,
} from '../parsing/invented-experience-guard.js';
import {
  normalizeContactPhone,
  scorePhoneExtraction,
  validatePhoneStrict,
  phoneHasYearOrDatePollution,
  PHONE_DISPLAY_CONFIDENCE_MIN,
} from '../parsing/phone-normalize.js';
import { experienceRowHasForbiddenFutureDate } from './data-sanitization-layer.js';
import { scoreIdentityName } from './confidence-gate.js';

export const NO_FAKE_DATA_POLICY_V1 = 'NO_FAKE_DATA_POLICY_V1';

/** Product tenets — missing data is acceptable; wrong data is forbidden. */
export const DATA_INTEGRITY_TENETS = Object.freeze({
  missingAcceptable: true,
  wrongForbidden: true,
  emptyNameOverFakeName: true,
  missingEmailOverCorruptedEmail: true,
  genericTemplateOverFakePremium: true,
});

export const DATA_INTEGRITY_TENET_LINES = Object.freeze([
  'Missing data is acceptable.',
  'Wrong data is forbidden.',
  'An empty name is better than a fake name.',
  'A missing email is better than a corrupted email.',
  'A generic template is better than a fake premium template.',
]);

/** Violation types — forbidden fabricated CV fields. */
export const NO_FAKE_FORBIDDEN = Object.freeze({
  fakeName: 'fake_name',
  fakePhone: 'fake_phone',
  fakeCompany: 'fake_company',
  fakeDates: 'fake_dates',
  fakeExperience: 'fake_experience',
});

export const NO_FAKE_POLICY_RULES = Object.freeze({
  missingNameAcceptable: true,
  wrongNameUnacceptable: true,
  lowConfidenceToReviewQueue: true,
  identityConfidenceMin: IDENTITY_CONFIDENCE_MIN,
  phoneDisplayConfidenceMin: PHONE_DISPLAY_CONFIDENCE_MIN,
  undetectedLabel: UNDETECTED_INFORMATION_LABEL,
});

/**
 * @param {string} name
 * @param {object[]} [experiences]
 */
export function isAcceptableDisplayName(name, experiences = []) {
  const s = String(name || '').trim();
  if (!s || isUncertainIdentityName(s)) return true;
  if (looksLikeCompanyOrAgencyName(s) || nameCollidesWithEmployers(s, experiences)) return false;
  if (!isValidIdentityName(s)) return false;
  if (scoreIdentityName(s, experiences) < NO_FAKE_POLICY_RULES.identityConfidenceMin) return false;
  return true;
}

/**
 * @param {string} phone
 */
export function isAcceptableDisplayPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw || isUncertainIdentityPhone(raw)) return true;
  if (phoneHasYearOrDatePollution(raw)) return false;
  const norm = normalizeContactPhone(raw);
  const confidence = norm.confidence || scorePhoneExtraction(raw, norm.phone);
  if (confidence < PHONE_DISPLAY_CONFIDENCE_MIN) return false;
  const display = norm.phone || raw;
  return validatePhoneStrict(display);
}

/**
 * @param {object} [ctx]
 * @param {object} [ctx.finalResumeData]
 * @param {object} [ctx.resumeData]
 * @param {object[]} [ctx.reviewQueue]
 * @returns {{ pass: boolean, policy: string, violations: object[], inventedAudit: string[] }}
 */
export function auditNoFakeDataPolicy(ctx = {}) {
  const rd = ctx.finalResumeData || ctx.resumeData || {};
  const violations = [];
  const id = rd.identity || {};
  const experiences = rd.experiences || [];

  const name = String(id.name || '').trim();
  if (name && !isAcceptableDisplayName(name, experiences)) {
    violations.push({ type: NO_FAKE_FORBIDDEN.fakeName, detail: name });
  }

  const phone = String(id.phone || '').trim();
  if (phone && !isAcceptableDisplayPhone(phone)) {
    violations.push({ type: NO_FAKE_FORBIDDEN.fakePhone, detail: phone });
  }

  for (const exp of experiences) {
    const invented = auditInventedExperience(exp);
    if (invented.invented) {
      violations.push({
        type: NO_FAKE_FORBIDDEN.fakeExperience,
        detail: [exp.role, exp.company, ...(exp.bullets || [])].filter(Boolean).join(' — '),
        reason: invented.reason,
      });
    }

    const company = String(exp.company || '').trim();
    const role = String(exp.role || '').trim();
    if (company && !role && isClientOnlyExperienceCompany(company)) {
      violations.push({ type: NO_FAKE_FORBIDDEN.fakeCompany, detail: company });
    }

    const dateBlob = [exp.dates, exp.startDate, exp.endDate, ...(exp.bullets || [])].join(' ');
    if (experienceRowHasForbiddenFutureDate(dateBlob)) {
      violations.push({ type: NO_FAKE_FORBIDDEN.fakeDates, detail: dateBlob.slice(0, 120) });
    }
  }

  const inventedAudit = auditResumeDataForInventedContent(rd);
  for (const msg of inventedAudit) {
    violations.push({ type: NO_FAKE_FORBIDDEN.fakeExperience, detail: msg });
  }

  return {
    pass: violations.length === 0,
    policy: NO_FAKE_DATA_POLICY_V1,
    violations,
    inventedAudit,
  };
}

/**
 * @param {object[]} experiences
 */
export function enforceNoFakeExperiences(experiences = []) {
  return stripInventedExperiences(experiences);
}

/**
 * Low-confidence stripped fields should appear in reviewQueue, not on the CV.
 * @param {object[]} reviewQueue
 * @param {string} field
 */
export function reviewQueueHasField(reviewQueue = [], field) {
  return (reviewQueue || []).some((item) => String(item?.field || '').toLowerCase() === field.toLowerCase());
}
