/**
 * @module core/layout — P0 layout reconstruction (frozen: no templates/ATS/export/UI).
 */

export {
  runResumeLayoutAnalysis,
  classifyResumePageLayout,
  classifyDocumentResumeLayouts,
  assignZonesToSpatialBlocks,
  buildResumeLayoutDebug,
  blocksShareReadingZone,
  zoneIdForBlock,
  splitXByPageFromLayout,
  RESUME_LAYOUT_ENGINE,
} from './resume-layout-engine.js';

export {
  PAGE_LAYOUT_TYPES,
  classifyPageLayout,
  classifyDocumentPageLayouts,
  buildPageLayoutDebug,
  lineReadingZone,
  zoneOrderedLines,
  splitXByPage,
  normalizePageLayoutType,
  toLegacyLayoutType,
} from './page-layout.js';

export {
  PAGE_DOCUMENT_CLASSIFIER,
  PAGE_DOCUMENT_CLASS,
  classifyPageDocument,
  classifyDocumentPages,
  isResumeCorePage,
  isPortfolioPage,
  filterLinesForResumeParsing,
  filterSpatialBlocksForResumeParsing,
  filterSegmentsForResumeParsing,
  extractPortfolioItems,
  buildPageDocumentClassificationDebug,
  buildPageDecisionReasons,
  buildExcludedPagesTrace,
} from './page-document-classifier.js';

export {
  LAYOUT_TYPES,
  detectLayout,
  detectLayoutStage,
  isMultiColumnLayoutType,
} from './detect-layout.js';

export {
  COLUMN_IDS,
  findColumnSplitX,
  detectColumns,
  orderBlocksByColumns,
} from './detect-columns.js';

export {
  lineBoundingBox,
  extractLineBlocks,
  mergeAdjacentLineBlocks,
  extractGeometricBlocks,
  geometricBlocksToLayoutBlocks,
  layoutBlocksToExtracted,
} from './block-extractor.js';

export {
  COLUMN_IDS as READING_COLUMN_IDS,
  ORDERED_BLOCK_KINDS,
  compareLinesReadingOrder,
  orderLinesForReading,
  groupOrderedLinesIntoBlocks,
  buildReadingOrder,
  applyReadingOrder,
  buildOrderedBlocks,
  orderLinesForLayout,
  buildReadingBlocksStage,
} from './reading-order.js';

export {
  hasPositionedPdfLines,
  detectPdfTextLayer,
  runPdfBlockEngine,
} from './pdf-block-engine.js';

export {
  reconstructDocument,
  reconstructionToParseReady,
  RECONSTRUCTION_STAGES,
  VISUAL_ROLES,
} from './document-reconstruction.js';

export {
  annotateVisualStructure,
  summarizeVisualStructure,
  isDateLine,
  isListLine,
  isHeadingLine,
} from './visual-features.js';

export {
  SIDEBAR_SECTION_KEYS,
  isSidebarColumn,
  enforceSectionIntegrity,
  groupBlocksIntoSectionRanges,
  geometricBlocksToSectionBlocks,
  reconstructColumnBlocks,
  validateSectionIntegrity,
} from './column-reconstruction.js';

export {
  LAYOUT_MEMORY_VERSION,
  LAYOUT_ZONE,
  buildLayoutMemory,
  buildLayoutMemoryFromPlainText,
  layoutEntryAt,
} from './layout-memory.js';

export { recoverTwoColumnSections } from './two-column-recovery.js';

export {
  SPATIAL_BLOCK_VERSION,
  SPATIAL_ZONE_ID,
  normalizeSpatialText,
  layoutMemoryEntryToSpatialBlock,
  spatialBlocksFromLayoutEntries,
  spatialBlocksFromLayoutMemory,
  spatialBlocksFromGeometricBlocks,
  spatialBlocksFromReconstruction,
  spatialBlocksToPlainText,
  lazyParserText,
  spatialBlocksToOcrLineInput,
  updateSpatialBlockTexts,
  attachSpatialBlocksToLayoutMemory,
  isSpatialBlockArray,
} from './spatial-block.js';
