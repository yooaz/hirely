/**
 * CV Pipeline — document ingestion & classification types.
 * @module cv-pipeline/types/document
 */

export type SourceType = 'pdf' | 'docx' | 'image' | 'text';

export type DocumentKind =
  | 'pdf_native'
  | 'pdf_scanned'
  | 'pdf_hybrid'
  | 'docx'
  | 'image_scanned'
  | 'text';

export type LayoutHint =
  | 'single_column'
  | 'two_columns'
  | 'sidebar_left'
  | 'sidebar_right'
  | 'complex'
  | 'unknown';

export type SupportedLanguageV1 = 'fr' | 'en';

export type SupportedLanguageV2 = SupportedLanguageV1 | 'es' | 'de' | 'it' | 'nl';

export type DetectedLanguage = SupportedLanguageV2 | 'unknown';

/** §4.1 — Input metadata at ingestion. */
export interface DocumentInput {
  document_id: string;
  source_type: SourceType;
  filename: string;
  mime_type: string;
  language_hint?: SupportedLanguageV1;
  user_id?: string;
  uploaded_at: string;
}

/** §6.3 — Output of document classification stage. */
export interface DocumentProfile {
  document_kind: DocumentKind;
  pages: number;
  layout_hint: LayoutHint;
  language: DetectedLanguage;
  ocr_required: boolean;
  confidence: number;
}

/** §4.2 — Per-page geometry & extraction flags. */
export interface RawPage {
  page_number: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  has_native_text: boolean;
  has_images: boolean;
}

export type BlockTextSource = 'native_text' | 'ocr' | 'docx' | 'paste';

export type ColumnId = 'main' | 'sidebar' | 'left' | 'right' | string;

/** §4.3 — Geometric text block before normalization. */
export interface RawBlock {
  block_id: string;
  page_number: number;
  text: string;
  bbox: BBox;
  source: BlockTextSource;
  font_size?: number;
  font_weight?: number;
  is_bold?: boolean;
  is_uppercase?: boolean;
  column_id?: ColumnId;
  line_index?: number;
  reading_order?: number;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Binary payload reference (browser File / Node Buffer). */
export interface DocumentPayload {
  input: DocumentInput;
  buffer?: ArrayBuffer | Uint8Array;
  text?: string;
}
