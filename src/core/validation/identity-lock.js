/**
 * P0 — Identity lock: strict name / phone / email extraction.
 * Missing data allowed. Wrong data forbidden.
 * Confidence < 90% → "Identity needs review" (display only).
 */

import { IDENTITY_NEEDS_REVIEW_LABEL } from '../display/identity-labels.js';
import {
  rejectAsPersonName,
  isValidIdentityName,
  looksLikeCompanyOrAgencyName,
  nameCollidesWithEmployers,
} from '../parsing/identity-extraction.js';
import { scoreIdentityName } from './confidence-gate.js';
import {
  normalizeContactPhone,
  validatePhoneStrict,
  phoneHasYearOrDatePollution,
  scorePhoneExtraction,
  PHONE_DISPLAY_CONFIDENCE_MIN,
} from '../parsing/phone-normalize.js';
import { assessEmailStrictness, sanitizeEmailOcrArtifacts, validateEmailRfcStrict } from './email-strictness.js';

export const IDENTITY_LOCK_V1 = 'IDENTITY_LOCK_V1';

/** Unified identity confidence floor — below this, never render guessed values. */
export const IDENTITY_LOCK_CONFIDENCE_MIN = 90;

/** Minimum digit count for international phone acceptance. */
export const PHONE_MIN_DIGITS = 8;

/** Internship / placement tokens — never a person name. */
export const PERSON_NAME_INTERNSHIP_RE =
  /\b(internship|internships?|interns?|stage|stages?|stagiaire|stagiaires?|apprenticeship|apprenti|apprentice|trainee|alternance)\b/i;

/** Year tokens in a name candidate. */
export const PERSON_NAME_YEAR_RE =
  /\b(19|20)\d{2}\b|(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|présent|current|now)\b/i;

/**
 * Strict person-name validation (identity lock rules).
 * @param {string} name
 * @param {object[]} [experiences]
 */
export function validatePersonNameStrict(name, experiences = []) {
  const s = String(name || '').trim();
  if (!s) {
    return { valid: false, reason: 'empty', confidence: 0 };
  }
  if (rejectAsPersonName(s)) {
    return {
      valid: false,
      reason: PERSON_NAME_INTERNSHIP_RE.test(s)
        ? 'internship_token'
        : PERSON_NAME_YEAR_RE.test(s) || /\d/.test(s)
          ? 'digits_or_years'
          : looksLikeCompanyOrAgencyName(s)
            ? 'company_or_agency'
            : 'reject_person_name',
      confidence: 0,
    };
  }
  if (looksLikeCompanyOrAgencyName(s)) {
    return { valid: false, reason: 'company_or_agency', confidence: 0 };
  }
  if (nameCollidesWithEmployers(s, experiences)) {
    return { valid: false, reason: 'employer_collision', confidence: 0 };
  }
  if (!isValidIdentityName(s)) {
    return { valid: false, reason: 'invalid_identity_name', confidence: 0 };
  }
  const confidence = scoreIdentityName(s, experiences);
  if (confidence < IDENTITY_LOCK_CONFIDENCE_MIN) {
    return { valid: false, reason: 'low_confidence', confidence };
  }
  return { valid: true, reason: 'ok', confidence };
}

/**
 * @param {string} rawPhone
 */
export function validatePhoneIdentityLock(rawPhone) {
  const raw = String(rawPhone || '').trim();
  if (!raw) {
    return { valid: false, reason: 'empty', confidence: 0, display: '', normalized: '' };
  }
  if (phoneHasYearOrDatePollution(raw)) {
    const norm = normalizeContactPhone(raw);
    return {
      valid: false,
      reason: 'year_or_page_pollution',
      confidence: norm.confidence || scorePhoneExtraction(raw, norm.phone),
      display: '',
      normalized: norm.phone || '',
    };
  }
  const norm = normalizeContactPhone(raw);
  const confidence = norm.confidence || scorePhoneExtraction(raw, norm.phone);
  const digits = String(norm.phone || raw).replace(/\D/g, '');
  if (digits.length < PHONE_MIN_DIGITS) {
    return { valid: false, reason: 'insufficient_digits', confidence, display: '', normalized: norm.phone || '' };
  }
  if (
    !norm.phone ||
    !validatePhoneStrict(norm.phone) ||
    confidence < PHONE_DISPLAY_CONFIDENCE_MIN
  ) {
    return {
      valid: false,
      reason: !norm.phone
        ? 'no_strict_match'
        : !validatePhoneStrict(norm.phone)
          ? 'invalid_international'
          : 'low_confidence',
      confidence,
      display: '',
      normalized: norm.phone || '',
    };
  }
  return {
    valid: true,
    reason: 'ok',
    confidence,
    display: norm.phone,
    normalized: norm.phone,
  };
}

