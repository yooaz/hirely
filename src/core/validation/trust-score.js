/**
 * H19 — Trust score rewrite.
 * Weighted pillars: extraction 40%, completeness 25%, recruiter quality 25%, formatting 10%.
 * Hard caps on identity/contact/sections and unresolved critical review items.
 */

import { computeRecruiterScoreV2 } from './recruiter-score-v2.js';
import { resolveChecklistProfile } from './recruiter-checklist-source.js';
import { validateConsumerDataSource } from './resume-data-contract.js';
import { isUncertainIdentityName } from '../display/undetected-label.js';
import { pendingReviewItems } from '../parsing/review-queue.js';

export const TRUST_SCORE_V1 = 'TRUST_SCORE_V1';

export const TRUST_SCORE_WEIGHTS = Object.freeze({
  extraction: 0.4,
  completeness: 0.25,
  recruiterQuality: 0.25,
  formatting: 0.1,
});

export const TRUST_SCORE_CAPS = Object.freeze({
  wrongName: 30,
  missingEmail: 40,
  missingExperience: 50,
  missingEducation: 60,
  criticalReview: 70,
});

const GARBAGE_NAME_RE =
  /^(ben|music|reading|typography|branding|illustration|vector|print|logo)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CRITICAL_REVIEW_FIELDS = new Set([
  'identity',
  'identity.name',
  'identity.title',
  'experiences',
  'experience',
  'raw',
  'contact',
  'email',
  'summary',
  'profile',
]);

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function hasName(p) {
  const n = String(p?.name || '').trim();
  if (!n || isUncertainIdentityName(n)) return false;
  if (GARBAGE_NAME_RE.test(n)) return false;
  return n.length >= 2 && n.length <= 80;
}

function hasEmail(p) {
  return EMAIL_RE.test(String(p?.email || '').trim());
}

