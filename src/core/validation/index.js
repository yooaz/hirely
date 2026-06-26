/**
 * @module core/validation — scores and pipeline audits.
 */

export {
  EXTRACTION_RELIABILITY_V1,
  isValidImportName,
  hasImportContact,
  assessResumeDataReliability,
  textMeetsRealCvMinimum,
  resolveHonestImportState,
  resumeDataMeetsImportMinimum,
  resumeDataAllowsPartialReview,
  validateExtractionReliabilityForExport,
} from './extraction-reliability.js';
export { scoreCV } from './score.js';
export { auditPipeline } from './audit.js';
export { assessImportQuality } from './extraction-quality.js';
export {
  IMPORT_QUALITY_SCORE_V1,
  computeImportQualityScore,
  buildImportQualityMetricRows,
} from './import-quality-score.js';
export {
  generateExtractionReport,
  printExtractionReport,
} from './extraction-report.js';
export {
  PRODUCTION_AUDIT,
  PRODUCTION_AUDIT_THRESHOLDS,
  buildProductionAudit,
  evaluateProductionAuditPass,
  formatProductionAuditDisplay,
  logProductionAudit,
  runProductionAudit,
} from './production-audit.js';
export {
  UNIVERSAL_SAFETY_GATE,
  applyUniversalSafetyGate,
  assertUniversalSafetyGate,
} from './universal-safety-gate.js';
export {
  computeAtsScore,
  ATS_QUALITY_H8,
  computeAtsQualityH8,
  normalizeCvForAtsScoring,
  detectCvArchetype,
  ATS_CATEGORIES,
  buildRecruiterPanelMetrics,
  buildRecruiterChecklist,
} from './ats-engine.js';
export {
  REAL_ATS_CORE_DIMENSIONS,
  getCoreAtsDimensionScores,
  RECRUITER_SCORE_V2,
  SCORE_V2_CATEGORIES,
  computeRecruiterScoreV2,
} from './recruiter-score-v2.js';
export { analyzeAts } from './ats-analyzer.js';
export {
  ATS_ENGINE_PRO,
  ATS_PRO_DIMENSIONS,
  ATS_PLATFORM_BENCHMARKS,
  analyzeAtsPro,
  computeAtsProScore,
} from './ats-engine-pro.js';
export { computeProductScore } from './product-score.js';
export {
  TRUSTED_CV_REVIEW_V1,
  computeTrustedCvReview,
  enrichReportWithTrustedReview,
} from './trusted-cv-review-engine.js';
export {
  TRUST_SCORE_V1,
  TRUST_SCORE_WEIGHTS,
  TRUST_SCORE_CAPS,
  computeTrustScore,
  applyTrustScoreCaps,
  assessTrustScoreIssues,
  isCriticalReviewItem,
  countUnresolvedCriticalReview,
} from './trust-score.js';
export {
  SCORE_CREDIBILITY_CAP_V1,
  assessCredibilityIssues,
  applyScoreCredibilityCap,
} from './score-credibility-cap.js';
export {
  PRODUCT_EXPERIENCE_GATE_V1,
  EXTRACTION_QUALITY_EXPORT_MIN,
  assessProductExperienceGate,
} from './product-experience-gate.js';
export { buildRecruiterReview } from './recruiter-review.js';
export { runRecruiterAudit, auditRecruiterQuality } from './recruiter-audit.js';
export {
  RECRUITER_AUDIT_ENGINE,
  AUDIT_DIMENSIONS,
  runRecruiterAuditEngine,
  formatRecruiterReviewText,
  attachRecruiterAuditToImportResult,
} from './recruiter-audit-engine.js';
export {
  RECRUITER_COMMAND_CENTER_V2,
  buildRecruiterCommandCenterAudit,
} from './recruiter-command-center.js';
export { RECRUITER_QUALITY_V1, collectExperienceRows } from './recruiter-quality-audit.js';
export { buildReviewReadinessReport, isExportReady } from './review-readiness.js';
export {
  REVIEW_BEFORE_TEMPLATE_LOCK_V1,
  CRITICAL_REVIEW_KINDS,
  CRITICAL_REVIEW_ACTIONS,
  classifyCriticalReviewItem,
  criticalReviewReason,
  buildReviewBeforeTemplateLockReport,
  isTemplateReady,
  isExportReadyAfterReview,
} from './review-before-template-lock.js';
export {
  enterScoreReportCycle,
  leaveScoreReportCycle,
  isInsideScoreReportCycle,
  exportReadyFromCvData,
  MAX_SCORE_CYCLE_DEPTH,
} from './score-cycle-guard.js';
export { resolveChecklistProfile, resumeDataSectionCounts } from './recruiter-checklist-source.js';
export {
  getFinalResumeSectionCounts,
  buildReviewChecklistFromFinalResume,
  isSuggestionAlreadyRendered,
  filterSuggestionsNotInCv,
  detectReviewPreviewContradictions,
} from './review-consistency.js';
export {
  CONFIDENCE_GATE,
  CONFIDENCE_THRESHOLDS,
  applyConfidenceGate,
  assertConfidenceGate,
  scoreIdentityName,
  scoreIdentityTitle,
  scoreExperienceConfidence,
  scoreEducationLine,
  scoreSkillLine,
} from './confidence-gate.js';
export {
  SEMANTIC_CONFIDENCE_GATE,
  SEMANTIC_CONFIDENCE_GATE_MIN,
  applySemanticConfidenceGate,
  assessSemanticPlacement,
  auditSemanticConfidenceGate,
} from './semantic-confidence-gate.js';
export {
  SANITIZE_RESUME_DISPLAY,
  sanitizeResumeForDisplay,
  sanitizedResumeSize,
} from './sanitize-resume-display.js';
export {
  DATA_SANITIZATION_LAYER,
  applyDataSanitizationLayer,
  auditDataSanitization,
  experienceRowHasForbiddenFutureDate,
  sanitizeExperienceFutureDates,
} from './data-sanitization-layer.js';
export {
  HIRELY_DATA_CONTRACT_VERSION,
  REQUIRED_RESUME_DATA_SECTIONS,
  OPTIONAL_EMPTY_SECTIONS,
  FORBIDDEN_CONSUMER_RAW_KEYS,
  FORBIDDEN_META_KEYS,
  validateResumeDataContract,
  validateResumeSoftChecks,
  ensureResumeDataSections,
  applyResumeDataContractWarnings,
  validateConsumerDataSource,
  stripForbiddenMeta,
} from './resume-data-contract.js';
export {
  FINAL_RESUME_DISPLAY_FIELDS,
  buildMetaSafe,
  toFinalResumeDisplay,
} from './final-resume-contract.js';
export { DEDUPE_FINAL_RESUME, dedupeFinalResumeData } from './dedupe-final-resume.js';
export {
  CV_COMPLETENESS_AUDIT_V1,
  CV_COMPLETENESS_TARGET_PCT,
  CV_UNCLASSIFIED_MSG_FR,
  auditCvCompleteness,
  flattenFinalResumePreviewText,
  finalResumeDataToAuditShape,
  findUnclassifiedLines,
  buildCompletenessReviewItems,
  applyUnclassifiedToSuggestions,
} from './cv-completeness-audit.js';
export {
  CONTENT_DENSITY_RECOVERY_V1,
  CONTENT_DENSITY_MIN_PCT,
  parseRawSectionLines,
  auditContentDensity,
  applyContentDensityRecovery,
  lineAccountedInOutput,
  buildAccountedBlob,
} from './content-density-recovery.js';
export {
  NO_FAKE_DATA_POLICY_V1,
  NO_FAKE_FORBIDDEN,
  NO_FAKE_POLICY_RULES,
  auditNoFakeDataPolicy,
  isAcceptableDisplayName,
  isAcceptableDisplayPhone,
  enforceNoFakeExperiences,
  reviewQueueHasField,
} from './no-fake-data-policy.js';
export {
  FINAL_PREVIEW_SANITY_CHECK_V1,
  PREVIEW_SANITY_RULES,
  applyFinalPreviewSanityCheck,
  auditFinalPreviewSanity,
} from './final-preview-sanity-check.js';
export {
  PREVIEW_RENDER_GATE_V1,
  assessPreviewRenderGate,
  shouldBlockPremiumPreview,
  sanitizeCvDataForCorrection,
  looksLikeMergedExtractionBlob,
  isRawBlobExperience,
} from './preview-render-gate.js';
export {
  QUALITY_CHECKS,
  runQualityValidation,
  isQualityExportAllowed,
  finalResumeToCvShape,
} from './quality-validator.js';
export {
  EXTRACTION_RECOVERY_V1,
  RECOVERY_LOW_CONFIDENCE_MIN,
  runExtractionRecovery,
  buildMergedExtractionRecoveryReport,
  isCvOutputSafe,
  shouldShowExtractionRecovery,
} from './extraction-recovery.js';
export {
  RECOVERY_GUIDANCE_V1,
  ISSUE_CODE_GUIDANCE,
  RECOVERY_ACTION_CATALOG,
  mapIssueToUserFacing,
  mapGateIssuesToUserFacing,
  buildRecoveryGuidanceSummary,
  buildRecoverySuggestions,
} from './extraction-recovery-guidance.js';
export {
  buildExtractionRecoveryContext,
  buildExtractionRecoveryDebugObject,
} from './extraction-recovery-context.js';
export {
  UI_FLOW_V1,
  UI_FLOW_STATES,
  hashRecoveryIssues,
  recoveryIssueHashFromReport,
  createUiFlowState,
  transitionUiFlow,
  syncUiFlowFromRecovery,
  isBlockedRecoveryFlow,
  isPreviewRenderAllowed,
  shouldSkipCommit,
  shouldSkipRecoveryPanelRender,
  shouldSkipBlockedPreviewRender,
  markRecoveryPanelRendered,
  markBlockedPreviewRendered,
  markCommitCompleted,
  resetUiFlowForImport,
  exitBlockedRecovery,
  getUiFlowSnapshot,
  appendUiFlowLog,
  dispatchUiFlowSync,
  bumpRevision,
  validateBlockedRecoveryInvariants,
  enforceBlockedRecoveryInvariants,
  shouldRejectStaleCommit,
  recordTemplateRenderSuppressed,
  logIllegalTransition,
  isTransitionAllowed,
  holdStickyBlockedRecovery,
  enterPreviewReadyFromGate,
  isGateExitReason,
  UI_FLOW_GATE_EXIT_REASONS,
  UI_FLOW_EXPLICIT_BLOCKED_EXITS,
  UI_FLOW_ALLOWED_TRANSITIONS,
} from './ui-flow-state.js';
export {
  CV_DATA_PROTECTION_V1,
  CV_DATA_STATUS,
  validateCvData,
  buildEmptyCvRecoveryReport,
} from './cv-data-protection.js';
export {
  RECRUITER_SCAN_TEST_V1,
  SCAN_ZONE_PX,
  SCAN_ZONE_SECONDS_MIN,
  SCAN_ZONE_SECONDS_MAX,
  SCAN_FIELD_WEIGHTS,
  SCAN_FIELDS,
  scoreScanField,
  computeScanScore,
  rankScanResults,
} from './recruiter-scan-test.js';
