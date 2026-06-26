/**
 * Structure-first pipeline — builds RawPage → CVCanonical without early flattening.
 */

import { spatialBlocksToPlainText } from '../layout/spatial-block.js';
import { resolveParserLayoutInput } from '../parsing/parser-layout-input.js';
import { detectSectionBlocks } from '../parsing/section-detect-v2.js';
import { structuredToCvData } from '../parsing/structured-resume.js';
import { extractFieldsFromSectionBlocks } from '../parsing/section-field-extract-v2.js';
import { classifySectionBlocks } from '../parsing/section-classify-v2.js';
import { runResumeGraphEngine } from '../parsing/resume-graph-engine.js';
import {
  BLOCK_PIPELINE_VERSION,
  STRUCTURE_FIRST_STAGE,
  blockHasStructure,
} from './block-contract.js';
import {
  rawPagesFromExtractionLines,
  rawBlocksFromExtractionLines,
  rawBlocksFromSpatialBlocks,
  normalizeRawBlocks,
  logicalBlocksFromNormalized,
  sectionBlocksFromLogical,
  normalizedBlocksFromSpatial,
} from './block-adapters.js';
import {
  createFlatTextGuard,
  setActiveFlatTextGuard,
  FLATTEN_ALLOWED_SITES,
} from './flat-text-guard.js';
import { runResumeLayoutAnalysis } from '../layout/resume-layout-engine.js';

/**
 * @typedef {import('./block-contract.js').StructureFirstDocument} StructureFirstDocument
 */

/**
 * @param {object} opts
 * @returns {StructureFirstDocument}
 */
export function buildStructureFirstDocument(opts = {}) {
  const extractionLines = opts.extractionLines || opts.lines || [];
  const spatialBlocks = opts.spatialBlocks || [];
  const segments = opts.sectionSegmentation?.segments || opts.segments || [];

  const raw_pages = opts.raw_pages?.length
    ? opts.raw_pages
    : rawPagesFromExtractionLines(extractionLines);

  const raw_blocks = opts.raw_blocks?.length
    ? opts.raw_blocks
    : spatialBlocks.length
      ? rawBlocksFromSpatialBlocks(spatialBlocks)
      : rawBlocksFromExtractionLines(extractionLines, { source: opts.source });

  const normalized_blocks = opts.normalized_blocks?.length
    ? opts.normalized_blocks
    : spatialBlocks.length
      ? normalizedBlocksFromSpatial(spatialBlocks)
      : normalizeRawBlocks(raw_blocks);

  const logical_blocks = opts.logical_blocks?.length
    ? opts.logical_blocks
    : logicalBlocksFromNormalized(normalized_blocks, { segments });

  const section_blocks = opts.section_blocks?.length
    ? opts.section_blocks
    : sectionBlocksFromLogical(logical_blocks, { sectionMap: opts.sectionMap });

  const structure_preserved =
    normalized_blocks.length > 0 &&
    normalized_blocks.filter((b) => blockHasStructure(b)).length >=
      Math.max(1, Math.floor(normalized_blocks.length * 0.5));

  return {
    version: BLOCK_PIPELINE_VERSION,
    pages: raw_pages,
    raw_blocks,
    normalized_blocks,
    logical_blocks,
    section_blocks,
    spatial_blocks: spatialBlocks,
    extraction_lines: extractionLines,
    derived_plain_text: opts.includeDerivedText
      ? spatialBlocksToPlainText(spatialBlocks)
      : undefined,
    structure_preserved,
  };
}

/**
 * @param {string} cleanedText — legacy boundary; spatial blocks take precedence
 * @param {object} [opts]
 */
