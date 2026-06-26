/**
 * CV Pipeline — HTTP API contracts (optional backend service).
 * @module cv-pipeline/types/api
 */

import type { CVCanonical } from './canonical.js';
import type { ConfidenceReport } from './confidence.js';
import type { CorrectionPayload } from './review.js';
import type { ReviewHint } from './review.js';
import type { ParsingTrace } from './trace.js';

export type ParseJobStatus = 'queued' | 'processing' | 'done' | 'failed';

/** POST /api/v1/cv/parse — immediate ack. */
export interface ParseJobCreated {
  job_id: string;
  status: 'processing';
}

/** GET /api/v1/cv/parse/{job_id} — poll result. */
export interface ParseJobResult {
  job_id: string;
  status: ParseJobStatus;
  result?: ParsePipelineResult;
  error?: ParseJobError;
}

export interface ParsePipelineResult {
  cv: CVCanonical;
  confidence: ConfidenceReport;
  review_hints: ReviewHint[];
  trace: ParsingTrace;
}

export interface ParseJobError {
  code: string;
  message: string;
  trace?: ParsingTrace;
}

/** POST /api/v1/cv/parse/{job_id}/corrections */
export interface CorrectionRequest extends CorrectionPayload {}

export interface CorrectionResponse {
  job_id: string;
  cv: CVCanonical;
  confidence: ConfidenceReport;
  review_hints: ReviewHint[];
}

export interface ParseCvOptions {
  language_hint?: 'fr' | 'en';
  enable_llm_fallback?: boolean;
  /** Skip LLM if confidence_global >= this (default 0.72). */
  llm_threshold?: number;
  user_id?: string;
}
