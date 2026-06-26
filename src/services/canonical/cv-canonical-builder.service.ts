import type {
  ContactInfo,
  CVCanonical,
  SkillsGroup,
  ExperienceItem,
  EducationItem,
  CertificationItem,
  ProjectItem,
  ConfidenceReport,
  ReviewHint,
  ParsingTrace,
  SourceType,
} from '../../types/cv.types.js';
import type { LayoutType } from '../../types/layout.types.js';
import type { DocumentKind, DetectedLanguage } from '../../types/document.types.js';

export class CvCanonicalBuilderService {
  build(params: {
    document_id: string;
    detected_language: DetectedLanguage;
    pages: number;
    source_type: SourceType;
    document_kind: DocumentKind;
    layout_type: LayoutType;
    has_sidebar: boolean;
    contact: ContactInfo;
    summary: string;
    experiences: ExperienceItem[];
    education: EducationItem[];
    skills: SkillsGroup;
    certifications?: CertificationItem[];
    projects?: ProjectItem[];
    awards?: string[];
    publications?: string[];
    interests?: string[];
    custom_sections?: CVCanonical['custom_sections'];
    unclassified_block_ratio?: number;
    confidence?: ConfidenceReport;
    review_hints?: ReviewHint[];
    parsing_trace?: ParsingTrace;
  }): CVCanonical {
    const confidence: ConfidenceReport = params.confidence || {
      global: 0,
      sections: {
        contact: params.contact.confidence,
        summary: 0,
        experience: 0,
        education: 0,
        skills: params.skills.confidence,
        certifications: 0,
        projects: 0,
      },
      fields: {},
    };

    return {
      document_id: params.document_id,
      detected_language: params.detected_language,
      contact: params.contact,
      summary: params.summary,
      experiences: params.experiences,
      education: params.education,
      skills: params.skills,
      certifications: params.certifications || [],
      projects: params.projects || [],
      awards: params.awards || [],
      publications: params.publications || [],
      interests: params.interests || [],
      custom_sections: params.custom_sections || [],
      meta: {
        pages: params.pages,
        source_type: params.source_type,
        document_kind: params.document_kind,
        has_sidebar: params.has_sidebar,
        layout_type: params.layout_type === 'unknown' ? 'single_column' : params.layout_type,
        confidence_global: confidence.global,
        unclassified_block_ratio: params.unclassified_block_ratio ?? 0,
      },
      confidence,
      review_hints: params.review_hints || [],
      parsing_trace: params.parsing_trace || {
        document_received_at: new Date().toISOString(),
        steps: [],
      },
    };
  }
}
