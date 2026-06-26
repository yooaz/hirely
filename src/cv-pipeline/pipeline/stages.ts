/**
 * CV Pipeline — stage service contracts.
 * Each service is a logical boundary; V1 may live in one Node process / monolith.
 */

import type {
  DocumentInput,
  DocumentPayload,
  DocumentProfile,
  RawBlock,
  RawPage,
} from '../types/document.js';
import type {
  BlockBuilderInput,
  LayoutAnalysis,
  LogicalBlock,
  NormalizedBlock,
  SectionBlocks,
  SectionSegmenterInput,
} from '../types/blocks.js';
import type {
  CVCanonical,
  CertificationItem,
  ContactInfo,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  SkillsBundle,
} from '../types/canonical.js';
import type { ConfidenceReport } from '../types/confidence.js';
import type { ReviewHint, ValidationReport } from '../types/review.js';
import type { ParsingTrace, StageTrace } from '../types/trace.js';
import type { ParseCvOptions } from '../types/api.js';

export interface PipelineContext {
  document_id: string;
  options: ParseCvOptions;
  trace: StageTrace[];
  started_at: number;
}

export interface StageResult<T> {
  data: T;
  trace: StageTrace;
}

/** §6 — Document classification. */
export interface DocumentClassifier {
  classify(payload: DocumentPayload): Promise<StageResult<DocumentProfile>>;
}

/** §7 — Native PDF / OCR / DOCX / text extraction → RawPage + RawBlock[]. */
export interface PrimaryExtractor {
  extract(
    payload: DocumentPayload,
    profile: DocumentProfile
  ): Promise<StageResult<{ pages: RawPage[]; blocks: RawBlock[] }>>;
}

/** §8 — Layout analysis (columns, sidebar, headings). */
export interface LayoutAnalyzer {
  analyze(
    pages: RawPage[],
    blocks: RawBlock[]
  ): Promise<StageResult<LayoutAnalysis>>;
}

/** §9 — OCR cleanup, line merge/split, date normalization. */
export interface TextNormalizer {
  normalize(
    blocks: RawBlock[],
    layout: LayoutAnalysis
  ): Promise<StageResult<NormalizedBlock[]>>;
}

/** §10 — Logical block builder. */
export interface BlockBuilder {
  build(input: BlockBuilderInput): Promise<StageResult<LogicalBlock[]>>;
}

/** §11 — Section segmentation. */
export interface SectionSegmenter {
  segment(input: SectionSegmenterInput): Promise<StageResult<SectionBlocks>>;
}

/** §12 — Cross-cutting entity extraction (optional pre-pass). */
export interface EntityExtractor {
  extract(blocks: LogicalBlock[]): Promise<
    StageResult<{
      emails: string[];
      phones: string[];
      urls: string[];
      date_spans: string[];
    }>
  >;
}

/** §13.2 */
export interface ContactParser {
  parse(blocks: LogicalBlock[]): Promise<StageResult<ContactInfo>>;
}

/** §13.3 */
export interface SummaryParser {
  parse(blocks: LogicalBlock[]): Promise<StageResult<string>>;
}

/** §13.4 — Dedicated experience parser (P0). */
export interface ExperienceParser {
  parse(blocks: LogicalBlock[]): Promise<StageResult<ExperienceItem[]>>;
}

/** §13.5 */
export interface EducationParser {
  parse(blocks: LogicalBlock[]): Promise<StageResult<EducationItem[]>>;
}

/** §13.6 */
export interface SkillsParser {
  parse(blocks: LogicalBlock[]): Promise<StageResult<SkillsBundle>>;
}

/** §13.8 */
export interface CertificationsParser {
  parse(blocks: LogicalBlock[]): Promise<StageResult<CertificationItem[]>>;
}

/** §13.9 */
export interface ProjectsParser {
  parse(blocks: LogicalBlock[]): Promise<StageResult<ProjectItem[]>>;
}

/** §14 — Assemble parsers → CVCanonical. */
export interface CanonicalBuilder {
  build(parts: {
    document_id: string;
    language: string;
    contact: ContactInfo;
    summary: string;
    experiences: ExperienceItem[];
    education: EducationItem[];
    skills: SkillsBundle;
    certifications: CertificationItem[];
    projects: ProjectItem[];
    meta: CVCanonical['meta'];
  }): Promise<StageResult<CVCanonical>>;
}

/** §15 */
export interface ConfidenceScorer {
  score(cv: CVCanonical, ctx: { unknown_ratio: number }): Promise<StageResult<ConfidenceReport>>;
}

/** §16 */
export interface ValidationLayer {
  validate(cv: CVCanonical, confidence: ConfidenceReport): Promise<StageResult<ValidationReport>>;
}

/** §17 — Controlled LLM repair (blocks in, validated JSON out). */
export interface LlmRepairService {
  shouldRun(
    confidence: ConfidenceReport,
    validation: ValidationReport,
    unknown_block_count: number
  ): boolean;
  repair(
    cv: CVCanonical,
    logical_blocks: LogicalBlock[],
    sections: SectionBlocks
  ): Promise<StageResult<Partial<CVCanonical>>>;
}

/** §16.3 */
export interface ReviewHintsGenerator {
  generate(
    cv: CVCanonical,
    confidence: ConfidenceReport,
    validation: ValidationReport
  ): Promise<StageResult<ReviewHint[]>>;
}

export interface CvPipelineServices {
  classifier: DocumentClassifier;
  extractor: PrimaryExtractor;
  layout: LayoutAnalyzer;
  normalizer: TextNormalizer;
  blockBuilder: BlockBuilder;
  segmenter: SectionSegmenter;
  entityExtractor?: EntityExtractor;
  contactParser: ContactParser;
  summaryParser: SummaryParser;
  experienceParser: ExperienceParser;
  educationParser: EducationParser;
  skillsParser: SkillsParser;
  certificationsParser: CertificationsParser;
  projectsParser: ProjectsParser;
  canonicalBuilder: CanonicalBuilder;
  confidenceScorer: ConfidenceScorer;
  validator: ValidationLayer;
  llmRepair?: LlmRepairService;
  reviewHints: ReviewHintsGenerator;
}

export interface ParseCvResult {
  cv: CVCanonical;
  confidence: ConfidenceReport;
  review_hints: ReviewHint[];
  trace: ParsingTrace;
}

export interface CvPipeline {
  parse(payload: DocumentPayload, options?: ParseCvOptions): Promise<ParseCvResult>;
}
