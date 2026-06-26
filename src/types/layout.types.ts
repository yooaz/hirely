/**
 * Layout analysis contracts.
 */

import type { BoundingBox, ColumnId } from './document.types.js';
import type { LayoutType as CvLayoutType } from './cv.types.js';

export type LayoutType = CvLayoutType | 'unknown';

export interface LayoutColumn {
  column_id: ColumnId;
  bbox: BoundingBox;
  page_number: number;
  role?: 'main' | 'sidebar' | 'secondary';
}

export interface PageZone {
  zone_id: string;
  role: 'main' | 'sidebar' | 'portfolio' | 'column' | string;
  column?: string;
  bounds?: BoundingBox;
  block_ids?: string[];
  line_count?: number;
  content_roles?: string[];
  preview?: string[];
  reading_order?: string;
}

export interface PageLayout {
  page_number: number;
  layout_type: LayoutType;
  page_class?: string;
  heading_candidates: string[];
  list_candidates: string[];
  zones?: PageZone[];
  merge_policy?: {
    cross_zone_merge_forbidden: boolean;
    split_x: number | null;
    portfolio_page?: boolean;
  };
}

export interface LayoutAnalysis {
  layout_type: LayoutType;
  has_sidebar: boolean;
  columns: LayoutColumn[];
  pages: PageLayout[];
  confidence: number;
}