/**
 * @param {string} email
 * @param {string} [sourceText]
 */
export function validateEmailIdentityLock(email, sourceText = '') {
  const cleaned = sanitizeEmailOcrArtifacts(email);
  if (!cleaned) {
    return { valid: false, reason: 'empty', confidence: 0, display: '' };
  }
  if (!validateEmailRfcStrict(cleaned)) {
    return { valid: false, reason: 'invalid_rfc', confidence: 15, display: '' };
  }
  const assessment = assessEmailStrictness(cleaned, sourceText);
  if (!assessment.accept || assessment.confidence < IDENTITY_LOCK_CONFIDENCE_MIN) {
    return {
      valid: false,
      reason: assessment.reason || 'low_confidence',
      confidence: assessment.confidence || 0,
      display: '',
      reviewRequired: true,
    };
  }
  return {
    valid: true,
    reason: assessment.reason,
    confidence: assessment.confidence,
    display: assessment.display,
    reviewRequired: assessment.reviewRequired === true,
  };
}

/**
 * Display value for an identity field under identity lock.
 * @param {string} value
 * @param {number} confidence
 * @param {boolean} valid
 */
export function identityLockDisplayValue(value, confidence, valid) {
  const v = String(value || '').trim();
  if (valid && confidence >= IDENTITY_LOCK_CONFIDENCE_MIN && v) return v;
  return '';
}

/**
 * Apply identity lock to an identity object.
 * @param {object} identity
 * @param {{ experiences?: object[], sourceText?: string, rawText?: string, cleanedText?: string }} [opts]
 */
export function applyIdentityLock(identity = {}, opts = {}) {
  const experiences = opts.experiences || [];
  const sourceText = [opts.sourceText, opts.rawText, opts.cleanedText].filter(Boolean).join('\n');
  const out = { ...(identity || {}) };
  const assessments = {};
  let needsReview = false;

  const rawName = String(out.name || '').trim();
  const nameCheck = validatePersonNameStrict(rawName, experiences);
  assessments.name = nameCheck;
  if (nameCheck.valid) {
    out.name = rawName;
  } else {
    out.name = rawName ? identityLockDisplayValue(rawName, nameCheck.confidence, false) : '';
    if (rawName) needsReview = true;
  }

  const rawEmail = String(out.email || '').trim();
  const emailCheck = validateEmailIdentityLock(rawEmail, sourceText);
  assessments.email = emailCheck;
  if (emailCheck.valid && !emailCheck.reviewRequired) {
    out.email = emailCheck.display;
  } else {
    out.email = rawEmail ? identityLockDisplayValue(rawEmail, emailCheck.confidence, false) : '';
    if (rawEmail) needsReview = true;
  }

  const rawPhone = String(out.phone || '').trim();
  const phoneCheck = validatePhoneIdentityLock(rawPhone);
  assessments.phone = phoneCheck;
  if (phoneCheck.valid) {
    out.phone = phoneCheck.display;
  } else {
    out.phone = '';
    if (rawPhone) needsReview = true;
  }

  return {
    identity: out,
    assessments,
    needsReview,
    reviewLabel: needsReview ? IDENTITY_NEEDS_REVIEW_LABEL : '',
  };
}

export { IDENTITY_NEEDS_REVIEW_LABEL };
