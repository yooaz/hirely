/**
 * Confidence scoring contracts.
 */

export type { ConfidenceReport } from './cv.types.js';
import type { ConfidenceReport } from './cv.types.js';
import type { SectionId } from './blocks.types.js';
import type { CVCanonical } from './cv.types.js';

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

export interface ConfidenceScorerInput {
  cv: CVCanonical;
  logical_block_count: number;
  unknown_block_ratio: number;
}

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

export function confidenceGlobal(report: ConfidenceReport): number {
  return report.global;
}
