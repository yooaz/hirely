/**
 * P0 — Extraction confidence tiers (HIGH / MEDIUM / LOW).
 * LOW confidence must enter reviewQueue — never auto-render as fact.
 */

import { P0_CONFIDENCE_THRESHOLD } from '../parsing/p0-threshold.js';

export const EXTRACTION_CONFIDENCE_TIERS_V1 = 'EXTRACTION_CONFIDENCE_TIERS_V1';

/** Mirrors identity-extraction.js — inlined to avoid circular imports. */
const IDENTITY_NAME_HIGH_MIN = 85;
/** Mirrors phone-normalize.js */
const PHONE_HIGH_MIN = 95;

/** Canonical tier labels. */
export const CONFIDENCE_TIER = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

/** Default numeric boundaries (percent). */
export const TIER_BOUNDARIES = Object.freeze({
  HIGH_MIN: 85,
  MEDIUM_MIN: P0_CONFIDENCE_THRESHOLD,
});

/** Field-specific HIGH floors. */
export const FIELD_HIGH_MIN = Object.freeze({
  identity: 95,
  name: IDENTITY_NAME_HIGH_MIN,
  phone: PHONE_HIGH_MIN,
  email: 95,
  experience: 85,
  education: 85,
  skills: 75,
  tools: 75,
  languages: 75,
  default: TIER_BOUNDARIES.HIGH_MIN,
});

/**
 * Map numeric confidence (0–100) to tier.
 * @param {number} score
 * @param {{ field?: string, highMin?: number }} [opts]
 */
export function confidenceTier(score, opts = {}) {
  const n = Math.round(Number(score) || 0);
  const field = String(opts.field || '').toLowerCase();
  const highMin =
    opts.highMin ??
    FIELD_HIGH_MIN[field] ??
    FIELD_HIGH_MIN.default;

  if (n >= highMin) return CONFIDENCE_TIER.HIGH;
  if (n >= TIER_BOUNDARIES.MEDIUM_MIN) return CONFIDENCE_TIER.MEDIUM;
  return CONFIDENCE_TIER.LOW;
}

/**
 * LOW tier must always enter reviewQueue.
 * @param {number} score
 * @param {{ field?: string }} [opts]
 */
export function tierRequiresReviewQueue(score, opts = {}) {
  return confidenceTier(score, opts) === CONFIDENCE_TIER.LOW;
}

/**
 * Only HIGH tier may auto-render on the CV without review.
 * @param {number} score
 * @param {{ field?: string }} [opts]
 */
export function tierAllowsAutoRender(score, opts = {}) {
  return confidenceTier(score, opts) === CONFIDENCE_TIER.HIGH;
}

/**
 * Annotate a review item or block with tier metadata.
 * @param {object} item
 */
export function annotateConfidenceTier(item = {}) {
  const confidence = Number(item.confidence) || 0;
  const field = item.field || item.detectedType || '';
  const tier = confidenceTier(confidence, { field });
  return {
    ...item,
    confidence,
    confidenceTier: tier,
    requiresReview: tier === CONFIDENCE_TIER.LOW,
  };
}

/**
 * Build a standard review-queue item for low-confidence extraction.
 * @param {object} opts
 */
export function buildLowConfidenceReviewItem(opts = {}) {
  const confidence = Math.round(Number(opts.confidence) || 0);
  const field = String(opts.field || 'unsorted');
  const tier = confidenceTier(confidence, { field });
  if (tier !== CONFIDENCE_TIER.LOW) return null;

  return annotateConfidenceTier({
    id: opts.id || `low-conf-${field}-${Date.now()}`,
    field,
    detectedType: opts.detectedType || field,
    detected: String(opts.detected || opts.value || '').trim(),
    sourceText: String(opts.sourceText || opts.detected || '').trim(),
    sourceLines: opts.sourceLines || [],
    confidence,
    reason: opts.reason || `LOW confidence (${confidence}%) — confirm before display`,
    suggestion: opts.suggestion || 'Verify this value',
    action: 'edit',
    status: 'pending',
  });
}
