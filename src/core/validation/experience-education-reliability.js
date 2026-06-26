/**
 * P0 — Experience & education reliability.
 * Wrong rows forbidden; low confidence → reviewQueue, not preview.
 */

import { auditFakeExperience, isGenericOnlyExperienceRole, genericRoleHasAnchoredEmploymentContext } from './fake-experience-gate.js';
import { auditInventedExperience } from '../parsing/invented-experience-guard.js';
import { validatesEducationLine } from '../parsing/stages/section-validator-stage.js';
import { scoreEducationConfidence } from '../parsing/education-confidence.js';
import { normalizeReviewItem } from '../parsing/review-queue-merge.js';

export const EXPERIENCE_EDUCATION_RELIABILITY_V1 = 'EXPERIENCE_EDUCATION_RELIABILITY_V1';

export const EXPERIENCE_RELIABILITY_MIN_CONFIDENCE = 70;
export const EDUCATION_RELIABILITY_MIN_CONFIDENCE = 55;

const ACTIVITY_BULLET_RE =
  /^(led|managed|designed|created|developed|produced|delivered|built|coordinated|implemented|illustrated|directed|oversaw|supported|maintained|launched)\b/i;

const CURRENT_MARKER_RE = /\b(present|présent|current|now|aujourd'?hui|actuel)\b/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;

const PROFILE_SUMMARY_AS_JOB_RE =
  /^(profil!?|profile|résumé|resume|summary|objective|about|coordonnées|contact)\b/i;

/**
 * @param {object} exp
 */
export function experienceHasRoleOrActivity(exp) {
  const role = String(exp?.role || exp?.title || '').trim();
  if (role && !PROFILE_SUMMARY_AS_JOB_RE.test(role)) {
    if (!isGenericOnlyExperienceRole(role)) return true;
    const src = [exp?.role, exp?.company, exp?.dates, ...(exp?.bullets || [])].filter(Boolean).join(' — ');
    if (genericRoleHasAnchoredEmploymentContext(exp, src)) return true;
  }
  const bullets = (exp?.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
  return bullets.some((b) => ACTIVITY_BULLET_RE.test(b) || (b.length >= 28 && /\b(for|with|at|to)\b/i.test(b)));
}

/**
 * @param {object} exp
 */
export function experienceHasCompanyOrContext(exp) {
  const company = String(exp?.company || '').trim();
  const role = String(exp?.role || '').trim();
  const blob = `${role} ${company}`.trim();

  if (company && !isGenericOnlyExperienceRole(company) && !/^\{[^}]+\}$/.test(company)) {
    return true;
  }
  if (/\b(freelance|independent|indépendant|self[- ]employed)\b/i.test(blob)) return true;
  if (/\bproject\b/i.test(role) && company.length >= 3) return true;
  if (role && company && company.length >= 2) return true;
  return false;
}

/**
 * @param {object} exp
 * @param {string} [sourceText]
 */
export function experienceHasExplicitDateOrCurrent(exp, sourceText = '') {
  const src = String(
    sourceText || [exp?.dates, exp?.startDate, exp?.endDate, ...(exp?.bullets || [])].filter(Boolean).join(' ')
  ).trim();
  const dates = String(exp?.dates || '').trim();
  const start = String(exp?.startDate || '').trim();
  const end = String(exp?.endDate || '').trim();

  const hasYearInField = YEAR_RE.test(dates) || YEAR_RE.test(start) || YEAR_RE.test(end);
  const hasYearInSource = YEAR_RE.test(src);
  if (hasYearInField && hasYearInSource) return true;

  const hasCurrentInField = CURRENT_MARKER_RE.test(dates) || CURRENT_MARKER_RE.test(end);
  const hasCurrentInSource = CURRENT_MARKER_RE.test(src);
  if (hasCurrentInField && hasCurrentInSource) return true;

  return false;
}

/**
 * @param {object} exp
 */
export function experienceDateDedupeKey(exp) {
  const start = String(exp?.startDate || '').replace(/\D/g, '').slice(0, 4);
  const end = String(exp?.endDate || '')
    .replace(/present|présent|current|now/gi, '9999')
    .replace(/\D/g, '')
    .slice(0, 4);
  const dates = String(exp?.dates || '');
  const years = [...dates.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]);
  const yStart = start || years[0] || '';
  const yEnd = end || years[years.length - 1] || years[0] || '';
  if (!yStart && !yEnd) return '';
  return `${yStart}|${yEnd}`;
}

/**
 * @param {object} exp
 * @param {string} [sourceText]
 * @returns {{ fake: boolean, reason?: string }}
 */
