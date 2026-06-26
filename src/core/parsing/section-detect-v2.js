/**
 * SECTION_ENGINE_V2 — stage 1: section boundaries via semantic inference (headers optional hints).
 */

import { normalizeHeaderText, fuzzySectionKey, scoreSectionHeader } from './section-fuzzy.js';
import { SECTION_IDS, SECTION_HEADER_ALIASES } from './section-types-v2.js';
import { inferSemanticSectionBlocks } from './semantic-section-infer.js';
import { SEMANTIC_PARSE_MODE } from './semantic-line-types.js';
import { buildDocumentBlocksFromOcrLines } from './block-builder-v1.js';
import { runCvBlockEngine, CV_BLOCK_ENGINE } from './universal-extraction/index.js';
import { recoverTwoColumnSections } from '../layout/two-column-recovery.js';
import {
  spatialBlocksFromLayoutMemory,
  spatialBlocksToOcrLineInput,
} from '../layout/spatial-block.js';
import {
  classifyDocumentPages,
  filterSpatialBlocksForResumeParsing,
  filterSegmentsForResumeParsing,
  buildPageDocumentClassificationDebug,
} from '../layout/page-document-classifier.js';
import { segmentCvBlocks, CV_SECTION } from './section-segmenter.js';
import { parseExperienceFromSegments } from './cv-experience-block-parser.js';
import { parseEducationFromSegments } from './cv-education-block-parser.js';
import { parseSkillsFromSegments } from './cv-skills-block-parser.js';
import { scoreCvParseBundle, applyValidationConfidenceAdjustments } from './cv-parse-confidence.js';
import { generateCvReviewHints, buildCvParseResponsePayload } from './cv-review-hints.js';
import { sidebarFieldsFromSegments } from './cv-block-parser-bridge.js';
import { validateCvParseBundle } from './cv-parse-validation.js';
import { recordFlattenIfActive } from '../blocks/flat-text-guard.js';
import {
  runResumeLayoutAnalysis,
  assignZonesToSpatialBlocks,
  buildResumeLayoutDebug,
} from '../layout/resume-layout-engine.js';
import { runResumeTextNormalization } from './resume-text-normalization.js';

/** Map layout segmenter section → SECTION_IDS */
export function cvSectionToSectionId(section) {
  const map = {
    [CV_SECTION.CONTACT]: SECTION_IDS.CONTACT,
    [CV_SECTION.SUMMARY]: SECTION_IDS.SUMMARY,
    [CV_SECTION.EXPERIENCE]: SECTION_IDS.EXPERIENCE,
    [CV_SECTION.EDUCATION]: SECTION_IDS.EDUCATION,
    [CV_SECTION.SKILLS]: SECTION_IDS.SKILLS,
    [CV_SECTION.LANGUAGES]: SECTION_IDS.LANGUAGES,
    [CV_SECTION.CERTIFICATIONS]: SECTION_IDS.CERTIFICATIONS,
    [CV_SECTION.PROJECTS]: SECTION_IDS.PROJECTS,
    [CV_SECTION.INTERESTS]: SECTION_IDS.INTERESTS,
    [CV_SECTION.OTHER]: SECTION_IDS.UNKNOWN,
  };
  return map[section] || SECTION_IDS.UNKNOWN;
}

