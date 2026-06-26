/**
 * HIRELY P0 — finalResumeData contract (single UI read surface).
 *
 * Pipeline:
 *   OCR → normalizedText → structuredResume → resumeData → finalResumeData → cvData → UI
 *
 * UI must never read raw OCR, raw extraction, debug graph, or unsorted blobs directly.
 */

import { shouldSkipFlatRepairForResumeData } from '../parsing/cv-block-parser-bridge.js';
import {
  normalizeResumeData,
  normalizeCvDataForTemplate,
  resumeDataToCvData,
  resumeDataIsRenderable,
  foldParserLeakFields,
  STRICT_FINAL_RESUME_SECTION_KEYS,
  PARSER_LEAK_KEYS,
} from '../resume-data.js';
import {
  dedupeEducationStrings,
  dedupeExperienceEntries,
  dedupeStringList,
  dedupeClientList,
  dedupeProjectList,
} from '../parsing/dedupe-engine.js';
import { dedupeFinalResumeData } from './dedupe-final-resume.js';
import { applyFinalResumeDataCleanup } from './final-resume-data-cleanup.js';
import { applyOcrMicroGarbageCleanup } from './ocr-micro-garbage-cleanup.js';
import { sanitizeFinalCvLabelsBeforeCommit } from './section-label-leakage-guard.js';
import { sanitizeFinalCvPlaceholdersBeforeCommit } from './final-cv-placeholder-guard.js';
import { sanitizeResumeForDisplay } from './sanitize-resume-display.js';
import { applyIdentityConfirmLabels } from './yoaz-bias-guard.js';
import {
  validateResumeDataContract,
  ensureResumeDataSections,
  validateConsumerDataSource,
  validateResumeSoftChecks,
  stripForbiddenMeta,
  HIRELY_DATA_CONTRACT_VERSION,
} from './resume-data-contract.js';
import {
  lockResumeDataShape,
  resumeDataMeetsImportMinimum,
} from '../pipeline/hirely-flow-lock.js';
import { applySemanticConfidenceGate } from './semantic-confidence-gate.js';
import { isUncertainIdentityName, isUncertainIdentityTitle } from '../display/undetected-label.js';
import {
  auditCvCompleteness,
  applyUnclassifiedToSuggestions,
  CV_COMPLETENESS_TARGET_PCT,
} from './cv-completeness-audit.js';
import {
  applyContentDensityRecovery,
  CONTENT_DENSITY_MIN_PCT,
} from './content-density-recovery.js';
import { mergeReviewQueues } from '../parsing/review-queue-merge.js';
import { applyFinalPreviewSanityCheck } from './final-preview-sanity-check.js';
import { enforceFakeExperienceGate } from './fake-experience-gate.js';
import { enforceExperienceEducationReliability } from './experience-education-reliability.js';

export { resumeDataMeetsImportMinimum };
export {
  resumeObjectExists,
  finalResumeDataMeetsReviewGuarantee,
  buildReviewGuaranteeWarnings,
  isReviewGuaranteeWeak,
  applyReviewGuaranteeToValidation,
} from './review-screen-guarantee.js';

export const FINAL_RESUME_CONTRACT_VERSION = 'final-resume-v2';

/** P1 — product sections only (experience = experiences). */
export const STRICT_FINAL_RESUME_KEYS = STRICT_FINAL_RESUME_SECTION_KEYS;

/** Safe UI-facing fields on finalResumeData. */
export const FINAL_RESUME_DISPLAY_FIELDS = Object.freeze([
  ...STRICT_FINAL_RESUME_SECTION_KEYS,
  'suggestions',
  'quality',
  'metaSafe',
]);

/** Keys that must never appear on finalResumeData or template cvData. */
export const FORBIDDEN_FINAL_PARSER_KEYS = PARSER_LEAK_KEYS;

/** Canonical product pipeline stages (documentation + meta). */
export const FINAL_RESUME_PIPELINE = Object.freeze([
  'ocr',
  'normalizedText',
  'structuredResume',
  'resumeData',
  'finalResumeData',
  'cvData',
  'ui',
]);

function listOfStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x || '').trim()).filter(Boolean);
}

