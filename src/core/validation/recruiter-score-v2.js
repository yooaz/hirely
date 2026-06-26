/**
 * HIRELY P2 — ATS score facade (delegates to ats-quality-h8).
 */

import { computeAtsQualityH8, ATS_QUALITY_H8 } from './ats-quality-h8.js';

export const RECRUITER_SCORE_V2 = 'HIRELY_ATS_SCORE_V2';
export const ATS_SCORE_V2 = 'HIRELY_ATS_SCORE_V2';

/** Core ATS dimensions used by audit scripts. */
export const REAL_ATS_CORE_DIMENSIONS = Object.freeze([
  'identity',
  'experience',
  'education',
  'skills',
  'languages',
]);

export const SCORE_V2_CATEGORIES = Object.freeze({
  identity: { id: 'identity', label: 'Identity', labelKey: 'scoreCatIdentity', max: 15 },
  contact: { id: 'contact', label: 'Contact', labelKey: 'scoreCatContact', max: 10 },
  experience: { id: 'experience', label: 'Experience', labelKey: 'scoreCatExperience', max: 24 },
  education: { id: 'education', label: 'Education', labelKey: 'scoreCatEducation', max: 10 },
  skills: { id: 'skills', label: 'Skills', labelKey: 'scoreCatSkills', max: 12 },
  tools: { id: 'tools', label: 'Tools', labelKey: 'scoreCatTools', max: 8 },
  languages: { id: 'languages', label: 'Languages', labelKey: 'scoreCatLanguages', max: 8 },
  summary: { id: 'summary', label: 'Summary', labelKey: 'scoreCatSummary', max: 8 },
  formatting: { id: 'formatting', label: 'Formatting', labelKey: 'scoreCatFormatting', max: 5 },
});

/**
 * Extract core dimension points from a score result (identity, experience, education, skills, languages).
 * @param {ReturnType<typeof computeRecruiterScoreV2>} result
 */
export function getCoreAtsDimensionScores(result) {
  if (!result?.breakdown) return null;
  const byId = Object.fromEntries(result.breakdown.map((c) => [c.id, c]));
  return REAL_ATS_CORE_DIMENSIONS.reduce((acc, id) => {
    const cat = byId[id];
    acc[id] = cat
      ? { points: cat.points, max: cat.max, pct: cat.max ? Math.round((cat.points / cat.max) * 100) : 0 }
      : { points: 0, max: 0, pct: 0 };
    return acc;
  }, {});
}

/**
 * @param {object|null} cvData
 * @returns {object|null}
 */
export function computeRecruiterScoreV2(cvData) {
  const result = computeAtsQualityH8(cvData);
  if (!result) return null;
  return { ...result, version: ATS_QUALITY_H8 };
}
