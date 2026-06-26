import type { CVCanonical } from '../../types/cv.types.js';
import type { ConfidenceReport } from '../../types/confidence.types.js';
import type { ValidationReport } from '../../types/review.types.js';
import type { LogicalBlock, SectionBlocks } from '../../types/blocks.types.js';
import type { StageTrace } from '../../types/trace.types.js';

import { LlmRepairValidator } from './llm-repair.validator.js';

export class LlmRepairService {
  private validator = new LlmRepairValidator();

  shouldRun(params: {
    cv: CVCanonical;
    confidence: ConfidenceReport;
    validation: ValidationReport;
    unknown_block_count: number;
    llm_threshold: number;
  }): boolean {
    return this.validator.shouldRun(params);
  }

  async repair(
    _cv: CVCanonical,
    _logical_blocks: LogicalBlock[],
    _sections: SectionBlocks
  ): Promise<{ data?: Partial<CVCanonical>; trace?: StageTrace[] }> {
    // Phase 1: disabled (deterministic pipeline only).
    return { data: undefined };
  }
}