const INLINE_HEADER_RE = /^([A-Za-zÀ-ÿ][\w\s&/'-]{1,40})\s*[:：]\s*(.+)$/;

/**
 * @param {string} line
 * @returns {string|null} SECTION_IDS value
 */
export function detectSectionHeaderId(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.length > 56) return null;

  const inline = trimmed.match(INLINE_HEADER_RE);
  if (inline) {
    const fromInline = detectSectionHeaderId(inline[1]);
    if (fromInline) return fromInline;
  }

  const norm = normalizeHeaderText(trimmed);
  if (!norm) return null;

  for (const { id, patterns } of SECTION_HEADER_ALIASES) {
    if (patterns.some((re) => re.test(norm))) return id;
  }

  const fuzzy = fuzzySectionKey(trimmed);
  if (fuzzy) {
    const map = {
      summary: SECTION_IDS.SUMMARY,
      profile: SECTION_IDS.PROFILE,
      experience: SECTION_IDS.EXPERIENCE,
      education: SECTION_IDS.EDUCATION,
      skills: SECTION_IDS.SKILLS,
      tools: SECTION_IDS.TOOLS,
      languages: SECTION_IDS.LANGUAGES,
      projects: SECTION_IDS.PROJECTS,
      clients: SECTION_IDS.CLIENTS,
      awards: SECTION_IDS.AWARDS,
      publications: SECTION_IDS.PUBLICATIONS,
      contact: SECTION_IDS.CONTACT,
      interests: SECTION_IDS.INTERESTS,
      certifications: SECTION_IDS.CERTIFICATIONS,
      volunteer: SECTION_IDS.VOLUNTEER,
      exhibitions: SECTION_IDS.EXHIBITIONS,
      portfolioLinks: SECTION_IDS.PORTFOLIO,
      achievements: SECTION_IDS.AWARDS,
      location: SECTION_IDS.CONTACT,
    };
    if (map[fuzzy]) return map[fuzzy];
  }

  if (/^profil\b/i.test(norm) && !/^profile summary/i.test(norm)) return SECTION_IDS.PROFILE;
  return null;
}

/**
 * Primary path: sections → semantic blocks (no regex-first field extraction).
 * @param {string} cleanedText
 * @returns {{ lines: string[], blocks: import('./section-types-v2.js').SectionBlockV2[], semanticLines?: object[], parseMode: string, neverRegexFirstParse: boolean }}
 */
export function detectSectionBlocks(cleanedText, opts = {}) {
  const recovery = recoverTwoColumnSections(cleanedText, {
    ...opts,
    extractionLines: opts.extractionLines || opts.layoutMemory?.lines,
    orderedLines: opts.orderedLines || opts.readingStage?.orderedLines,
    readingStage: opts.readingStage,
    spatialBlocks: opts.spatialBlocks,
  });

  const memory = recovery.layoutMemory || opts.layoutMemory || null;
  const spatialBlocks =
    opts.spatialBlocks?.length > 0
      ? opts.spatialBlocks
      : memory?.spatialBlocks?.length > 0
        ? memory.spatialBlocks
        : spatialBlocksFromLayoutMemory(memory);

  const extractionLines =
    opts.extractionLines ||
    memory?.lines ||
    memory?.entries ||
    (spatialBlocks.length ? spatialBlocksToOcrLineInput(spatialBlocks) : []);

  const textNormalizationStage =
    opts.textNormalizationStage ||
    (extractionLines.length || spatialBlocks.length
      ? runResumeTextNormalization(
          {
            text: cleanedText,
            spatialBlocks,
            extractionLines,
          },
          { debug: opts.debug, dedupeBlocks: opts.dedupeBlocks !== false }
        )
      : null);

  let normalizedSpatialBlocks = textNormalizationStage?.spatialBlocks?.length
    ? textNormalizationStage.spatialBlocks
    : spatialBlocks;
  let normalizedExtractionLines = textNormalizationStage?.extractionLines?.length
    ? textNormalizationStage.extractionLines
    : extractionLines;
  const normalizedCleanedText = textNormalizationStage?.text || cleanedText;

  const resumeLayoutStage =
    opts.resumeLayoutStage ||
    (normalizedExtractionLines.length || normalizedSpatialBlocks.length
      ? runResumeLayoutAnalysis(
          {
            lines: normalizedExtractionLines,
            spatialBlocks: normalizedSpatialBlocks,
            pageDocumentClassification: opts.pageDocumentClassification,
          },
          opts
        )
      : null);

  const pageLayouts = opts.pageLayouts || resumeLayoutStage || null;

  let zonedSpatialBlocks = normalizedSpatialBlocks;
  if (resumeLayoutStage?.pages?.length && normalizedSpatialBlocks.length) {
    zonedSpatialBlocks = assignZonesToSpatialBlocks(normalizedSpatialBlocks, resumeLayoutStage);
  }

  const pageDocumentClassification =
    opts.pageDocumentClassification ||
    resumeLayoutStage?.page_document_classification ||
    (normalizedExtractionLines.length
      ? classifyDocumentPages(normalizedExtractionLines, { pageLayouts })
      : null);

  const resumeSpatialBlocks = pageDocumentClassification
    ? filterSpatialBlocksForResumeParsing(zonedSpatialBlocks, pageDocumentClassification)
    : zonedSpatialBlocks;

  const sectionSegmentation =
    opts.sectionSegmentation ||
    (resumeSpatialBlocks.length
      ? segmentCvBlocks(resumeSpatialBlocks, {
          pageLayouts,
          layoutMemory: memory,
        })
      : null);

  const resumeSegments = pageDocumentClassification
    ? filterSegmentsForResumeParsing(
        sectionSegmentation?.segments || [],
        pageDocumentClassification
      )
    : sectionSegmentation?.segments || [];

  const experienceBlockParse =
    opts.experienceBlockParse ||
    (resumeSegments.length ? parseExperienceFromSegments(resumeSegments) : null);

  const educationBlockParse =
    opts.educationBlockParse ||
    (resumeSegments.length ? parseEducationFromSegments(resumeSegments) : null);

  const skillsBlockParse =
    opts.skillsBlockParse ||
    (resumeSegments.length ? parseSkillsFromSegments(resumeSegments) : null);

  const blocksForStructuredInput =
    resumeSpatialBlocks.length > 0 ? resumeSpatialBlocks : normalizedSpatialBlocks;

  const structuredInput =
    blocksForStructuredInput.length > 0
      ? spatialBlocksToOcrLineInput(blocksForStructuredInput)
      : recovery.layoutMemory?.entries?.length > 0
        ? recovery.layoutMemory.entries
        : opts.layoutMemory?.entries?.length > 0
          ? opts.layoutMemory.entries
          : (() => {
              if (opts.structureFirst !== false) {
                recordFlattenIfActive('block_builder', 'string fallback for buildDocumentBlocksFromOcrLines');
              }
              return cleanedText;
            })();

  const built = buildDocumentBlocksFromOcrLines(structuredInput, {
    ...opts,
    layoutMemory: memory,
    spatialBlocks: blocksForStructuredInput,
    source: opts.extractionMethod || 'ocr',
  });

  const universal = runCvBlockEngine(built.lines.length ? built.lines : structuredInput, {
    ...opts,
    layoutMemory: memory,
    spatialBlocks: blocksForStructuredInput,
    documentBlocks: built.documentBlocks,
  });

  const parseBundle = {
    contact: null,
    experienceItems: experienceBlockParse?.items || [],
    educationItems: educationBlockParse?.items || [],
    skillItems: skillsBlockParse?.items || [],
    resumeSegments,
    extractionLines: normalizedExtractionLines,
    pageDocumentClassification,
    portfolio_items: pageDocumentClassification?.portfolio_items || [],
    excluded_pages_trace: pageDocumentClassification?.excluded_pages_trace || [],
    sectionSegmentation,
    rawText: opts.rawText || '',
    cleanedText: opts.cleanedText || '',
    fileName: opts.fileName || opts.file?.name || '',
  };

  const parseConfidenceRaw = scoreCvParseBundle(parseBundle);
  const parseValidation = validateCvParseBundle(parseBundle, parseConfidenceRaw);
  const parseConfidence = applyValidationConfidenceAdjustments(parseConfidenceRaw, parseValidation);
  parseBundle.parseValidation = parseValidation;
  parseBundle.contact = parseConfidence.contact;
  const sidebarFields = sidebarFieldsFromSegments(resumeSegments);
  parseBundle.summary = sidebarFields.summary;
  parseBundle.languages = sidebarFields.languages;
  parseBundle.interests = sidebarFields.interests;
  const reviewHints = generateCvReviewHints(parseBundle, parseConfidence, parseValidation);
  const parseResponse = buildCvParseResponsePayload({
    contact: parseConfidence.contact,
    summary: sidebarFields.summary,
    languages: sidebarFields.languages,
    interests: sidebarFields.interests,
    experienceItems: parseBundle.experienceItems,
    educationItems: parseBundle.educationItems,
    skillItems: parseBundle.skillItems,
    skillsByCategory: skillsBlockParse?.byCategory || null,
    portfolio_items: parseBundle.portfolio_items,
    pageDocumentClassification,
    parseConfidence,
    parseValidation,
    reviewHints,
  });

  const structuredLineTexts =
    resumeSpatialBlocks.length > 0
      ? resumeSpatialBlocks
          .slice()
          .sort((a, b) => (a.reading_order ?? 0) - (b.reading_order ?? 0))
          .map((b) => String(b.text || '').trim())
          .filter(Boolean)
      : built.lines?.length
        ? built.lines.map((l) => String(l.text ?? l).trim()).filter(Boolean)
        : null;

  if (!structuredLineTexts?.length && opts.structureFirst !== false) {
    recordFlattenIfActive('section_detect', 'no spatial blocks — semantic infer may flatten');
  }

  const hasResumeSpatialInput =
    resumeSpatialBlocks.length >= 3 || blocksForStructuredInput.length >= 3;
  const semanticInputText = hasResumeSpatialInput ? '' : normalizedCleanedText;

  const semantic = recovery.applied && !hasResumeSpatialInput
    ? {
        lines: recovery.lines,
        blocks: recovery.blocks,
        semanticLines: recovery.semanticLines,
      }
    : inferSemanticSectionBlocks(semanticInputText, {
        ...opts,
        layoutMemory: memory,
        spatialBlocks: resumeSpatialBlocks.length ? resumeSpatialBlocks : spatialBlocks,
        lines: structuredLineTexts || undefined,
        structureFirst: opts.structureFirst !== false,
        noFlatTextFallback: hasResumeSpatialInput,
        documentBlocks: built.documentBlocks,
        lineGroupBlocks: built.documentBlocks,
      });

  return {
    lines: semantic.lines,
    blocks: semantic.blocks,
    semanticLines: semantic.semanticLines,
    documentBlocks: universal.documentBlocks?.length ? universal.documentBlocks : built.documentBlocks,
    lineGroupBlocks: built.documentBlocks,
    universalBlocks: universal.blocks,
    universalBlockStats: universal.stats,
    universalBlockEngine: CV_BLOCK_ENGINE,
    parseMode: SEMANTIC_PARSE_MODE,
    neverRegexFirstParse: true,
    blockStats: built.stats,
    twoColumnRecovery: recovery.applied === true,
    twoColumnStats: recovery.stats || null,
    layoutMemory: memory,
    spatialBlocks: zonedSpatialBlocks,
    resumeSpatialBlocks,
    pageLayouts,
    resumeLayoutStage,
    resumeLayoutDebug: resumeLayoutStage?.debug || buildResumeLayoutDebug(resumeLayoutStage || {}),
    textNormalizationStage,
    textNormalizationDebug: textNormalizationStage?.debug || null,
    pageDocumentClassification,
    portfolio_items: pageDocumentClassification?.portfolio_items || [],
    excluded_pages_trace: pageDocumentClassification?.excluded_pages_trace || [],
    pageClassificationDebug: pageDocumentClassification
      ? buildPageDocumentClassificationDebug(pageDocumentClassification)
      : null,
    sectionSegmentation,
    sectionMap: sectionSegmentation?.sectionMap || null,
    resumeSegments,
    experienceBlockParse,
    experienceItems: experienceBlockParse?.items || [],
    educationBlockParse,
    educationItems: educationBlockParse?.items || [],
    skillsBlockParse,
    skillItems: skillsBlockParse?.items || [],
    skillsByCategory: skillsBlockParse?.byCategory || null,
    readingStage: recovery.readingStage || opts.readingStage || null,
    parseConfidence,
    reviewHints,
    parseValidation,
    parseResponse,
  };
}

/**
 * Legacy header-boundary detection (optional hint source only).
 * @param {string} cleanedText
 */
export function detectHeaderBasedSectionBlocks(cleanedText) {
  const lines = String(cleanedText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  /** @type {import('./section-types-v2.js').SectionBlockV2[]} */
  const blocks = [];
  let currentId = SECTION_IDS.PREAMBLE;
  let currentLines = [];
  let headerLine = null;
  let startIdx = 0;

  let lastHeaderConfidence = 55;

  const flush = (endIdx) => {
    if (!currentLines.length && !headerLine) return;
    blocks.push({
      id: `sec-${blocks.length}`,
      type: currentId,
      lines: [...currentLines],
      headerLine,
      startLine: startIdx,
      endLine: endIdx,
      detectedConfidence: headerLine ? lastHeaderConfidence : 55,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inline = line.match(INLINE_HEADER_RE);
    let headerId = detectSectionHeaderId(line);
    const scored = scoreSectionHeader(line);

    if (inline && headerId) {
      flush(i);
      currentId = headerId;
      headerLine = line;
      lastHeaderConfidence = scored?.confidence ?? 90;
      currentLines = [inline[2].trim()].filter(Boolean);
      startIdx = i;
      continue;
    }

    if (headerId) {
      flush(i);
      currentId = headerId;
      headerLine = line;
      lastHeaderConfidence = scored?.confidence ?? 88;
      currentLines = [];
      startIdx = i;
      continue;
    }

    currentLines.push(line);
  }
  flush(lines.length);

  if (!blocks.length && lines.length) {
    blocks.push({
      id: 'sec-0',
      type: SECTION_IDS.PREAMBLE,
      lines,
      headerLine: null,
      startLine: 0,
      endLine: lines.length,
      detectedConfidence: 50,
    });
  }

  return { lines, blocks };
}
