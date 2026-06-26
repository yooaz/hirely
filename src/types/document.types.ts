/**
 * Document ingestion & classification contracts.
 */

import type { SourceType, DocumentKind, DocumentInput, BoundingBox } from './cv.types.js';

export type { SourceType, DocumentKind, DocumentInput, BoundingBox };

export type BBox = BoundingBox;

export type BlockStyleHints = {
  font_size?: number;
  font_weight?: number;
  is_bold?: boolean;
  is_uppercase?: boolean;
};

export type LayoutHint = LayoutType | 'unknown';

export type SupportedLanguageV1 = 'fr' | 'en';
export type SupportedLanguageV2 = SupportedLanguageV1 | 'es' | 'de' | 'it' | 'nl';
export type DetectedLanguage = SupportedLanguageV2 | 'unknown';

export interface DocumentProfile {
  document_kind: DocumentKind;
  pages: number;
  layout_hint: LayoutHint;
  language: DetectedLanguage;
  ocr_required: boolean;
  confidence: number;
}

export type ColumnId = 'main' | 'sidebar' | 'left' | 'right' | string;

export interface DocumentPayload {
  input: DocumentInput;
  buffer?: ArrayBuffer | Uint8Array | Buffer;
  text?: string;
}

export interface IngestedDocument extends DocumentPayload {
  stored_path?: string;
}
