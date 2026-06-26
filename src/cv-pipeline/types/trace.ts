/**
 * CV Pipeline — observability & stage tracing.
 * @module cv-pipeline/types/trace
 */

import type { DocumentProfile } from './document.js';
import type { LayoutAnalysis } from './blocks.js';
import type { ConfidenceReport } from './confidence.js';
import type { ValidationReport } from './review.js';

export type PipelineStageName =
  | 'document_received'
  | 'document_classified'
  | 'native_extraction_done'
  | 'ocr_done'
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

export type StageStatus = 'ok' | 'degraded' | 'fallback' | 'error' | 'skipped';

export interface StageTrace {
  stage: PipelineStageName;
  status: StageStatus;
  duration_ms: number;
  started_at: string;
  ended_at: string;
  metrics?: Record<string, number | string | boolean>;
  errors?: string[];
  fallback_reason?: string;
}

/** §23 — Full technical trace attached to CVCanonical.parsing_trace. */
export interface ParsingTrace {
  pipeline_version: string;
  document_profile?: DocumentProfile;
  layout?: Pick<LayoutAnalysis, 'layout_type' | 'has_sidebar' | 'confidence'>;
  stages: StageTrace[];
  total_duration_ms: number;
  truth_source: 'native' | 'ocr' | 'hybrid' | 'docx' | 'text';
  block_counts: {
    raw: number;
    normalized: number;
    logical: number;
    unknown: number;
    other_section: number;
  };
  confidence?: ConfidenceReport;
  validation?: ValidationReport;
  llm_fallback_used: boolean;
}

export interface PipelineMetrics {
  /** V1 performance targets (§3.1), milliseconds. */
  targets: {
    pdf_native: number;
    pdf_scanned_1p: number;
    pdf_scanned_2p: number;
    docx: number;
  };
  actual_ms: number;
  within_target: boolean;
}

export const PIPELINE_PERF_TARGETS_V1: PipelineMetrics['targets'] = {
  pdf_native: 2000,
  pdf_scanned_1p: 4000,
  pdf_scanned_2p: 7000,
  docx: 2000,
};
