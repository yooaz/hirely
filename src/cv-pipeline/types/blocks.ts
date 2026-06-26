/**
 * CV Pipeline — layout, normalization, logical blocks & section segmentation.
 * @module cv-pipeline/types/blocks
 */

import type { BBox, ColumnId, LayoutHint, RawBlock, RawPage } from './document.js';

export type LayoutType =
  | 'single_column'
  | 'two_columns'
  | 'sidebar_left'
  | 'sidebar_right'
  | 'complex'
  | 'unknown';

/** §8.2 — Layout analysis output per document. */
export interface LayoutAnalysis {
  layout_type: LayoutType;
  has_sidebar: boolean;
  columns: LayoutColumn[];
  pages: PageLayout[];
  confidence: number;
}

export interface LayoutColumn {
  column_id: ColumnId;
  bbox: BBox;
  page_number: number;
  role?: 'main' | 'sidebar' | 'secondary';
}

export interface PageLayout {
  page_number: number;
  layout_type: LayoutType;
  heading_candidates: string[];
  list_candidates: string[];
}

export interface BlockSignals {
  looks_like_heading: boolean;
  looks_like_date: boolean;
  looks_like_email: boolean;
  looks_like_phone: boolean;
  looks_like_url?: boolean;
  looks_like_bullet?: boolean;
  looks_like_company?: boolean;
  looks_like_job_title?: boolean;
}

/** §4.4 — Post-OCR / post-native normalization. */
export interface NormalizedBlock {
  block_id: string;
  raw_text: string;
  normalized_text: string;
  tokens: string[];
  bbox: BBox;
  page_number: number;
  column_id?: ColumnId;
  reading_order: number;
  signals: BlockSignals;
}

export type LogicalBlockType =
  | 'heading'
  | 'contact'
  | 'summary'
  | 'experience_candidate'
  | 'education_candidate'
  | 'skills_candidate'
  | 'certification_candidate'
  | 'project_candidate'
  | 'languages_candidate'
  | 'unknown';

/** §10 — Logical block after grouping. */
export interface LogicalBlock {
  block_id: string;
  type: LogicalBlockType;
  lines: NormalizedBlock[];
  text: string;
  page_number: number;
  column_id?: ColumnId;
  reading_order: number;
  confidence: number;
}

export type SectionId =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'languages'
  | 'certifications'
  | 'projects'
  | 'awards'
  | 'publications'
  | 'interests'
  | 'other';

/** §11 — Blocks grouped by section. */
export interface SectionBlocks {
  contact: LogicalBlock[];
  summary: LogicalBlock[];
  experience: LogicalBlock[];
  education: LogicalBlock[];
  skills: LogicalBlock[];
  languages: LogicalBlock[];
  certifications: LogicalBlock[];
  projects: LogicalBlock[];
  awards: LogicalBlock[];
  publications: LogicalBlock[];
  interests: LogicalBlock[];
  other: LogicalBlock[];
}

export interface BlockBuilderInput {
  pages: RawPage[];
  normalized_blocks: NormalizedBlock[];
  layout: LayoutAnalysis;
}

export interface SectionSegmenterInput {
  logical_blocks: LogicalBlock[];
  layout: LayoutAnalysis;
  language: string;
}
