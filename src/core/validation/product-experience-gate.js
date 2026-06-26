/**
 * H16 — Product empty-state gate when extraction quality is below threshold.
 */

import { CV_UNCLASSIFIED_MSG_FR } from './cv-completeness-audit.js';
import { isV1AtsBlockersDisabled } from '../import/v1-scope-lock.js';

export const PRODUCT_EXPERIENCE_GATE_V1 = 'PRODUCT_EXPERIENCE_GATE_V1';
export const EXTRACTION_QUALITY_EXPORT_MIN = 80;

/**
 * @param {{
 *   importQualityScore?: object|null,
 *   exportReady?: boolean,
 *   recruiterTotal?: number|null,
 *   credibility?: object|null,
 *   completenessAudit?: object|null,
 * }} input
 */
export function assessProductExperienceGate(input = {}) {
  if (isV1AtsBlockersDisabled()) {
    const recruiterTotal = input.recruiterTotal ?? null;
    return {
      version: PRODUCT_EXPERIENCE_GATE_V1,
      extractionQuality: input.importQualityScore?.overall ?? input.importQualityScore?.extraction ?? null,
      lowExtraction: false,
      reviewRequired: false,
      showReadyExport: !!input.exportReady,
      showHighRecruiterScore: recruiterTotal != null && recruiterTotal >= 80,
      reasons: [],
      v1ScopeLock: true,
    };
  }
  const iq = input.importQualityScore || null;
  const extractionQuality = iq?.overall ?? iq?.extraction ?? null;
  const lowExtraction =
    extractionQuality != null && extractionQuality < EXTRACTION_QUALITY_EXPORT_MIN;

  /** @type {string[]} */
  const reasons = [];

  if (lowExtraction) {
    if (extractionQuality < 60) {
      reasons.push('Document text was only partially recovered.');
    } else {
      reasons.push('Extraction quality is not high enough for export-ready status.');
    }
    if (iq?.parser != null && iq.parser < 75) {
      reasons.push('Some content still needs manual placement or correction.');
    }
    if (iq?.completeness != null && iq.completeness < 75) {
      reasons.push('Key CV sections are incomplete.');
    }
    if (iq?.metrics?.reviewQueueCount > 0) {
      reasons.push(`${iq.metrics.reviewQueueCount} item(s) waiting in review.`);
    }
  }

  const completeness = input.completenessAudit || null;
  const lowCompleteness = completeness && completeness.meetsTarget === false;
  if (lowCompleteness) {
    const msg = completeness.messageFr || CV_UNCLASSIFIED_MSG_FR;
    if (!reasons.includes(msg)) reasons.push(msg);
    if (completeness.coveragePct != null) {
      const detail = `Couverture ${completeness.coveragePct}% (objectif ${completeness.targetPct ?? 80}%).`;
      if (!reasons.includes(detail)) reasons.push(detail);
    }
  }

  if (input.credibility?.reasons?.length) {
    for (const r of input.credibility.reasons) {
      const msg =
        r.id === 'wrong_name'
          ? 'Confirm your name before trusting the recruiter score.'
          : r.id === 'missing_experience'
            ? 'Add at least one experience entry.'
            : r.id === 'missing_education'
              ? 'Education is missing from the structured CV.'
              : r.id === 'partial_cv'
                ? 'The CV is still partial — finish review first.'
                : r.label;
      if (msg && !reasons.includes(msg)) reasons.push(msg);
    }
  }

  const showReadyExport = !!input.exportReady && !lowExtraction && !lowCompleteness;
  const recruiterTotal = input.recruiterTotal ?? null;
  const showHighRecruiterScore =
    !lowExtraction && recruiterTotal != null && recruiterTotal >= 80;

  return {
    version: PRODUCT_EXPERIENCE_GATE_V1,
    extractionQuality,
    lowExtraction,
    reviewRequired: lowExtraction || lowCompleteness || reasons.length > 0,
    showReadyExport,
    showHighRecruiterScore,
    reasons: reasons.slice(0, 5),
  };
}
