/**
 * Hirely P0 pipeline — extraction + parsing only (no UI/templates/export scoring).
 * Document → layout → block detection → block classification → structured resume
 * Never parseCV(raw) — blocks only; confidence < 70 → review queue.
 */

import {
  cleanExtraction,
  getLastRejectedLines,
  getLastUncertainLines,
  getLastCleanLoss,
  setParseExtractionLines,
  titleCaseName,
  lineLooksLikeName,
  isBadName,
  nameLooksLikeBrandList,
  isSectionHeaderLine,
  lineLooksLikeTitle,
  lineHasJunk,
  forceCvDataFromText,
  cvDataIsRenderable,
} from '../parsing/rich-parser.js';
import {
  structuredToCvData,
  buildConfidenceReport,
} from '../parsing/structured-resume.js';
import { buildStructuredResumeFromDocumentBlocks } from '../parsing/structured-resume-from-blocks.js';
import { runP0Pipeline } from './p0-pipeline.js';
import { countByType } from '../parsing/block-classifier.js';
import { auditPipeline } from '../validation/audit.js';
import { scoreCV } from '../validation/score.js';
import { computeProductScore } from '../validation/product-score.js';
import { computeImportQualityScore } from '../validation/import-quality-score.js';
import { formatCvAsStructuredText } from '../export/format-cv.js';
import { sanitizeCvDataForExport } from '../parsing/corruption-detector.js';
import { applyReviewQueueToCvData } from '../parsing/review-queue.js';
import { generateCreativeDictionaryCoverageReport } from '../../data/dictionaries/creative/index.js';
import { flattenStructuredPreservedText } from '../../debug/cv-preserved-text.js';
import { buildParserDetectionSummary } from '../parsing/parser-recovery.js';
import { peekLastPdfExtraction, peekLastEnterpriseExtraction } from '../extraction/extraction-session.js';
import {
  recordExtractionAuditStage,
  sanitizeParserInput,
  printExtractionAuditSummary,
} from '../extraction/extraction-audit.js';
import { extractPlainTextEnterprise } from '../extraction/enterprise-engine.js';
import { fetchStructuredCvData, mergeCvData, llmStructureConfigured } from '../parsing/structure-from-api.js';
import {
  runAiReconstructionEngine,
  mergeAiResumeIntoCvData,
  applyAiReconstructionArchive,
  aiReconstructionConfigured,
} from '../parsing/ai-reconstruction-engine.js';
import { buildOcrForensic, attachForensicToAudit, logOcrForensic } from '../../debug/ocr-forensic.js';
import { detectDocumentStage } from '../extraction/stages/document-detection.js';
import {
  buildExtractionArchiveStage,
  measureTextRetention,
} from '../extraction/stages/extraction-archive.js';
import { runConflictResolverStage } from '../parsing/stages/conflict-resolver-stage.js';
import { runExtractionScoreStage } from '../parsing/stages/extraction-score-stage.js';
import { runValidationStage } from '../parsing/stages/validation-stage.js';
import {
  generateExtractionReport,
  printExtractionReport,
} from '../validation/extraction-report.js';
import { runProductionAudit } from '../validation/production-audit.js';
import {
  beginForensicResumeImport,
  captureForensicResumeStage,
  finalizeForensicResumeImport,
  FORENSIC_ARTIFACT_NAMES,
} from '../../debug/forensic-resume-mode.js';
import { ENTERPRISE_PARSER_BUCKETS } from '../parsing/parser-enterprise.js';
import { clearParserClassificationLog } from '../parsing/parser-classification-debug.js';
import { enforceNoDataLossRule, capUnsortedWithArchive } from '../parsing/no-data-loss.js';
import { buildZeroTextLossAudit, isZeroTextLossMode } from '../parsing/zero-text-loss.js';
import { applySafeFallback, ensureExportableCv } from '../parsing/safe-fallback.js';
import { P0_CONFIDENCE_THRESHOLD } from '../parsing/p0-threshold.js';
import { applyConfidenceGate } from '../parsing/confidence-scoring.js';
import {
  normalizePipelineTexts,
  coerceParserInputText,
  slimStructuredResume,
  slimPipelineResult,
  stripCvDataForTemplate,
  guardStructuredResumeSize,
  buildDebugReport,
  assertExperienceRecovery,
  recoverExperienceLinesToUnsorted,
} from './pipeline-contract.js';
import { hirelyDebugWarn } from '../runtime/hirely-debug.js';
import { buildProductionPipelineSafeFallback } from '../runtime/runtime-stability-guard.js';
import { attachStructureFirstToEnterprise, buildStructureFirstDocument } from '../blocks/block-pipeline.js';
import { enterpriseHasSpatialParseInput } from '../parsing/cv-block-parser-bridge.js';
import { runResumeLayoutAnalysis } from '../layout/resume-layout-engine.js';

