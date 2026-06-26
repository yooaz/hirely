/**
 * Canonical CV JSON — sole contract for templates / editor consumption.
 */

export type SourceType = 'pdf' | 'docx' | 'image' | 'text';

export type DocumentKind =
  | 'pdf_native'
  | 'pdf_scanned'
  | 'pdf_hybrid'
  | 'docx'
  | 'image_scanned'
  | 'plain_text';

export type LayoutType =
  | 'single_column'
  | 'two_columns'
  | 'sidebar_left'
  | 'sidebar_right'
  | 'complex'
  | 'portfolio_page';

export type BlockSource = 'native_text' | 'ocr' | 'docx' | 'plain_text';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DocumentInput {
  document_id: string;
  source_type: SourceType;
  filename: string;
  mime_type: string;
  language_hint?: string;
  user_id?: string;
  uploaded_at: string;
}

export interface RawPage {
  page_number: number;
  width: number;
  height: number;
  rotation: number;
  has_native_text: boolean;
  has_images: boolean;
}

export interface RawBlock {
  block_id: string;
  page_number: number;
  text: string;
  normalized_text: string;
  bbox: BoundingBox;
  source: BlockSource;
  column_id?: string;
  zone_id?: string;
  reading_order: number;
  line_index?: number;
  font_size?: number;
  font_weight?: number;
  is_bold?: boolean;
  is_uppercase?: boolean;
  style?: import('./document.types.js').BlockStyleHints;
}

/** @deprecated Prefer NormalizedBlock from blocks.types.ts */
export interface LegacyNormalizedBlock {
  block_id: string;
  raw_text: string;
  normalized_text: string;
  tokens: string[];
  bbox: BoundingBox;
  page_number: number;
  column_id?: string;
  reading_order: number;
  signals: {
    looks_like_heading: boolean;
    looks_like_date: boolean;
    looks_like_email: boolean;
    looks_like_phone: boolean;
    looks_like_url: boolean;
    looks_like_name: boolean;
  };
}

export interface CVCanonical {
  document_id: string;
  detected_language: string;
  contact: ContactInfo;
  summary: string;
  experiences: ExperienceItem[];
  education: EducationItem[];
  skills: SkillsGroup;
  certifications: CertificationItem[];
  projects: ProjectItem[];
  awards: string[];
  publications: string[];
  interests: string[];
  custom_sections: CustomSection[];
  meta: CVMeta;
  confidence: ConfidenceReport;
  review_hints: ReviewHint[];
  parsing_trace: ParsingTrace;
}

export interface ContactInfo {
  full_name: string;
  title: string;
  emails: string[];
  phones: string[];
  location: string;
  linkedin: string;
  website: string;
  github: string;
  source_block_ids: string[];
  confidence: number;
}

export interface ExperienceItem {
  id: string;
  job_title: string;
  company: string;
  client?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  duration_months?: number | null;
  description: string[];
  achievements: string[];
  skills: string[];
  confidence: number;
  source_block_ids: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  school: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  description: string[];
  confidence: number;
  source_block_ids: string[];
}

export interface SkillsGroup {
  technical: string[];
  tools: string[];
  languages: LanguageSkill[];
  soft: string[];
  source_block_ids: string[];
  confidence: number;
}

export interface LanguageSkill {
  language: string;
  level?:
    | 'native'
    | 'fluent'
    | 'professional'
    | 'intermediate'
    | 'basic'
    | 'A1'
    | 'A2'
    | 'B1'
    | 'B2'
    | 'C1'
    | 'C2';
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
  credential_id?: string;
  confidence: number;
  source_block_ids: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  role?: string;
  date?: string;
  stack: string[];
  description: string[];
  url?: string;
  confidence: number;
  source_block_ids: string[];
}

export interface CustomSection {
  id: string;
  title: string;
  items: string[];
  source_block_ids: string[];
  confidence: number;
}

export interface CVMeta {
  pages: number;
  source_type: SourceType;
  document_kind: DocumentKind;
  has_sidebar: boolean;
  layout_type: LayoutType;
  confidence_global: number;
  unclassified_block_ratio: number;
}

export interface ConfidenceReport {
  global: number;
  sections: {
    contact: number;
    summary: number;
    experience: number;
    education: number;
    skills: number;
    certifications: number;
    projects: number;
  };
  fields: Record<string, number>;
}

export type ReviewHintType =
  | 'missing_dates'
  | 'ambiguous_company'
  | 'ambiguous_job_title'
  | 'unclassified_block'
  | 'low_confidence_contact'
  | 'invalid_date_range'
  | 'possible_duplicate'
  | 'missing_section'
  | 'needs_user_confirmation';

export interface ReviewHint {
  id: string;
  type: ReviewHintType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  target_ids: string[];
  source_block_ids?: string[];
  suggested_action:
    | 'ask_user_confirmation'
    | 'move_block'
    | 'edit_field'
    | 'choose_value'
    | 'ignore';
}

export interface ParsingTrace {
  document_received_at: string;
  document_classified_at?: string;
  native_extraction_done_at?: string;
  ocr_done_at?: string;
  layout_analysis_done_at?: string;
  normalization_done_at?: string;
  section_segmentation_done_at?: string;
  experience_parsing_done_at?: string;
  confidence_scored_at?: string;
  review_hints_generated_at?: string;
  steps: ParsingTraceStep[];
}

export interface ParsingTraceStep {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  duration_ms: number;
  message?: string;
  metrics?: Record<string, unknown>;
}

/** @deprecated Use SkillsGroup */
export type SkillsBundle = SkillsGroup;

/** @deprecated Use LanguageSkill */
export type SpokenLanguage = LanguageSkill;

/** @deprecated Use BoundingBox */
export type BBox = BoundingBox;

export type ParseJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface ParseJobCreated {
  job_id: string;
  status: 'processing';
}

export interface ParsePipelineResult {
  cv: CVCanonical;
  confidence: ConfidenceReport;
  review_hints: ReviewHint[];
  trace: ParsingTrace;
}

export interface ParseJobResult {
  job_id: string;
  status: ParseJobStatus;
  result?: ParsePipelineResult;
  error?: { code: string; message: string; trace?: ParsingTrace };
}

export interface ParseCvOptions {
  language_hint?: 'fr' | 'en';
  enable_llm_fallback?: boolean;
  llm_threshold?: number;
  user_id?: string;
}
