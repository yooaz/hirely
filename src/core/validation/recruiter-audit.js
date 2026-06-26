/**
 * Recruiter audit — ATS score + H5 quality checks + actionable fixes.
 */

import { analyzeAts } from './ats-analyzer.js';
import { buildRecruiterReview } from './recruiter-review.js';
import { auditRecruiterQuality } from './recruiter-quality-audit.js';
import { runRecruiterAuditEngine } from './recruiter-audit-engine.js';

function mergeFixes(primary, secondary) {
  const out = [...(primary || [])];
  for (const fix of secondary || []) {
    if (!out.some((x) => x.id === fix.id)) out.push(fix);
  }
  const order = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return out.slice(0, 10);
}

/**
 * @param {object|null} cvData
 * @param {{ resumeData?: object }} [opts]
 */
export function runRecruiterAudit(cvData, opts = {}) {
  const quality = auditRecruiterQuality(cvData, opts);
  const ats = quality.ats || analyzeAts(cvData);
  const review = buildRecruiterReview(cvData);
  const fixes = mergeFixes(quality.fixes, review.fixes);
  const scoreResult = ats || quality.ats;
  const engine = runRecruiterAuditEngine({
    cvData,
    cvDataV2: opts.cvDataV2 ?? null,
    resumeData: opts.resumeData ?? null,
    finalResumeData: opts.finalResumeData ?? null,
    importQualityScore: opts.importQualityScore ?? null,
    jobDescription: opts.jobDescription ?? opts.job ?? '',
  });
  return {
    atsScore: engine.overall ?? scoreResult?.score ?? scoreResult?.total ?? quality.panel?.score ?? 0,
    score: engine.overall ?? scoreResult?.score ?? scoreResult?.total ?? 0,
    overall: engine.overall ?? scoreResult?.total ?? 0,
    band: engine.band ?? scoreResult?.band ?? review.band,
    breakdown: scoreResult?.breakdown ?? [],
    checklist: scoreResult?.checklist ?? [],
    strengths: engine.strengths?.length ? engine.strengths : scoreResult?.strengths ?? [],
    weaknesses: engine.weaknesses?.length ? engine.weaknesses : scoreResult?.weaknesses ?? [],
    recommendations: engine.recommendations?.length ? engine.recommendations : scoreResult?.recommendations ?? [],
    dimensions: engine.dimensions ?? [],
    scores: engine.scores ?? {},
    headline: engine.headline ?? '',
    reviewText: engine.reviewText ?? '',
    engine,
    review: { ...review, fixes },
    quality,
    checks: quality.checks,
    panel: scoreResult?.panel ?? quality.panel,
    fixes,
    ats: scoreResult,
    hallucinationSafe: true,
  };
}

export { buildRecruiterReview, auditRecruiterQuality };
