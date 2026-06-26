/**
 * Parsing trace & observability (internal pipeline stages).
 */

import type { DocumentProfile } from './document.types.js';
import type { LayoutType } from './layout.types.js';
import type { ConfidenceReport } from './cv.types.js';
import type { ValidationReport } from './review.types.js';
import type { ParsingTrace, ParsingTraceStep } from './cv.types.js';

export type { ParsingTrace, ParsingTraceStep };

export type StageName =
  | 'document_received'
  | 'document_classified'
  | 'native_extraction_done'
  | 'ocr_done'
  | 'docx_extraction_done'
  | 'text_extraction_done'
  | 'layout_analysis_done'
  | 'normalization_done'
  | 'block_building_done'
  | 'section_segmentation_done'
  | 'entity_extraction_done'
  | 'contact_parsing_done'
  | 'summary_parsing_done'
  | 'experience_parsing_done'
  | 'education_parsing_done'
  | 'skills_parsing_done'
  | 'canonical_build_done'
  | 'confidence_scored'
  | 'validation_done'
  | 'llm_fallback_triggered'
  | 'llm_repair_done'
  | 'review_hints_generated';

export type StageStatus = 'ok' | 'degraded' | 'failed' | 'skipped';

export interface StageTrace {
  stage: StageName;
  status: StageStatus;
  duration_ms: number;
  started_at: string;
  ended_at: string;
  metrics?: Record<string, number | string | boolean>;
  errors?: string[];
  fallback_reason?: string;
}

export interface PipelineObservabilityTrace {
  pipeline_version: string;
  document_profile: DocumentProfile;
  layout: {
    layout_type: LayoutType;
    has_sidebar: boolean;
    confidence: number;
  };
  stages: StageTrace[];
  total_duration_ms: number;
  truth_source: 'native' | 'ocr' | 'docx' | 'text' | 'hybrid';
  block_counts: {
    raw: number;
    normalized: number;
    logical: number;
    unknown: number;
    other_section: number;
  };
  confidence: ConfidenceReport;
  validation: ValidationReport;
  llm_fallback_used: boolean;
}

export const PIPELINE_PERF_TARGETS_V1 = {
  pdf_native: 2000,
  pdf_scanned_1p: 4000,
  pdf_scanned_2p: 7000,
  docx: 2000,
} as const;

export const CV_PIPELINE_VERSION = 'HIRELY_CV_BACKEND_V1';

export function stageStatusToTraceStepStatus(status: StageStatus): ParsingTraceStep['status'] {
  if (status === 'ok' || status === 'degraded') return 'PASS';
  if (status === 'skipped') return 'SKIPPED';
  return 'FAIL';
}
