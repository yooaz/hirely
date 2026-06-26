/**
 * H19 — Trust score caps (delegates to trust-score.js).
 * @deprecated Prefer computeTrustScore / applyTrustScoreCaps directly.
 */

import {
  TRUST_SCORE_V1,
  TRUST_SCORE_CAPS,
  assessTrustScoreIssues,
  applyTrustScoreCaps,
} from './trust-score.js';

export const SCORE_CREDIBILITY_CAP_V1 = TRUST_SCORE_V1;

/** @param {object|null} cvData @param {object} [opts] */
export function assessCredibilityIssues(cvData, opts = {}) {
  const issues = assessTrustScoreIssues(cvData, opts);
  return {
    wrongName: issues.wrongName,
    missingEmail: issues.missingEmail,
    missingExperience: issues.missingExperience,
    missingEducation: issues.missingEducation,
    partialCv: issues.unresolvedCriticalReview || issues.toClassifyCount > 0,
    cleanCv:
      !issues.wrongName &&
      !issues.missingEmail &&
      !issues.missingExperience &&
      !issues.missingEducation &&
      !issues.unresolvedCriticalReview &&
      issues.toClassifyCount === 0,
    unresolvedCriticalReview: issues.unresolvedCriticalReview,
    criticalReviewCount: issues.criticalReviewCount,
    toClassifyCount: issues.toClassifyCount,
    reviewQueueCount: issues.reviewQueueCount,
  };
}

/** @param {object|null} report @param {object|null} cvData @param {object} [opts] */
export function applyScoreCredibilityCap(report, cvData, opts = {}) {
  return applyTrustScoreCaps(report, cvData, opts);
}

export { TRUST_SCORE_CAPS };
