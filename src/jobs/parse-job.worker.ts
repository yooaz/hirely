import type { DocumentPayload } from '../types/document.types.js';
import type { ParseResultRepository } from '../storage/parse-result.repository.js';
import type { DocumentStorage } from '../storage/document-storage.js';
import type { ParseJobRecord, ParseJobError } from '../storage/parse-result.repository.js';

import { stageTrace, newId } from '../services/_internal/utils.js';

import { DocumentClassifierService } from '../services/ingestion/document-classifier.service.js';
import { ExtractionRouterService } from '../services/extraction/extraction-router.service.js';

import { LayoutAnalyzerService } from '../services/layout/layout-analyzer.service.js';
import { TextNormalizerService } from '../services/normalization/text-normalizer.service.js';
import { BlockBuilderService } from '../services/blocks/block-builder.service.js';
import { SectionSegmenterService } from '../services/blocks/section-segmenter.service.js';

import { ContactParserService } from '../services/parsers/contact.parser.js';
import { SummaryParserService } from '../services/parsers/summary.parser.js';
import { ExperienceParserService } from '../services/parsers/experience.parser.js';
import { EducationParserService } from '../services/parsers/education.parser.js';
import { SkillsParserService } from '../services/parsers/skills.parser.js';

import { LanguagesParserService } from '../services/parsers/languages.parser.js';
import { CertificationsParserService } from '../services/parsers/certifications.parser.js';
import { ProjectsParserService } from '../services/parsers/projects.parser.js';

import { CvCanonicalBuilderService } from '../services/canonical/cv-canonical-builder.service.js';
import { DedupeService } from '../services/canonical/dedupe.service.js';

import { ConfidenceScorerService } from '../services/confidence/confidence-scorer.service.js';
import { CvValidatorService } from '../services/validation/cv-validator.service.js';
import { ReviewHintsGeneratorService } from '../services/validation/review-hints-generator.service.js';
import { ParsingTraceService } from '../services/trace/parsing-trace.service.js';

import type { ParsingTrace, StageTrace } from '../types/trace.types.js';

export class ParseJobWorker {
  constructor(params: {
    documentStorage: DocumentStorage;
    resultRepository: ParseResultRepository;
  }) {
    this.documentStorage = params.documentStorage;
    this.repo = params.resultRepository;
  }

  private documentStorage: DocumentStorage;
  private repo: ParseResultRepository;

  private classifier = new DocumentClassifierService();
  private extractor = new ExtractionRouterService();
  private layoutAnalyzer = new LayoutAnalyzerService();
  private normalizer = new TextNormalizerService();
  private blockBuilder = new BlockBuilderService();
  private segmenter = new SectionSegmenterService();

  private contactParser = new ContactParserService();
  private summaryParser = new SummaryParserService();
  private experienceParser = new ExperienceParserService();
  private educationParser = new EducationParserService();
  private skillsParser = new SkillsParserService();
  private languagesParser = new LanguagesParserService();
  private certificationsParser = new CertificationsParserService();
  private projectsParser = new ProjectsParserService();

  private canonicalBuilder = new CvCanonicalBuilderService();
  private dedupe = new DedupeService();
  private confidenceScorer = new ConfidenceScorerService();
  private validator = new CvValidatorService();
  private hintsGenerator = new ReviewHintsGeneratorService();
  private traceBuilder = new ParsingTraceService();