/** Lightweight renderable check — no re-sanitize (final display shape). */
function isFinalDisplayRenderable(rd) {
  if (!rd || typeof rd !== 'object') return false;
  const name = String(rd.identity?.name || '').trim();
  const title = String(rd.identity?.title || '').trim();
  if (name && !isUncertainIdentityName(name)) return true;
  if (title && !isUncertainIdentityTitle(title)) return true;
  if (String(rd.summary || '').trim()) return true;
  if ((rd.experiences || []).length || (rd.education || []).length) return true;
  if ((rd.skills || []).length || (rd.tools || []).length || (rd.clients || []).length) return true;
  if ((rd.suggestions || []).length) return true;
  return false;
}

/**
 * Consumer-safe meta — no raw OCR payloads.
 * @param {object} [meta]
 */
export function buildMetaSafe(meta = {}) {
  const m = stripForbiddenMeta(meta);
  return {
    sourceType: String(m.fileType || m.sourceType || '').trim(),
    extractionMethod: String(m.extractionMethod || '').trim(),
    confidence: m.confidence ?? null,
    warnings: Array.isArray(m.warnings)
      ? m.warnings.filter((w) => !/^CONTRACT_(EMPTY_SECTION|FORBIDDEN)/.test(String(w)))
      : [],
    finalResume: m.finalResume || null,
    creativeMode: m.creativeMode || null,
  };
}

/**
 * H18 — never synthesize summary, experience, education, or skills for export.
 * Missing sections stay empty; UI shows UNDETECTED_INFORMATION_LABEL.
 * @param {object} rd
 */
function ensurePartialExportProfile(rd) {
  return rd && typeof rd === 'object' ? rd : rd;
}

/**
 * Shape locked resumeData into finalResumeData (UI read surface).
 * Never includes meta.rawText / meta.cleanedText.
 * @param {object} rd
 */
export function toFinalResumeDisplay(rd) {
  const folded = foldParserLeakFields(ensureResumeDataSections(rd));
  const display = {
    identity: { ...(folded.identity || {}) },
    summary: String(folded.summary || '').trim(),
    experiences: Array.isArray(folded.experiences)
      ? folded.experiences.map((e) => ({ ...e }))
      : [],
    education: listOfStrings(folded.education),
    skills: listOfStrings(folded.skills),
    tools: listOfStrings(folded.tools),
    languages: listOfStrings(folded.languages),
    clients: listOfStrings(folded.clients),
    projects: listOfStrings(folded.projects),
    suggestions: listOfStrings(folded.unsorted),
    quality: {
      confidence: folded.meta?.confidence ?? null,
      extractionMethod: String(folded.meta?.extractionMethod || '').trim(),
      sourceType: String(folded.meta?.fileType || folded.meta?.sourceType || '').trim(),
      creativeMode: folded.meta?.creativeMode || null,
    },
    metaSafe: buildMetaSafe(folded.meta),
  };

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of FINAL_RESUME_DISPLAY_FIELDS) {
    if (key in display) out[key] = display[key];
  }
  for (const key of FORBIDDEN_FINAL_PARSER_KEYS) {
    delete out[key];
  }
  return out;
}

/**
 * Strict validation gate for finalResumeData before any UI render.
 * @param {object|null} finalResumeData
 * @param {{ silent?: boolean }} [opts]
 */
export function validateFinalResumeContract(finalResumeData, opts = {}) {
  const raw = finalResumeData && typeof finalResumeData === 'object' ? finalResumeData : {};
  const rd = ensureResumeDataSections({
    ...raw,
    unsorted: raw.unsorted?.length ? raw.unsorted : raw.suggestions || [],
    meta: raw.metaSafe || raw.meta || {},
  });
  const baseContract = validateResumeDataContract(rd, {
    silent: opts.silent ?? true,
    profile: 'final',
  });

  const renderable = isFinalDisplayRenderable(rd) || resumeDataMeetsImportMinimum(rd);
  const consumerCv = resumeDataToCvData(rd, { skipNormalize: true });
  const consumerCheck = validateConsumerDataSource(consumerCv, 'FINAL_RESUME', { silent: true });
  const soft = validateResumeSoftChecks(rd);

  /** @type {string[]} */
  const reasons = [];
  if (!renderable) reasons.push('NOT_RENDERABLE');
  if (!consumerCheck.ok) reasons.push(...consumerCheck.violations);
  for (const m of baseContract.missing) reasons.push(`MISSING_SECTION:${m}`);
  for (const f of baseContract.forbidden.filter((x) => !String(x).startsWith('meta.'))) {
    reasons.push(`FORBIDDEN:${f}`);
  }

  const ok = renderable && consumerCheck.ok && baseContract.missing.length === 0;

  return {
    ok,
    renderable,
    version: FINAL_RESUME_CONTRACT_VERSION,
    dataContractVersion: HIRELY_DATA_CONTRACT_VERSION,
    reasons,
    warnings: baseContract.warnings,
    soft,
    missing: baseContract.missing,
    empty: baseContract.empty,
    forbidden: baseContract.forbidden,
    consumerViolations: consumerCheck.violations,
    sections: baseContract.sections,
  };
}

