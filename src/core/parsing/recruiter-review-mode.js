/**
 * HIRELY H12 — Recruiter review mode.
 * Low-confidence / ambiguous lines never auto-place; user chooses via review cards.
 */

import { normalizeReviewItem } from './review-queue-merge.js';
import {
  buildPossibleCategoriesFromAlternatives,
  categoryLabel,
  suggestPossibleCategories,
} from './review-queue-categories.js';
import { SEMANTIC_CLASS, SEMANTIC_V2_CONFIDENCE_MIN } from './semantic-classifier-v2.js';
import { FACT_CONFIDENCE_THRESHOLD } from './fact-types.js';
import { REVIEW_QUEUE_THRESHOLD } from './review-queue.js';

export const RECRUITER_REVIEW_MODE_VERSION = 'recruiter-review-mode-v1';

export const RECRUITER_REVIEW_ACTIONS = Object.freeze({
  ACCEPT: 'accept',
  MOVE: 'move',
  EDIT: 'edit',
  IGNORE: 'ignore',
});

const SEMANTIC_TO_FACT = Object.freeze({
  [SEMANTIC_CLASS.SKILL]: 'skill',
  [SEMANTIC_CLASS.TOOL]: 'tool',
  [SEMANTIC_CLASS.LANGUAGE]: 'language',
  [SEMANTIC_CLASS.CLIENT]: 'client',
  [SEMANTIC_CLASS.COMPANY]: 'client',
  [SEMANTIC_CLASS.EDUCATION]: 'education',
  [SEMANTIC_CLASS.EXPERIENCE]: 'experience',
  [SEMANTIC_CLASS.JOB_TITLE]: 'identity',
  [SEMANTIC_CLASS.PERSON_NAME]: 'identity',
  [SEMANTIC_CLASS.SUMMARY]: 'summary',
  [SEMANTIC_CLASS.LINK]: 'contact',
  [SEMANTIC_CLASS.UNKNOWN]: 'unknown',
});

/**
 * @param {string} semanticType
 * @returns {string}
 */
export function semanticClassToFactType(semanticType) {
  return SEMANTIC_TO_FACT[semanticType] || String(semanticType || 'unknown').toLowerCase();
}

/**
 * @param {string} line
 */
export function isAmbiguousRecruiterLine(line) {
  return /^visual\s+communication$/i.test(String(line || '').trim());
}

/**
 * @param {Array<{ type?: string, factType?: string, confidence?: number, label?: string }>} alternatives
 * @returns {{ id: string, label: string, score: number, confidence: number }[]}
 */
export function buildDetectionAlternatives(alternatives) {
  return buildPossibleCategoriesFromAlternatives(alternatives);
}

/**
 * @param {object} opts
 * @param {string} opts.line
 * @param {object} [opts.classification]
 * @param {import('./fact-extraction.js').ResumeFact} [opts.fact]
 */
export function buildRecruiterReviewItem(opts = {}) {
  const line = String(opts.line || opts.fact?.sourceLine || opts.fact?.value || '').trim();
  if (!line) return null;

  const classification = opts.classification || {};
  const alternatives = classification.alternatives || opts.fact?.alternatives || [];
  const hasAlternatives = Array.isArray(alternatives) && alternatives.length >= 2;

  const factType = opts.fact?.type || semanticClassToFactType(classification.rawType || classification.semanticType);
  const confidencePct = Math.round(
    Number(
      opts.fact?.confidence != null
        ? (opts.fact.confidence <= 1 ? opts.fact.confidence * 100 : opts.fact.confidence)
        : classification.confidence ?? classification.rawConfidence ?? 50
    )
  );

  const possibleCategories = hasAlternatives
    ? buildDetectionAlternatives(alternatives)
    : suggestPossibleCategories(line, factType);

  const requiresUserChoice =
    Boolean(classification.needsReview) ||
    hasAlternatives ||
    factType === 'unknown' ||
    confidencePct < SEMANTIC_V2_CONFIDENCE_MIN ||
    (opts.fact?.confidence ?? 1) < FACT_CONFIDENCE_THRESHOLD;

  const primary = possibleCategories[0];
  const altSummary = hasAlternatives
    ? alternatives
        .slice(0, 3)
        .map((a) => {
          const id = semanticClassToFactType(a.type) || a.factType || a.type;
          return `${categoryLabel(id)} ${Math.round(a.confidence || 0)}%`;
        })
        .join(' · ')
    : '';

  return normalizeReviewItem({
    field: requiresUserChoice ? 'unknown' : factType,
    detectedType: requiresUserChoice ? 'unknown' : factType,
    detected: line.slice(0, 400),
    sourceText: line,
    sourceLines: [line],
    confidence: confidencePct,
    reason: hasAlternatives
      ? `Ambiguous — ${altSummary}`
      : classification.reason ||
        `Confidence ${confidencePct}% — below ${SEMANTIC_V2_CONFIDENCE_MIN}% threshold`,
    suggestion: requiresUserChoice
      ? 'Choose the correct section before adding to your CV'
      : 'Accept to include, edit to fix, or ignore to exclude',
    action: hasAlternatives ? 'recruiter_ambiguous' : 'recruiter_review',
    status: 'pending',
    possibleCategories,
    requiresUserChoice,
    factId: opts.fact?.id,
    alternatives: hasAlternatives ? alternatives : undefined,
    recruiterReview: true,
  });
}

/**
 * @param {import('./fact-extraction.js').ResumeFact[]} pendingFacts
 */
export function factsToRecruiterReviewItems(pendingFacts) {
  return (pendingFacts || [])
    .map((fact) =>
      buildRecruiterReviewItem({
        line: fact.sourceLine || fact.value,
        fact,
        classification: {
          needsReview: true,
          alternatives: fact.alternatives,
          rawType: fact.rawType,
          confidence: (fact.confidence || 0) * 100,
          reason: fact.classifyReason,
        },
      })
    )
    .filter(Boolean);
}

/**
 * Ensure pending low-confidence values are not present in CV section arrays.
 * @param {object} cv
 * @param {object[]} queue
 */
export function auditLowConfidenceNotInCv(cv, queue) {
  const pending = (queue || []).filter((i) => i.status === 'pending');
  const issues = [];

  const sections = {
    skills: cv?.skills || [],
    education: cv?.education || [],
    tools: cv?.tools || [],
    languages: cv?.languages || [],
    clients: cv?.clients || [],
    experience: cv?.experience || [],
  };

  for (const item of pending) {
    const text = String(item.sourceText || item.detected || '').trim().toLowerCase();
    if (!text) continue;
    for (const [section, values] of Object.entries(sections)) {
      for (const v of values) {
        if (String(v).trim().toLowerCase() === text) {
          issues.push({ section, text: item.sourceText || item.detected, itemId: item.id });
        }
      }
    }
  }

  return {
    pass: issues.length === 0,
    issues,
    pendingCount: pending.length,
    threshold: REVIEW_QUEUE_THRESHOLD,
  };
}
