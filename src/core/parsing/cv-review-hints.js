/**
 * Actionable review hints for low-confidence CV parse output.
 */

import { CV_SECTION } from './section-heading-dictionary.js';
import {
  CV_PARSE_CONFIDENCE,
  LOW_CONFIDENCE_THRESHOLDS,
  findAmbiguousEducationSchools,
} from './cv-parse-confidence.js';
import { CV_PARSE_VALIDATION } from './cv-parse-validation.js';

export const CV_REVIEW_HINTS = 'CV_REVIEW_HINTS_V2';

let hintCounter = 0;

function nextHintId(type) {
  hintCounter += 1;
  return `hint-${type}-${hintCounter}`;
}

function pickSeverity(conf) {
  if (conf < 0.4) return 'high';
  if (conf < 0.7) return 'medium';
  return 'low';
}

/**
 * @typedef {object} ReviewHint
 * @property {string} id
 * @property {string} type
 * @property {'low'|'medium'|'high'} severity
 * @property {string} message
 * @property {string[]} target_ids
 * @property {string[]} [source_block_ids]
 * @property {'ask_user_confirmation'|'move_block'|'edit_field'|'choose_value'|'ignore'} suggested_action
 */

function validationAction(code) {
  const map = {
    invalid_dates: 'edit_field',
    duplicate_education_entry: 'ask_user_confirmation',
    duplicate_experience_entry: 'ask_user_confirmation',
    duplicate_skill_entry: 'move_block',
    polluted_skill: 'move_block',
    empty_critical_field: 'edit_field',
    page_leakage_suspected: 'ask_user_confirmation',
    weak_date_confidence: 'edit_field',
    unclassified_block: 'move_block',
  };
  return map[code] || 'ask_user_confirmation';
}

/**
 * @param {import('./cv-parse-validation.js').ParseValidationIssue} issue
 */
function hintFromValidationIssue(issue) {
  return {
    id: nextHintId(issue.code),
    type: issue.code,
    severity: issue.severity === 'error' ? 'high' : pickSeverity(0.55),
    message: issue.message,
    target_ids: issue.target_ids || (issue.item_id ? [issue.item_id] : []),
    source_block_ids: issue.source_block_ids || [],
    suggested_action: validationAction(issue.code),
    trace: issue.trace || null,
    section: issue.section || null,
  };
}

/**
 * @param {object} bundle
 * @param {import('./cv-parse-confidence.js').ParseConfidenceReport} confidence
 * @param {import('./cv-parse-validation.js').object} [validation]
 */
