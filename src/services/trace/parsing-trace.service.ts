import type { DocumentProfile } from '../../types/document.types.js';
import type { LayoutAnalysis } from '../../types/layout.types.js';
import type { ConfidenceReport, ParsingTrace, ParsingTraceStep } from '../../types/cv.types.js';
import type { ValidationReport } from '../../types/review.types.js';
import type { StageTrace } from '../../types/trace.types.js';
import { stageStatusToTraceStepStatus } from '../../types/trace.types.js';

function stageToStep(stage: StageTrace): ParsingTraceStep {
  return {
    name: stage.stage,
    status: stageStatusToTraceStepStatus(stage.status),
    duration_ms: stage.duration_ms,
    message: stage.errors?.[0] || stage.fallback_reason,
    metrics: stage.metrics as Record<string, unknown> | undefined,
  };
}

function findStageEndedAt(stages: StageTrace[], name: StageTrace['stage']): string | undefined {
  const hit = stages.find((s) => s.stage === name);
  return hit?.ended_at;
}

export class ParsingTraceService {
  build(params: {
    started_at: string;
    stages: StageTrace[];
    confidence: ConfidenceReport;
    validation: ValidationReport;
  }): ParsingTrace {
    const { stages } = params;
    return {
      document_received_at: params.started_at,
      document_classified_at: findStageEndedAt(stages, 'document_classified'),
      native_extraction_done_at: findStageEndedAt(stages, 'native_extraction_done'),
      ocr_done_at: findStageEndedAt(stages, 'ocr_done'),
      layout_analysis_done_at: findStageEndedAt(stages, 'layout_analysis_done'),
      normalization_done_at: findStageEndedAt(stages, 'normalization_done'),
      section_segmentation_done_at: findStageEndedAt(stages, 'section_segmentation_done'),
      experience_parsing_done_at: findStageEndedAt(stages, 'experience_parsing_done'),
      confidence_scored_at: findStageEndedAt(stages, 'confidence_scored'),
      review_hints_generated_at: findStageEndedAt(stages, 'review_hints_generated'),
      steps: stages.map(stageToStep),
    };
  }
}
