/**
 * CV Pipeline — confidence scoring types.
 * @module cv-pipeline/types/confidence
 */

import type { SectionId } from './blocks.js';

export type SectionConfidenceMap = Partial<Record<SectionId, number>>;

export interface FieldConfidence {
  path: string;
  value: unknown;
  confidence: number;
  signals: string[];
}

export interface ItemConfidence {
  id: string;
  section: SectionId;
  confidence: number;
  fields: FieldConfidence[];
}

/** §15.3 — Confidence scorer output. */
export interface ConfidenceReport {
  confidence_global: number;
  sections: SectionConfidenceMap;
  items: ItemConfidence[];
  thresholds: {
    render: number;
    review: number;
    llm_fallback: number;
  };
}

export interface ConfidenceScorerInput {
  /** Canonical CV after parsers + builder. */
  cv: import('./canonical.js').CVCanonical;
  /** For layout-aware scoring. */
  logical_block_count: number;
  unknown_block_ratio: number;
}

/** V1 reliability targets (§3.2) — used by QA benchmarks. */
export interface ReliabilityTargets {
  email_detected: number;
  phone_detected: number;
  full_name_detected: number;
  experience_section_detected: number;
  experience_split_accuracy: number;
  max_other_content_ratio: number;
}

export const RELIABILITY_TARGETS_V1: ReliabilityTargets = {
  email_detected: 0.98,
  phone_detected: 0.95,
  full_name_detected: 0.92,
  experience_section_detected: 0.9,
  experience_split_accuracy: 0.85,
  max_other_content_ratio: 0.1,
};