export function runStructureFirstParse(cleanedText, opts = {}) {
  const guard = opts.flatTextGuard || createFlatTextGuard({ structureFirst: true });
  setActiveFlatTextGuard(guard);

  const layoutInput = resolveParserLayoutInput(cleanedText, {
    rawText: opts.rawText,
    extractionLines: opts.extractionLines,
    lines: opts.lines,
    layoutMemory: opts.layoutMemory,
    layout: opts.layout || opts.layoutStage,
    layoutStage: opts.layoutStage,
    readingStage: opts.readingStage,
    orderedLines: opts.orderedLines,
    ocrLayout: opts.ocrLayout,
    extractionMethod: opts.extractionMethod,
    pageLayouts: opts.pageLayouts,
    spatialBlocks: opts.spatialBlocks,
  });

  const spatialBlocks = layoutInput.spatialBlocks || [];
  const extractionLines = layoutInput.extractionLines || [];

  const structureDoc = buildStructureFirstDocument({
    extractionLines,
    spatialBlocks,
    source: opts.extractionMethod,
    includeDerivedText: false,
  });

  const resumeLayoutStage =
    opts.resumeLayoutStage ||
    (extractionLines.length || spatialBlocks.length
      ? runResumeLayoutAnalysis({ lines: extractionLines, spatialBlocks })
      : null);
  structureDoc.resume_layout = resumeLayoutStage;

  const detection = detectSectionBlocks(cleanedText, {
    ...opts,
    layoutMemory: layoutInput.layoutMemory,
    spatialBlocks,
    extractionLines,
    structureFirst: true,
    flatTextGuard: guard,
    sectionSegmentation: opts.sectionSegmentation,
  });

  structureDoc.section_blocks = sectionBlocksFromLogical(
    logicalBlocksFromNormalized(structureDoc.normalized_blocks, {
      segments: detection.sectionSegmentation?.segments || detection.resumeSegments || [],
    }),
    { sectionMap: detection.sectionSegmentation?.sectionMap }
  );

  guard.recordFlatten(FLATTEN_ALLOWED_SITES.DERIVED_SNAPSHOT, 'post-detection audit snapshot');
  structureDoc.derived_plain_text = spatialBlocksToPlainText(spatialBlocks);

  const classified = classifySectionBlocks(detection.blocks || []);
  const structured = extractFieldsFromSectionBlocks(classified, {
    rawText: opts.rawText,
    headerLines: opts.headerLines,
  });

  const graph = runResumeGraphEngine(structured, {
    rawText: opts.rawText,
    lines: detection.lines,
  });

  const cvData = structuredToCvData(graph.structured || structured);

  const guardResult = guard.assertNoEarlyFlatten();
  setActiveFlatTextGuard(null);

  return {
    version: BLOCK_PIPELINE_VERSION,
    stage: STRUCTURE_FIRST_STAGE.CANONICAL,
    structureDoc,
    detection,
    structured: graph.structured || structured,
    resumeJson: graph.resumeJson,
    cvData,
    flatTextGuard: guardResult,
    layoutInput,
  };
}

/**
 * Attach structure-first document to enterprise extraction metadata.
 * @param {object} enterprise
 * @param {object} [opts]
 */
export function attachStructureFirstToEnterprise(enterprise, opts = {}) {
  if (!enterprise) return null;
  const lines = enterprise.lines || enterprise.metadata?.lines || opts.lines || [];
  const spatialBlocks =
    enterprise.spatialBlocks ||
    enterprise.metadata?.spatialBlocks ||
    enterprise.layoutMemory?.spatialBlocks ||
    enterprise.metadata?.layoutMemory?.spatialBlocks ||
    [];

  const doc = buildStructureFirstDocument({
    extractionLines: lines,
    spatialBlocks,
    source: enterprise.method || enterprise.metadata?.extractionMethod,
    sectionSegmentation: opts.sectionSegmentation,
  });

  enterprise.structureFirst = doc;
  enterprise.metadata = {
    ...(enterprise.metadata || {}),
    structureFirst: doc,
    structureFirstVersion: BLOCK_PIPELINE_VERSION,
    structurePreserved: doc.structure_preserved,
    primaryParseInput: spatialBlocks.length ? 'spatial_blocks' : lines.length ? 'extraction_lines' : 'plain_text_fallback',
  };
  return doc;
}
