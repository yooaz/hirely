/**
 * Confidence gates — low-confidence fields never render in CV preview.
 * Below threshold → unsorted (Suggestions bucket). Wrong data worse than empty.
 */

import {
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
} from '../parsing/parser-recovery.js';
import {
  isValidIdentityName,
  isValidIdentityTitle,
  looksLikeCompanyOrAgencyName,
  nameCollidesWithEmployers,
} from '../parsing/identity-extraction.js';
import {
  scoreStrictExperienceEntry,
  lineIsSkillOrTagOnly,
} from '../parsing/experience-parser.js';
import { scoreEducationConfidence } from '../parsing/education-confidence.js';
import { validatePhone } from '../parsing/rich-parser.js';
import { scorePhoneExtraction, PHONE_DISPLAY_CONFIDENCE_MIN } from '../parsing/phone-normalize.js';

export const CONFIDENCE_GATE = 'CONFIDENCE_GATE_V1';

export {
  CONFIDENCE_TIER,
  confidenceTier,
  tierRequiresReviewQueue,
  tierAllowsAutoRender,
} from './extraction-confidence-tiers.js';

export const CONFIDENCE_THRESHOLDS = Object.freeze({
  identity: 95,
  experience: 85,
  education: 85,
  skills: 75,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** OCR interest/header tags — never valid identity or standalone CV lines */
const OCR_FRAGMENT_RE =
  /^(music|reading|ben|lea|movies?|nature|drawing|sketching)$/i;

const PARTIAL_ROLE_RE = /\b\d{1,2}[-\s]?year\s*old\b/i;

const GARBAGE_FRAGMENT_RE =
  /\b(graphic designer\s*\d+\s*illustrator|product design,?\s*video game|print\s*logo|vector\s*art|nature\s*music|reading\s*nature)\b/i;

const SKILL_FRAGMENT_TITLE_RE =
  /\b(product design|graphic design|illustration|print|logo|vector|typography|branding|packaging)\b/i;

function pushUnsorted(list, line) {
  const t = String(line || '').trim();
  if (!t || t.length < 2) return list;
  const k = t.toLowerCase();
  if (list.some((x) => String(x).trim().toLowerCase() === k)) return list;
  return [...list, t];
}

function isPartialSentence(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (OCR_FRAGMENT_RE.test(s)) return true;
  if (PARTIAL_ROLE_RE.test(s)) return true;
  if (GARBAGE_FRAGMENT_RE.test(s)) return true;
  if (s.length < 12 && !/\b(19|20)\d{2}\b/.test(s) && !EMAIL_RE.test(s)) return true;
  if (lineIsSkillOrTagOnly(s)) return true;
  return false;
}

/** @param {string} name */
export function scoreIdentityName(name, experiences = []) {
  const n = String(name || '').trim();
  if (!n || n === NAME_UNCERTAIN_LABEL || n === 'Nom à compléter') return 0;
  if (looksLikeCompanyOrAgencyName(n) || nameCollidesWithEmployers(n, experiences)) return 0;
  if (OCR_FRAGMENT_RE.test(n) || GARBAGE_FRAGMENT_RE.test(n)) return 12;
  if (PARTIAL_ROLE_RE.test(n)) return 18;
  if (isValidIdentityName(n)) return 98;
  if (n.split(/\s+/).length === 1) return 42;
  return 68;
}

/** @param {string} title */
export function scoreIdentityTitle(title) {
  const t = String(title || '').trim();
  if (!t || t === TITLE_UNCERTAIN_LABEL || t === 'Poste à compléter') return 0;
  if (OCR_FRAGMENT_RE.test(t) || GARBAGE_FRAGMENT_RE.test(t)) return 15;
  if (PARTIAL_ROLE_RE.test(t)) return 20;
  if (
    SKILL_FRAGMENT_TITLE_RE.test(t) &&
    !/\b(designer|director|illustrator|manager|lead|developer|consultant|graphic)\b/i.test(t)
  ) {
    return 38;
  }
  if (isValidIdentityTitle(t)) return 97;
  if (t.split(/\s+/).length === 1 && lineIsSkillOrTagOnly(t)) return 25;
  return 72;
}

/** @param {string} email */
export function scoreIdentityEmail(email) {
  return EMAIL_RE.test(String(email || '').trim()) ? 100 : 0;
}

/** @param {string} phone */
export function scoreIdentityPhone(phone) {
  const p = String(phone || '').trim();
  if (!p) return 0;
  if (/^\d{4}\s+\d{4}$/.test(p) || /^\d{1,4}\s+(?:19|20)\d{2}\s+(?:19|20)\d{2}$/.test(p)) return 8;
  if (/\b(19|20)\d{2}\s*[-–—]/.test(p)) return 8;
  if (/\s+(?:19|20)\d{2}\b/.test(p) || /\s+\d{2}\s*$/.test(p)) return 12;
  if (!validatePhone(p)) return 25;
  return scorePhoneExtraction(p, p);
}

/** @param {object} exp */
export function scoreExperienceConfidence(exp) {
  return scoreStrictExperienceEntry(exp || {});
}

/** @param {string} line */
export function scoreEducationLine(line) {
  const edu = scoreEducationConfidence(line);
  const base = edu.confidence ?? edu.score ?? 0;
  if (edu.forceEducation && base < CONFIDENCE_THRESHOLDS.education) {
    return CONFIDENCE_THRESHOLDS.education;
  }
  if (edu.schoolMatch && base < CONFIDENCE_THRESHOLDS.education) {
    return CONFIDENCE_THRESHOLDS.education;
  }
  return base;
}

const INTEREST_TAG_ONLY_RE =
  /^(music|reading|movies?|nature|ben|lea|adobe|packaging|drawing|sketching)$/i;

/** @param {string} line */
export function scoreSkillLine(line) {
  const s = String(line || '').trim();
  if (!s) return 0;
  if (INTEREST_TAG_ONLY_RE.test(s) || OCR_FRAGMENT_RE.test(s)) return 10;
  if (PARTIAL_ROLE_RE.test(s)) return 15;
  if (GARBAGE_FRAGMENT_RE.test(s)) return 20;
  if (s.includes(',') && s.split(',').length >= 2) return 88;
  if (s.split(/\s+/).length >= 2) return 86;
  if (s.length >= 5 && !lineIsSkillOrTagOnly(s)) return 82;
  if (s.length >= 5) return 76;
  return 48;
}

/** @param {string} summary */
export function scoreSummaryLine(summary) {
  const s = String(summary || '').trim();
  if (!s) return 0;
  if (isPartialSentence(s)) return 40;
  if (s.length < 40) return 62;
  return 90;
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 * @param {object} [opts]
 */
export function applyConfidenceGate(resumeData, opts = {}) {
  const thresholds = { ...CONFIDENCE_THRESHOLDS, ...(opts.thresholds || {}) };
  const rd = {
    ...(resumeData || {}),
    identity: { ...(resumeData?.identity || {}) },
    experiences: Array.isArray(resumeData?.experiences) ? [...resumeData.experiences] : [],
    education: Array.isArray(resumeData?.education) ? [...resumeData.education] : [],
    skills: Array.isArray(resumeData?.skills) ? [...resumeData.skills] : [],
    tools: Array.isArray(resumeData?.tools) ? [...resumeData.tools] : [],
    unsorted: Array.isArray(resumeData?.unsorted) ? [...resumeData.unsorted] : [],
    meta: { ...(resumeData?.meta || {}) },
  };

  let routed = 0;

  const gateIdentity = (field, value, scorer, clearValue = '') => {
    const raw = String(value || '').trim();
    if (!raw) return;
    const score = scorer(raw);
    if (score >= thresholds.identity) return;
    routed += 1;
    rd.unsorted = pushUnsorted(rd.unsorted, raw);
    rd.identity[field] = clearValue;
  };

  if (scoreIdentityName(rd.identity.name) < thresholds.identity) {
    const raw = String(rd.identity.name || '').trim();
    if (raw && raw !== NAME_UNCERTAIN_LABEL) rd.unsorted = pushUnsorted(rd.unsorted, raw);
    rd.identity.name = NAME_UNCERTAIN_LABEL;
    routed += 1;
  }

  if (scoreIdentityTitle(rd.identity.title) < thresholds.identity) {
    const raw = String(rd.identity.title || '').trim();
    if (raw && raw !== TITLE_UNCERTAIN_LABEL) rd.unsorted = pushUnsorted(rd.unsorted, raw);
    rd.identity.title = TITLE_UNCERTAIN_LABEL;
    routed += 1;
  }

  gateIdentity('email', rd.identity.email, scoreIdentityEmail, '');

  const rawPhone = String(rd.identity.phone || '').trim();
  if (rawPhone && scoreIdentityPhone(rawPhone) < PHONE_DISPLAY_CONFIDENCE_MIN) {
    routed += 1;
    rd.unsorted = pushUnsorted(rd.unsorted, rawPhone);
    rd.identity.phone = '';
  }

  if (rd.summary && scoreSummaryLine(rd.summary) < thresholds.education) {
    rd.unsorted = pushUnsorted(rd.unsorted, rd.summary);
    rd.summary = '';
    routed += 1;
  }

  const keptExperiences = [];
  for (const exp of rd.experiences) {
    const score = scoreExperienceConfidence(exp);
    if (score >= thresholds.experience) {
      keptExperiences.push(exp);
      continue;
    }
    const parts = [
      exp?.role,
      exp?.company,
      exp?.dates,
      exp?.startDate && exp?.endDate ? `${exp.startDate}–${exp.endDate}` : exp?.startDate,
      ...(exp?.bullets || []),
    ].filter(Boolean);
    for (const part of parts) rd.unsorted = pushUnsorted(rd.unsorted, part);
    routed += 1;
  }
  rd.experiences = keptExperiences;

  const keptEducation = [];
  for (const item of rd.education) {
    if (scoreEducationLine(item) >= thresholds.education) {
      keptEducation.push(item);
      continue;
    }
    rd.unsorted = pushUnsorted(rd.unsorted, item);
    routed += 1;
  }
  rd.education = keptEducation;

  const keptSkills = [];
  for (const item of rd.skills) {
    if (scoreSkillLine(item) >= thresholds.skills) {
      keptSkills.push(item);
      continue;
    }
    rd.unsorted = pushUnsorted(rd.unsorted, item);
    routed += 1;
  }
  rd.skills = keptSkills;

  const keptTools = [];
  for (const item of rd.tools) {
    if (scoreSkillLine(item) >= thresholds.skills) {
      keptTools.push(item);
      continue;
    }
    rd.unsorted = pushUnsorted(rd.unsorted, item);
    routed += 1;
  }
  rd.tools = keptTools;

  rd.meta.confidenceGate = {
    version: CONFIDENCE_GATE,
    thresholds,
    routed,
    at: new Date().toISOString(),
  };

  return rd;
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 */
export function assertConfidenceGate(resumeData) {
  const rd = resumeData || {};
  const failures = [];
  const t = CONFIDENCE_THRESHOLDS;

  if (rd.identity?.name && scoreIdentityName(rd.identity.name) < t.identity) {
    failures.push('low_confidence_name');
  }
  for (const exp of rd.experiences || []) {
    if (scoreExperienceConfidence(exp) < t.experience) failures.push('low_confidence_experience');
  }
  for (const item of rd.education || []) {
    if (scoreEducationLine(item) < t.education) failures.push('low_confidence_education');
  }
  for (const item of [...(rd.skills || []), ...(rd.tools || [])]) {
    if (scoreSkillLine(item) < t.skills) failures.push('low_confidence_skill');
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}
