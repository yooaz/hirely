/**
 * ATS analyzer — pipeline entry for weighted ATS scoring.
 */

import { ATS_CATEGORIES, computeAtsScore } from './ats-engine.js';
import { analyzeAtsPro, ATS_ENGINE_PRO } from './ats-engine-pro.js';

export { ATS_CATEGORIES, computeAtsScore, analyzeAtsPro, ATS_ENGINE_PRO };

/**
 * @param {object|null} cvData
 * @param {{ timestamp?: number, jobDescription?: string, job?: string }} [opts]
 */
export function analyzeAts(cvData, opts = {}) {
  const pro = analyzeAtsPro(cvData, opts);
  const legacy = computeAtsScore(cvData);
  if (!legacy && !pro?.ready) return null;
  return {
    ...(legacy || {}),
    pro,
    score: pro?.ready ? pro.score : legacy?.total ?? legacy?.score ?? 0,
    total: pro?.ready ? pro.score : legacy?.total ?? legacy?.score ?? 0,
    atsScore: pro?.ready ? pro.score : legacy?.total ?? legacy?.score ?? 0,
    risks: pro?.risks || [],
    recommendations: pro?.recommendations || legacy?.nextActions?.map((a) => ({ priority: 'medium', action: a })) || [],
    confidence: pro?.confidence || null,
    benchmarks: pro?.benchmarks || [],
    pipeline: 'ats-analyzer',
    analyzedAt: opts.timestamp ?? Date.now(),
  };
}
