/**
 * Normalized / logical blocks & section segmentation — structure-first contracts.
 */

import type { BBox, ColumnId, BlockSource, BlockStyleHints } from './document.types.js';
import type { LayoutAnalysis } from './layout.types.js';

/** Shared fields preserved on every block stage */
export interface BlockCore {
  block_id: string;
  page_number: number;
  bbox: BBox;
  source: BlockSource | string;
  text: string;
  normalized_text: string;
  column_id?: ColumnId;
  zone_id?: string;
  reading_order: number;
  style?: BlockStyleHints;
}

export interface RawPage {
  page_number: number;
  width: number;
  height: number;
  rotation: number;
  has_native_text: boolean;
  has_images: boolean;
}

export interface RawBlock extends BlockCore {
  line_index?: number;
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
  looks_like_name?: boolean;
}

export interface NormalizedBlock extends BlockCore {
  tokens: string[];
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

export interface LogicalBlock {
  block_id: string;
  type: LogicalBlockType | string;
  lines: NormalizedBlock[];
  text: string;
  page_number: number;
  column_id?: ColumnId;
  zone_id?: string;
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
  | 'other'
  | string;

/** Section bucket with block provenance */
export interface SectionBlock {
  section_id: SectionId;
  block_id: string;
  blocks: LogicalBlock[];
  source_block_ids: string[];
  page_number: number;
  column_id?: ColumnId;
  zone_id?: string;
  reading_order: number;
  text: string;
}

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

export interface StructureFirstDocument {
  version: string;
  pages: RawPage[];
  raw_blocks: RawBlock[];
  normalized_blocks: NormalizedBlock[];
  logical_blocks: LogicalBlock[];
  section_blocks: SectionBlock[];
  spatial_blocks: unknown[];
  extraction_lines: unknown[];
  derived_plain_text?: string;
  structure_preserved: boolean;
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
