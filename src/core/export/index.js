/**
 * @module core/export — structured output (TXT/PDF hooks live in UI until split).
 */

export { formatCvAsStructuredText } from './format-cv.js';
export {
  COVER_LETTER_ENGINE,
  COVER_LETTER_MODES,
  COVER_LETTER_TONES,
  LETTER_TONE_IDS,
  buildCoverLetterDraft,
  buildCoverLetterFromResumeData,
  buildCoverLetterFromFinalResumeData,
  finalResumeDataToResumeShape,
  resumeDataToLetterProfile,
  validateCoverLetterInputs,
  resolveCoverLetterTone,
  auditCoverLetterFacts,
  isFinalResumeDataInput,
} from './cover-letter-engine.js';
export {
  renderCoverLetter,
  LETTER_MODES,
  LETTER_TONES,
  LETTER_STYLES,
  LEGACY_LETTER_MODES,
} from './cover-letter-renderer.js';
export { generateCoverLetter } from './letter-ai-generation.js';
export {
  downloadLetterTxt,
  copyLetterToClipboard,
  downloadLetterPdf,
  buildLetterPdfElement,
  validateLetterPdfExport,
  LETTER_PDF_A4_WIDTH_PX,
} from './letter-exporter.js';
export {
  LINKEDIN_OPTIMIZER,
  buildLinkedInOptimization,
  formatLinkedInOptimizationText,
} from './linkedin-optimizer.js';
export {
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  PDF_PAGE_MARGIN_MM,
  PDF_PAGE_BREAK_AVOID_SELECTORS,
  PDF_EXPORT_BODY_CLASS,
  PDF_EXPORT_CV_CLASS,
  PDF_EXPORT_ENGINE,
  PDF_EXPORT_ENGINE_V2,
} from './pdf-export-config.js';
export { PDF_EXPORT_V2, buildPdfExportV2Packet } from './pdf-export-v2.js';
export {
  EXPORT_LOCK_VERSION,
  CV_EXPORT_ELEMENT_ID,
  CV_EXPORT_REQUIRED_CLASSES,
  validateFinalResumeForExport,
  validateExportCvElement,
  validateExportSectionParity,
  validateExportLock,
  buildCvExportFilename,
} from './export-lock.js';
export {
  EXPORT_REWRITE_VERSION,
  isExportRewriteActive,
  canExportWithResume,
  validateExportResumeOnly,
  applyExportIsolationToValidation,
} from './export-rewrite.js';
