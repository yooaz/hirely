/**
 * Review hints, validation & user corrections.
 */

export type { ReviewHint, ReviewHintType } from './cv.types.js';
import type { ReviewHint, ConfidenceReport, CVCanonical } from './cv.types.js';

export type ReviewSeverity = ReviewHint['severity'];

export type SuggestedAction = ReviewHint['suggested_action'];

export interface ValidationIssue {
  code: string;
  blocking: boolean;
  message: string;
  field_path?: string;
}

export interface ValidationReport {
  ok: boolean;
  blocking_issues: ValidationIssue[];
  non_blocking_issues: ValidationIssue[];
  other_content_ratio: number;
}

export interface FieldUpdate {
  path: string;
  value: unknown;
  previous_value?: unknown;
}

export interface BlockCorrection {
  block_id: string;
  action: 'keep' | 'delete' | 'reclassify';
  target_section?: string;
}

export interface CorrectionPayload {
  field_updates: FieldUpdate[];
  block_actions?: BlockCorrection[];
}

export interface CorrectionResponse {
  job_id: string;
  cv: CVCanonical;
  confidence: ConfidenceReport;
  review_hints: ReviewHint[];
  correction_trace_id?: string;
}

export interface CorrectionTrace {
  id: string;
  job_id: string;
  applied_at: string;
  updates: FieldUpdate[];
  block_actions?: BlockCorrection[];
}
