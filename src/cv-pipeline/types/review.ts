/**
 * CV Pipeline — review hints & user correction types.
 * @module cv-pipeline/types/review
 */

export type ReviewHintType =
  | 'missing_dates'
  | 'ambiguous_company'
  | 'ambiguous_job_title'
  | 'unclassified_block'
  | 'low_confidence_contact'
  | 'duplicate_phone'
  | 'duplicate_email'
  | 'invalid_email'
  | 'invalid_date_range'
  | 'experience_incomplete'
  | 'education_incomplete'
  | 'skills_uncategorized'
  | 'high_other_content';

export type ReviewSeverity = 'low' | 'medium' | 'high';

export type SuggestedAction =
  | 'ask_user_confirmation'
  | 'move_to_section'
  | 'delete_line'
  | 'merge_items'
  | 'pick_one_of_many';

/** §5.4 — UI-facing ambiguity / correction hint. */
export interface ReviewHint {
  id: string;
  type: ReviewHintType;
  severity: ReviewSeverity;
  message: string;
  target_ids: string[];
  suggested_action: SuggestedAction;
  /** Optional JSON-pointer style paths, e.g. experiences[0].company */
  field_paths?: string[];
  /** Candidate values when pick_one_of_many */
  candidates?: string[];
  source_block_ids?: string[];
}

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

/** §18.3 — User correction payload. */
export interface FieldUpdate {
  path: string;
  value: unknown;
  previous_value?: unknown;
}

export interface CorrectionPayload {
  field_updates: FieldUpdate[];
  block_actions?: BlockCorrection[];
}

export interface BlockCorrection {
  block_id: string;
  action: 'keep' | 'delete' | 'reclassify';
  target_section?: string;
}
