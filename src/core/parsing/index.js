/**
 * @module core/parsing — clean text → structured cvData.
 */

export {
  CV_NORMALIZER_V1,
  normalizeCvText,
  normalizeCvDocument,
  isPageNumberLine,
  removePageNumberLines,
} from './cv-normalizer.js';
export {
  normalizeRawExtract,
  repairCompactWordBoundaries,
  safeClean,
  strictClean,
  cleanText,
  stripSpecialCharacters,
  stripHeaderFooterLines,
  isProtectedContentLine,
  isObviousStrictGarbage,
  measureCleanLoss,
} from './clean.js';
export {
  TEXT_RECONSTRUCTION_VERSION,
  smartLineMerge,
  smartParagraphMerge,
  reconstructExtractedText,
  reconstructExtractedLines,
  normalizeReconstructedDates,
  dedupeEntitySegmentsInLine,
  repairReconstructionGlitches,
  shouldMergeLines,
  mergeTwoLines,
  splitEmbeddedSectionHeader,
  preserveSectionBoundaries,
  stripParserLabelsFromLine,
  inferLineSection,
  isFakeReconstructedSentence,
} from './text-reconstruction.js';
export {
  collectSectionsOrderAgnostic,
  assignOrphanLinesToSections,
} from './section-mapper.js';
export {
  cleanExtraction,
  parseCV,
  parseCVData,
  parseStructuredCV,
  setParseExtractionLines,
  getParseExtractionLines,
  normalizeCvData,
  emptyCVData,
  forceCvDataFromText,
  syncExperienceFromRawText,
  buildForcedPartialCvData,
  cvDataHasMinimum,
  cvDataIsRenderable,
  isBadName,
  validateEmail,
  validatePhone,
  validateLinkedIn,
  validatePortfolio,
  validateLocation,
  headerKeyForLine,
  detectSections,
  splitListItems,
  lineLooksLikeTitle,
  isSectionHeaderLine,
} from './rich-parser.js';
export { structuredCompleteness, segregateClientBrands } from './field-sanitize.js';
export {
  buildStructuredResume,
  structuredToCvData,
  buildConfidenceReport,
  emptyStructuredResume,
  NAME_UNCERTAIN_LABEL,
} from './structured-resume.js';
export { fuzzySectionKey, scoreSectionHeader, SECTION_DETECTION_V1, getSectionAliases } from './section-fuzzy.js';
export {
  detectSectionsWithConfidence,
  scoreHeaderBatch,
  H4_SECTION_KEYS,
  H4_SECTION_LABELS,
} from './section-detection.js';
export { cleanTextWithRejected, classifyLine } from './line-cleaner.js';
export {
  applySectionSanityPass,
  classifyLineWithConfidence,
  passesExperienceGate,
  isLikelyPortfolioProject,
  SECTION_BUCKETS,
  SANITY_CONFIDENCE_THRESHOLD,
} from './section-sanity.js';
export {
  classifySpecialtyLineV2,
  CLASSIFICATION_ENGINE_V2,
  CLASSIFICATION_CONFIDENCE_MIN,
  SECTION_TYPES_V2,
  v2TypeToBucket,
} from './classification-engine-v2.js';
export {
  classifySemanticBlockV2,
  auditSemanticMisclassifications,
  isRejectedPersonNameLine,
  isCompanyOrClientLine,
  isEducationSemanticLine,
  SEMANTIC_CLASSIFIER_V2,
  SEMANTIC_V2_CONFIDENCE_MIN,
  SEMANTIC_CLASS,
  semanticV2ToBucket,
} from './semantic-classifier-v2.js';
export {
  buildParserDetectionSummary,
  detectNameFromLines,
  detectNameCandidates,
  detectTitleFromText,
  detectTitleCandidates,
  formatNameCandidateDisplay,
  harvestEducation,
  partitionSkillsAndInterests,
} from './parser-recovery.js';
export {
  getLastRejectedLines,
  getLastUncertainLines,
  getLastCleanLoss,
} from './rich-parser.js';
export {
  detectBlocks,
  buildBlockDetectionStage,
  groupLinesIntoBlocks,
  orderLinesForLayout,
} from './block-detector.js';
export {
  classifyBlock,
  classifyBlocks,
  runBlockClassifierStage,
  BLOCK_TYPES,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
} from './block-classifier.js';
export {
  ENTITY_BOOST,
  ENTITY_CATALOG,
  matchEntitiesInLine,
  scoreBlockWithEntities,
} from './entity-dictionaries.js';
export {
  ENTITY_DICTIONARIES,
  ENTITY_TYPE_BOOST,
  ENTITY_SCORE_BASE,
  ENTITY_CLASSIFY_THRESHOLD,
  resolveLineEntities,
  collectEntityHits,
  pickPrimaryEntityHit,
  scoreEntityHit,
} from './entity-engine.js';
export {
  buildStructuredResumeFromBlocks,
  buildStructuredResumeFromDocumentBlocks,
} from './structured-resume-from-blocks.js';
export { parseResumeSectionFirst } from './section-first-parser.js';
export {
  runSectionEngineV2,
  SECTION_ENGINE_V2,
  SECTION_IDS,
} from './section-engine-v2.js';
export {
  extractFactsFromLine,
  extractFactsFromLines,
  extractFactsFromSectionBlocks,
  dedupeFacts,
  FACT_TYPES,
  FACT_EXTRACTION_STAGE,
  bucketToFactType,
} from './fact-extraction.js';
export {
  buildCvFromFacts,
  partitionFactsByConfidence,
  factsToReviewItems,
  CV_FROM_FACTS_STAGE,
} from './cv-from-facts.js';
export { runFactPipeline, FACT_PIPELINE_VERSION } from './fact-pipeline.js';
export {
  classifyFactStrict,
  applyFactClassifier,
  satisfiesFactTypeContract,
  ALLOWED_FACT_TYPES,
  FACT_CLASSIFIER_VERSION,
} from './fact-classifier.js';
export { FACT_CONFIDENCE_THRESHOLD, FACT_TYPE_TO_CV_FIELD } from './fact-types.js';
export {
  CREATIVE_CV_MODE,
  CREATIVE_CV_TRIGGER_ROLES,
  CREATIVE_SECTION_RENDER_ORDER,
  detectCreativeCvMode,
  detectCreativeCvTriggerRoles,
  applyCreativeCvModeToSectionBlocks,
  applyCreativeCvModeToStructured,
} from './creative-cv-mode.js';
export {
  detectSectionBlocks,
  detectSectionHeaderId,
  detectHeaderBasedSectionBlocks,
  cvSectionToSectionId,
} from './section-detect-v2.js';
export {
  CV_SECTION,
  SECTION_HEADING_DICTIONARY,
  matchSectionHeading,
  scoreTypographyHeading,
  normalizeHeadingPhrase,
  fuzzyKeyToCvSection,
} from './section-heading-dictionary.js';
export {
  SECTION_SEGMENTER_VERSION,
  SECTION_SEGMENTER_ENGINE,
  segmentCvBlocks,
  segmentCvLines,
  buildSectionMapDebug,
  segmentsInSection,
  sectionTextsOnPage,
} from './section-segmenter.js';
export {
  EXPERIENCE_BLOCK_PARSER,
  MIN_EXPERIENCE_EMIT_CONFIDENCE,
  EXPERIENCE_REVIEW_CONFIDENCE,
  parseExperienceSectionBlocks,
  parseExperienceLines,
  parseExperienceFromSegments,
  parseExperienceEntryFromGroup,
  collectExperienceRejectionReasons,
  partitionExperienceItems,
  buildExperienceReviewHints,
} from './cv-experience-block-parser.js';
export {
  EDUCATION_BLOCK_PARSER,
  MIN_EDUCATION_EMIT_CONFIDENCE,
  parseEducationSectionBlocks,
  parseEducationLines,
  parseEducationFromSegments,
  parseEducationEntryFromGroup,
  dedupeEducationBlockItems,
  canonicalSchoolKey,
  buildEducationDedupeDebug,
  collectEducationRejectionReasons,
} from './cv-education-block-parser.js';
export {
  SKILLS_BLOCK_PARSER,
  MIN_SKILLS_EMIT_CONFIDENCE,
  SKILL_CATEGORY,
  parseSkillsSectionBlocks,
  parseSkillsLines,
  parseSkillsFromSegments,
  dedupeSkillBlockItems,
  assessSkillsSectionPurity,
  buildSkillsParseDebug,
} from './cv-skills-block-parser.js';
export {
  SKILLS_POLLUTION_FILTER,
  isSkillsSectionPollution,
  isDeniedClientBrand,
  isOcrSkillFragment,
  pollutionReason,
} from './skills-section-pollution-filter.js';
export {
  CV_PARSE_CONFIDENCE,
  LOW_CONFIDENCE_THRESHOLDS,
  scoreCvParseBundle,
  applyValidationConfidenceAdjustments,
  extractContactFromParseContext,
  findAmbiguousEducationSchools,
} from './cv-parse-confidence.js';
export {
  CV_PARSE_VALIDATION,
  validateCvParseBundle,
  isValidItemDateRange,
} from './cv-parse-validation.js';
export {
  CV_REVIEW_HINTS,
  generateCvReviewHints,
  buildCvParseResponsePayload,
} from './cv-review-hints.js';
export {
  CV_BLOCK_PARSER_BRIDGE,
  shouldUseBlockParserBridge,
  applyBlockParserBundleToStructured,
  experienceItemToStructured,
  educationItemToLine,
  resumeDataFromParseResponse,
  sidebarFieldsFromSegments,
  segmentTexts,
} from './cv-block-parser-bridge.js';
export {
  PAGE_DOCUMENT_CLASSIFIER,
  PAGE_DOCUMENT_CLASS,
  classifyPageDocument,
  classifyDocumentPages,
  filterLinesForResumeParsing,
  filterSpatialBlocksForResumeParsing,
  filterSegmentsForResumeParsing,
  extractPortfolioItems,
  buildPageDocumentClassificationDebug,
  buildPageDecisionReasons,
  buildExcludedPagesTrace,
} from '../layout/page-document-classifier.js';
export {
  classifySemanticLine,
  classifySemanticLines,
  isSemanticRoleLine,
  semanticToSectionTarget,
} from './semantic-line-classifier.js';
export { inferSemanticSectionBlocks } from './semantic-section-infer.js';
export { resolveParserLayoutInput } from './parser-layout-input.js';
export {
  RESUME_GRAPH_ENGINE,
  RESUME_GRAPH_VERSION,
  GRAPH_NODE,
  GRAPH_EDGE,
} from './resume-graph-types.js';
export { buildResumeGraph, assertGraphStructuredInput } from './build-resume-graph.js';
export { graphToCvData } from './graph-to-cv-data.js';
export { runResumeGraphEngine } from './resume-graph-engine.js';
export { SEMANTIC_LINE, SEMANTIC_PARSE_MODE } from './semantic-line-types.js';
export { classifySectionBlocks } from './section-classify-v2.js';
export { extractFieldsFromSectionBlocks } from './section-field-extract-v2.js';
export {
  buildParserCoverageReport,
  logParserCoverageTable,
  PARSER_COVERAGE_TARGET_PCT,
  PARSER_CONFIDENCE_MIN,
} from './parser-coverage-report.js';
export {
  enforceNoDataLossRule,
  measureCleanedTextUtilization,
  mergeUnsortedLines,
  flattenCvPreservedText,
  FINAL_CV_UTILIZATION_MIN_PCT,
  cvDataIsRenderableWithUnsorted,
} from './no-data-loss.js';
export {
  ZERO_TEXT_LOSS_MODE,
  UNSORTED_ARCHIVE,
  isZeroTextLossMode,
  applyZeroTextLossMode,
  assertZeroTextLossBalance,
  buildZeroTextLossAudit,
  recoverOrphansToUnsortedArchive,
  partitionRawTextChars,
  rawContentCharCount,
  PipelineLossError,
} from './zero-text-loss.js';
export {
  EXPERIENCE_RECOVERY,
  EXPERIENCE_RECOVERY_MIN_CHARS,
  detectYearSignals,
  shouldRunExperienceRecovery,
  scanDraftExperiences,
  runExperienceRecovery,
} from './experience-recovery.js';
export {
  EXPERIENCE_REBUILDER,
  detectCareerYears,
  detectExperienceParserFailed,
  shouldRunExperienceRebuilder,
  rebuildExperiencesFromText,
  runExperienceRebuilder,
} from './experience-rebuilder.js';
export {
  EXPERIENCE_RECONSTRUCTION,
  EXPERIENCE_RECONSTRUCTION_RECALL_GOAL,
  COMPANY_INFERENCE_CONFIDENCE_MIN,
  reconstructExperiencesFromText,
  runExperienceReconstruction,
} from './experience-reconstruction.js';
export {
  EXPERIENCE_INTELLIGENCE,
  EXPERIENCE_INTELLIGENCE_RECALL_GOAL,
  experienceNormalizer,
  detectExperienceRole,
  detectExperienceCompany,
  detectExperienceDates,
  detectFreelanceMission,
  detectInternship,
  mergeFragmentedExperienceEntries,
} from './experience-intelligence.js';
export {
  EXPERIENCE_SEMANTIC_LAYER,
  extractSpecialtiesFromText,
  needsSemanticReconstruction,
  reconstructExperienceSemantics,
  reconstructAllExperienceSemantics,
} from './experience-semantic-layer.js';
export {
  EDUCATION_NORMALIZATION_LAYER,
  stripEducationLeaks,
  canonicalizeEducationProgram,
  formatNormalizedEducationLine,
  normalizeEducationEntry,
  normalizeAllEducation,
} from './education-normalization-layer.js';
export {
  EDUCATION_QUALITY_ENGINE,
  educationHasContamination,
  validateEducationYears,
  buildQualityEducationEntry,
  applyEducationQuality,
  applyEducationQualityToCvData,
} from './education-quality-engine.js';
export {
  OCR_CONTAMINATION_FIREWALL,
  isSectionAnchorField,
  rejectHeaderField,
  isPlausibleYear,
  educationHasUrlContamination,
  rejectEducationContamination,
  splitExperienceContamination,
  sanitizeClientsFirewall,
  applyOcrContaminationFirewall,
} from './ocr-contamination-firewall.js';
export {
  EXPERIENCE_RECONSTRUCTION_ENGINE,
  EMPLOYMENT_KIND,
  classifyEmploymentKind,
  detectExperienceLocation,
  scoreExperienceConfidence,
  mustNeverMergeExperiences,
  splitMergedExperienceText,
  reconstructExperienceEntries,
  formatExperienceForCvData,
  applyExperienceReconstruction,
} from './experience-reconstruction-engine.js';
export {
  EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
  EXPERIENCE_V2_RECALL_GOAL,
  reconstructExperiencesFromRawText,
  runExperienceReconstructionV2,
  harvestCareerLines,
  parseStackedOcrBlock,
  parseCompactOcrExperienceLine,
  parseClientNames,
  buildReviewItemForLine,
} from './experience-reconstruction-engine-v2.js';
export {
  EXPERIENCE_RECONSTRUCTION_CONFIDENCE_ROUTER,
  EXPERIENCE_CONFIDENCE_AUTO_MIN,
  EXPERIENCE_CONFIDENCE_REVIEW_MIN,
  classifyExperienceConfidenceTier,
  countExpectedExperiencesInDocument,
  scanDocumentExperienceCandidates,
  routeExperienceCandidatesByConfidence,
  dedupeExperienceCandidates,
  runExperienceReconstructionEngine,
} from './experience-reconstruction-confidence-router.js';
export {
  CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
  CREATIVE_ENGAGEMENT_TYPES,
  CREATIVE_ANCHOR_CLIENTS,
  extractCreativeClientEntities,
  detectCreativeEngagementType,
  enrichCreativeExperienceFields,
  expandClientEngagements,
  mergeClientsIntoParentExperience,
  recoverSegmentedCreativeExperiences,
  harvestCreativeCareerLines,
  runCreativeExperienceRecovery,
  auditCreativeExperienceRecovery,
} from './creative-experience-recovery-engine.js';
export {
  CLIENT_DETECTION_ENGINE,
  CLIENT_ANCHOR_TARGETS,
  parseClientListLine,
  detectClientsFromText,
  harvestClientSourceBlob,
  runClientDetection,
  auditClientDetection,
} from './client-detection-engine.js';
export {
  PORTFOLIO_EXTRACTION_ENGINE,
  PORTFOLIO_ANCHOR_TARGETS,
  PORTFOLIO_PLATFORMS,
  parsePortfolioLine,
  parsePortfolioToken,
  detectPlatformFromUrl,
  formatPortfolioEntry,
  detectPortfolioLinksFromText,
  harvestPortfolioSourceBlob,
  runPortfolioExtraction,
  auditPortfolioExtraction,
} from './portfolio-extraction-engine.js';
export {
  DESIGNER_CV_MODE,
  DESIGNER_MODE_TARGET_ROLES,
  DESIGNER_PRIORITY_SECTIONS,
  DESIGNER_SECTION_WEIGHTS,
  DESIGNER_ATS_ADJUSTMENTS,
  detectDesignerTriggerRoles,
  detectDesignerCvMode,
  applyDesignerSectionWeight,
  scoreDesignerCreativeSectionsH8,
  applyDesignerAtsAdjustments,
  designerCreativeSignalCount,
  resolveDesignerCvMode,
} from './designer-cv-mode.js';
export {
  PROJECTS_ENGINE,
  PROJECT_ANCHOR_TARGETS,
  PROJECT_CLIENT_ANCHORS,
  parseProjectLine,
  formatProjectEntry,
  extractProjectClientAndTitle,
  isProjectCandidateLine,
  detectProjectsFromText,
  detectProjectsFromHarvest,
  harvestProjectsSourceBlob,
  runProjectsExtraction,
  auditProjectsExtraction,
} from './projects-engine.js';
export {
  CV_EXPERIENCE_REWRITE,
  PROFESSIONAL_DESCRIPTION_MIN_LEN,
  collectOriginalDescription,
  rewriteExperienceDescription,
  rewriteExperienceEntry,
  rewriteResumeExperiences,
  experienceRewriteQuality,
  validateRewriteRecord,
  SAFE_REWRITE_CONFIDENCE_MIN,
} from './cv-experience-rewrite.js';
export {
  CV_ENHANCEMENT_ENGINE,
  ISSUE_TYPES,
  detectCvEnhancementIssues,
  enhanceSummaryText,
  runCvEnhancementEngine,
} from './cv-enhancement-engine.js';
export {
  SAFE_REWRITE_VALIDATION,
  SAFE_REWRITE_CONFIDENCE_MIN as SAFE_REWRITE_THRESHOLD,
  extractFactsUsed,
  detectRewriteViolations,
  isRewriteTraceable,
  scoreRewriteConfidence,
  buildSafeRewriteRecord,
  applySafeRewriteGate,
  validateRewriteRecord as validateSafeRewriteRecord,
} from './safe-rewrite-validation.js';
export {
  parseStrictExperiencesFromLines,
  normalizeExperienceRole,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  lineIsContactData,
  lineIsEducationData,
  lineIsSkillOrTagOnly,
  passesStrictExperienceGate,
  buildExperienceEntryFromLineGroup,
  sanitizeStrictExperiences,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
export {
  BLOCK_RECONSTRUCTION,
  reconstructLineBlocks,
  mergeRoleContinuationLines,
  isDateAnchorLine,
  splitLinesIntoDateAnchoredGroups,
  logBlocksCreated,
} from './block-reconstruction.js';
export {
  BLOCK_BUILDER_V1,
  buildDocumentBlocksFromOcrLines,
  buildBlocksV1,
  normalizeOcrLineInput,
  computeBlockSignals,
  logBlockBuilderAudit,
} from './block-builder-v1.js';
export {
  SECTION_CLASSIFIER_V1,
  SECTION_CLASSIFIER_MIN_CONFIDENCE,
  ALLOWED_BLOCK_TYPES,
  classifyDocumentBlocksV1,
  documentBlocksToSectionBlocks,
} from './section-classifier-v1.js';
export {
  EXPERIENCE_BUILDER_V2,
  EXPERIENCE_BUILDER_MIN_CONFIDENCE,
  buildExperiencesFromClassifiedBlocks,
  mergeAdjacentExperienceBlocks,
  normalizeExperienceFields,
  validateExperienceCandidate,
} from './experience-builder-v2.js';
export {
  EXPERIENCE_PARSER_V2,
  EXPERIENCE_V2_CONFIDENCE_MIN,
  parseExperiencesFromExperienceBlocks,
  filterExperienceBlocksOnly,
  applyExperienceV2Unsorted,
} from './experience-parser-v2.js';
export {
  AI_RECONSTRUCTION_ENGINE,
  AI_RECONSTRUCTION_CONFIDENCE_MIN,
  runAiReconstructionEngine,
  aiReconstructionConfigured,
  aiResumeJsonToCvData,
  mergeAiResumeIntoCvData,
  applyAiReconstructionArchive,
  emptyAiResumeJson,
} from './ai-reconstruction-engine.js';
export { groundAiResumeJson, groundingScoreForValue } from './ai-reconstruction-grounding.js';
export {
  buildDocumentBlocks,
  createDocumentBlock,
  documentBlocksToReviewItems,
  countByType,
  DOCUMENT_BLOCK_TYPES,
  CLASSIFICATION_CONFIDENCE_THRESHOLD as DOCUMENT_BLOCK_CONFIDENCE_THRESHOLD,
} from './document-block.js';
export { classifyLineType } from './block-line-classifier.js';
export { runExtractionPipeline } from './pipeline.js';
export {
  runProductionExtractionPipeline,
  generateExtractionReport,
  printExtractionReport,
} from '../pipeline/production-pipeline.js';
export { runP0Pipeline as runBlockPipeline, runP0Pipeline } from '../pipeline/p0-pipeline.js';
export {
  detectLayout,
  applyReadingOrder,
  extractGeometricBlocks,
  extractLineBlocks,
  LAYOUT_TYPES,
} from '../layout/index.js';
export {
  resolveBlock,
  resolveBlocks,
  normalizeBlockType,
} from './entity-resolver.js';
export { runValidationStage, REQUIRED_VALIDATION_FIELDS } from './stages/validation-stage.js';
export {
  assessFieldCompleteness,
  PARSER_REBUILD_MSG_FR,
  NAME_CONFIRM_FR,
} from './field-completeness-gate.js';
export {
  structureEducationEntries,
  harvestExperienceFromLines,
  recoverOrphanLinesToUnsorted,
} from './parser-recovery.js';
export { repairResumeDataFromRaw } from './import-repair.js';
export {
  IDENTITY_CONFIDENCE_MIN,
  IDENTITY_TOP_LINE_LIMIT,
  IDENTITY_SOURCE_PRIORITY_V1,
  IDENTITY_FIRST_PAGE_TOP_PCT,
  IDENTITY_SOURCE_PRIORITY,
  COMPANY_LIKE_NAME_RE,
  extractLockedIdentity,
  isValidIdentityName,
  isValidIdentityTitle,
  looksLikeCompanyOrAgencyName,
  nameCollidesWithEmployers,
  repairIdentityFromOcrSignals,
  buildIdentityCandidateLines,
  buildForbiddenIdentityIndices,
  isOcrGarbageIdentityLine,
  isForbiddenIdentityLineIndex,
  getFirstPageLineCount,
  blockedIdentityLineSet,
  formatIdentitySourceReport,
} from './identity-extraction.js';
export { postProcessOcrText, looksLikeOcrText } from './ocr-postprocess.js';
export {
  normalizeOcrDocument,
  normalizeOcrText,
  fixBrokenWordsInLine,
  repairCommonOcrMistakes,
  mergeSplitOcrLines,
  isOcrGarbageFragment,
  evaluateOcrNormalizationCorpus,
  measureLineDictionaryCoverage,
  OCR_NORMALIZATION_CORPUS,
} from './ocr-normalization.js';
export {
  CV_TEXT_NORMALIZATION_VERSION,
  CORRECTION_RULE,
  MIN_CORRECTION_CONFIDENCE,
  normalizeCvLine,
  normalizeCvDocument as normalizeCvTextDocument,
  normalizeCvDatesInLine,
  normalizeCvWordsInLine,
  YOAZ_NORMALIZATION_EXAMPLES,
} from './cv-text-normalization.js';
export {
  RESUME_TEXT_NORMALIZATION_VERSION,
  runResumeTextNormalization,
  normalizeResumeBlock,
  normalizeResumeBlocks,
  dedupeResumeBlocks,
  normalizeResumePlainText,
  normalizeExtractionLines,
  buildNormalizationDebug,
  RESUME_NORMALIZATION_EXAMPLES,
} from './resume-text-normalization.js';
export {
  hardenOcrText,
  repairHyphenatedLineBreaks,
  collapseOcrSpacedLetters,
  splitMergedSectionHeaders,
  splitColumnMergedLine,
  dedupeConsecutiveLines,
  dedupeGlobalLines,
  stripRepeatedFootersAndHeaders,
  dedupeRepeatedSectionHeaders,
} from './ocr-hardening.js';
export {
  maskCreativeEntities,
  unmaskCreativeEntities,
  transformPreservingCreativeEntities,
  applyCreativeOcrCanonicalHints,
  CREATIVE_OCR_CANONICAL_HINTS,
} from './creative-entity-guard.js';
export {
  detectCreativeParsingMode,
  applyCreativeParsingPass,
  applyCreativeModeToClassifiedBlocks,
  classifyCreativeLine,
  detectTargetCreativeRoles,
  isCreativeClientEntityLine,
  isCreativeJobLine,
  isCreativeNonExperienceLine,
  isLikelyCreativeProjectLine,
  CREATIVE_MODE_TARGET_ROLES,
  CREATIVE_FIRST_CLASS_SECTIONS,
  CREATIVE_BUCKET_TO_BLOCK_TYPE,
  CREATIVE_ROLE_TERMS,
  CREATIVE_ROLE_RE,
  CREATIVE_CLIENT_ENTITIES,
  CREATIVE_EXTRA_BUCKETS,
} from './creative-parsing-mode.js';
export {
  CREATIVE_SOFTWARE,
  CREATIVE_AGENCIES,
  LUXURY_BRANDS,
  CREATIVE_STUDIOS,
  CREATIVE_SCHOOLS,
  CREATIVE_DICTIONARY_CATEGORIES,
  CREATIVE_DICTIONARY_ANCHORS,
  ALL_CREATIVE_ENTITIES,
  CREATIVE_ENTITY_RE,
  findCreativeEntitiesInText,
  generateCreativeDictionaryCoverageReport,
  printCreativeDictionaryCoverageReport,
  textContainsCreativeEntity,
  isProtectedCreativeLine,
} from '../../data/dictionaries/creative/index.js';
export {
  applyParserEnterprisePass,
  attachIdentityFields,
  buildEnterpriseParse,
  buildUnknownExperienceBlocks,
  enterpriseToLegacyCvData,
  experienceEntryToLegacyString,
  lineMayBeUnknownExperience,
  UNKNOWN_EXPERIENCE_LABEL,
  diagnoseExperienceBucketLine,
  EXPERIENCE_DROP_RULES,
  makeConfidentField,
  makeListItem,
  makeReviewItem,
  ENTERPRISE_PARSER_BUCKETS,
  PARSER_ENTERPRISE_THRESHOLD,
  scoreEducationLine,
  scoreSkillLine,
  scoreToolLine,
  scoreLanguageLine,
  scoreClientLine,
  scoreProjectLine,
  separateProjectsFromExperience,
} from './parser-enterprise.js';
/** Node-only: import from ./parser-accuracy-report.js in QA scripts (uses fs). */
export { applyExtractionConfidenceGate } from './extraction-line-gate.js';
export {
  TO_CLASSIFY_TARGETS,
  normalizeToClassifyItem,
  normalizeToClassifyList,
  buildToClassifyFromCv,
  applySafeFallback,
  applyRescueMode,
  ensureExportableCv,
  applyClassifyTarget,
  cvDataHasToClassify,
  normalizeClassifiedIgnore,
} from './safe-fallback.js';
export {
  REVIEW_QUEUE_THRESHOLD,
  REVIEW_ACTIONS,
  normalizeReviewItem,
  shouldQueueForReview,
  buildReviewQueue,
  buildBlockReviewItems,
  mergeReviewQueues,
  pendingReviewItems,
  hasPendingReview,
  applyReviewQueueToCvData,
  applyAcceptedReviewItem,
  resolveReviewItem,
  reviewQueueSummary,
  blocksToReviewItems,
} from './review-queue.js';
export {
  CLASSIFICATION_LEARNING_VERSION,
  LEARNED_CONFIDENCE,
  recordClassificationCorrection,
  lookupLearnedClassification,
  clearClassificationLearning,
  listClassificationCorrections,
  normalizeLearningKey,
} from './classification-learning.js';
export {
  suggestPossibleCategories,
  buildPossibleCategoriesFromAlternatives,
  categoryLabel,
} from './review-queue-categories.js';
export {
  RECRUITER_REVIEW_MODE_VERSION,
  RECRUITER_REVIEW_ACTIONS,
  semanticClassToFactType,
  buildDetectionAlternatives,
  buildRecruiterReviewItem,
  factsToRecruiterReviewItems,
  auditLowConfidenceNotInCv,
  isAmbiguousRecruiterLine,
} from './recruiter-review-mode.js';
export {
  CV_SECTION_CONTRACT_VERSION,
  ALLOWED_LANGUAGE_NAMES,
  ALLOWED_LANGUAGE_PROFICIENCY,
  satisfiesLanguageContract,
  satisfiesToolContract,
  satisfiesClientContract,
  satisfiesEducationContract,
  satisfiesSkillContract,
  validateCvSectionItem,
  contractViolationReviewItem,
  assignFactWithContract,
  enforceStructuredSectionContract,
  enforceCvDataSectionContract,
} from './cv-section-contract.js';
export {
  analyzeLineCorruption,
  scoreLineCorruption,
  isLineCorrupted,
  isLineCorruptedForExport,
  sanitizeCvDataForExport,
  corruptionScoreText,
  CORRUPTION_BLOCK_SCORE,
} from './corruption-detector.js';
export {
  CV_BLOCK_ENGINE,
  UNIVERSAL_DATE_DETECTOR,
  UNIVERSAL_COMPANY_DETECTOR,
  UNIVERSAL_ROLE_DETECTOR,
  UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  UNIVERSAL_EXPERIENCE_RECALL_GOAL,
  CV_BLOCK_TYPES,
  detectDatesInText,
  detectCompanyInLine,
  detectRoleInLine,
  runCvBlockEngine,
  runUniversalExtractionEngine,
  runUniversalExperienceReconstruction,
  reconstructExperiencesFromBlocks,
} from './universal-extraction/index.js';
export {
  OCR_STRUCTURE_RECOVERY,
  OCR_EXPERIENCE_RECALL_GOAL,
  shouldRunOcrStructureRecovery,
  runOcrStructureRecovery,
  groupOcrLines,
  bucketGroupsBySection,
  rebuildSectionsText,
  extractYearsFromLine,
  lineHasYearAnchor,
  isYearOnlyLine,
} from './ocr-structure-recovery/index.js';
export {
  UNIVERSAL_PARSE_PIPELINE,
  runUniversalParsePipeline,
} from './universal-parse-pipeline.js';
export {
  suggestionConfidenceScore,
  classifySuggestionNoise,
  filterProductSuggestions,
  logSuggestionFilterStats,
} from './suggestion-confidence-score.js';
export {
  REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE,
  REVIEW_QUEUE_PRIMARY_TEXT_MAX,
  isCriticalReviewSuggestion,
  reviewSuggestionConfidence,
  meetsReviewVisibilityThreshold,
  compactSuggestionDisplayText,
  resolveDisplayCategory,
  filterVisibleCategoryAlternatives,
} from './review-queue-quality-filter.js';
export {
  SUGGESTION_CLASSIFICATION_FIX_VERSION,
  SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN,
  isEmploymentCompanyLine,
  isStandaloneSkillDiscipline,
  classifySuggestionCategory,
  resolveSuggestionCategory,
  filterSuggestionCategoryOptions,
  classifyVisualCommunicationContext,
  COMPANY_UNCERTAIN_RE,
} from './suggestion-classification-fix.js';
