/**
 * P0 — Identity & contact strictness.
 * Missing name/phone is better than wrong name/phone.
 */

import { NAME_CONFIRM_LABEL, UNDETECTED_INFORMATION_LABEL, IDENTITY_NEEDS_REVIEW_LABEL } from '../display/identity-labels.js';
import { isUncertainIdentityName } from '../display/undetected-label.js';
import { NAME_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';
import {
  looksLikeCompanyOrAgencyName,
  nameCollidesWithEmployers,
  IDENTITY_CONFIDENCE_MIN,
} from '../parsing/identity-extraction.js';
import { scoreIdentityName } from './confidence-gate.js';
import {
  normalizeContactPhone,
  buildPhoneReviewItem,
  scorePhoneExtraction,
  validatePhoneStrict,
  phoneHasYearOrDatePollution,
  PHONE_DISPLAY_CONFIDENCE_MIN,
} from '../parsing/phone-normalize.js';
import { enforceEmailStrictness } from './email-strictness.js';
import {
  IDENTITY_LOCK_V1,
  IDENTITY_LOCK_CONFIDENCE_MIN,
  validatePersonNameStrict,
  validatePhoneIdentityLock,
  identityLockDisplayValue,
} from './identity-lock.js';

function isAcceptableDisplayNameLocal(name, experiences = []) {
  return validatePersonNameStrict(name, experiences).valid;
}

function isAcceptableDisplayPhoneLocal(phone) {
  return validatePhoneIdentityLock(phone).valid;
}

export const IDENTITY_CONTACT_STRICTNESS_V1 = 'IDENTITY_CONTACT_STRICTNESS_V1';
export const STRICT_IDENTITY_EXTRACTION_V1 = 'STRICT_IDENTITY_EXTRACTION_V1';
export const IDENTITY_CONTACT_LOCK_V1 = IDENTITY_LOCK_V1;

export const IDENTITY_CONTACT_RULES = Object.freeze({
  neverCompanyAsPersonName: true,
  neverInventPhoneDigits: true,
  neverMutateEmailLocalPart: true,
  neverMergePhoneWithYearsOrPages: true,
  lowConfidenceToReviewQueue: true,
  missingNameBetterThanWrong: true,
  missingPhoneBetterThanFake: true,
  nameConfidenceMin: IDENTITY_LOCK_CONFIDENCE_MIN,
  phoneConfidenceMin: PHONE_DISPLAY_CONFIDENCE_MIN,
  emailConfidenceMin: IDENTITY_LOCK_CONFIDENCE_MIN,
  uncertainNameLabel: IDENTITY_NEEDS_REVIEW_LABEL,
  identityReviewLabel: IDENTITY_NEEDS_REVIEW_LABEL,
});

/**
 * @param {string} name
 * @param {object[]} [experiences]
 */
export function assessIdentityNameStrict(name, experiences = []) {
  const raw = String(name || '').trim();
  if (!raw || raw === NAME_UNCERTAIN_LABEL || raw === UNDETECTED_INFORMATION_LABEL || raw === IDENTITY_NEEDS_REVIEW_LABEL) {
    return {
      accept: false,
      display: '',
      confidence: 0,
      reviewRequired: false,
      reason: 'empty_or_uncertain',
    };
  }
  const check = validatePersonNameStrict(raw, experiences);
  if (check.valid) {
    return { accept: true, display: raw, confidence: check.confidence, reviewRequired: false, reason: 'ok' };
  }
  return {
    accept: false,
    display: identityLockDisplayValue(raw, check.confidence, false),
    confidence: check.confidence,
    reviewRequired: true,
    reason: check.reason,
  };
}

/**
 * @param {string} rawPhone
 */
export function assessIdentityPhoneStrict(rawPhone) {
  const check = validatePhoneIdentityLock(rawPhone);
  if (check.valid) {
    return {
      accept: true,
      display: check.display,
      confidence: check.confidence,
      reviewRequired: false,
      reason: 'ok',
      normalized: check.normalized,
    };
  }
  const raw = String(rawPhone || '').trim();
  if (!raw) {
    return {
      accept: false,
      display: '',
      confidence: 0,
      reviewRequired: false,
      reason: 'empty',
      normalized: '',
    };
  }
  return {
    accept: false,
    display: '',
    confidence: check.confidence,
    reviewRequired: true,
    reason: check.reason,
    normalized: check.normalized,
  };
}

/**
 * @param {string} original
 * @param {string} [normalized]
 * @param {number} [confidence]
 * @param {string} [reason]
 */
export function buildNameReviewItem(original, normalized = '', confidence = 0, reason = '') {
  const src = String(original || '').trim();
  if (!src || src === NAME_UNCERTAIN_LABEL || src === UNDETECTED_INFORMATION_LABEL) return null;
  const conf = confidence || scoreIdentityName(src);
  return {
    id: `contact-name-${src.slice(0, 20).replace(/\W/g, '') || 'unknown'}`,
    field: 'identity.name',
    section: 'contact',
    sourceText: src,
    detected: normalized || src,
    status: 'pending',
    confidence: conf,
    category: 'contact',
    reason:
      reason ||
      (conf < IDENTITY_CONTACT_RULES.nameConfidenceMin
        ? 'Name confidence below threshold — confirm full name'
        : looksLikeCompanyOrAgencyName(src)
          ? 'Possible company name — confirm person name'
          : 'Name could not be verified — confirm full name'),
  };
}

/**
 * Remove parser artifacts where a person name was misclassified as employer company.
 * @param {object[]} experiences
 * @param {string[]} candidateNames
 */
export function stripPersonNameEmployerArtifacts(experiences = [], candidateNames = []) {
  const blocked = new Set(
    candidateNames
      .map((n) => String(n || '').trim().toLowerCase())
      .filter((n) => n.length >= 3)
  );
  if (!blocked.size) return experiences;
  return (experiences || []).filter((exp) => {
    const company = String(exp?.company || '').trim().toLowerCase();
    if (!company) return true;
    return !blocked.has(company);
  });
}

/**
 * Apply strict identity/contact rules; strip bad fields and emit review items.
 * @param {object} [identity]
 * @param {{ experiences?: object[], existingReviewItems?: object[], sourceText?: string, rawText?: string, cleanedText?: string }} [opts]
 */
export function enforceIdentityContactStrictness(identity = {}, opts = {}) {
  let id = { ...(identity || {}) };
  const experiences = opts.experiences || [];
  let reviewItems = [...(opts.existingReviewItems || [])];
  let strippedEmail = '';

  const emailStrict = enforceEmailStrictness(id, {
    sourceText: opts.sourceText,
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
    existingReviewItems: reviewItems,
  });
  id = emailStrict.identity;
  reviewItems = emailStrict.reviewItems;
  strippedEmail = emailStrict.stripped.email || '';
  if (String(identity?.email || '').trim() && !emailStrict.assessment.accept) {
    id.email = identityLockDisplayValue(
      String(identity.email || '').trim(),
      emailStrict.assessment.confidence || 0,
      false
    );
  }

  const rawName = String(id.name || '').trim();
  const nameAssessment = assessIdentityNameStrict(rawName, experiences);
  if (nameAssessment.accept) {
    id.name = nameAssessment.display;
  } else {
    if (rawName && nameAssessment.reviewRequired) {
      const item = buildNameReviewItem(
        rawName,
        '',
        nameAssessment.confidence,
        nameAssessment.reason === 'company_or_agency'
          ? 'Company/agency line rejected as person name — confirm full name'
          : nameAssessment.reason === 'employer_collision'
            ? 'Name matches employer company — confirm person name'
            : nameAssessment.reason === 'low_confidence'
              ? `Identity needs review — name confidence below ${IDENTITY_LOCK_CONFIDENCE_MIN}%`
              : undefined
      );
      if (item) reviewItems.push(item);
    }
    id.name = nameAssessment.display || '';
  }

  const rawPhone = String(id.phone || '').trim();
  const phoneAssessment = assessIdentityPhoneStrict(rawPhone);
  if (phoneAssessment.accept) {
    id.phone = phoneAssessment.display;
  } else if (rawPhone) {
    const item = buildPhoneReviewItem(
      rawPhone,
      phoneAssessment.normalized || '',
      phoneAssessment.confidence
    );
    if (item) reviewItems.push(item);
    id.phone = '';
  } else {
    id.phone = '';
  }

  return {
    identity: id,
    reviewItems,
    stripped: {
      name: rawName && !nameAssessment.accept ? rawName : '',
      phone: rawPhone && !phoneAssessment.accept ? rawPhone : '',
      email: strippedEmail,
    },
    assessments: {
      name: nameAssessment,
      phone: phoneAssessment,
      email: emailStrict.assessment,
    },
  };
}

export { buildPhoneReviewItem };
