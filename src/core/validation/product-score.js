/**
 * Product score — H19 trust score (weighted pillars + hard caps)
 * + P1 trusted CV review (strengths / weaknesses / missing).
 */

import { computeTrustScore } from './trust-score.js';
import { enrichReportWithTrustedReview } from './trusted-cv-review-engine.js';

/** @typedef {{ id: string, ok: boolean }} ChecklistItem */

/**
 * @param {object|null} cvData normalized cvData (display / mapper fallback)
 * @param {{ finalResumeData?: object|null, resumeData?: object|null }} [opts]
 * @returns {object|null}
 */
export function computeProductScore(cvData, opts = {}) {
  try {
    const base = computeTrustScore(cvData, {
      finalResumeData: opts.finalResumeData ?? null,
      resumeData: opts.resumeData ?? null,
      toClassifyCount: opts.toClassifyCount ?? 0,
      reviewQueueCount: opts.reviewQueueCount ?? 0,
      reviewQueue: opts.reviewQueue ?? null,
      importQualityScore: opts.importQualityScore ?? null,
    });
    return enrichReportWithTrustedReview(base, cvData, {
      finalResumeData: opts.finalResumeData ?? null,
      resumeData: opts.resumeData ?? null,
    });
  } catch {
    return { score: 0, capped: true, pillars: {}, issues: ['stack_guard'] };
  }
}