function resumeSectionCount(p, key) {
  const n = p?._resumeCounts?.[key];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function hasExperience(p) {
  if (resumeSectionCount(p, 'experiences') > 0) return true;
  return Array.isArray(p?.experience) && p.experience.filter(Boolean).length > 0;
}

function hasEducation(p) {
  if (resumeSectionCount(p, 'education') > 0) return true;
  return Array.isArray(p?.education) && p.education.filter(Boolean).length > 0;
}

/**
 * @param {object} item
 */
export function isCriticalReviewItem(item) {
  if (!item || item.status !== 'pending') return false;
  const field = String(item.field || item.detectedType || '').toLowerCase();
  if (CRITICAL_REVIEW_FIELDS.has(field)) return true;
  if (item.action === 'corruption' || item.semanticConfidenceGate === true) return true;
  if (Number(item.confidence) > 0 && Number(item.confidence) < 50) return true;
  if (item.priority === 'high' || item.critical === true) return true;
  return false;
}

/**
 * @param {object[]|null|undefined} queue
 */
export function countUnresolvedCriticalReview(queue) {
  return pendingReviewItems(queue || []).filter(isCriticalReviewItem).length;
}

/**
 * @param {object|null} cvData
 * @param {{ toClassifyCount?: number, reviewQueue?: object[], reviewQueueCount?: number, importQualityScore?: object|null }} [opts]
 */
export function assessTrustScoreIssues(cvData, opts = {}) {
  const wrongName = !hasName(cvData);
  const missingEmail = !hasEmail(cvData);
  const missingExperience = !hasExperience(cvData);
  const missingEducation = !hasEducation(cvData);
  const reviewQueue = opts.reviewQueue || cvData?.reviewQueue || [];
  const criticalReviewCount = countUnresolvedCriticalReview(reviewQueue);
  const unresolvedCriticalReview = criticalReviewCount > 0;
  const toClassify = Number(opts.toClassifyCount) || 0;

  return {
    wrongName,
    missingEmail,
    missingExperience,
    missingEducation,
    unresolvedCriticalReview,
    criticalReviewCount,
    toClassifyCount: toClassify,
    reviewQueueCount:
      Number(opts.reviewQueueCount) ||
      pendingReviewItems(reviewQueue).length,
  };
}

function bandFromTotal(total) {
  if (total >= 80) {
    return {
      label: 'Excellent',
      labelKey: 'bandExcellent',
      desc: 'CV prêt à envoyer — identité, contact et sections essentielles solides.',
    };
  }
  if (total >= 60) {
    return {
      label: 'Good',
      labelKey: 'bandGood',
      desc: 'Base solide — renforcez les sections faibles ci-dessous.',
    };
  }
  if (total >= 40) {
    return {
      label: 'Fair',
      labelKey: 'bandAverage',
      desc: 'Profil partiel — complétez contact, expérience et compétences.',
    };
  }
  return {
    label: 'Needs improvement',
    labelKey: 'bandNeedsImprovement',
    desc: 'Sections clés manquantes — corrigez avant envoi.',
  };
}

function pillarPctFromBreakdown(breakdown, id) {
  const cat = (breakdown || []).find((c) => c.id === id);
  if (!cat || !cat.max) return null;
  return clamp((cat.points / cat.max) * 100);
}

/**
 * @param {object|null} report
 * @param {object|null} cvData
 * @param {{ toClassifyCount?: number, reviewQueue?: object[], reviewQueueCount?: number, importQualityScore?: object|null }} [opts]
 */
export function applyTrustScoreCaps(report, cvData, opts = {}) {
  if (!report || typeof report.total !== 'number') return report;

  const issues = assessTrustScoreIssues(cvData, {
    ...opts,
    reviewQueue: opts.reviewQueue || cvData?.reviewQueue,
  });

  let maxScore = 100;
  /** @type {{ id: string, max: number, label: string }[]} */
  const capReasons = [];

  if (issues.wrongName) {
    maxScore = Math.min(maxScore, TRUST_SCORE_CAPS.wrongName);
    capReasons.push({ id: 'wrong_name', max: TRUST_SCORE_CAPS.wrongName, label: 'Name not confirmed' });
  }
  if (issues.missingEmail) {
    maxScore = Math.min(maxScore, TRUST_SCORE_CAPS.missingEmail);
    capReasons.push({ id: 'missing_email', max: TRUST_SCORE_CAPS.missingEmail, label: 'Email missing' });
  }
  if (issues.missingExperience) {
    maxScore = Math.min(maxScore, TRUST_SCORE_CAPS.missingExperience);
    capReasons.push({
      id: 'missing_experience',
      max: TRUST_SCORE_CAPS.missingExperience,
      label: 'Experience missing',
    });
  }
  if (issues.missingEducation) {
    maxScore = Math.min(maxScore, TRUST_SCORE_CAPS.missingEducation);
    capReasons.push({
      id: 'missing_education',
      max: TRUST_SCORE_CAPS.missingEducation,
      label: 'Education missing',
    });
  }
  if (issues.unresolvedCriticalReview) {
    maxScore = Math.min(maxScore, TRUST_SCORE_CAPS.criticalReview);
    capReasons.push({
      id: 'critical_review',
      max: TRUST_SCORE_CAPS.criticalReview,
      label: 'Unresolved critical review items',
    });
  }

  const rawTotal = report.trustScore?.rawWeighted ?? report.total;
  const total = clamp(Math.min(rawTotal, maxScore));
  const capped = total < rawTotal;

  const next = {
    ...report,
    total,
    score: total,
    credibilityCapped: capped,
    credibilityCap: maxScore,
    credibilityReasons: capReasons,
    trustCaps: {
      version: TRUST_SCORE_V1,
      capped,
      rawTotal,
      maxScore,
      issues,
      reasons: capReasons,
    },
    credibility: {
      version: TRUST_SCORE_V1,
      capped,
      rawTotal,
      maxScore,
      issues,
      reasons: capReasons,
    },
  };

  if (capped) next.band = bandFromTotal(total);
  return next;
}

/**
 * @param {object|null} cvData
 * @param {{ finalResumeData?: object|null, resumeData?: object|null, importQualityScore?: object|null, reviewQueue?: object[], reviewQueueCount?: number, toClassifyCount?: number }} [opts]
 */
export function computeTrustScore(cvData, opts = {}) {
  const profile = resolveChecklistProfile({
    finalResumeData: opts.finalResumeData ?? null,
    resumeData: opts.resumeData ?? null,
    cvData,
  });
  if (!profile) return null;

  const sourceCheck = validateConsumerDataSource(profile, 'ATS', { silent: true });
  if (!sourceCheck.ok && typeof console !== 'undefined') {
    console.warn('[HIRELY_TRUST_SCORE] ATS blocked raw OCR input', sourceCheck.violations);
  }

  const recruiterReport = computeRecruiterScoreV2(profile);
  if (!recruiterReport) return null;

  const iq = opts.importQualityScore || null;
  const extractionRaw = iq?.extraction ?? recruiterReport.ats?.score ?? recruiterReport.total ?? 50;
  const classificationRaw = iq?.parser ?? recruiterReport.readability?.score ?? extractionRaw;
  const extractionPillar = clamp(extractionRaw * 0.55 + classificationRaw * 0.45);

  const completenessPillar = clamp(
    iq?.completeness ??
      recruiterReport.completeness?.score ??
      recruiterReport.panel?.completeness ??
      50
  );

  const recruiterPillar = clamp(recruiterReport.total ?? 0);

  const formattingPillar = clamp(
    pillarPctFromBreakdown(recruiterReport.breakdown, 'formatting') ??
      recruiterReport.readability?.score ??
      70
  );

  const rawWeighted = clamp(
    extractionPillar * TRUST_SCORE_WEIGHTS.extraction +
      completenessPillar * TRUST_SCORE_WEIGHTS.completeness +
      recruiterPillar * TRUST_SCORE_WEIGHTS.recruiterQuality +
      formattingPillar * TRUST_SCORE_WEIGHTS.formatting
  );

  const base = {
    ...recruiterReport,
    version: TRUST_SCORE_V1,
    total: rawWeighted,
    score: rawWeighted,
    band: bandFromTotal(rawWeighted),
    trustScore: {
      version: TRUST_SCORE_V1,
      rawWeighted,
      weights: { ...TRUST_SCORE_WEIGHTS },
      caps: { ...TRUST_SCORE_CAPS },
      pillars: {
        extraction: {
          score: extractionPillar,
          weight: TRUST_SCORE_WEIGHTS.extraction,
          extractionQuality: extractionRaw,
          classificationQuality: classificationRaw,
          label: 'Extraction',
          labelKey: 'trustPillarExtraction',
        },
        completeness: {
          score: completenessPillar,
          weight: TRUST_SCORE_WEIGHTS.completeness,
          label: 'Completeness',
          labelKey: 'trustPillarCompleteness',
        },
        recruiterQuality: {
          score: recruiterPillar,
          weight: TRUST_SCORE_WEIGHTS.recruiterQuality,
          label: 'Recruiter quality',
          labelKey: 'trustPillarRecruiter',
        },
        formatting: {
          score: formattingPillar,
          weight: TRUST_SCORE_WEIGHTS.formatting,
          label: 'Formatting',
          labelKey: 'trustPillarFormatting',
        },
      },
    },
    panel: {
      ...(recruiterReport.panel || {}),
      overall: rawWeighted,
      extraction: extractionPillar,
      completeness: completenessPillar,
      recruiterQuality: recruiterPillar,
      formatting: formattingPillar,
    },
  };

  return applyTrustScoreCaps(base, profile, opts);
}
