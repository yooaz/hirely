/**
 * Breaks enrichScoreReport ↔ getReviewReadinessReport ↔ computeProductScoreReport cycles.
 * Glue in index.html must call these helpers — never isExportReady() while inside score report.
 */

export const MAX_SCORE_CYCLE_DEPTH = 10;

let scoreReportDepth = 0;

/** @returns {boolean} false when max depth exceeded */
export function enterScoreReportCycle() {
  if (scoreReportDepth >= MAX_SCORE_CYCLE_DEPTH) return false;
  scoreReportDepth += 1;
  return true;
}

export function leaveScoreReportCycle() {
  scoreReportDepth = Math.max(0, scoreReportDepth - 1);
}

export function isInsideScoreReportCycle() {
  return scoreReportDepth > 0;
}

/**
 * Direct readiness gate — no score report re-entry.
 * @param {object|null} cvData
 * @param {{ toClassifyCount?: number, atsScore?: number|null, atsBand?: object|null }} [opts]
 * @param {(cv: object|null, o: object) => object} buildReviewReadinessReport
 */
export function exportReadyFromCvData(cvData, opts, buildReviewReadinessReport) {
  if (typeof buildReviewReadinessReport !== 'function') return false;
  try {
    return !!buildReviewReadinessReport(cvData, opts)?.exportReady;
  } catch {
    return false;
  }
}