  async run(job_id: string): Promise<void> {
    const job = this.repo.get(job_id);
    if (!job) return;

    const stages: StageTrace[] = [];
    const started = Date.now();

    try {
      const doc = this.documentStorage.get(job_id);
      if (!doc) throw new Error('DOC_NOT_FOUND');

      // 1) document_received
      stages.push(stageTrace('document_received', 'ok', started, { filename: doc.input.filename }));

      // 2) classify
      let t0 = Date.now();
      const { profile, trace: classifyTrace } = await this.classifier.classify(doc, doc.text || '');
      stages.push(classifyTrace);

      // 3) extraction
      t0 = Date.now();
      const extractedRoute = await this.extractor.extract(doc, profile);
      // keep traces produced by extraction
      stages.push(
        ...extractedRoute.traces
      );

      // 4) layout
      t0 = Date.now();
      const layout = this.layoutAnalyzer.analyze(extractedRoute.result.pages, extractedRoute.result.blocks);
      stages.push(stageTrace('layout_analysis_done', 'ok', t0, { layout_type: layout.layout_type, confidence: layout.confidence }));

      // 5) normalization
      t0 = Date.now();
      const normalized_blocks = this.normalizer.normalize(extractedRoute.result.blocks, layout);
      stages.push(stageTrace('normalization_done', 'ok', t0, { blocks: normalized_blocks.length }));

      // 6) block building
      t0 = Date.now();
      const logical_blocks = this.blockBuilder.build({
        pages: extractedRoute.result.pages,
        normalized_blocks,
        layout,
      });
      stages.push(stageTrace('block_building_done', 'ok', t0, { logical_blocks: logical_blocks.length }));

      // 7) section segmentation
      t0 = Date.now();
      const sections = this.segmenter.segment(logical_blocks, layout, profile.language);
      const otherCount = sections.other.length;
      stages.push(stageTrace('section_segmentation_done', 'ok', t0, { other_blocks: otherCount }));

      // 8) parsers
      t0 = Date.now();
      const contact = this.contactParser.parse(sections.contact);
      const summaryRes = this.summaryParser.parse(sections.summary);
      const expRes = this.experienceParser.parse(sections.experience);
      const eduRes = this.educationParser.parse(sections.education);
      const skillsRes = this.skillsParser.parse(sections.skills);
      const langsRes = this.languagesParser.parse(sections.languages);
      const certRes = this.certificationsParser.parse(sections.certifications);
      const projectsRes = this.projectsParser.parse(sections.projects);

      stages.push(
        stageTrace('contact_parsing_done', 'ok', t0, {
          experiences: expRes.items.length,
          education: eduRes.items.length,
        })
      );

      // 9) canonical build
      t0 = Date.now();
      const mergedSkills = {
        ...skillsRes.skills,
        languages: [...skillsRes.skills.languages, ...langsRes.languages],
      };

      const canonical = this.canonicalBuilder.build({
        document_id: doc.input.document_id,
        detected_language: profile.language,
        pages: extractedRoute.result.pages.length,
        source_type: doc.input.source_type,
        document_kind: profile.document_kind,
        layout_type: layout.layout_type,
        has_sidebar: layout.has_sidebar,
        contact,
        summary: summaryRes.summary,
        experiences: expRes.items,
        education: eduRes.items,
        skills: mergedSkills,
        certifications: certRes.items,
        projects: projectsRes.items,
        unclassified_block_ratio: otherCount / Math.max(1, logical_blocks.length),
        review_hints: [],
      });
      const deduped = this.dedupe.dedupeCanonical(canonical);

      stages.push(stageTrace('canonical_build_done', 'ok', t0, { exp: deduped.experiences.length }));

      // 10) confidence
      const unknown_ratio = otherCount / Math.max(1, logical_blocks.length);
      t0 = Date.now();
      const confidence = this.confidenceScorer.score({ cv: deduped, unknown_ratio });
      deduped.confidence = confidence;
      deduped.meta.confidence_global = confidence.global;
      stages.push(stageTrace('confidence_scored', 'ok', t0, { confidence_global: confidence.global }));

      // 11) validation
      t0 = Date.now();
      const validation = this.validator.validate({
        cv: deduped,
        confidence,
        other_content_ratio: unknown_ratio,
      });
      stages.push(stageTrace('validation_done', 'ok', t0, { ok: validation.ok, blocking: validation.blocking_issues.length }));

      // 12) review hints
      t0 = Date.now();
      const hintRes = this.hintsGenerator.generate({ cv: deduped, confidence, validation });
      deduped.review_hints = hintRes.hints;
      stages.push(stageTrace('review_hints_generated', 'ok', t0, { hints: hintRes.hints.length }));

      // Phase 1 safety net: when OCR is required but extraction produced no blocks,
      // we must not pretend the CV is fully parsed. Ask for paste/retry.
      if (profile.ocr_required && logical_blocks.length === 0) {
        deduped.review_hints.push({
          id: newId('hint'),
          type: 'needs_user_confirmation',
          severity: 'high',
          message: 'Lecture partielle : le scan semble ne pas être lisible via OCR. Pouvez-vous coller le texte du CV ou réessayer avec une autre image/PDF ?',
          target_ids: [],
          suggested_action: 'ask_user_confirmation',
        });
      }

      // 13) trace
      const parsingTrace = this.traceBuilder.build({
        started_at: new Date(started).toISOString(),
        stages,
        confidence,
        validation,
      });

      deduped.parsing_trace = parsingTrace;

      // Persist
      this.repo.setDone(job_id, {
        cv: deduped,
        confidence,
        review_hints: deduped.review_hints,
        validation,
        trace: parsingTrace,
      });

      this.documentStorage.delete(job_id);
    } catch (e: any) {
      const code = String(e?.message || 'PARSE_FAILED');
      const err: ParseJobError = { code, message: e?.message ? String(e.message) : 'Parse failed' };
      this.repo.setFailed(job_id, err);
      this.documentStorage.delete(job_id);
    }
  }
}

