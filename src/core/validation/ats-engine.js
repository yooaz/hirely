/**
 * ATS / recruiter score facade — delegates to Recruiter Score V2.
 */

import { SCORE_V2_CATEGORIES, computeRecruiterScoreV2 } from './recruiter-score-v2.js';
import { ATS_QUALITY_H8, computeAtsQualityH8, normalizeCvForAtsScoring, detectCvArchetype } from './ats-quality-h8.js';

export { ATS_QUALITY_H8, computeAtsQualityH8, normalizeCvForAtsScoring, detectCvArchetype };

/** @deprecated use SCORE_V2_CATEGORIES — kept for import compatibility */
export const ATS_CATEGORIES = SCORE_V2_CATEGORIES;

/**
 * @param {object|null} cvData
 * @returns {object|null}
 */
/**
 * @param {object|null} cvData
 * @param {{ resumeData?: object|null }} [opts] optional resumeData for ATS enrichment
 */
export function computeAtsScore(cvData, opts = {}) {
  return computeAtsQualityH8(cvData, opts);
}

/**
 * Four-dimension recruiter panel metrics (0–100 each).
 * @param {ReturnType<typeof computeRecruiterScoreV2>} scoreResult
 */
export function buildRecruiterPanelMetrics(scoreResult) {
  if (!scoreResult) return null;
  const panel = scoreResult.panel || {};
  const scores = scoreResult.scores || {};
  return {
    overall: panel.overall ?? scores.overall ?? scoreResult.total ?? scoreResult.score ?? 0,
    content: panel.content ?? scores.content ?? panel.completeness ?? 0,
    experience: panel.experience ?? scores.experience ?? scoreResult.experience?.score ?? 0,
    readability: panel.readability ?? scores.readability ?? scoreResult.readability?.score ?? 0,
    ats: panel.ats ?? scores.ats ?? scoreResult.ats?.score ?? 0,
    completeness: panel.completeness ?? scores.content ?? 0,
    recruiterReady: panel.recruiterReady ?? panel.overall ?? scoreResult.total ?? 0,
  };
}

/**
 * @param {ReturnType<typeof computeRecruiterScoreV2>} scoreResult
 * @param {boolean} [exportReady]
 */
export function buildRecruiterChecklist(scoreResult, exportReady = false) {
  const base = scoreResult?.checklist || [
    { id: 'name', ok: false },
    { id: 'title', ok: false },
    { id: 'email', ok: false },
    { id: 'phone', ok: false },
    { id: 'experience', ok: false },
    { id: 'education', ok: false },
    { id: 'skills', ok: false },
    { id: 'tools', ok: false },
    { id: 'languages', ok: false },
  ];
  return [...base, { id: 'export', ok: !!exportReady }];
}
