/**
 * Browser / test facade — composes extraction, parsing, validation, export.
 * Import submodules directly when you need strict boundaries.
 */

export * from './extraction/index.js';
export * from './parsing/index.js';
export {
  extractDocument,
  buildBlocks,
  classifyBlocks,
  buildStructuredResume,
  runCanonicalImport,
  importFile,
  importText,
  importPaste,
  runProductionExtractionPipeline,
  runHirelyImportFromFile,
  runHirelyImportFromText,
  buildProductFallback,
} from './pipeline/index.js';
export {
  sanitizeResumeForDisplay,
  sanitizedResumeSize,
} from './validation/sanitize-resume-display.js';
export {
  DATA_SANITIZATION_LAYER,
  applyDataSanitizationLayer,
  auditDataSanitization,
} from './validation/data-sanitization-layer.js';
export {
  HIRELY_DATA_CONTRACT_VERSION,
  REQUIRED_RESUME_DATA_SECTIONS,
  validateResumeDataContract,
  applyResumeDataContractWarnings,
  validateConsumerDataSource,
} from './validation/resume-data-contract.js';
export {
  FINAL_PREVIEW_SANITY_CHECK_V1,
  PREVIEW_SANITY_RULES,
  applyFinalPreviewSanityCheck,
  auditFinalPreviewSanity,
} from './validation/final-preview-sanity-check.js';
export {
  PREVIEW_RENDER_GATE_V1,
  assessPreviewRenderGate,
  shouldBlockPremiumPreview,
  sanitizeCvDataForCorrection,
  looksLikeMergedExtractionBlob,
  isRawBlobExperience,
} from './validation/preview-render-gate.js';
export {
  FINAL_RESUME_CONTRACT_VERSION,
  FINAL_RESUME_PIPELINE,
  FINAL_RESUME_DISPLAY_FIELDS,
  buildFinalResumeData,
  buildMetaSafe,
  toFinalResumeDisplay,
  validateFinalResumeContract,
  isFinalResumeRenderable,
  getFinalResumeFallbackReason,
  finalResumeDataMeetsReviewGuarantee,
  buildReviewGuaranteeWarnings,
  isReviewGuaranteeWeak,
  resumeObjectExists,
  applyReviewGuaranteeToValidation,
} from './validation/final-resume-contract.js';
export {
  ONE_CV_SOURCE_VERSION,
  isOneCvSourceEnabled,
  getResumeDataFromState,
  isResumeDataReady,
  sectionCountsFromResumeData,
  templateCvFromResumeData,
  buildOneSourceContract,
} from './resume/resume-data-source.js';
export {
  NAVIGATION_LOCK_VERSION,
  isNavigationLockEnabled,
  hasResumeDataForNavigation,
  isNavigationStepEnabled,
  canNavigateToStep,
  buildNavigationLockValidation,
} from './navigation/navigation-lock.js';
export {
  EXPORT_SIMPLE_VERSION,
  isExportSimpleEnabled,
  hasResumeDataForExport,
  isPreviewLiveForExport,
  canExportSimple,
} from './export/export-simple.js';
export {
  isHirelyFlowLocked,
  lockResumeDataShape,
  stripResumeDataForProduct,
  assertResumeDataFlowLock,
  resumeDataMeetsImportMinimum,
  FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS,
} from './pipeline/hirely-flow-lock.js';
export {
  emptyResumeData,
  resumeDataFromImport,
  resumeDataToCvData,
  resumeDataIsRenderable,
  normalizeCvDataForTemplate,
  stripStrictTemplateCvData,
  foldParserLeakFields,
  STRICT_TEMPLATE_CV_KEYS,
  STRICT_FINAL_RESUME_SECTION_KEYS,
  PARSER_LEAK_KEYS,
  normalizeResumeData,
  buildResumeData,
  prepareResumeDataForUiCommit,
  shouldSkipFlatRepairForResumeData,
  reconcileTextRetention,
  moveUnsortedToSection,
  reorderListItems,
  reorderExperiences,
  clearListSection,
  assertResumeDataContract,
  canonicalImportFromFile,
  canonicalImportFromText,
  IMPORT_STATUS,
  IMPORT_STATE,
  resolveImportStatus,
  resolveImportState,
  finishImport,
  setImportPhase,
  beginImportRun,
  isImportRunFinished,
  importStatusRequiresPasteFallback,
  importStateNeedsPaste,
  importStatusAllowsParser,
  importStateAllowsParser,
  pasteFallbackMessage,
  IMPORT_FALLBACK_TITLE,
  IMPORT_OCR_FAILURE_LEAD,
  IMPORT_FALLBACK_LEAD,
  IMPORT_FALLBACK_UX_VERSION,
  IMPORT_FALLBACK_UX_LEAD,
  IMPORT_FALLBACK_UX_TITLE,
  sanitizeImportErrorForUser,
  resolveImportFileTypeLabel,
  resolveImportFallbackReason,
  buildImportFallbackMeta,
  ensureResumeBlocks,
  moveLinesToBlocks,
  addBlock,
  deleteBlock,
  duplicateBlock,
  moveBlockToIndex,
  updateBlock,
  BLOCK_TYPES,
  resolveCreativeResumeMode,
  getStudioBlockTypes,
  getSmartRepairTargets,
  CREATIVE_MODE_TARGET_ROLES,
  reconcileCreativeSections,
  repairResumeDataFromRaw,
  slimStructuredResume,
  strictStructuredResume,
  slimPipelineResult,
  guardStructuredResumeSize,
  buildDebugReport,
  assertStructuredResumeJsonSize,
  assertStrictStructuredResumeKeys,
  STRUCTURED_RESUME_JSON_MAX,
} from './pipeline/index.js';
export {
  UNDETECTED_INFORMATION_LABEL,
  NAME_CONFIRM_LABEL,
  EMAIL_CONFIRM_LABEL,
  PHONE_CONFIRM_LABEL,
  TITLE_CONFIRM_LABEL,
} from './display/identity-labels.js';
export {
  isUncertainIdentityName,
  isUncertainIdentityTitle,
  isUndetectedLabel,
  auditResumeDataForInventedContent,
} from './display/undetected-label.js';
export { shouldSkipRemoteOcr, isStaticLocalMode } from './runtime/static-mode.js';
export {
  createStageResult,
  normalizeStageResult,
  runStageSafe,
  normalizeImportResultShape,
  mergeStageIntoImportResult,
} from './runtime/pipeline-stage-result.js';
export {
  buildProductionPipelineSafeFallback,
  buildExtractionSafeFallback,
  buildPdfExportSafeResult,
} from './runtime/runtime-stability-guard.js';
export {
  getHirelyRuntimeVersion,
  logHirelyRuntimeVersion,
  logResumeDataCounts,
} from './runtime/runtime-version.js';
export {
  logRenderPipelineCounts,
  sectionCounts,
  resetRenderPipelineTrace,
  getRenderPipelineLogCount,
} from './runtime/render-pipeline-trace.js';
export { formatCvAsStructuredText } from './export/index.js';
export {
  EXPORT_LOCK_VERSION,
  validateExportLock,
  validateFinalResumeForExport,
  validateExportCvElement,
  buildCvExportFilename,
} from './export/export-lock.js';
export {
  EXPORT_REWRITE_VERSION,
  isExportRewriteActive,
  canExportWithResume,
  validateExportResumeOnly,
  applyExportIsolationToValidation,
} from './export/export-rewrite.js';
export { extractLockedIdentity } from './parsing/identity-extraction.js';
export { resolveIdentityContact } from './validation/identity-contact.js';
export {
  EXTRACTION_RELIABILITY_V1,
  resolveHonestImportState,
  assessResumeDataReliability,
  textMeetsRealCvMinimum,
  resumeDataAllowsPartialReview,
  validateExtractionReliabilityForExport,
} from './validation/extraction-reliability.js';
export { runOcrOnCanvas } from './extraction/ocr-pipeline.js';
export { buildReviewQueue } from './parsing/review-queue.js';
export { extractFactsFromSectionBlocks } from './parsing/fact-extraction.js';
export { runFactPipeline } from './parsing/fact-pipeline.js';
export { runSectionEngineV2 } from './parsing/section-engine-v2.js';
export { runResumeGraphEngine } from './parsing/resume-graph-engine.js';
export {
  FINAL_IMPORT_LOCK_VERSION,
  FINAL_IMPORT_MIN_TEXT,
  FINAL_IMPORT_OUTCOME,
  normalizeFinalImportTerminal,
  classifyFinalImportOutcome,
  previewTextAllowsExport,
  countImportDecisionLogs,
} from './import/final-import-lock.js';
export {
  OCR_IMPORT_USABILITY_VERSION,
  SCANNED_PDF_NATIVE_EMPTY_IS_NORMAL,
  assessOcrImportUsability,
  assessOcrImportUsabilityRaw,
  hydrateExtractedImportText,
  buildImportDecisionFromExtracted,
  isScannedPdfWithoutNativeText,
  importMustNotStopOnNativeEmpty,
  importMustNotPasteAfterUsableOcr,
  coerceImportStateForUsableOcr,
  resolveFinalImportState,
  enrichImportDecisionContext,
  effectiveImportTextLength,
  logImportFinal,
  guardPasteImportResult,
  awaitOcrSettlementBeforeImportPaste,
  recoverLateUsableOcrImport,
} from './import/ocr-import-usability.js';
export { finalizePdfImportWithOcr, enrichImportResultWithOcrSettlement } from './import/enrich-import-result-ocr-settlement.js';
export { buildEnrichedImportRouteInput } from './import/enriched-import-route-input.js';
export {
  OCR_SETTLEMENT,
  OCR_SETTLEMENT_VERSION,
  ocrSettlementIsPending,
  ocrSettlementIsComplete,
  ocrSettlementAllowsPaste,
  isPdfImageOnlyRoute,
  applyPdfImageOnlyOcrFlagGate,
  markPdfImageOnlyOcrSettled,
  importMustNotCommitPasteWhileOcrPending,
  attachOcrSettlementMeta,
  blockPasteUntilOcrSettled,
} from './import/ocr-settlement.js';
export {
  exactTranscriptionFromExtracted,
  isExactTranscriptionMode,
  activateExactTranscriptionExtraction,
} from './import/exact-transcription-import.js';
export {
  SIMPLE_IMPORT_MODE,
  isSimpleImportMode,
  canContinueWithRawText,
  fallbackRawTextCvData,
  fallbackRawTextResumeData,
  renderFallbackCv,
  simpleExtractTextFromFile,
  simpleCanonicalImportFromFile,
  v1NormalizeImportTerminal,
  V1_OCR_DISABLED,
  V1_SCANNED_PDF_MSG,
} from './import/simple-import-mode.js';
export {
  IMPORT_FALLBACK_CHAIN_VERSION,
  FALLBACK_CHAIN_STEPS,
  resolveFallbackStep,
  buildGuaranteedImportResult,
  importFailureUserMessage,
} from './import/import-fallback-chain.js';
export {
  CVDATA_V2_VERSION,
  field as cvFieldV2,
  emptyCvDataV2,
  cvDataV2ToLegacy,
  cvDataV2ToResumeData,
  cvDataV2ToTemplateData,
  finalizeCvDataV2,
} from './extraction/cv-data-v2.js';
export {
  RECRUITER_EXTRACTION_PIPELINE_VERSION,
  runRecruiterExtractionPipeline,
} from './extraction/recruiter-extraction-pipeline.js';
export {
  RECRUITER_AUDIT_ENGINE,
  AUDIT_DIMENSIONS,
  runRecruiterAuditEngine,
  formatRecruiterReviewText,
  attachRecruiterAuditToImportResult,
} from './validation/recruiter-audit-engine.js';
export {
  EXTRACTION_ENGINE_V2,
  runExtractionEngineV2,
  normalizeExtractionTextV2,
  summarizeExtractionBatchV2,
} from './extraction/extraction-engine-v2.js';
export {
  shouldUseRawTextFallback,
  buildRawTextFallbackCvData,
  buildRawTextFallbackResumeData,
  renderRawTextFallbackHtml,
  buildRawTextFallbackBundle,
  renderRawTextFallbackBundle,
} from './import/raw-text-fallback-render.js';
export {
  V1_FLOW_GATE_VERSION,
  getPreviewTextLength,
  isV1PreviewSufficient,
  isV1FlowGateActive,
  buildV1FlowGateValidation,
  v1FlowUnlocked as isV1FlowUnlocked,
} from './import/v1-flow-gate.js';
export {
  PASTE_FIRST_FLOW_VERSION,
  PASTE_FIRST_TITLE,
  PASTE_FIRST_LEAD,
  PASTE_FIRST_FORMATS_NOTE,
  PASTE_FIRST_CTA,
  buildPasteFirstPanelCopy,
  buildOcrFailurePanelCopy,
  pasteFirstTextSufficient,
  shouldUsePasteFirstPanel,
  isImagePdfPasteFlow,
  isOcrCalmPasteFlow,
  applyPasteGuaranteedFlow,
} from './import/paste-first-flow.js';
export {
  PASTE_MODE_REASON,
  IMPORT_DECISION_REASON,
  resolveImportDecision,
  resolveAutomaticImportRoute,
  decideAndLogImport,
  logImportDecision,
  collectDetectedSections,
  resolveReasonForPasteMode,
  traceImportDecision,
  isOcrReadyForPolicyRoute,
  coerceImpossibleStructuredFromOcrRoute,
} from './import/import-decision-trace.js';
export {
  IMPORT_UI_ROUTE,
  readImportDecisionDestination,
  resolveImportContinuationRoute,
  importDestinationBlocksPaste,
  attachImportDecisionToResult,
  logImportUiRoute,
} from './import/import-ui-routing.js';
export {
  UNBLOCK_EVERYTHING_VERSION,
  isUnblockEverythingActive,
  isTextSufficientForFlow,
  isFlowUnlocked,
  buildUnblockFlowValidation,
} from './import/unblock-everything.js';
export {
  TEXT_FIRST_ENGINE_VERSION,
  createResumeFromText,
  createMinimalResume,
} from './import/text-first-engine.js';
export {
  OCR_CLEANUP_PIPELINE_VERSION,
  VERIFY_CONTENT_LABEL,
  applyOcrCleanupPipeline,
  repairFusedYearRangesInLine,
  repairContextualOcrWords,
  dedupeEducationEntries,
  isEducationGarbageLine,
} from './import/ocr-cleanup-pipeline.js';
export {
  RAW_TEXT_REVIEW_VERSION,
  LOW_OCR_CONFIDENCE_THRESHOLD,
  RAW_TEXT_VERIFY_LABEL,
  isSuspiciousExtractedLine,
  buildVerifyQueueLines,
  shouldActivateRawTextReviewMode,
  bootstrapRawTextReview,
  getRawTextVerifyItems,
  applyRawTextVerifyAction,
  resumeDataForCleanPreview,
} from './import/raw-text-review-mode.js';
export {
  EXTRACTION_HONEST_MODE_VERSION,
  EXTRACTED_VERIFY_LABEL,
  PARTIAL_READ_WARNING,
  isWeakOcrQuality,
  shouldUseExtractionHonestMode,
  isConfidentExtractedLine,
  partitionLinesByConfidence,
  applyExtractionHonestMode,
  buildHonestResumeFromTextParts,
} from './import/extraction-honest-mode.js';
export {
  FILE_IMPORT_REWRITE_VERSION,
  FILE_IMPORT_MAX_MS,
  withFileImportTimeout,
  extractFileTextNoOcr,
  rewriteImportFromFile,
} from './import/file-import-rewrite.js';
export {
  TEMPLATE_ISOLATION_VERSION,
  TEMPLATE_QUALITY_SIGNAL_KEYS,
  isTemplateIsolationActive,
  stripTemplateQualitySignals,
  buildTemplateInputFromResume,
  canRenderTemplateFromResume,
  isIsolatedTemplateInput,
  applyTemplateIsolationToValidation,
} from '../ui/templates/template-isolation.js';
export {
  PDF_IMAGE_PASTE_MSG,
  V1_UNSUPPORTED_IMAGE_MSG,
  SIMPLE_IMPORT_MIN_CHARS,
  V1_IMPORT_MAX_MS,
} from './import/v1-import-constants.js';
export {
  probeOcrAvailability,
  pdfJsTextLengthPerPage,
  resolveImportNeedsPasteReason,
  pasteMessageForReason,
  buildPdfExtractionDebug,
  formatExtractionDebugForConsole,
} from './extraction/pdf-extraction-debug.js';

import { logHirelyRuntimeVersion } from './runtime/runtime-version.js';
logHirelyRuntimeVersion();

// Keep boot hard-fail visible, but only after contract is valid.
export async function bootCore() {
  try {
    const core = await import('./canonical-import.js');
    globalThis.__HIRELY_CORE_BOOT__ = 'ok';
    return core;
  } catch (error) {
    globalThis.__HIRELY_CORE_BOOT__ = 'failed';
    console.error('CORE_BOOT_FAILED', error);
    throw error;
  }
}
