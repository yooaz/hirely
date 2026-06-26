/**
 * SECTION_ENGINE_V2
 *
 * CLEAN TEXT → semantic sections → semantic blocks → field extraction → graph → RESUME JSON
 *
 * Does not depend on section titles; roles (e.g. Graphic Designer) inferred without Experience: headers.
 * Never extracts fields directly from raw text — only from classified section blocks.
 * Resume JSON is emitted only via RESUME_GRAPH_ENGINE (never direct OCR → JSON).
 */

import { postProcessOcrText, looksLikeOcrText } from './ocr-postprocess.js';
import { splitMergedSectionHeaders } from './ocr-hardening.js';
import { runOcrStructureRecovery, OCR_STRUCTURE_RECOVERY } from './ocr-structure-recovery/index.js';
import {
  preprocessOcrTextForExperience,
  applyOcrExperienceSupplement,
} from './ocr-experience-merge.js';
import { SECTION_ENGINE_V2, SECTION_IDS, SECTION_TO_RESUME_KEY } from './section-types-v2.js';
import { detectSectionBlocks } from './section-detect-v2.js';
import { extractLockedIdentity, isValidIdentityName, isValidIdentityTitle } from './identity-extraction.js';
import { classifySectionBlocks } from './section-classify-v2.js';
import {
  classifyDocumentBlocksV1,
  documentBlocksToSectionBlocks,
  SECTION_CLASSIFIER_V1,
} from './section-classifier-v1.js';
import { extractFieldsFromSectionBlocks } from './section-field-extract-v2.js';
import { runResumeGraphEngine } from './resume-graph-engine.js';
import {
  buildParserCoverageReport,
  logParserCoverageTable,
} from './parser-coverage-report.js';
import { applyZeroTextLossMode } from './zero-text-loss.js';
import {
  detectCreativeCvMode,
  applyCreativeCvModeToSectionBlocks,
  applyCreativeCvModeToStructured,
  CREATIVE_CV_MODE,
} from './creative-cv-mode.js';
import { detectDesignerCvMode, DESIGNER_CV_MODE } from './designer-cv-mode.js';
import { runExperienceRebuilder } from './experience-rebuilder.js';
import { runExperienceRecovery } from './experience-recovery.js';
import { runExperienceReconstruction } from './experience-reconstruction.js';
import { runExperienceReconstructionV2 } from './experience-reconstruction-engine-v2.js';
import { runExperienceReconstructionEngine } from './experience-reconstruction-confidence-router.js';
import { runCreativeExperienceRecovery } from './creative-experience-recovery-engine.js';
import { runClientDetection } from './client-detection-engine.js';
import { runPortfolioExtraction } from './portfolio-extraction-engine.js';
import { runProjectsExtraction } from './projects-engine.js';
import { runCreativeClientProjectRecovery } from './creative-client-project-recovery.js';
import { resolveParserLayoutInput } from './parser-layout-input.js';
import {
  attachSpatialBlocksToLayoutMemory,
  spatialBlocksToPlainText,
} from '../layout/spatial-block.js';
import { runResumeTextNormalization } from './resume-text-normalization.js';
import { sanitizeStrictExperiences } from './experience-parser.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { runUniversalExperienceReconstruction, CV_BLOCK_ENGINE } from './universal-extraction/index.js';
import {
  createFlatTextGuard,
  setActiveFlatTextGuard,
  FLATTEN_ALLOWED_SITES,
} from '../blocks/flat-text-guard.js';
import { buildStructureFirstDocument } from '../blocks/block-pipeline.js';
import {
  shouldUseBlockParserBridge,
  applyBlockParserBundleToStructured,
} from './cv-block-parser-bridge.js';