/**
 * Build locked finalResumeData + derived cvData from normalized resumeData.
 * @param {object|null} resumeData
 * @param {{ silent?: boolean, lockShape?: boolean }} [opts]
 */
export function buildFinalResumeData(resumeData, opts = {}) {
  if (!resumeData || typeof resumeData !== 'object') {
    const contract = {
      ok: false,
      renderable: false,
      version: FINAL_RESUME_CONTRACT_VERSION,
      reasons: ['NO_INPUT'],
      warnings: [],
      soft: [],
      missing: [],
      empty: [],
      forbidden: [],
      consumerViolations: [],
      sections: {},
    };
    return {
      finalResumeData: null,
      cvData: null,
      contract,
      reviewItems: [],
      semanticGate: { gated: 0, reviewCount: 0 },
    };
  }

  let rd = foldParserLeakFields(resumeData);
  rd = normalizeResumeData(rd, { skipSanitize: true });
  rd = foldParserLeakFields(rd);
  rd = sanitizeResumeForDisplay(rd, opts);

  const microGarbage = applyOcrMicroGarbageCleanup(rd, {
    existingReviewItems: rd.meta?.contactReviewItems || [],
  });
  rd = microGarbage.resumeData;

  const semanticGate = applySemanticConfidenceGate(rd, {
    existingReview: mergeReviewQueues(
      opts.existingReview || opts.reviewQueue || [],
      microGarbage.reviewItems
    ),
    contactReviewItems: microGarbage.reviewItems,
  });
  rd = semanticGate.resumeData;

  rd = ensurePartialExportProfile(rd);
  if (opts.lockShape !== false) {
    rd = lockResumeDataShape(rd);
  }
  rd = foldParserLeakFields(rd);
  rd.experiences = dedupeExperienceEntries(rd.experiences || []);
  rd.education = dedupeEducationStrings(rd.education || [], { identity: rd.identity });
  rd.skills = dedupeStringList(rd.skills);
  rd.tools = dedupeStringList(rd.tools);
  rd.languages = dedupeStringList(rd.languages);
  rd.clients = dedupeClientList(rd.clients);
  rd.projects = dedupeProjectList(rd.projects);

  const fakeExpGate = enforceFakeExperienceGate(rd.experiences || []);
  const reliabilityGate = enforceExperienceEducationReliability({
    ...rd,
    experiences: fakeExpGate.kept,
  });
  rd.experiences = reliabilityGate.resumeData.experiences;
  rd.education = reliabilityGate.resumeData.education;
  const fakeExpReview = fakeExpGate.review || [];
  const reliabilityReview = reliabilityGate.review || [];

  rd.meta = stripForbiddenMeta({
    ...(rd.meta || {}),
    finalResume: {
      version: FINAL_RESUME_CONTRACT_VERSION,
      builtAt: new Date().toISOString(),
      pipeline: [...FINAL_RESUME_PIPELINE],
    },
  });

  let shaped = applyFinalResumeDataCleanup(dedupeFinalResumeData(toFinalResumeDisplay(rd)));
  shaped = sanitizeFinalCvLabelsBeforeCommit(shaped);
  const placeholderGate = sanitizeFinalCvPlaceholdersBeforeCommit(shaped, {
    existingReview: semanticGate.reviewItems,
  });
  shaped = placeholderGate.finalResumeData;

  const rawText = String(opts.rawText || rd.meta?.rawText || rd.rawText || '').trim();
  const cleanedText = String(opts.cleanedText || rd.meta?.cleanedText || rd.cleanedText || rawText).trim();
  const skipFlatRepair = shouldSkipFlatRepairForResumeData(resumeData);
  let densityRecovery = null;
  let reviewBeforeCompleteness = mergeReviewQueues(
    opts.existingReview || opts.reviewQueue || [],
    semanticGate.reviewItems || [],
    fakeExpReview,
    reliabilityReview,
    placeholderGate.reviewItems || []
  );
  if (shaped && rawText && !skipFlatRepair) {
    densityRecovery = applyContentDensityRecovery(rawText, shaped, reviewBeforeCompleteness, {
      cleanedText,
    });
    shaped = densityRecovery.finalResumeData;
    reviewBeforeCompleteness = densityRecovery.reviewItems;
  }

  let completenessAudit = null;
  if (shaped) {
    completenessAudit = auditCvCompleteness(rawText, shaped, {
      cleanedText,
      existingReview: reviewBeforeCompleteness,
    });
    if (!completenessAudit.meetsTarget && !skipFlatRepair) {
      shaped = applyUnclassifiedToSuggestions(shaped, completenessAudit.unclassifiedLines);
    }
    const postDensityMicro = applyOcrMicroGarbageCleanup(shaped, {
      existingReviewItems: reviewBeforeCompleteness,
      skipRawMerge: skipFlatRepair,
    });
    shaped = postDensityMicro.resumeData;
    reviewBeforeCompleteness = mergeReviewQueues(
      reviewBeforeCompleteness,
      postDensityMicro.reviewItems
    );

    const previewSanity = skipFlatRepair
      ? { finalResumeData: shaped, reviewItems: reviewBeforeCompleteness }
      : applyFinalPreviewSanityCheck(shaped, {
          existingReview: reviewBeforeCompleteness,
          rawText,
          cleanedText,
          sourceText: rawText,
        });
    shaped = previewSanity.finalResumeData;
    reviewBeforeCompleteness = previewSanity.reviewItems;

    shaped.quality = {
      ...(shaped.quality || {}),
      completeness: {
        coveragePct: completenessAudit.coveragePct,
        charCoveragePct: completenessAudit.charCoveragePct,
        lineCoveragePct: completenessAudit.lineCoveragePct,
        rawChars: completenessAudit.rawChars,
        previewChars: completenessAudit.previewChars,
        meetsTarget: completenessAudit.meetsTarget,
        targetPct: CV_COMPLETENESS_TARGET_PCT,
        openReviewQueue: completenessAudit.openReviewQueue,
      },
      contentDensity: {
        ...(shaped.quality?.contentDensity || {}),
        ...(densityRecovery?.audit || {}),
        targetPct: CONTENT_DENSITY_MIN_PCT,
        recovered: densityRecovery?.stats?.recovered ?? 0,
        queued: densityRecovery?.stats?.queued ?? 0,
      },
      previewSanity: {
        policy: previewSanity.stats?.skipped ? 'skipped' : 'FINAL_PREVIEW_SANITY_CHECK_V1',
        violationCount: previewSanity.violations?.length ?? 0,
        queued: previewSanity.stats?.queued ?? 0,
      },
    };
    shaped.metaSafe = {
      ...(shaped.metaSafe || {}),
      completenessAudit: {
        coveragePct: completenessAudit.coveragePct,
        meetsTarget: completenessAudit.meetsTarget,
        messageFr: completenessAudit.messageFr,
      },
    };
  }

  if (shaped?.identity) {
    shaped = { ...shaped, identity: applyIdentityConfirmLabels(shaped.identity) };
  }

  const contract = validateFinalResumeContract(shaped, { silent: opts.silent });
  const cvData = contract.renderable
    ? normalizeCvDataForTemplate(resumeDataToCvData(shaped, { skipNormalize: true }))
    : null;

  const reviewItems = mergeReviewQueues(
    reviewBeforeCompleteness,
    completenessAudit?.reviewItems || []
  );

  return {
    finalResumeData: contract.renderable || resumeDataIsRenderable(shaped,{skipNormalize:true}) ? shaped : null,
    cvData,
    contract,
    reviewItems,
    semanticGate: semanticGate.stats,
    completenessAudit,
    densityRecovery: densityRecovery?.audit || null,
  };
}

/** @param {ReturnType<typeof validateFinalResumeContract>|null|undefined} contract */
export function isFinalResumeRenderable(contract) {
  return !!(contract?.renderable);
}

/** @param {ReturnType<typeof validateFinalResumeContract>|null|undefined} contract */
export function getFinalResumeFallbackReason(contract) {
  if (!contract) return 'NO_CONTRACT';
  if (contract.reasons?.length) return contract.reasons[0];
  if (!contract.renderable) return 'NOT_RENDERABLE';
  return 'INVALID';
}
