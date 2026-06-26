/**
 * P0 — Block fake / guessed experiences from final CV preview.
 */

import { auditInventedExperience, stripInventedExperiences } from '../parsing/invented-experience-guard.js';
import { normalizeReviewItem } from '../parsing/review-queue-merge.js';

export const FAKE_EXPERIENCE_GATE_V1 = 'FAKE_EXPERIENCE_GATE_V1';

const GENERIC_ROLE_ONLY_RE =
  /^(designer|intern|freelance|internship|stagiaire|graphic\s+designer|visual\s+designer|illustrator)$/i;

const SECTION_LABEL_RE =
  /\b(profil!?|profile|résumé|resume|summary|objective|coordonnées|contact|experience|expériences?|education|formation|skills?|compétences?|page\s+\d|section\s*\d*)\b/i;

const BRACE_ARTIFACT_RE = /^\{[^}]+\}$/;

const GUESSED_RANGE_RE = /\b(2010|2011|2012)\s*[-–—]\s*(present|présent|2023|current)\b/i;

const YEAR_RE = /\b(19|20)\d{2}\b/;
const CURRENT_MARKER_RE = /\b(present|présent|current|now)\b/i;
const ACTIVITY_BULLET_RE =
  /^(led|managed|designed|created|developed|produced|delivered|built|coordinated|implemented|illustrated|directed|oversaw|supported|maintained|launched)\b/i;

/**
 * Generic titles (e.g. "Designer") are allowed when anchored to a real employer and explicit dates in source.
 * @param {object} exp
 * @param {string} [sourceText]
 */
export function genericRoleHasAnchoredEmploymentContext(exp, sourceText = '') {
  const role = String(exp?.role || exp?.title || '').trim();
  if (!isGenericOnlyExperienceRole(role)) return true;

  const company = String(exp?.company || '').trim();
  const src = String(
    sourceText || exp.sourceText || [role, company, exp.dates, ...(exp.bullets || [])].filter(Boolean).join(' — ')
  ).trim();

  if (!company || isGenericOnlyExperienceRole(company) || BRACE_ARTIFACT_RE.test(company)) return false;
  if (/\binternship\b/i.test(company) || /\binternship\b/i.test(role)) return false;

  const dates = String(exp?.dates || '').trim();
  const hasExplicitDate =
    (YEAR_RE.test(src) &&
      (YEAR_RE.test(dates) || YEAR_RE.test(exp?.startDate || '') || YEAR_RE.test(exp?.endDate || ''))) ||
    (CURRENT_MARKER_RE.test(src) &&
      (CURRENT_MARKER_RE.test(dates) || CURRENT_MARKER_RE.test(exp?.endDate || '')));
  if (!hasExplicitDate) return false;

  const bullets = (exp?.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
  const hasActivity = bullets.some((b) => ACTIVITY_BULLET_RE.test(b));
  const hasStructuredSource = /\s[-–—]\s/.test(src) && YEAR_RE.test(src);

  return hasActivity || hasStructuredSource;
}

/**
 * @param {string} role
 */
export function isGenericOnlyExperienceRole(role) {
  const r = String(role || '').trim();
  if (!r) return true;
  if (BRACE_ARTIFACT_RE.test(r)) return true;
  return GENERIC_ROLE_ONLY_RE.test(r);
}

/**
 * @param {string} text
 */
export function experienceLineHasSectionLabelPollution(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (SECTION_LABEL_RE.test(s) && !/\s[-–—|]\s/.test(s)) return true;
  if (/^profil!?\b/i.test(s)) return true;
  return false;
}

/**
 * @param {object} exp
 * @param {string} [sourceText]
 */
export function experienceHasGuessedPresent(exp, sourceText = '') {
  const end = String(exp?.endDate || '').trim();
  const dates = String(exp?.dates || '').trim();
  if (!/present|présent|current|now/i.test(end) && !/present|présent|current|now/i.test(dates)) {
    return false;
  }
  const src = String(sourceText || exp?.sourceText || dates || '').trim();
  return !/\bpresent|présent|current|now\b/i.test(src);
}

/**
 * @param {object} exp
 * @param {string} [sourceText]
 * @returns {{ fake: boolean, reason?: string }}
 */
export function auditFakeExperience(exp, sourceText = '') {
  if (!exp || typeof exp !== 'object') return { fake: true, reason: 'empty' };

  const role = String(exp.role || exp.title || '').trim();
  const company = String(exp.company || '').trim();
  const src = String(
    sourceText || exp.sourceText || [role, company, exp.dates, ...(exp.bullets || [])].filter(Boolean).join(' — ')
  ).trim();

  if (experienceLineHasSectionLabelPollution(src) || experienceLineHasSectionLabelPollution(role) || experienceLineHasSectionLabelPollution(company)) {
    return { fake: true, reason: 'section_label' };
  }

  if (!company || isGenericOnlyExperienceRole(company) || BRACE_ARTIFACT_RE.test(company)) {
    return { fake: true, reason: 'missing_company' };
  }

  if (isGenericOnlyExperienceRole(role)) {
    if (!genericRoleHasAnchoredEmploymentContext(exp, src)) {
      return { fake: true, reason: 'generic_role' };
    }
  }

  if (experienceHasGuessedPresent(exp, src)) {
    return { fake: true, reason: 'guessed_present' };
  }

  if (GUESSED_RANGE_RE.test(src) || GUESSED_RANGE_RE.test(String(exp.dates || ''))) {
    return { fake: true, reason: 'guessed_date_range' };
  }

  const invented = auditInventedExperience(exp);
  if (invented.invented) return { fake: true, reason: invented.reason || 'invented' };

  return { fake: false };
}

/**
 * @param {object[]} experiences
 * @returns {{ kept: object[], review: object[], rejected: object[] }}
 */
export function enforceFakeExperienceGate(experiences = []) {
  const invented = stripInventedExperiences(experiences);
  const kept = [];
  const review = [...(invented.review || [])];
  const rejected = [...(invented.rejected || [])];

  for (const exp of invented.kept) {
    const src = [exp.role, exp.company, exp.dates, ...(exp.bullets || [])].filter(Boolean).join(' — ');
    const audit = auditFakeExperience(exp, src);
    if (!audit.fake) {
      kept.push(exp);
      continue;
    }
    rejected.push({ exp, reason: audit.reason });
    review.push(
      normalizeReviewItem({
        field: 'experiences',
        detectedType: 'experience',
        detected: src,
        sourceText: src,
        sourceLines: [src],
        confidence: 38,
        reason: `Expérience rejetée (${audit.reason}) — confirmer dans la file de relecture`,
        status: 'pending',
        fakeExperienceGate: true,
      })
    );
  }

  return { kept, review, rejected };
}
