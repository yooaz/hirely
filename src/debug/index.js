/**
 * @module debug — extraction metrics (?debug=true).
 */

export { textStats, linesRemoved, structuredCharCount, lossRatio } from './stats.js';
export { buildParserLabSnapshot, renderParserLabDecisions } from './parser-lab-report.js';
export {
  buildDocumentUnderstandingDebug,
  renderDocumentUnderstandingPanel,
  attachDocumentUnderstandingDebug,
  isDocumentUnderstandingDebugEnabled,
} from './document-understanding-debug.js';
export {
  buildPdfAccuracyReport,
  renderPdfAccuracyLab,
  renderMetricsBar,
  flattenStructuredText,
  findDroppedLines,
  findClassificationErrors,
} from './pdf-accuracy-lab.js';
export {
  buildExtractionTrace,
  renderExtractionTrace,
  buildOcrForensic,
  renderOcrForensic,
  logOcrForensic,
  pinpointCorruption,
  diffStageLines,
  FORENSIC_STAGE_IDS,
  FORENSIC_STAGE_LABELS,
  diffLineSets,
  formatSectionsAsText,
  flattenStructuredResume,
  detectReclassified,
} from './extraction-trace.js';
export {
  buildForensicReport,
  renderForensicPanel,
  logForensicReport,
  diffWordsRawCleaned,
  FORENSIC_STAGE_LABELS as FORENSIC_MODE_LABELS,
} from './forensic-mode.js';
export {
  FORENSIC_RESUME_MODE,
  FORENSIC_ARTIFACT_NAMES,
  FORENSIC_STAGE_CHAIN,
  isForensicResumeCaptureEnabled,
  beginForensicResumeImport,
  captureForensicResumeStage,
  finalizeForensicResumeImport,
  getForensicResumeImport,
  listForensicResumeImports,
  buildForensicStageCompare,
  charDiffSummary,
  createForensicDownloadUrl,
  renderForensicResumeDebugPanel,
  bindForensicResumeDownloadButtons,
  refreshForensicResumeCompare,
} from './forensic-resume-mode.js';