/**
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export function runSectionEngineV2(cleanedText, opts = {}) {
  const flatTextGuard =
    opts.flatTextGuard || createFlatTextGuard({ structureFirst: opts.structureFirst !== false });
  setActiveFlatTextGuard(flatTextGuard);

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
    spatialBlocks: opts.spatialBlocks,
    pageLayouts: opts.pageLayouts,
  });

  let spatialBlocks = layoutInput.spatialBlocks || [];
  let clean = String(layoutInput.text || cleanedText || '').trim();
  const raw = String(opts.rawText || layoutInput.rawText || clean).trim();
  const hasSpatialParseInput =
    opts.structureFirst !== false &&
    (spatialBlocks.length >= 3 ||
      (layoutInput.extractionLines || []).filter(
        (l) => Number.isFinite(l?.x) && Number.isFinite(l?.y)
      ).length >= 3);
  let ocrStructureRecovery = null;
  if (
    !hasSpatialParseInput &&
    (looksLikeOcrText(clean) ||
      looksLikeOcrText(raw) ||
      /ocr|pdf_scanned|pdf-ocr/i.test(String(opts.extractionMethod || '')))
  ) {
    clean = postProcessOcrText(clean || raw, { ocr: true });
    clean = preprocessOcrTextForExperience(clean || raw);
    ocrStructureRecovery = runOcrStructureRecovery(clean, {
      rawText: raw,
      extractionMethod: opts.extractionMethod,
      extractionLines: layoutInput.extractionLines,
      lines: opts.lines,
      layoutMemory: layoutInput.layoutMemory,
    });
    if (ocrStructureRecovery.applied && ocrStructureRecovery.text) {
      clean = ocrStructureRecovery.text;
    }
    if (layoutInput.layoutMemory?.entries?.length || spatialBlocks.length) {
      const normStage = runResumeTextNormalization(
        { spatialBlocks, extractionLines: layoutInput.extractionLines },
        { debug: opts.debug }
      );
      spatialBlocks = normStage.spatialBlocks || spatialBlocks;
      layoutInput.layoutMemory = attachSpatialBlocksToLayoutMemory(
        {
          ...layoutInput.layoutMemory,
          entries: (layoutInput.layoutMemory?.entries || []).map((e) => ({
            ...e,
            text: postProcessOcrText(e.text, { ocr: true }) || e.text,
          })),
        },
        spatialBlocks
      );
      clean = normStage.text || spatialBlocksToPlainText(spatialBlocks) || clean;
      flatTextGuard.recordFlatten(FLATTEN_ALLOWED_SITES.DERIVED_SNAPSHOT, 'ocr postprocess block sync');
    }
  }

  hirelyDebugLog('SECTION_ENGINE_V2', {
    engine: SECTION_ENGINE_V2,
    chars: clean.length,
    layoutLines: layoutInput.layoutMemory?.lineCount ?? 0,
    ocrStructureRecovery: ocrStructureRecovery?.applied === true,
  });

  if (
    !hasSpatialParseInput &&
    (looksLikeOcrText(clean) || looksLikeOcrText(raw))
  ) {
    const splitLines = clean
      .split('\n')
      .flatMap((line) => splitMergedSectionHeaders(line))
      .map((line) => line.trim())
      .filter(Boolean);
    if (spatialBlocks.length === splitLines.length) {
      spatialBlocks = spatialBlocks.map((b, i) => ({
        ...b,
        text: splitLines[i],
        normalized_text: splitLines[i],
      }));
      layoutInput.layoutMemory = attachSpatialBlocksToLayoutMemory(layoutInput.layoutMemory, spatialBlocks);
    }
    if (spatialBlocks.length) {
      flatTextGuard.recordFlatten(FLATTEN_ALLOWED_SITES.DERIVED_SNAPSHOT, 'ocr line split sync');
      clean = spatialBlocksToPlainText(spatialBlocks) || clean;
    } else {
      flatTextGuard.recordFlatten('section_detect', 'ocr split without spatial blocks');
      clean = splitLines.join('\n');
    }
  }

  const detection = detectSectionBlocks(clean, {
    layoutMemory: layoutInput.layoutMemory,
    spatialBlocks,
    extractionLines: layoutInput.extractionLines,
    structureFirst: opts.structureFirst !== false,
    flatTextGuard,
    sectionSegmentation: opts.sectionSegmentation,
    pageLayouts: opts.pageLayouts,
    extractionMethod: opts.extractionMethod,
    readingStage: opts.readingStage,
    orderedLines: opts.orderedLines,
    rawText: raw,
    cleanedText: clean,
    fileName: opts.fileName || opts.file?.name || '',
  });
  const {
    lines,
    blocks: detected,
    semanticLines,
    parseMode,
    neverRegexFirstParse,
    documentBlocks,
    universalBlocks,
    universalBlockEngine,
    universalBlockStats,
    twoColumnRecovery,
    twoColumnStats,
    readingStage,
  } = detection;
  const detectedTypes = [...new Set(detected.map((b) => b.type))];
  hirelyDebugLog('SECTIONS_DETECTED', {
    count: detected.length,
    types: detectedTypes,
    lines: lines.length,
    parseMode: parseMode || 'semantic-sections',
    neverRegexFirstParse: neverRegexFirstParse !== false,
  });

  const creativeMode = detectCreativeCvMode(clean, { lines, rawText: raw });
  const designerMode = detectDesignerCvMode(clean, { lines, rawText: raw });
  const effectiveCreative = creativeMode.active || designerMode.active;
  if (creativeMode.active) {
    hirelyDebugLog('CREATIVE_CV_MODE', {
      active: true,
      triggerRoles: creativeMode.triggerRoles,
    });
  }
  if (designerMode.active) {
    hirelyDebugLog('DESIGNER_CV_MODE', {
      active: true,
      triggerRoles: designerMode.triggerRoles,
    });
  }

  let classified;
  let sectionClassifier = 'section-classify-v2';
  if (documentBlocks?.length) {
    const v1 = classifyDocumentBlocksV1(documentBlocks);
    classified = documentBlocksToSectionBlocks(v1.blocks);
    sectionClassifier = SECTION_CLASSIFIER_V1;
  } else {
    classified = classifySectionBlocks(detected);
  }
  if (effectiveCreative) {
    classified = applyCreativeCvModeToSectionBlocks(classified, creativeMode.active ? creativeMode : { ...creativeMode, active: true });
  }

  let structured = extractFieldsFromSectionBlocks(classified, {
    rawText: raw,
    headerLines: opts.headerLines,
    creativeMode: effectiveCreative ? { ...creativeMode, active: true } : creativeMode,
    designerMode,
  });

  let blockParserBridge = null;
  if (shouldUseBlockParserBridge(detection, spatialBlocks, opts)) {
    blockParserBridge = applyBlockParserBundleToStructured(structured, detection, {
      segments:
        detection.resumeSegments ||
        detection.sectionSegmentation?.segments ||
        detection.resumeSpatialBlocks ||
        [],
      extractionLines: layoutInput.extractionLines,
      rawText: raw,
      cleanedText: clean,
      fileName: opts.fileName || opts.file?.name || '',
    });
    structured = blockParserBridge.structured;
  }

  if (blockParserBridge?.applied === true) {
    const ocrPath =
      looksLikeOcrText(clean) ||
      looksLikeOcrText(raw) ||
      /^(pdf|ocr)/i.test(String(opts.extractionMethod || ''));
    if (ocrPath && (structured.experiences?.length ?? 0) < 3) {
      const ocrSupplement = applyOcrExperienceSupplement(structured, clean, {
        force: true,
        rawText: raw,
      });
      structured = ocrSupplement.structured;
    }
  }

  const skipLegacyExperienceReconstruction = blockParserBridge?.applied === true;

  if (effectiveCreative && !skipLegacyExperienceReconstruction) {
    structured = applyCreativeCvModeToStructured(structured, creativeMode.active ? creativeMode : { ...creativeMode, active: true });
  }

  structured = sanitizeStrictExperiences(structured);

  if (!skipLegacyExperienceReconstruction) {
  const expReconstruct = runExperienceReconstruction(structured, clean, {
    extractionMethod: opts.extractionMethod,
  });
  structured = expReconstruct.structured;

  const expReconstructV2 = runExperienceReconstructionV2(structured, raw || clean, {
    extractionMethod: opts.extractionMethod,
  });
  structured = expReconstructV2.structured;

  const universalRecon = runUniversalExperienceReconstruction(structured, raw || clean, {
    universalBlocks: universalBlocks || [],
    lines,
    extractionMethod: opts.extractionMethod,
  });
  structured = universalRecon.structured;

  const expReconstructP4 = runExperienceReconstructionEngine(structured, raw || clean, {
    extractionMethod: opts.extractionMethod,
  });
  structured = expReconstructP4.structured;

  const classifiedTypes = new Set(classified.map((b) => String(b.type || '').toLowerCase()));
  const needsCreativeRecovery = effectiveCreative;
  const needsClientDetection =
    effectiveCreative ||
    designerMode.active ||
    classifiedTypes.has('clients') ||
    /\bclients?\b/i.test(clean);
  const needsProjectsExtraction =
    effectiveCreative ||
    designerMode.active ||
    classifiedTypes.has('projects') ||
    /\bprojects?\b/i.test(clean);
  const needsPortfolioExtraction =
    effectiveCreative ||
    designerMode.active ||
    classifiedTypes.has('portfolio') ||
    /\b(portfolio|behance|dribbble)\b/i.test(clean);

  if (needsCreativeRecovery) {
    const creativeRecovery = runCreativeExperienceRecovery(structured, raw || clean, {
      creativeMode: { ...creativeMode, active: true },
      extractionMethod: opts.extractionMethod,
    });
    structured = creativeRecovery.structured;
  }

  if (needsClientDetection) {
    const clientDetection = runClientDetection(structured, raw || clean, {
      creativeMode: effectiveCreative ? { ...creativeMode, active: true } : creativeMode,
      designerMode,
      extractionMethod: opts.extractionMethod,
    });
    structured = clientDetection.structured;
  }

  if (needsPortfolioExtraction) {
    const portfolioExtraction = runPortfolioExtraction(structured, raw || clean, {
      creativeMode: effectiveCreative ? { ...creativeMode, active: true } : creativeMode,
      extractionMethod: opts.extractionMethod,
    });
    structured = portfolioExtraction.structured;
  }

  if (needsProjectsExtraction) {
    const projectsExtraction = runProjectsExtraction(structured, raw || clean, {
      creativeMode: effectiveCreative ? { ...creativeMode, active: true } : creativeMode,
      designerMode,
      extractionMethod: opts.extractionMethod,
    });
    structured = projectsExtraction.structured;
  }

  if (needsClientDetection || needsProjectsExtraction || effectiveCreative) {
    const recovery = runCreativeClientProjectRecovery(structured, raw || clean, {
      creativeMode: effectiveCreative ? { ...creativeMode, active: true } : creativeMode,
      designerMode,
      forceCreative: effectiveCreative,
      extractionMethod: opts.extractionMethod,
    });
    structured = recovery.structured;
  }

  const expRebuild = runExperienceRebuilder(structured, clean, {
    extractionMethod: opts.extractionMethod,
  });
  structured = expRebuild.structured;
  if (!expRebuild.rebuilt) {
    const expRecovery = runExperienceRecovery(structured, clean);
    structured = expRecovery.structured;
  }
  const ocrPath =
    looksLikeOcrText(clean) ||
    looksLikeOcrText(raw) ||
    /^(pdf|ocr)/i.test(String(opts.extractionMethod || ''));
  if (ocrPath) {
    const ocrSupplement = applyOcrExperienceSupplement(structured, clean);
    structured = ocrSupplement.structured;
  }
  }

  const zeroLoss = applyZeroTextLossMode(raw || clean, structured, {
    throwOnLoss: opts.throwOnPipelineLoss !== false,
  });
  structured = zeroLoss.structured;

  structured.metadata = {
    ...(structured.metadata || {}),
    parseSource: SECTION_ENGINE_V2,
    pipelineVersion: SECTION_ENGINE_V2,
    cleanedText: clean,
    sectionBlockCount: classified.length,
    sectionsDetected: detectedTypes,
    neverRawFieldExtract: true,
    neverRegexFirstParse: neverRegexFirstParse !== false,
    sectionParseArchitecture: parseMode || 'semantic-sections',
    semanticLineCount: semanticLines?.length ?? 0,
    layoutMemory: layoutInput.layoutMemory,
    spatialBlocks,
    spatialBlockCount: spatialBlocks.length,
    parserUsesLayoutMemory: Boolean(layoutInput.layoutMemory?.lineCount),
    layoutType: layoutInput.layoutMemory?.layoutType || opts.layoutType || null,
    twoColumnRecovery: twoColumnRecovery === true,
    twoColumnStats: twoColumnStats || null,
    readingStage: readingStage || null,
    ocrStructureRecovery: ocrStructureRecovery?.applied === true,
    ocrStructureEngine: ocrStructureRecovery?.applied ? OCR_STRUCTURE_RECOVERY : null,
    ocrStructureStats: ocrStructureRecovery?.stats || null,
    documentBlocks: documentBlocks || [],
    universalBlockEngine: universalBlockEngine || CV_BLOCK_ENGINE,
    universalBlockStats: universalBlockStats || null,
    universalBlocks: universalBlocks || [],
    blockBuilder: 'BLOCK_BUILDER_V1',
    sectionClassifier,
    blockStats: detection.blockStats || null,
    zeroTextLoss: true,
    zeroTextLossAudit: zeroLoss.audit,
    extractionMethod: opts.extractionMethod || null,
    creativeCvMode: effectiveCreative ? { ...creativeMode, active: true } : null,
    creativeParsingMode: effectiveCreative === true,
    designerCvMode: designerMode.active ? designerMode : null,
    parseMode: designerMode.active
      ? DESIGNER_CV_MODE
      : effectiveCreative
        ? CREATIVE_CV_MODE
        : parseMode || 'semantic-sections',
    blockParserBridge: blockParserBridge?.applied
      ? {
          version: blockParserBridge.structured?.metadata?.blockParserBridge,
          stats: blockParserBridge.stats,
        }
      : null,
  };

  const report = buildParserCoverageReport(clean, structured, { rawText: raw || clean });
  structured.metadata.parserCoverage = report;
  logParserCoverageTable(clean, structured);

  const graphResult = runResumeGraphEngine(structured);
  structured = graphResult.structured;
  const resumeJson = graphResult.resumeJson;

  const rawIdentityLines = String(raw || clean || '')
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .slice(0, 24);
  const identityNeedsRepair =
    !isValidIdentityName(String(structured?.identity?.name || '').trim()) ||
    !isValidIdentityTitle(String(structured?.identity?.title || '').trim());
  if (identityNeedsRepair && rawIdentityLines.length) {
    const lockedIdentity = extractLockedIdentity(rawIdentityLines, {
      identityLines: rawIdentityLines.slice(0, 6),
      contactLines: rawIdentityLines.slice(0, 6),
      headerLines: rawIdentityLines.slice(0, 8),
      unsortedLines: structured?.unsorted || [],
      toClassifyLines: [],
      reviewQueueLines: structured?.needsReview || [],
      skillsLines: structured?.skills || [],
      interestsLines: structured?.interests || [],
      toolsLines: structured?.tools || [],
      fileName: opts.fileName || opts.file?.name || null,
      contact: {
        email: structured?.identity?.email,
        phone: structured?.identity?.phone,
      },
    });
    if (isValidIdentityName(lockedIdentity?.name)) {
      structured.identity.name = lockedIdentity.name;
      if (resumeJson) resumeJson.name = lockedIdentity.name;
    }
    if (isValidIdentityTitle(lockedIdentity?.title)) {
      structured.identity.title = lockedIdentity.title;
      if (resumeJson) resumeJson.title = lockedIdentity.title;
    }
    if (lockedIdentity?.nameCandidates?.length) structured.nameCandidates = lockedIdentity.nameCandidates;
    if (lockedIdentity?.titleCandidates?.length) structured.titleCandidates = lockedIdentity.titleCandidates;
    structured.selectedName = isValidIdentityName(lockedIdentity?.name) ? lockedIdentity.name : structured.selectedName;
    structured.selectedTitle = isValidIdentityTitle(lockedIdentity?.title) ? lockedIdentity.title : structured.selectedTitle;
    structured.identitySources = {
      ...(structured.identitySources || {}),
      fallback: 'IDENTITY_LOCK_FALLBACK_V1',
      name: lockedIdentity?.nameSource || structured.identitySources?.name,
      title: lockedIdentity?.titleSource || structured.identitySources?.title,
    };
  }

  hirelyDebugLog('FIELDS_EXTRACTED', {
    name: structured.identity?.name,
    experienceCount: structured.experiences?.length ?? 0,
    educationCount: structured.education?.length ?? 0,
    skillsCount: structured.skills?.length ?? 0,
    unsortedCount: structured.unsorted?.length ?? 0,
    coveragePercent: report.coveragePercent,
  });

  const sections = blocksToLegacySections(classified);

  const structureDoc = buildStructureFirstDocument({
    extractionLines: layoutInput.extractionLines,
    spatialBlocks,
    segments: detection.sectionSegmentation?.segments || detection.resumeSegments || [],
    includeDerivedText: true,
  });

  const flatTextGuardResult = flatTextGuard.assertNoEarlyFlatten();
  setActiveFlatTextGuard(null);

  return {
    structured,
    resumeJson,
    resumeGraph: graphResult.graph,
    report,
    sectionBlocks: classified,
    blocks: detected,
    sections,
    sectionsFound: Object.keys(sections).filter((k) => (sections[k] || []).length > 0),
    lines,
    structureDoc,
    structureFirst: {
      version: structureDoc.version,
      structurePreserved: structureDoc.structure_preserved,
      blockCounts: {
        raw: structureDoc.raw_blocks.length,
        normalized: structureDoc.normalized_blocks.length,
        logical: structureDoc.logical_blocks.length,
        section: structureDoc.section_blocks.length,
        spatial: spatialBlocks.length,
      },
      flatTextGuard: flatTextGuardResult,
    },
    twoColumnRecovery: twoColumnRecovery === true,
    twoColumnStats: twoColumnStats || null,
    ocrStructureRecovery: ocrStructureRecovery?.applied === true,
    ocrStructureStats: ocrStructureRecovery?.stats || null,
    creativeMode: effectiveCreative ? { ...creativeMode, active: true } : creativeMode,
    designerMode,
    blockParserBridge,
    parseBundle: blockParserBridge?.applied
      ? {
          experienceItems: detection.experienceItems || [],
          educationItems: detection.educationItems || [],
          skillItems: detection.skillItems || [],
          parseResponse: detection.parseResponse || null,
          parseConfidence: detection.parseConfidence || null,
          parseValidation: detection.parseValidation || null,
          reviewHints: detection.reviewHints || null,
        }
      : null,
  };
}

/**
 * Map V2 blocks → legacy section-first shape for downstream merge.
 * @param {import('./section-types-v2.js').SectionBlockV2[]} blocks
 */
function blocksToLegacySections(blocks) {
  /** @type {Record<string, string[]>} */
  const out = { top: [] };
  for (const block of blocks || []) {
    const key = SECTION_TO_RESUME_KEY[block.type] || 'unsorted';
    out[key] = out[key] || [];
    out[key].push(...(block.lines || []));
  }
  if (!out.profile?.length && out.top?.length) {
    out.profile = [...out.top];
  }
  return out;
}

export { SECTION_ENGINE_V2, SECTION_IDS };
