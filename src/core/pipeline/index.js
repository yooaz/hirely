/**
 * @module core/pipeline — canonical import + production orchestration.
 */

/** Product contract exports — verified by scripts/check-core-exports.mjs */
export {
  sanitizeResumeForDisplay,
  sanitizedResumeSize,
} from '../validation/sanitize-resume-display.js';
export {
  FINAL_RESUME_CONTRACT_VERSION,
  FINAL_RESUME_PIPELINE,
  buildFinalResumeData,
  validateFinalResumeContract,
  isFinalResumeRenderable,
  getFinalResumeFallbackReason,
} from '../validation/final-resume-contract.js';
export { runHirelyImportFromText as runHirelyPipeline } from './hirely-import.js';
export { computeProductScore as scoreResume } from '../validation/product-score.js';
export { generateCoverLetter } from '../export/letter-ai-generation.js';
export {
  EXPORT_LOCK_VERSION,
  validateExportLock,
  validateFinalResumeForExport,
  validateExportCvElement,
  buildCvExportFilename,
} from '../export/export-lock.js';

export {
  extractDocument,
  buildBlocks,
  classifyBlocks,
  buildStructuredResume,
  runCanonicalImport,
} from './canonical-import.js';

export {
  runProductionExtractionPipeline,
  generateExtractionReport,
  printExtractionReport,
} from './production-pipeline.js';

export {
  canonicalImportFromFile,
  canonicalImportFromText,
  extractTextFromFile,
  normalizeText,
  detectFileType,
} from '../import/canonical-import.js';

export {
  IMPORT_STATUS,
  IMPORT_STATE,
  resolveImportStatus,
  resolveImportState,
  mapLegacyStatusToImportState,
  mapImportStateToLegacy,
  importStatusRequiresPasteFallback,
  importStatusAllowsParser,
  importStateAllowsParser,
  importStateNeedsPaste,
  pasteFallbackMessage,
  ocrRecoveredMessage,
  IMPORT_FALLBACK_TITLE,
  IMPORT_OCR_FAILURE_LEAD,
  IMPORT_FALLBACK_LEAD,
} from '../import/import-status.js';

export {
  IMPORT_FALLBACK_UX_VERSION,
  IMPORT_FALLBACK_UX_LEAD,
  IMPORT_FALLBACK_UX_TITLE,
  sanitizeImportErrorForUser,
  resolveImportFileTypeLabel,
  resolveImportFallbackReason,
  buildImportFallbackMeta,
  IMPORT_FILE_TYPE_LABELS,
} from '../import/import-fallback-ux.js';

export {
  beginImportRun,
  peekImportRunId,
  isImportRunCurrent,
  dispatchImportRunEvent,
} from '../import/import-run-guard.js';

export {
  finishImport,
  setImportPhase,
  isImportRunFinished,
  getImportRunSnapshot,
  isTerminalImportState,
} from '../import/import-state.js';

export {
  hasRenderableImportText,
  isPlaceholderOnlyResume,
  MIN_IMPORT_RENDER_CHARS,
} from '../import/import-render-guard.js';

export {
  runHirelyImportFromFile,
  runHirelyImportFromText,
  importFile,
  importText,
  importPaste,
  buildProductFallback,
  productionToHirelyImportResult,
  emptyHirelyImportResult,
  slimImportBlocks,
} from './hirely-import.js';

export {
  resolveHonestImportState,
  assessResumeDataReliability,
  textMeetsRealCvMinimum,
  validateExtractionReliabilityForExport,
} from '../validation/extraction-reliability.js';
export {
  HIRELY_FLOW_LOCK,
  HIRELY_FLOW_STAGES,
  ALLOWED_RESUME_DATA_KEYS,
  isHirelyFlowLocked,
  lockResumeDataShape,
  stripResumeDataForProduct,
  stripTemplateCvData,
  assertResumeDataFlowLock,
  assertTemplateCvFlowLock,
  logPipelineStage,
  resumeDataMeetsImportMinimum,
  FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS,
} from './hirely-flow-lock.js';

export {
  emptyResumeData,
  resumeDataFromImport,
  resumeDataFromStructured,
  resumeDataToCvData,
  normalizeResumeData,
  resumeDataIsRenderable,
  normalizeCvDataForTemplate,
  stripStrictTemplateCvData,
  foldParserLeakFields,
  STRICT_TEMPLATE_CV_KEYS,
  STRICT_FINAL_RESUME_SECTION_KEYS,
  PARSER_LEAK_KEYS,
  moveUnsortedToSection,
  reorderListItems,
  reorderExperiences,
  clearListSection,
  reconcileTextRetention,
  buildResumeData,
  prepareResumeDataForUiCommit,
  shouldSkipFlatRepairForResumeData,
  assertResumeDataContract,
} from '../resume-data.js';
export { repairResumeDataFromRaw } from '../parsing/import-repair.js';

export {
  BLOCK_TYPES,
  blockTypeLabel,
  createEmptyBlock,
  legacyToBlocks,
  applyBlocksToResumeData,
  ensureResumeBlocks,
  addBlock,
  deleteBlock,
  duplicateBlock,
  moveBlockToIndex,
  updateBlock,
  moveLinesToBlocks,
} from '../resume-blocks.js';

export {
  resolveCreativeResumeMode,
  getStudioBlockTypes,
  getSmartRepairTargets,
  CREATIVE_MODE_TARGET_ROLES,
  CREATIVE_FIRST_CLASS_SECTIONS,
  reconcileCreativeSections,
} from '../creative-resume-mode.js';

export { runP0Pipeline } from './p0-pipeline.js';

export {
  CV_REBUILD_ENGINE_V1,
  REBUILD_PIPELINE,
  runCvRebuildEngine,
  applyCvRebuildEngine,
  auditRebuildOutput,
} from './cv-rebuild-engine.js';

export {
  reconstructDocument,
  reconstructionToParseReady,
  RECONSTRUCTION_STAGES,
} from '../layout/document-reconstruction.js';

export {
  normalizePipelineTexts,
  coerceParserInputText,
  coercePipelineString,
  slimStructuredResume,
  strictStructuredResume,
  slimPipelineResult,
  stripCvDataForTemplate,
  debugStructuredResumeJson,
  assertStructuredResumeJsonSize,
  assertStrictStructuredResumeKeys,
  guardStructuredResumeSize,
  buildDebugReport,
  capUnsortedPractical,
  assertExperienceRecovery,
  recoverExperienceLinesToUnsorted,
  STRUCTURED_RESUME_JSON_MAX,
} from './pipeline-contract.js';

/** @deprecated Use runCanonicalImport or importText */
export { runExtractionPipeline } from '../parsing/pipeline.js';

export {
  LINKEDIN_IMPORT_ENGINE,
  mergeLinkedInSources,
  normalizeLinkedInImportSource,
  runLinkedInImportMerge,
  runLinkedInMultiImport,
  scoreResumeDataSource,
  buildLinkedInImportReportSummary,
} from '../import/linkedin-import-engine.js';
export {
  detectLinkedInSource,
  LINKEDIN_SOURCE_TYPES,
  sourceFieldWeight,
} from '../import/linkedin-source-detect.js';
export {
  parseLinkedInExportText,
  parseLinkedInExportPayload,
  resumeDataFromLinkedInExport,
} from '../import/linkedin-export-parser.js';
