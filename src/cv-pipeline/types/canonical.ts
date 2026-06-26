/**
 * CV Pipeline — canonical CV JSON (product output contract).
 * @module cv-pipeline/types/canonical
 */

import type { DetectedLanguage, DocumentKind, LayoutType } from './document.js';
import type { ReviewHint } from './review.js';
import type { ParsingTrace } from './trace.js';

export interface ContactInfo {
  full_name: string;
  title: string;
  emails: string[];
  phones: string[];
  location: string;
  linkedin: string;
  website: string;
  github: string;
}

export interface SkillsBundle {
  technical: string[];
  tools: string[];
  languages: string[];
  soft: string[];
}

export type LanguageProficiency =
  | 'native'
  | 'fluent'
  | 'professional'
  | 'intermediate'
  | 'basic'
  | 'a1'
  | 'a2'
  | 'b1'
  | 'b2'
  | 'c1'
  | 'c2'
  | string;

export interface SpokenLanguage {
  language: string;
  level: LanguageProficiency;
  raw?: string;
  confidence?: number;
}

/** §5.2 — Structured experience item. */
export interface ExperienceItem {
  id: string;
  job_title: string;
  company: string;
  client: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  duration_months: number | null;
  description: string[];
  achievements: string[];
  skills: string[];
  confidence: number;
  source_block_ids: string[];
}

/** §5.3 — Structured education item. */
export interface EducationItem {
  id: string;
  degree: string;
  school: string;
  location: string;
  start_date: string;
  end_date: string;
  grade: string;
  description: string[];
  confidence: number;
  source_block_ids: string[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credential_id: string;
  confidence: number;
  source_block_ids: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  start_date: string;
  end_date: string;
  stack: string[];
  description: string[];
  url: string;
  confidence: number;
  source_block_ids: string[];
}

export interface AwardItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description: string;
  confidence: number;
  source_block_ids: string[];
}

export interface PublicationItem {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url: string;
  description: string;
  confidence: number;
  source_block_ids: string[];
}

export interface CustomSection {
  id: string;
  title: string;
  items: string[];
  source_block_ids: string[];
}

export interface CVCanonicalMeta {
  pages: number;
  source_type: DocumentKind | 'image' | 'text';
  has_sidebar: boolean;
  layout_type: LayoutType;
  confidence_global: number;
}

/** §5.1 — Primary pipeline output. */
export interface CVCanonical {
  document_id: string;
  detected_language: DetectedLanguage;
  contact: ContactInfo;
  summary: string;
  experiences: ExperienceItem[];
  education: EducationItem[];
  skills: SkillsBundle;
  certifications: CertificationItem[];
  projects: ProjectItem[];
  awards: AwardItem[];
  publications: PublicationItem[];
  interests: string[];
  custom_sections: CustomSection[];
  meta: CVCanonicalMeta;
  review_hints: ReviewHint[];
  parsing_trace: ParsingTrace;
}

/** Minimum validity for an experience (≥2 of 4 per spec §13.4). */
export type ExperienceValidityField =
  | 'job_title'
  | 'company'
  | 'date_range'
  | 'description';

export interface ExperienceAnchor {
  block_id: string;
  reading_order: number;
  signals: {
    has_date: boolean;
    has_title: boolean;
    has_company: boolean;
    vertical_gap: number;
  };
}

export interface ExperienceLineRole {
  line_index: number;
  text: string;
  scores: {
    job_title: number;
    company: number;
    date_range: number;
    location: number;
    description_bullet: number;
  };
}