export function auditExperienceReliability(exp, sourceText = '') {
  const fakeAudit = auditFakeExperience(exp, sourceText);
  if (fakeAudit.fake) return fakeAudit;

  const invented = auditInventedExperience(exp);
  if (invented.invented) return { fake: true, reason: invented.reason || 'invented' };

  const role = String(exp?.role || '').trim();
  const company = String(exp?.company || '').trim();
  if (PROFILE_SUMMARY_AS_JOB_RE.test(role) || PROFILE_SUMMARY_AS_JOB_RE.test(company)) {
    return { fake: true, reason: 'profile_summary_as_job' };
  }

  if (!role && company && !exp?.startDate && !exp?.dates) {
    return { fake: true, reason: 'company_only_row' };
  }

  if (!experienceHasRoleOrActivity(exp)) {
    return { fake: true, reason: 'missing_role_activity' };
  }
  if (!experienceHasCompanyOrContext(exp)) {
    return { fake: true, reason: 'missing_company_context' };
  }
  if (!experienceHasExplicitDateOrCurrent(exp, sourceText)) {
    return { fake: true, reason: 'missing_explicit_date' };
  }

  return { fake: false };
}

/**
 * @param {string} entry
 * @returns {{ accept: boolean, reviewRequired: boolean, confidence: number, reason?: string }}
 */
export function auditEducationReliability(entry) {
  const line = String(entry || '').trim();
  if (!line) return { accept: false, reviewRequired: false, confidence: 0, reason: 'empty' };

  const validation = validatesEducationLine(line);
  if (!validation.ok) {
    return {
      accept: false,
      reviewRequired: true,
      confidence: 0,
      reason: validation.reason || 'missing_school_degree',
    };
  }

  const scored = scoreEducationConfidence(line);
  const confidence = scored?.confidence ?? scored?.score ?? 0;
  if (confidence < EDUCATION_RELIABILITY_MIN_CONFIDENCE) {
    return {
      accept: false,
      reviewRequired: true,
      confidence,
      reason: 'low_confidence',
    };
  }

  return { accept: true, reviewRequired: false, confidence, reason: validation.reason };
}

function buildExperienceReviewItem(exp, reason, sourceText = '') {
  const src =
    sourceText ||
    [exp?.role, exp?.company, exp?.dates, ...(exp?.bullets || [])].filter(Boolean).join(' — ');
  return normalizeReviewItem({
    field: 'experiences',
    detectedType: 'experience',
    detected: src,
    sourceText: src,
    sourceLines: [src],
    confidence: 36,
    reason: `Expérience rejetée (${reason}) — confirmer dans la file de relecture`,
    status: 'pending',
    experienceReliability: true,
  });
}

function buildEducationReviewItem(line, reason, confidence = 0) {
  return normalizeReviewItem({
    field: 'education',
    detectedType: 'education',
    detected: line,
    sourceText: line,
    sourceLines: [line],
    confidence: Math.max(28, Math.min(62, confidence || 40)),
    reason: `Formation à confirmer (${reason})`,
    status: 'pending',
    educationReliability: true,
  });
}

/**
 * @param {object[]} experiences
 */
export function enforceExperienceReliability(experiences = []) {
  const kept = [];
  const review = [];
  const rejected = [];
  const seenDateKeys = new Set();

  for (const exp of experiences || []) {
    const src = [exp?.role, exp?.company, exp?.dates, ...(exp?.bullets || [])].filter(Boolean).join(' — ');
    const audit = auditExperienceReliability(exp, src);
    if (audit.fake) {
      rejected.push({ exp, reason: audit.reason });
      review.push(buildExperienceReviewItem(exp, audit.reason, src));
      continue;
    }

    const dateKey = experienceDateDedupeKey(exp);
    if (dateKey && seenDateKeys.has(dateKey)) {
      rejected.push({ exp, reason: 'duplicate_dates' });
      review.push(buildExperienceReviewItem(exp, 'duplicate_dates', src));
      continue;
    }
    if (dateKey) seenDateKeys.add(dateKey);

    const conf = Number(exp?.confidence ?? exp?.nameConfidence ?? 100);
    if (conf < EXPERIENCE_RELIABILITY_MIN_CONFIDENCE) {
      rejected.push({ exp, reason: 'low_confidence' });
      review.push(buildExperienceReviewItem(exp, 'low_confidence', src));
      continue;
    }

    kept.push(exp);
  }

  return { kept, review, rejected };
}

/**
 * @param {string[]} education
 */
export function enforceEducationReliability(education = []) {
  const kept = [];
  const review = [];
  const rejected = [];

  for (const entry of education || []) {
    const line = String(entry || '').trim();
    if (!line) continue;
    const audit = auditEducationReliability(line);
    if (!audit.accept) {
      rejected.push({ line, reason: audit.reason });
      if (audit.reviewRequired) review.push(buildEducationReviewItem(line, audit.reason, audit.confidence));
      continue;
    }
    kept.push(line);
  }

  return { kept, review, rejected };
}

/**
 * @param {object} resumeData
 */
export function enforceExperienceEducationReliability(resumeData = {}) {
  const expResult = enforceExperienceReliability(resumeData.experiences || []);
  const eduResult = enforceEducationReliability(resumeData.education || []);

  return {
    resumeData: {
      ...resumeData,
      experiences: expResult.kept,
      education: eduResult.kept,
    },
    review: [...expResult.review, ...eduResult.review],
    rejected: {
      experiences: expResult.rejected,
      education: eduResult.rejected,
    },
  };
}
