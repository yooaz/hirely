import type { CVCanonical } from '../../types/cv.types.js';
import type { ConfidenceReport } from '../../types/confidence.types.js';
import type { ValidationReport } from '../../types/review.types.js';

export class LlmRepairValidator {
  shouldRun(params: {
    cv: CVCanonical;
    confidence: ConfidenceReport;
    validation: ValidationReport;
    unknown_block_count: number;
    llm_threshold: number;
  }): boolean {
    const { confidence, unknown_block_count, llm_threshold } = params;
    // Phase 1: keep deterministic by default.
    if (confidence.global >= llm_threshold) return false;
    if (unknown_block_count < 6) return false;
    return false;
  }
}

