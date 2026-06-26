/**
 * @module core/extraction — enterprise file → raw text + line archive.
 */

export { extractFromFile, extractFromFileDetailed, normalizeExtractionMethod } from './extract-file.js';
export {
  extractDocument,
  extractPdfDocument,
  extractDocxDocument,
  extractTxtDocument,
  extractImageDocument,
  applyPdfOcrPolicy,
  OCR_MIN_CHARS_HARD,
  OCR_MIN_CHARS_SOFT,
} from './document-extract.js';
export {
  extractPdfEnterprise,
  extractImageEnterprise,
  extractPlainTextEnterprise,
} from './enterprise-engine.js';
export {
  EXTRACTION_LOCK,
  EXTRACTION_LOCK_OCR_MIN_CHARS,
  isExtractionLocked,
  shouldRunOcrForTextLength,
  logExtractionLockSkip,
} from './extraction-lock.js';
export {
  EXTRACTION_LINE_REVIEW_THRESHOLD,
  linesToPlainText,
  buildLineConfidenceIndex,
  summarizeLines,
} from './extracted-line.js';
export { extractNativePdfLines } from './pdf-lines-native.js';
export { buildPdfPageText, groupPdfItemsIntoLines } from './pdf-text.js';
export { assessPdfTextLayer, isPdfTextLayerUsable } from './pdf-text-quality.js';
export { extractTopZoneLines, pdfItemsFromTextContent } from './pdf-first-page.js';
export {
  setLastPdfExtraction,
  consumeLastPdfExtraction,
  peekLastPdfExtraction,
  setLastEnterpriseExtraction,
  peekLastEnterpriseExtraction,
  consumeLastEnterpriseExtraction,
  setLastOcrForensic,
  peekLastOcrForensic,
} from './extraction-session.js';
export { isBrowser, ocrImageFile, ocrPdfDocument, concatPageOcrTexts } from './ocr.js';
export { ocrPdfPages, PAGE_SEPARATOR } from './pdf-ocr-pages.js';
export {
  ocrPdfPagesWithRenderer,
  OCR_PAGE_RENDER_SCALE,
  OCR_PAGE_RENDERER_MAX_MS,
} from './pdf-ocr-page-renderer.js';
export { cloudOcrConfigured, tryCloudOcr } from './cloud-ocr.js';
export { probePdfWithPdfLib } from './pdf-lib-probe.js';
export { readFileBuffer, cloneArrayBuffer, logExtractionStep } from './file-buffer.js';
export {
  clearExtractionAuditTrail,
  peekExtractionAuditTrail,
  recordExtractionAuditStage,
  measureExtractionStage,
  dedupeExtractedLines,
  dedupePlainText,
  sanitizeParserInput,
  printExtractionAuditSummary,
  TEXT_EXPLOSION_CHAR_THRESHOLD,
} from './extraction-audit.js';
export {
  resolveOcrPreprocessingMode,
  getPdfOcrFileBaseKey,
  getPdfOcrCacheKey,
  getCachedPdfOcrIfReady,
  clearPdfOcrCache,
  markPdfOcrTimedOut,
  clearPdfOcrTimedOut,
  isPdfOcrTimedOut,
  getOrRunCachedPdfOcr,
  setOcrInFlightPromise,
  clearOcrInFlightPromise,
  peekOcrInFlightPromise,
  awaitOcrSettlementForFile as awaitOcrSettlementForCacheKey,
} from './pdf-ocr-cache.js';
export { beginImportRun as nextExtractionImportRunId } from '../import/import-run-guard.js';
export { awaitOcrSettlementForFile } from './pdf-ocr-settlement.js';
export {
  runCachedTimedPdfOcr,
  OCR_SLOW_HINT_MS,
  OCR_UI_SOFT_TIMEOUT_MS,
  OCR_HARD_TIMEOUT_MS,
  OCR_ABSOLUTE_MAX_MS,
} from './pdf-ocr-run.js';
export {
  PDF_EXTRACTION_MAX_MS,
  pdfExtractionBudgetMs,
  pdfImportBarrierTimeoutMs,
  OCR_UX_PROGRESS_MS,
  OCR_UX_PATIENCE_MS,
  OCR_UX_EARLY_PASTE_MS,
  OCR_UX_FULL_FALLBACK_MS,
  OCR_UX_PATIENCE_MSG,
  OCR_UX_EARLY_PASTE_MSG,
  OCR_ROTATION_TRIAL_MAX_MS,
  OCR_ROTATION_MAX,
  OCR_TIMEOUT_USER_MSG,
} from './pdf-extraction-timeout.js';
export {
  detectInputFileType,
  classifyPdfForExtraction,
  extractionSourceLabel,
  fileTypeLabel,
} from './file-type-detect.js';
export {
  MULTI_FORMAT_ENGINE_VERSION,
  resolveSourceType,
  splitLinesBySource,
  measureTextLength,
  mergeNativeAndOcrLines,
  scoreExtractionConfidence,
  selectBestExtractionVersion,
  enrichMultiFormatExtraction,
} from './multi-format-extraction-engine.js';
export {
  BEST_TEXT_SOURCE_VERSION,
  selectBestTextSource,
  scoreTextSource,
  measurePlausibleWordRatio,
  measureGarbageRatio,
  measureDuplicateRatio,
  mergeTextSourcesConservative,
  mergeLineArchivesConservative,
} from './best-text-source-selection.js';
export {
  extractDocDocument,
  extractRtfDocument,
  stripRtfToPlain,
} from './document-extract.js';
export {
  DOCX_RECOVERY_VERSION,
  DOCX_RETENTION_TARGET_PCT,
  recoverDocxStructure,
  auditDocxStructureRecovery,
  measureDocxRetention,
  extractVisibleCorpusFromDocx,
  extractTextFromOoxml,
} from './docx-structure-recovery.js';
export {
  extractDocxWithRecovery,
  mammothHtmlToPlainText,
} from './docx-extract.js';
export {
  PDF_ROUTES,
  routePdfExtraction,
  planPdfExtraction,
  assertNativePdfLines,
} from './pdf-router.js';
export {
  detectPdfLayout,
  buildPdfReadingOrder,
  preparePdfLinesForParsing,
  layoutTypeLabel,
} from './pdf-post-extract.js';
export {
  hasPositionedPdfLines,
  detectPdfTextLayer,
  runPdfBlockEngine,
} from '../layout/pdf-block-engine.js';
export {
  LAYOUT_MEMORY_VERSION,
  LAYOUT_ZONE,
  buildLayoutMemory,
  buildLayoutMemoryFromPlainText,
  layoutEntryAt,
} from '../layout/layout-memory.js';
export { detectDocumentStage, DOCUMENT_TYPES } from './stages/document-detection.js';
export { detectLayoutStage, LAYOUT_TYPES, detectLayout } from './layout-detector.js';
export {
  buildOrderedBlocks,
  buildReadingBlocksStage,
  orderLinesForReading,
  compareLinesReadingOrder,
  ORDERED_BLOCK_KINDS,
  COLUMN_IDS,
} from './reading-order.js';
export {
  extractLineBlocks,
  mergeAdjacentLineBlocks,
  clusterBlocksIntoColumns,
  reconstructTwoColumnLayout,
  geometricBlocksToLayoutBlocks,
  COLUMN_IDS as LAYOUT_COLUMN_IDS,
} from './layout-blocks.js';
export {
  buildExtractionArchiveStage,
  assignLineSections,
  measureTextRetention,
  CONTENT_RETENTION_TARGET_PCT,
} from './stages/extraction-archive.js';
export { runOcrBestPass, isOcrBestPassEnabled } from './ocr-best-pass.js';
export {
  preprocessCanvasForOcr,
  preprocessCanvas,
  getOcrDpiScale,
  detectContentBounds,
  detectMultiColumn,
  OCR_TARGET_DPI,
} from './ocr-preprocess.js';
export {
  scoreOcrCandidate,
  pickFusionWinner,
  fuseOcrPageTexts,
  corruptionScore,
  languageScore,
} from './ocr-fusion.js';
export { runOcrWithFusion, isOcrFusionEnabled, OCR_PASS_DEFS } from './ocr-multipass.js';
export {
  pushOcrPreprocessPreview,
  peekOcrPreprocessPreviews,
  clearOcrPreprocessPreviews,
  peekLastOcrFusionInternal,
  peekLastOcrRotationDecision,
  setLastOcrRotationDecision,
  clearLastOcrRotationDecision,
} from './extraction-session.js';
export {
  scoreOcrQuality,
  isOcrQualityAcceptable,
  evaluateOcrParserGate,
  hasReversedCvHeadings,
  OCR_QUALITY_MIN_PASS,
  OCR_QUALITY_FAIL_MSG,
} from './ocr-quality-score.js';
export {
  OCR_STATUS,
  GIBBERISH_MARKERS,
  countGibberishMarkers,
  isMostlyGibberishOcr,
  resolveOcrQualityStatus,
} from './ocr-quality-status.js';
export {
  selectBestOcrRotation,
  runRotationTrialOcr,
  ROTATION_ANGLES,
} from './ocr-rotation-select.js';
export { rotateCanvasByDegrees, autoRotateCanvas } from './ocr-preprocess.js';
export {
  runExtractionEngineV2,
  EXTRACTION_ENGINE_V2,
  normalizeExtractionTextV2,
  buildStructuredCvJsonV2,
  postProcessCvDataV2,
  summarizeExtractionBatchV2,
} from './extraction-engine-v2.js';
export {
  FIELD_REVIEW_THRESHOLD,
  EXTRACTION_FIELD_CONFIDENCE_V2,
  scoreCvFieldConfidence,
  applyFieldConfidenceV2,
  buildFieldReviewItems,
} from './field-confidence-v2.js';
export { applySkillsLanguagesGuard, SKILLS_LANGUAGES_GUARD_V2 } from './skills-languages-guard.js';
