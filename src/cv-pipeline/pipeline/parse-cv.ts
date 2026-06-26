/**
 * CV Pipeline — orchestrator (§19.1).
 * Implementation wires stage services; V1 adapters delegate to existing `src/core/*` modules.
 */

import type { DocumentPayload } from '../types/document.js';
import type { ParseCvOptions } from '../types/api.js';
import type { CvPipeline, CvPipelineServices, ParseCvResult, PipelineContext } from './stages.js';
import type { ParsingTrace, StageTrace } from '../types/trace.js';
import { PIPELINE_PERF_TARGETS_V1 } from '../types/trace.js';

export const CV_PIPELINE_VERSION = 'CV_PIPELINE_V1';

function nowIso() {
  return new Date().toISOString();
}

function stageTrace(
  stage: StageTrace['stage'],
  status: StageTrace['status'],
  started: number,
  metrics?: StageTrace['metrics'],
  errors?: string[],
  fallback_reason?: string
): StageTrace {
  const ended = Date.now();
  return {
    stage,
    status,
    duration_ms: ended - started,
    started_at: new Date(started).toISOString(),
    ended_at: new Date(ended).toISOString(),
    metrics,
    errors,
    fallback_reason,
  };
}

/**
 * Factory — inject concrete services (JS adapters or future TS implementations).
 */
export function createCvPipeline(services: CvPipelineServices): CvPipeline {
  return {
    async parse(payload: DocumentPayload, options: ParseCvOptions = {}): Promise<ParseCvResult> {
      const ctx: PipelineContext = {
        document_id: payload.input.document_id,
        options,
        trace: [],
        started_at: Date.now(),
      };

      const push = (t: StageTrace) => {
        ctx.trace.push(t);
      };

      // 1. Classify
      let t0 = Date.now();
      const classified = await services.classifier.classify(payload);
      push(classified.trace);

      // 2. Extract
      t0 = Date.now();
      const extracted = await services.extractor.extract(payload, classified.data);
      push(extracted.trace);

      // 3. Layout (MUST run before segmentation — §8 rule)
      t0 = Date.now();
      const layoutRes = await services.layout.analyze(extracted.data.pages, extracted.data.blocks);
      push(layoutRes.trace);

      // 4. Normalize
      t0 = Date.now();
      const normRes = await services.normalizer.normalize(
        extracted.data.blocks,
        layoutRes.data
      );
      push(normRes.trace);

      // 5. Block build
      t0 = Date.now();
      const built = await services.blockBuilder.build({
        pages: extracted.data.pages,
        normalized_blocks: normRes.data,
        layout: layoutRes.data,
      });
      push(built.trace);

      // 6. Section segment
      t0 = Date.now();
      const segmented = await services.segmenter.segment({
        logical_blocks: built.data,
        layout: layoutRes.data,
        language: classified.data.language,
      });
      push(segmented.trace);

      // 7. Section parsers (parallel where independent)
      t0 = Date.now();
      const [contact, summary, experiences, education, skills, certifications, projects] =
        await Promise.all([
          services.contactParser.parse(segmented.data.contact),
          services.summaryParser.parse(segmented.data.summary),
          services.experienceParser.parse(segmented.data.experience),
          services.educationParser.parse(segmented.data.education),
          services.skillsParser.parse(segmented.data.skills),
          services.certificationsParser.parse(segmented.data.certifications),
          services.projectsParser.parse(segmented.data.projects),
        ]);
      push(
        stageTrace('contact_parsing_done', 'ok', t0, {
          experiences: experiences.data.length,
          education: education.data.length,
        })
      );

      // 8. Canonical build
      t0 = Date.now();
      const canonical = await services.canonicalBuilder.build({
        document_id: ctx.document_id,
        language: classified.data.language,
        contact: contact.data,
        summary: summary.data,
        experiences: experiences.data,
        education: education.data,
        skills: skills.data,
        certifications: certifications.data,
        projects: projects.data,
        meta: {
          pages: classified.data.pages,
          source_type: classified.data.document_kind,
          has_sidebar: layoutRes.data.has_sidebar,
          layout_type: layoutRes.data.layout_type,
          confidence_global: 0,
        },
      });
      push(canonical.trace);

      // 9. Confidence
      t0 = Date.now();
      const unknownCount = segmented.data.other.length;
      const totalLogical = built.data.length || 1;
      const confRes = await services.confidenceScorer.score(canonical.data, {
        unknown_ratio: unknownCount / totalLogical,
      });
      canonical.data.meta.confidence_global = confRes.data.confidence_global;
      push(confRes.trace);

      // 10. Validation
      t0 = Date.now();
      const valRes = await services.validator.validate(canonical.data, confRes.data);
      push(valRes.trace);

      // 11. Optional LLM repair
      let llmUsed = false;
      if (
        services.llmRepair?.shouldRun(
          confRes.data,
          valRes.data,
          unknownCount
        )
      ) {
        t0 = Date.now();
        const repaired = await services.llmRepair.repair(
          canonical.data,
          built.data,
          segmented.data
        );
        llmUsed = true;
        push(stageTrace('llm_fallback_triggered', 'ok', t0));
        if (repaired.data) {
          Object.assign(canonical.data, repaired.data);
        }
        const reconf = await services.confidenceScorer.score(canonical.data, {
          unknown_ratio: unknownCount / totalLogical,
        });
        canonical.data.meta.confidence_global = reconf.data.confidence_global;
        push(stageTrace('llm_repair_done', 'ok', Date.now()));
      }

      // 12. Review hints
      t0 = Date.now();
      const hints = await services.reviewHints.generate(
        canonical.data,
        confRes.data,
        valRes.data
      );
      canonical.data.review_hints = hints.data;
      push(hints.trace);

      const totalMs = Date.now() - ctx.started_at;
      const trace: ParsingTrace = {
        pipeline_version: CV_PIPELINE_VERSION,
        document_profile: classified.data,
        layout: {
          layout_type: layoutRes.data.layout_type,
          has_sidebar: layoutRes.data.has_sidebar,
          confidence: layoutRes.data.confidence,
        },
        stages: ctx.trace,
        total_duration_ms: totalMs,
        truth_source:
          classified.data.document_kind === 'pdf_native'
            ? 'native'
            : classified.data.document_kind === 'docx'
              ? 'docx'
              : classified.data.ocr_required
                ? 'ocr'
                : 'text',
        block_counts: {
          raw: extracted.data.blocks.length,
          normalized: normRes.data.length,
          logical: built.data.length,
          unknown: segmented.data.other.filter((b) => b.type === 'unknown').length,
          other_section: segmented.data.other.length,
        },
        confidence: confRes.data,
        validation: valRes.data,
        llm_fallback_used: llmUsed,
      };
      canonical.data.parsing_trace = trace;

      return {
        cv: canonical.data,
        confidence: confRes.data,
        review_hints: hints.data,
        trace,
      };
    },
  };
}

/** §19.2 — Experience parser pseudocode as documented algorithm (reference). */
export function parseExperiencesAlgorithmReference(): string {
  return `
function parse_experiences(blocks):
  anchors = detect_experience_anchors(blocks)
  groups = group_blocks_between_anchors(blocks, anchors)
  items = []
  for group in groups:
    line_roles = classify_lines(group)
    item = resolve_experience_fields(line_roles)
    item.confidence = score_experience_item(item, group)
    if is_valid_experience(item): items.push(item)
    else: emit_review_hint(group)
  return items
`.trim();
}