export function generateCvReviewHints(bundle = {}, confidence, validation = null) {
  /** @type {ReviewHint[]} */
  const hints = [];
  /** @type {object[]} */
  const lowConfidenceItems = [];

  const contactConf = confidence?.sections?.contact ?? 0;
  const contact = confidence?.contact || bundle.contact || {};

  if (!contact.email || contactConf < LOW_CONFIDENCE_THRESHOLDS.section) {
    hints.push({
      id: nextHintId('low_confidence_contact'),
      type: 'low_confidence_contact',
      severity: pickSeverity(contactConf),
      message: contact.email
        ? 'We could not fully verify the contact details.'
        : 'We could not find a reliable email address.',
      target_ids: [],
      source_block_ids: contact.source_block_ids || [],
      suggested_action: 'edit_field',
    });
  }

  for (const item of confidence?.items?.experience || []) {
    const missingDates =
      (item.fields?.start_date?.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLDS.field ||
      (item.fields?.end_date?.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLDS.field;

    if (missingDates) {
      hints.push({
        id: nextHintId('missing_dates'),
        type: 'missing_dates',
        severity: 'medium',
        message: 'This experience has weak date confidence.',
        target_ids: [item.id],
        source_block_ids: item.source_block_ids,
        suggested_action: 'edit_field',
      });
      lowConfidenceItems.push({ section: 'experience', ...item, reason: 'missing_dates' });
      continue;
    }

    if (item.confidence < LOW_CONFIDENCE_THRESHOLDS.item) {
      const lowField = Object.entries(item.fields || {}).find(
        ([, fs]) => fs.confidence < LOW_CONFIDENCE_THRESHOLDS.field
      );
      hints.push({
        id: nextHintId('ambiguous_job_title'),
        type: lowField ? `ambiguous_${lowField[0]}` : 'ambiguous_job_title',
        severity: pickSeverity(item.confidence),
        message: lowField
          ? `We have low confidence on the ${lowField[0].replace(/_/g, ' ')} for this experience.`
          : 'We have low confidence on this experience entry.',
        target_ids: [item.id],
        source_block_ids: item.source_block_ids,
        suggested_action: 'ask_user_confirmation',
      });
      lowConfidenceItems.push({ section: 'experience', ...item, reason: 'low_confidence' });
    }
  }

  const rawEducation = bundle.educationItems || [];
  const ambiguousSchools = findAmbiguousEducationSchools(rawEducation);
  for (const amb of ambiguousSchools) {
    hints.push({
      id: nextHintId('ambiguous_school'),
      type: 'ambiguous_school',
      severity: 'medium',
      message: 'We detected multiple possible school names for the same date range.',
      target_ids: confidence?.items?.education?.map((e) => e.id) || [],
      suggested_action: 'choose_value',
    });
  }

  for (const item of confidence?.items?.education || []) {
    const schoolLow = (item.fields?.school?.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLDS.field;
    if (schoolLow || item.confidence < LOW_CONFIDENCE_THRESHOLDS.item) {
      hints.push({
        id: nextHintId('needs_user_confirmation'),
        type: 'needs_user_confirmation',
        severity: pickSeverity(item.confidence),
        message: schoolLow
          ? `We have low confidence on the school name (“${item.fields?.school?.value || ''}”).`
          : 'We have low confidence on this education entry.',
        target_ids: [item.id],
        source_block_ids: item.source_block_ids,
        suggested_action: 'ask_user_confirmation',
      });
      lowConfidenceItems.push({ section: 'education', ...item, reason: schoolLow ? 'ambiguous_school' : 'low_confidence' });
    }
  }

  for (const item of confidence?.items?.skills || []) {
    if (item.confidence < LOW_CONFIDENCE_THRESHOLDS.item) {
      hints.push({
        id: nextHintId('unclassified_block'),
        type: 'unclassified_block',
        severity: 'low',
        message: `Skill “${item.fields?.name?.value || ''}” could not be classified with high confidence.`,
        target_ids: [item.id],
        source_block_ids: item.source_block_ids,
        suggested_action: 'move_block',
      });
      lowConfidenceItems.push({ section: 'skills', ...item, reason: 'low_confidence' });
    }
  }

  const unclassifiedSegs = (bundle.resumeSegments || []).filter(
    (s) =>
      (s.section === CV_SECTION.OTHER || !s.section) &&
      String(s.text || '').trim().length >= 16
  );
  if (unclassifiedSegs.length > 0 && !validation) {
    hints.push({
      id: nextHintId('unclassified_block'),
      type: 'unclassified_block',
      severity: 'medium',
      message: 'This block could not be classified safely.',
      target_ids: unclassifiedSegs.map((s) => s.block_id).filter(Boolean),
      source_block_ids: unclassifiedSegs.map((s) => s.block_id).filter(Boolean),
      suggested_action: 'move_block',
    });
  }

  const portfolioPages = confidence?.traces?.portfolio_pages || bundle.pageDocumentClassification?.portfolio_pages || [];
  for (const page of portfolioPages) {
    const pageMeta = bundle.pageDocumentClassification?.pages?.find((p) => p.page === page);
    hints.push({
      id: nextHintId('portfolio_page_excluded'),
      type: 'portfolio_page_excluded',
      severity: 'low',
      message: `This page was classified as portfolio and excluded (page ${page}).`,
      target_ids: [`page-${page}`],
      source_block_ids: [],
      suggested_action: 'ignore',
      trace: {
        page,
        page_class: pageMeta?.page_class || 'portfolio_page',
        classifier_confidence: pageMeta?.confidence ?? null,
        portfolio_item_count: (bundle.portfolio_items || []).filter((i) => i.page_number === page).length,
      },
    });
  }

  const missingExperience =
    (bundle.resumeSegments || []).some((s) => s.section === CV_SECTION.EXPERIENCE) &&
    !(bundle.experienceItems || []).length;
  if (missingExperience) {
    hints.push({
      id: nextHintId('missing_section'),
      type: 'missing_section',
      severity: 'high',
      message: 'We found an experience section but could not extract any roles.',
      target_ids: [],
      suggested_action: 'ask_user_confirmation',
    });
  }

  const validationIssues = validation?.issues || [];
  const seenValidation = new Set();
  for (const issue of validationIssues) {
    const key = `${issue.code}|${(issue.target_ids || []).join(',')}|${issue.message}`;
    if (seenValidation.has(key)) continue;
    seenValidation.add(key);
    const hint = hintFromValidationIssue(issue);
    if (!hints.some((h) => h.type === hint.type && h.message === hint.message)) {
      hints.push(hint);
    }
    if (issue.severity === 'error' || issue.severity === 'warning') {
      lowConfidenceItems.push({
        section: issue.section,
        id: issue.item_id,
        reason: issue.code,
        message: issue.message,
      });
    }
  }

  const hasValidationErrors = (validation?.error_count || 0) > 0;
  const hasValidationWarnings = (validation?.warning_count || 0) > 0;

  const needsReview =
    (confidence?.global ?? 1) < LOW_CONFIDENCE_THRESHOLDS.global ||
    lowConfidenceItems.length > 0 ||
    hints.some((h) => h.severity === 'high') ||
    hasValidationErrors ||
    (hasValidationWarnings && (confidence?.global ?? 1) < 0.75);

  return {
    version: CV_REVIEW_HINTS,
    hints,
    low_confidence_items: lowConfidenceItems,
    needs_review: needsReview,
    suppress_silent_low_quality: needsReview || hasValidationErrors,
    validation: validation
      ? {
          version: validation.version || CV_PARSE_VALIDATION,
          valid: validation.valid,
          production_ready: validation.production_ready,
          error_count: validation.error_count,
          warning_count: validation.warning_count,
          stats: validation.stats,
        }
      : null,
  };
}

/**
 * Build a sample API-style parse response payload for QA and UI contracts.
 * @param {object} params
 */
export function buildCvParseResponsePayload(params = {}) {
  const {
    contact,
    summary = '',
    languages = [],
    interests = [],
    experienceItems = [],
    educationItems = [],
    skillItems = [],
    skillsByCategory = null,
    portfolio_items = [],
    pageDocumentClassification = null,
    parseConfidence,
    reviewHints,
    parseValidation = null,
    traces = {},
  } = params;

  return {
    schema: 'hirely.parse_response.v1',
    generated_at: new Date().toISOString(),
    contact: contact || parseConfidence?.contact || null,
    summary: String(summary || '').trim(),
    languages: Array.isArray(languages) ? languages : [],
    interests: Array.isArray(interests) ? interests : [],
    experiences: experienceItems,
    education: educationItems,
    skills: skillItems,
    skills_by_category: skillsByCategory,
    portfolio_items,
    page_document_classification: pageDocumentClassification
      ? {
          resume_core_pages: pageDocumentClassification.resume_core_pages || [],
          portfolio_pages: pageDocumentClassification.portfolio_pages || [],
          pages: pageDocumentClassification.pages || [],
        }
      : null,
    confidence: parseConfidence
      ? {
          version: parseConfidence.version || CV_PARSE_CONFIDENCE,
          global: parseConfidence.global,
          sections: parseConfidence.sections,
          fields: parseConfidence.fields,
          items: parseConfidence.items,
          traces: parseConfidence.traces,
        }
      : null,
    review_hints: reviewHints?.hints || [],
    validation: parseValidation
      ? {
          version: parseValidation.version || CV_PARSE_VALIDATION,
          valid: parseValidation.valid,
          production_ready: parseValidation.production_ready,
          error_count: parseValidation.error_count,
          warning_count: parseValidation.warning_count,
          issues: parseValidation.issues,
          stats: parseValidation.stats,
        }
      : reviewHints?.validation || null,
    quality_gate: {
      needs_review: reviewHints?.needs_review ?? false,
      suppress_silent_low_quality: reviewHints?.suppress_silent_low_quality ?? false,
      low_confidence_item_count: reviewHints?.low_confidence_items?.length ?? 0,
      validation_errors: parseValidation?.error_count ?? reviewHints?.validation?.error_count ?? 0,
      validation_warnings: parseValidation?.warning_count ?? reviewHints?.validation?.warning_count ?? 0,
      production_ready:
        parseValidation?.production_ready ??
        ((parseValidation?.error_count ?? 0) === 0 && (reviewHints?.needs_review === false)),
    },
    traces: {
      confidence_module: parseConfidence?.version || CV_PARSE_CONFIDENCE,
      hints_module: reviewHints?.version || CV_REVIEW_HINTS,
      validation_module: parseValidation?.version || CV_PARSE_VALIDATION,
      ...traces,
    },
  };
}