export { generateExtractionReport, printExtractionReport };

/** @param {object} blockPipeline */
function resolveClassifiedBlockList(blockPipeline) {
  const cb = blockPipeline?.classifiedBlocks;
  if (Array.isArray(cb)) return cb;
  if (cb?.blocks && Array.isArray(cb.blocks)) return cb.blocks;
  return [];
}

/**
 * @param {string} rawText
 * @param {object} opts
 */
export async function runProductionExtractionPipeline(rawText, opts = {}) {
  try {
    return await runProductionExtractionPipelineInner(rawText, opts);
  } catch (err) {
    console.error('PRODUCTION_PIPELINE_SAFE_FALLBACK', err);
    return buildProductionPipelineSafeFallback(rawText, opts, err);
  }
}

/**
 * @param {string} rawText
 * @param {object} opts
 */
async function runProductionExtractionPipelineInner(rawText, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const raw = String(rawText || '');
  const canonical = opts.canonicalImport !== false;
  if (canonical && (opts.parseCV || opts.cleanText)) {
    hirelyDebugWarn('[Hirely] parseCV/cleanText overrides ignored — canonical import only');
  }
  clearParserClassificationLog();

  const forensicOn =
    globalThis.HIRELY_DEBUG === true || globalThis.HIRELY_FORENSIC === true;
  const forensicImportId = forensicOn
    ? beginForensicResumeImport({
        extractionMethod: opts.extractionMethod || peekLastEnterpriseExtraction()?.method || 'paste',
        fileName: opts.file?.name || null,
        source: opts.source || 'production-pipeline',
      })
    : null;

  const pdfExtraction = opts.pdfExtraction || peekLastPdfExtraction();
  const extractionMethod =
    opts.extractionMethod || pdfExtraction?.method || peekLastEnterpriseExtraction()?.method || 'paste';

  let enterprise =
    opts.enterpriseExtraction ||
    peekLastEnterpriseExtraction() ||
    (raw.length >= 20 ? extractPlainTextEnterprise(raw, extractionMethod) : null);

  const stageDocument = detectDocumentStage({
    file: opts.file,
    method: extractionMethod,
    fileType: enterprise?.metadata?.fileType || pdfExtraction?.fileType,
    pdfClassification: pdfExtraction?.classification || null,
  });

  const stageArchive = buildExtractionArchiveStage(enterprise, raw);

  const texts = normalizePipelineTexts(stageArchive.rawExtraction, stageArchive.cleanedText, {
    extractionMethod,
    applyCvNormalizer: true,
    ocr: /ocr|mixed|scan|image|pdf_scan|pdf_mixed/i.test(String(extractionMethod || '')),
  });
  stageArchive.rawExtraction = texts.rawText;
  stageArchive.cleanedText = texts.cleanedText;
  if (texts.normalizerStats) {
    stageArchive.normalizerStats = texts.normalizerStats;
  }

  captureForensicResumeStage(forensicImportId, FORENSIC_ARTIFACT_NAMES.OCR, stageArchive.rawExtraction, {
    note: 'post-normalize',
  });
  captureForensicResumeStage(forensicImportId, FORENSIC_ARTIFACT_NAMES.CLEAN, stageArchive.cleanedText, {
    note: 'post-normalize',
  });
  recordExtractionAuditStage('extraction_archive', {
    lines: stageArchive.lines,
    rawText: stageArchive.rawExtraction,
    cleanText: stageArchive.cleanedText,
    pageCount: stageArchive.pageCount,
    normalizerStats: texts.normalizerStats || null,
  });

  const sanitized = sanitizeParserInput(stageArchive.cleanedText, stageArchive.lines);
  stageArchive.lines = sanitized.lines;
  stageArchive.cleanedText = sanitized.cleanedText;
  captureForensicResumeStage(forensicImportId, FORENSIC_ARTIFACT_NAMES.CLEAN, stageArchive.cleanedText, {
    note: 'post-sanitize',
  });
  enterprise = {
    ...(enterprise || {}),
    rawExtraction: stageArchive.rawExtraction,
    cleanedText: stageArchive.cleanedText,
    text: stageArchive.cleanedText,
    lines: stageArchive.lines,
    method: stageArchive.method,
    metadata: {
      ...(enterprise?.metadata || {}),
      productionPipeline: true,
      pipelineVersion: 'p0-layout',
      documentStage: stageDocument,
    },
  };

  attachStructureFirstToEnterprise(enterprise, { lines: stageArchive.lines });

  const spatialParseInput = enterpriseHasSpatialParseInput(enterprise);
  const structureFirst = opts.structureFirst !== false || spatialParseInput;
  if (spatialParseInput) {
    const spatial =
      enterprise.spatialBlocks ||
      enterprise.metadata?.spatialBlocks ||
      enterprise.layoutMemory?.spatialBlocks ||
      [];
    if (spatial.length) enterprise.spatialBlocks = spatial;
    enterprise.metadata = {
      ...(enterprise.metadata || {}),
      spatialParseInput: true,
      structureFirst: true,
      spatialBlocks: spatial,
    };
  }

  if (stageArchive.lines?.length) {
    const spatial =
      enterprise.metadata?.spatialBlocks ||
      enterprise.layoutMemory?.spatialBlocks ||
      [];
    enterprise.metadata.resumeLayoutStage = runResumeLayoutAnalysis({
      lines: stageArchive.lines,
      spatialBlocks: spatial,
    });
    enterprise.metadata.resumeLayoutDebug = enterprise.metadata.resumeLayoutStage.debug;
  }

  const pdfPrebuilt = enterprise?.metadata?.documentBlocks || enterprise?.documentBlocks;
  const isPdf =
    /pdf|native_pdf|mixed|pdf_text|pdf_scan|pdf_mixed/i.test(String(extractionMethod || '')) ||
    String(enterprise?.metadata?.fileType || '').startsWith('pdf');
  const neverParseRawPdfText =
    isPdf &&
    (enterprise?.metadata?.neverParseRawPdfText === true ||
      enterprise?.metadata?.documentReconstruction === true ||
      enterprise?.metadata?.parseFromDocumentBlocksOnly === true);

  let blockPipeline;
  if (isPdf && Array.isArray(pdfPrebuilt) && pdfPrebuilt.length > 0) {
    const threshold = P0_CONFIDENCE_THRESHOLD;
    const confidence = applyConfidenceGate(pdfPrebuilt, threshold);
    blockPipeline = {
      pipelineVersion: 'p0-layout',
      neverRawParseCv: true,
      neverParseRawPdfText: true,
      parseSource: 'document_reconstruction',
      documentReconstruction: enterprise.metadata?.documentReconstruction === true,
      fromPdfBlockEngine: true,
      layout: enterprise.metadata?.layoutStage || enterprise.metadata?.pdfBlockEngine?.layout,
      columns: enterprise.metadata?.pdfBlockEngine?.columns,
      reading: enterprise.metadata?.readingStage || enterprise.metadata?.pdfBlockEngine?.reading,
      classifiedBlocks: pdfPrebuilt,
      confidence,
      renderBlocks: confidence.renderBlocks,
      reviewBlocks: confidence.reviewBlocks,
      threshold,
      at: new Date().toISOString(),
    };
  } else {
    blockPipeline = runP0Pipeline(
      {
        lines: stageArchive.lines,
        rawText: stageArchive.rawExtraction,
        cleanedText: stageArchive.cleanedText,
        ocrLayout: enterprise?.metadata?.ocrLayout || null,
        source: isPdf ? 'pdf' : extractionMethod,
      },
      { skipStructuredResume: true }
    );
  }

  const stageLayout = blockPipeline.layout;
  enterprise.metadata.layoutStage = stageLayout;
  enterprise.metadata.columnsStage = blockPipeline.columns;
  enterprise.metadata.readingStage = blockPipeline.reading;

  const stageReadingBlocks = blockPipeline.reading;
  const classifiedBlockList = resolveClassifiedBlockList(blockPipeline);
  const stageDocumentBlocks = {
    stage: 'document_blocks',
    documentBlocks: classifiedBlockList,
    blockCount: classifiedBlockList.length,
    renderBlocks: blockPipeline.renderBlocks,
    reviewBlocks: blockPipeline.reviewBlocks,
    typeCounts: countByType(classifiedBlockList),
    acceptedCount: blockPipeline.confidence.renderCount,
    reviewCount: blockPipeline.confidence.reviewCount,
    threshold: blockPipeline.confidence.threshold,
    at: blockPipeline.at,
  };

  let cleanedText = coerceParserInputText(
    opts.cleanText ? opts.cleanText(stageArchive.rawExtraction) : stageArchive.cleanedText,
    stageArchive.rawExtraction || raw
  );
  captureForensicResumeStage(forensicImportId, FORENSIC_ARTIFACT_NAMES.PARSER_INPUT, cleanedText);
  recordExtractionAuditStage('parser_input', {
    cleanText: cleanedText,
    lines: stageArchive.lines,
    pageCount: stageArchive.pageCount,
  });
  const rejectedLines = opts.rejectedLines || getLastRejectedLines();
  const uncertainLines = opts.uncertainLines || getLastUncertainLines();
  const cleanLoss = opts.cleanLoss || getLastCleanLoss();

  if (stageArchive.lines?.length) {
    setParseExtractionLines(stageArchive.lines);
  } else {
    setParseExtractionLines(null);
  }

  let structuredResume = buildStructuredResumeFromDocumentBlocks(blockPipeline.renderBlocks, {
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    rejectedLines,
    uncertainLines,
    pdfExtraction,
    enterprise,
    structureFirst,
    extractionLines: stageArchive.lines,
    layoutMemory: enterprise?.layoutMemory || enterprise?.metadata?.layoutMemory || null,
    spatialBlocks:
      enterprise?.spatialBlocks ||
      enterprise?.metadata?.spatialBlocks ||
      enterprise?.layoutMemory?.spatialBlocks ||
      enterprise?.metadata?.layoutMemory?.spatialBlocks ||
      null,
    layoutStage: stageLayout,
    readingStage: stageReadingBlocks,
    extractionMethod,
    fileName: opts.file?.name || opts.fileName || null,
    layoutType: stageLayout.layoutType,
    parseHelpers: opts.parseHelpers || {
      titleCaseName,
      lineLooksLikeName,
      isBadName,
      nameLooksLikeBrandList,
      isSectionHeaderLine,
      lineLooksLikeTitle,
      lineHasJunk,
    },
  });

  structuredResume.metadata = {
    ...(structuredResume.metadata || {}),
    pipelineVersion: 'block-v1',
    documentType: stageDocument.documentType,
    layoutType: stageLayout.layoutType,
    documentReconstruction: blockPipeline.documentReconstruction === true,
    neverParseRawPdfText: neverParseRawPdfText || blockPipeline.neverParseRawPdfText === true,
    visualStructure:
      blockPipeline.visualStructure || enterprise?.metadata?.visualStructure || null,
    readingBlockCount: stageReadingBlocks.blockCount,
    usedRawPdfLineOrder: stageReadingBlocks.usedRawPdfLineOrder === true,
    usedGeometryReadingOrder: stageReadingBlocks.usedGeometryReadingOrder === true,
    documentBlocks: {
      blockCount: stageDocumentBlocks.blockCount,
      acceptedCount: stageDocumentBlocks.acceptedCount,
      reviewCount: stageDocumentBlocks.reviewCount,
      typeCounts: stageDocumentBlocks.typeCounts,
      threshold: stageDocumentBlocks.threshold,
    },
  };

  let validatedCVData = sanitizeCvDataForExport(structuredToCvData(structuredResume));

  const useAiReconstruction =
    opts.aiReconstruction === true ||
    (globalThis.HIRELY_AI_RECONSTRUCTION === true &&
      opts.aiReconstruction !== false &&
      aiReconstructionConfigured());
  const useLegacyLlm =
    opts.llmStructure === true ||
    (globalThis.HIRELY_USE_LLM_STRUCTURE === true &&
      opts.llmStructure !== false &&
      llmStructureConfigured());
  const llmEligible =
    (useAiReconstruction || useLegacyLlm) && /ocr|scann/i.test(String(extractionMethod || ''));
  if (llmEligible && cleanedText.length >= 80) {
    if (useAiReconstruction) {
      const ai = await runAiReconstructionEngine(cleanedText, { forceLlm: true });
      if (ai.lowConfidence) {
        structuredResume = applyAiReconstructionArchive(structuredResume, ai);
      } else if (ai.confidence >= 80 && ai.resume) {
        validatedCVData = sanitizeCvDataForExport(
          mergeAiResumeIntoCvData(validatedCVData, ai.resume)
        );
      }
      validatedCVData.meta = {
        ...(validatedCVData.meta || {}),
        aiReconstruction: ai,
      };
    } else if (useLegacyLlm) {
      const llmCv = await fetchStructuredCvData(cleanedText);
      if (llmCv) validatedCVData = sanitizeCvDataForExport(mergeCvData(validatedCVData, llmCv));
    }
  }

  const bucketCounts = { ...(stageDocumentBlocks.typeCounts || {}) };
  const missingBuckets = ['experience', 'education', 'skills'].filter(
    (b) => !bucketCounts[b] && cleanedText.length > 200
  );

  const stageParser = {
    stage: 'parser',
    buckets: ENTERPRISE_PARSER_BUCKETS,
    bucketCounts,
    missingBuckets,
    parseSource: 'classified_blocks_only',
    neverRawParseCv: true,
    at: new Date().toISOString(),
  };

  const stageValidation = runValidationStage({
    cvData: validatedCVData,
    structuredResume,
    enterprise,
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    rejectedLines,
    uncertainLines,
    extractionMethod,
  });

  const stageConflict = runConflictResolverStage({
    blocks: stageDocumentBlocks.documentBlocks.map((db) => ({
      id: db.id,
      kind: 'content',
      bucket: db.type,
      type: db.type,
      text: db.text,
      confidence: db.confidence,
      accepted: db.accepted,
      needsReview: db.needsReview,
      lines: db.lines,
    })),
    existingReview: [
      ...stageValidation.reviewQueue,
      ...(structuredResume.reviewQueue || []),
      ...(structuredResume.factReviewQueue || []),
      ...(structuredResume.needsReview || []),
    ],
  });

  validatedCVData = applyReviewQueueToCvData(stageValidation.cvData, stageConflict.reviewQueue);
  validatedCVData.reviewQueue = stageConflict.reviewQueue;

  const noDataLoss = enforceNoDataLossRule({
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    blocks: stageDocumentBlocks.documentBlocks,
    reviewBlocks: blockPipeline.reviewBlocks || [],
    structuredResume,
    cvData: validatedCVData,
    rejectedLines,
    uncertainLines,
    reviewQueue: stageConflict.reviewQueue,
  });
  validatedCVData = applySafeFallback(noDataLoss.cvData, {
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    reviewQueue: stageConflict.reviewQueue,
  });
  structuredResume = noDataLoss.structuredResume || structuredResume;
  if (isZeroTextLossMode() && noDataLoss.zeroTextLossAudit) {
    validatedCVData.meta = {
      ...(validatedCVData.meta || {}),
      zeroTextLossAudit: noDataLoss.zeroTextLossAudit,
      UNSORTED_ARCHIVE: structuredResume.metadata?.UNSORTED_ARCHIVE,
    };
  }
  if ((validatedCVData.unsorted || []).length < (structuredResume?.unsorted || []).length) {
    validatedCVData.unsorted = [
      ...new Set([...(validatedCVData.unsorted || []), ...(structuredResume.unsorted || [])]),
    ].slice(0, 96);
  }
  validatedCVData = stripCvDataForTemplate(validatedCVData);
  validatedCVData.structuredResume = slimStructuredResume(structuredResume);

  if (!noDataLoss.renderable && !cvDataIsRenderable(validatedCVData)) {
    if (canonical) {
      validatedCVData = stripCvDataForTemplate({
        ...validatedCVData,
        reviewQueue: stageConflict.reviewQueue,
      });
    } else {
      const pdfBlocksOnly =
        neverParseRawPdfText &&
        (blockPipeline.renderBlocks?.length === 0 || blockPipeline.documentReconstruction === false);
      validatedCVData = ensureExportableCv(
        pdfBlocksOnly
          ? { ...validatedCVData, reviewQueue: stageConflict.reviewQueue }
          : forceCvDataFromText(cleanedText || raw),
        { rawText: stageArchive.rawExtraction || raw, cleanedText }
      );
      validatedCVData.reviewQueue = stageConflict.reviewQueue;
      validatedCVData._parseFallback = pdfBlocksOnly
        ? 'pdf_reconstruction_review_required'
        : 'emergency_text_only';
      const recovered = enforceNoDataLossRule({
        rawText: stageArchive.rawExtraction || raw,
        cleanedText,
        cvData: validatedCVData,
        rejectedLines,
        uncertainLines,
        reviewQueue: stageConflict.reviewQueue,
      });
      validatedCVData = recovered.cvData;
    }
  }

  captureForensicResumeStage(forensicImportId, FORENSIC_ARTIFACT_NAMES.PARSER_OUTPUT, structuredResume, {
    asJson: true,
    note: 'structured_resume_final',
  });

  const retention = measureTextRetention(
    stageArchive.rawExtraction || raw,
    cleanedText,
    validatedCVData,
    stageArchive.lines
  );

  const confidenceReport = buildConfidenceReport(structuredResume, {}, rejectedLines.length);

  const stageScore = runExtractionScoreStage({
    document: stageDocument,
    layout: stageLayout,
    archive: stageArchive,
    blocks: stageDocumentBlocks.documentBlocks,
    structuredResume,
    retention,
    validation: stageValidation,
    parserScore: confidenceReport.overall,
  });

  const wc = cleanedText.trim().split(/\s+/).filter(Boolean).length;
  const finalText = formatCvAsStructuredText(validatedCVData);
  const audit = auditPipeline(stageArchive.rawExtraction || raw, cleanedText, validatedCVData, finalText);
  audit.extractionMethod = extractionMethod;
  if (isZeroTextLossMode()) {
    audit.zeroTextLoss =
      validatedCVData.meta?.zeroTextLossAudit ||
      structuredResume.metadata?.zeroTextLossAudit ||
      buildZeroTextLossAudit(stageArchive.rawExtraction || raw, structuredResume);
  }
  const expCheck = assertExperienceRecovery(structuredResume, cleanedText);
  if (!expCheck.ok) {
    recoverExperienceLinesToUnsorted(structuredResume, cleanedText);
    audit.warnings = [
      ...(audit.warnings || []),
      expCheck.message || 'Career lines moved to review (à classer)',
    ];
    validatedCVData = stripCvDataForTemplate(
      structuredToCvData(structuredResume)
    );
    validatedCVData.reviewQueue = stageConflict.reviewQueue;
    validatedCVData.structuredResume = slimStructuredResume(structuredResume);
  }
  audit.documentType = stageDocument.documentType;
  audit.layoutType = stageLayout.layoutType;
  if (pdfExtraction) audit.pdfExtraction = pdfExtraction;
  audit.rejectedLines = rejectedLines;
  audit.uncertainLines = uncertainLines;
  audit.cleanLoss = cleanLoss;
  if (cleanLoss?.warn) {
    audit.cleanLossWarning = `Safe clean removed ${cleanLoss.lossPct}% of characters (>20% threshold)`;
  }
  audit.parserDetection = buildParserDetectionSummary(structuredResume);
  audit.productionPipeline = {
    version: 'p0',
    document: stageDocument,
    layout: stageLayout,
    readingBlocks: {
      blockCount: stageReadingBlocks.blockCount,
      usedRawPdfOrder: stageReadingBlocks.usedRawPdfLineOrder === true,
      usedGeometryReadingOrder: stageReadingBlocks.usedGeometryReadingOrder === true,
    },
    documentBlocks: stageDocumentBlocks,
    conflict: stageConflict,
    score: stageScore,
    archive: stageArchive,
    parser: stageParser,
    validation: {
      missingFields: stageValidation.missingFields,
      neverEmpty: stageValidation.neverEmpty,
    },
  };
  audit.timingMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);

  const forensic = buildOcrForensic(stageArchive.rawExtraction || raw, {
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    rejectedLines,
    structuredResume,
    validatedCVData,
    extractionMethod,
    audit,
  });
  attachForensicToAudit(audit, forensic);
  if (globalThis.HIRELY_OCR_FORENSIC === true) logOcrForensic(forensic);

  const score = opts.scoreCV
    ? opts.scoreCV(validatedCVData)
    : (() => {
        const ats = computeProductScore(validatedCVData);
        if (ats) {
          return {
            overall: ats.total,
            ats: ats.total,
            recruiter: ats.total,
            readability: ats.readability?.score ?? ats.total,
            impact: ats.recruiterReadiness?.score ?? ats.total,
            completeness: ats.completeness?.score ?? ats.total,
            breakdown: ats.breakdown,
            band: ats.band,
          };
        }
        return scoreCV(validatedCVData);
      })();
  const importQuality = stageValidation.importQuality;
  audit.importQuality = importQuality;
  audit.creativeDictionary = generateCreativeDictionaryCoverageReport(cleanedText || raw);
  audit.fieldCompleteness = stageValidation.fieldCompleteness;
  audit.contentUtilizationPct = retention.retentionPct;
  audit.contentLossPct = retention.lossPct;
  audit.cleanedTextUtilization = noDataLoss.utilization;
  audit.cleanedTextUtilizationPct = noDataLoss.utilization.utilizationPct;
  audit.incompleteCv = noDataLoss.incomplete;
  if (noDataLoss.warnings?.length) {
    audit.warnings = [...(audit.warnings || []), ...noDataLoss.warnings];
  }
  if (!noDataLoss.utilization.meetsTarget) {
    audit.contentUtilizationWarning = noDataLoss.utilization.warning;
    hirelyDebugWarn('[Hirely] NO DATA LOSS', noDataLoss.utilization.warning);
  }
  audit.extractionScore = stageScore.extractionScore;
  if (stageValidation.fieldCompleteness.warnings?.length) {
    audit.warnings = [...(audit.warnings || []), ...stageValidation.fieldCompleteness.warnings];
  }

  const stages = {
    document: stageDocument,
    layout: stageLayout,
    readingBlocks: {
      ...stageReadingBlocks,
      usedRawPdfOrder: stageReadingBlocks.usedRawPdfLineOrder === true,
    },
    documentBlocks: stageDocumentBlocks,
    conflict: stageConflict,
    score: stageScore,
    archive: stageArchive,
    parser: stageParser,
    validation: stageValidation,
  };

  const extractionReport = generateExtractionReport({
    stages,
    retention,
    cleanedTextUtilization: noDataLoss.utilization,
    noDataLoss,
    extractionMethod,
    creativeDictionary: audit.creativeDictionary,
    structuredResume,
  });
  audit.extractionReport = extractionReport;
  audit.importQualityScore = computeImportQualityScore({
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    cvData: validatedCVData,
    structuredResume,
    audit,
    pipeline: { retention, stages, method: extractionMethod },
    importQuality,
    fieldCompleteness: stageValidation.fieldCompleteness,
    extractionMethod,
    recruiterScore: computeProductScore(validatedCVData),
  });

  audit.productionAudit =
    globalThis.HIRELY_DEBUG === true
      ? runProductionAudit(cleanedText, structuredResume, {
          rawText: stageArchive.rawExtraction || raw,
          log: true,
        })
      : null;

  const forensicResumeEntry = finalizeForensicResumeImport(forensicImportId);
  audit.forensicResume = forensicResumeEntry
    ? {
        importId: forensicResumeEntry.id,
        label: forensicResumeEntry.label,
        compare: forensicResumeEntry.compare,
        artifacts: Object.keys(forensicResumeEntry.latest || {}),
      }
    : null;

  if (globalThis.HIRELY_EXTRACTION_REPORT === true) {
    printExtractionReport(extractionReport);
  }

  const fatStructured = structuredResume;
  const blockParserBridgeApplied =
    fatStructured?.metadata?.blockParserBridgeApplied === true ||
    fatStructured?.metadata?.blockParserApplied === true;
  const parseResponse = fatStructured?.metadata?.parseResponse || null;
  const guarded = guardStructuredResumeSize(fatStructured, cleanedText);
  structuredResume = guarded.resume;
  const debugReport = buildDebugReport(fatStructured, {
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    parserInput: cleanedText,
    audit,
    productionAudit: audit.productionAudit,
    reviewQueue: stageConflict.reviewQueue,
    warnings: audit.warnings,
  });
  if (guarded.fallback) {
    audit.warnings = [...(audit.warnings || []), 'structuredResume size guard: identity + unsorted fallback'];
  }
  validatedCVData = stripCvDataForTemplate(structuredToCvData(structuredResume));
  validatedCVData.reviewQueue = stageConflict.reviewQueue;
  validatedCVData.structuredResume = structuredResume;

  // Extraction Engine V2 — skills/languages guard + per-field 70% confidence
  if (!blockParserBridgeApplied) {
  try {
    const { postProcessCvDataV2 } = await import('../extraction/extraction-engine-v2.js');
    const v2 = postProcessCvDataV2(validatedCVData, stageConflict.reviewQueue);
    validatedCVData = v2.cvData;
    stageConflict.reviewQueue = v2.reviewQueue;
    audit.extractionEngineV2 = {
      version: v2.fieldConfidence?.version,
      overall: v2.fieldConfidence?.overall,
      flaggedCount: v2.fieldConfidence?.flaggedCount,
      skillsLanguagesMoves: v2.guard?.moves?.length || 0,
    };
  } catch (v2Err) {
    hirelyDebugWarn('[Hirely] extraction-engine-v2 post-process skipped', v2Err);
  }
  }

  audit.blockParserBridgeApplied = blockParserBridgeApplied;
  audit.parseResponse = parseResponse;

  const parserOutputText = flattenStructuredPreservedText(structuredResume).slice(0, 50000);
  recordExtractionAuditStage('parser_output', {
    cleanText: parserOutputText,
    text: parserOutputText,
    note: `structured_chars=${structuredResume?.metadata?.parserCoverage?.structuredChars ?? parserOutputText.length} coverage=${structuredResume?.metadata?.parserCoverage?.coveragePercent ?? '—'}%`,
  });
  printExtractionAuditSummary({
    rawChars: (stageArchive.rawExtraction || raw).length,
    cleanChars: cleanedText.length,
    uniqueLines: sanitized.metrics?.uniqueLines,
    duplicateLines: sanitized.metrics?.duplicateLines,
    parserInputChars: cleanedText.length,
  });

  return slimPipelineResult({
    rawText: stageArchive.rawExtraction || raw,
    cleanedText,
    rejectedLines,
    structuredResume,
    debugReport,
    confidenceReport,
    documentType: stageDocument.documentType,
    layoutType: stageLayout.layoutType,
    validatedCVData,
    structured: validatedCVData,
    validation: { data: validatedCVData, ok: stageValidation.neverEmpty },
    assessment: {
      quality: importQuality.quality,
      isPoor: importQuality.isPoor,
      score: importQuality.score,
      reasons: importQuality.reasons,
      flags: importQuality.flags,
      fieldConfidence: { overall: confidenceReport.overall },
      extractionScore: stageScore.extractionScore,
    },
    importQuality,
    canGenerate: cleanedText.length >= 20 || raw.length >= 20,
    lenientGenerate: wc >= 80,
    parseConfidence: confidenceReport.overall,
    score,
    audit,
    productionAudit: audit.productionAudit,
    extractionMethod,
    enterpriseExtraction: enterprise,
    forensic,
    forensicResumeImportId: forensicImportId,
    reviewQueue: stageConflict.reviewQueue,
    creativeDictionaryCoverage: audit.creativeDictionary,
    extractionReport,
    extractionScore: stageScore,
    retention,
    cleanedTextUtilization: noDataLoss.utilization,
    noDataLoss,
    stages,
    productionPipeline: true,
    pipelineVersion: 'block-v1',
  });
}
