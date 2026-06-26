/**
 * Stage 5 — Validation: required fields → review queue; never empty CV.
 */

import { buildReviewQueue, pendingReviewItems, normalizeReviewItem } from '../review-queue.js';
import {
  buildForcedPartialCvData,
  cvDataIsRenderable,
  normalizeCvData,
} from '../rich-parser.js';
import { NAME_UNCERTAIN_LABEL } from '../structured-resume.js';
import { assessFieldCompleteness } from '../field-completeness-gate.js';
import { assessImportQuality } from '../../validation/extraction-quality.js';

export const REQUIRED_VALIDATION_FIELDS = ['name', 'title', 'experience', 'education'];

/**
 * @param {object} cvData
 */
function fieldPresent(cvData, field) {
  const d = cvData || {};
  switch (field) {
    case 'name': {
      const n = String(d.name || '').trim();
      return n.length > 1 && n !== NAME_UNCERTAIN_LABEL;
    }
    case 'title':
      return String(d.title || '').trim().length > 1;
    case 'experience':
      return Array.isArray(d.experience) && d.experience.length > 0;
    case 'education':
      return Array.isArray(d.education) && d.education.length > 0;
    default:
      return false;
  }
}

/**
 * @param {object} opts
 */
export function runValidationStage(opts = {}) {
  let cvData = normalizeCvData(opts.cvData || {});
  const rawText = String(opts.rawText || '').trim();
  const cleanedText = String(opts.cleanedText || rawText).trim();
  const structuredResume = opts.structuredResume || null;
  const enterprise = opts.enterprise || null;

  const missingFields = REQUIRED_VALIDATION_FIELDS.filter((f) => !fieldPresent(cvData, f));

  const reviewQueue = buildReviewQueue({
    enterprise,
    parserReview: structuredResume?.needsReview,
    extractionReview: cvData._extractionReview || [],
    rejectedLines: opts.rejectedLines || [],
    uncertainLines: opts.uncertainLines || [],
    legacyNeedsReview: structuredResume?.needsReview,
    reviewItems: [
      ...(structuredResume?.reviewQueue || []),
      ...(structuredResume?.factReviewQueue || []),
    ],
  });

  for (const field of missingFields) {
    const item = normalizeReviewItem({
      id: `missing-${field}`,
      field,
      detected: `(missing ${field})`,
      sourceText: '',
      sourceLines: [],
      confidence: 40,
      reason: `Missing required field: ${field}`,
      suggestion: `Add or confirm ${field} before sending to recruiters`,
      action: 'missing_field',
      status: 'pending',
    });
    if (item) reviewQueue.push(item);
  }

  const renderableBefore = cvDataIsRenderable(cvData);
  if (!renderableBefore && (rawText.length >= 20 || cleanedText.length >= 20)) {
    cvData = normalizeCvData(buildForcedPartialCvData(rawText, cleanedText));
    cvData._pipelineFallback = true;
  }

  const renderable = cvDataIsRenderable(cvData);
  const fieldCompleteness = assessFieldCompleteness(cvData, rawText, cleanedText);
  const importQuality = assessImportQuality({
    rawText,
    cleanedText,
    cvData,
    structuredResume,
    audit: opts.audit || {},
    extractionMethod: opts.extractionMethod || 'paste',
  });

  return {
    stage: 5,
    cvData,
    renderable,
    neverEmpty: renderable,
    missingFields,
    reviewQueue,
    pendingReview: pendingReviewItems(reviewQueue),
    fieldCompleteness,
    importQuality,
    warnings: [
      ...(fieldCompleteness.warnings || []),
      ...missingFields.map((f) => `Missing: ${f}`),
    ],
    at: new Date().toISOString(),
  };
}
