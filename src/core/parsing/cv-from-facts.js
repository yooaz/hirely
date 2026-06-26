/**
 * STAGE 2 — Build CV from facts only.
 * Facts below confidence threshold → review queue. Never force category.
 */

import { emptyStructuredResume } from './structured-resume.js';
import { SECTION_IDS } from './section-types-v2.js';
import { FACT_CONFIDENCE_THRESHOLD } from './fact-types.js';
import { normalizeReviewItem, mergeReviewQueues } from './review-queue-merge.js';
import { factsToRecruiterReviewItems } from './recruiter-review-mode.js';
import {
  buildExperiencesFromClassifiedBlocks,
  filterExperienceBlocksOnly,
} from './experience-builder-v2.js';
import {
  extractLockedIdentity,
  isValidIdentityName,
  isValidIdentityTitle,
  IDENTITY_CONFIDENCE_MIN,
} from './identity-extraction.js';
import {
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
} from './parser-recovery.js';
import { isValidSummaryField, EMAIL_RE } from './field-sanitize.js';
import { normalizeEmail } from './line-cleaner.js';
import {
  assignFactWithContract,
  enforceStructuredSectionContract,
} from './cv-section-contract.js';
import { mergeUnsortedLines } from './no-data-loss.js';
import { UNSORTED_DISPLAY_MAX } from './parser-coverage-report.js';
import { PARSER_CONFIDENCE_MIN } from './parser-coverage-report.js';

export const CV_FROM_FACTS_STAGE = 'CV_FROM_FACTS_V1';

/**
 * @param {import('./fact-extraction.js').ResumeFact[]} facts
 * @param {number} [threshold]
 */
export function partitionFactsByConfidence(facts, threshold = FACT_CONFIDENCE_THRESHOLD) {
  const accepted = [];
  const pending = [];

  for (const fact of facts || []) {
    if (fact.type === 'unknown' || fact.confidence < threshold) {
      pending.push(fact);
    } else {
      accepted.push(fact);
    }
  }

  return { accepted, pending, threshold };
}

/**
 * @param {import('./fact-extraction.js').ResumeFact[]} pendingFacts
 */
export function factsToReviewItems(pendingFacts) {
  return factsToRecruiterReviewItems(pendingFacts);
}

function pushUnique(arr, value) {
  const v = String(value || '').trim();
  if (!v) return;
  const key = v.toLowerCase();
  if (arr.some((x) => String(x).toLowerCase() === key)) return;
  arr.push(v);
}

function experienceFactsToBlocks(experienceFacts) {
  return (experienceFacts || []).map((fact, i) => ({
    id: fact.id || `exp-fact-${i}`,
    type: SECTION_IDS.EXPERIENCE,
    lines: [fact.sourceLine || fact.value],
    classifiedConfidence: Math.round((fact.confidence || 0) * 100),
    classifyReason: 'fact_pipeline_experience',
  }));
}

/**
 * Stage 2 — build structured resume from accepted facts only.
 * @param {import('./fact-extraction.js').ResumeFact[]} facts
 * @param {object} [opts]
 */
export function buildCvFromFacts(facts, opts = {}) {
  const threshold = opts.threshold ?? FACT_CONFIDENCE_THRESHOLD;
  const { accepted, pending } = partitionFactsByConfidence(facts, threshold);
  const structured = emptyStructuredResume();
  const reviewItems = factsToReviewItems(pending);

  const byType = new Map();
  for (const fact of accepted) {
    const list = byType.get(fact.type) || [];
    list.push(fact);
    byType.set(fact.type, list);
  }

  for (const fact of byType.get('identity') || []) {
    if (!structured.identity.name && isValidIdentityName(fact.value)) {
      structured.identity.name = fact.value;
      structured.nameConfidence = Math.round(fact.confidence * 100);
    } else if (!structured.identity.title && isValidIdentityTitle(fact.value)) {
      structured.identity.title = fact.value;
      structured.titleConfidence = Math.round(fact.confidence * 100);
    }
  }

  for (const fact of byType.get('contact') || []) {
    const v = fact.value;
    if (v.includes('@') && !structured.identity.email) {
      structured.identity.email = normalizeEmail(v) || String(v).match(EMAIL_RE)?.[0] || v;
    }
    else if (/\+?\d/.test(v) && !structured.identity.phone) structured.identity.phone = v;
    else if (/linkedin/i.test(v) && !structured.identity.linkedin) structured.identity.linkedin = v;
    else if (/https?:\/\//i.test(v) && !structured.identity.website) structured.identity.website = v;
  }

  const summaryFacts = byType.get('summary') || [];
  if (summaryFacts.length) {
    const blob = summaryFacts.map((f) => f.value).join('\n').trim();
    if (isValidSummaryField(blob)) structured.summary = blob.slice(0, 520);
  }

  const expFacts = byType.get('experience') || [];
  if (expFacts.length) {
    const blocks = experienceFactsToBlocks(expFacts);
    const scoped = filterExperienceBlocksOnly(blocks);
    const expResult = buildExperiencesFromClassifiedBlocks(scoped);
    structured.experiences = expResult.experiences;
    for (const line of expResult.unsorted || []) {
      reviewItems.push(
        normalizeReviewItem({
          field: 'experience',
          detectedType: 'experience',
          detected: line,
          sourceText: line,
          confidence: Math.round(threshold * 100) - 1,
          reason: 'Experience fact could not be structured',
          action: 'review',
          status: 'pending',
        })
      );
    }
  }

  for (const fact of byType.get('education') || []) {
    assignFactWithContract(structured, reviewItems, 'education', fact, pushUnique);
  }
  for (const fact of byType.get('skill') || []) {
    assignFactWithContract(structured, reviewItems, 'skill', fact, pushUnique);
  }
  for (const fact of byType.get('tool') || []) {
    assignFactWithContract(structured, reviewItems, 'tool', fact, pushUnique);
  }
  for (const fact of byType.get('language') || []) {
    assignFactWithContract(structured, reviewItems, 'language', fact, pushUnique);
  }
  for (const fact of byType.get('client') || []) {
    assignFactWithContract(structured, reviewItems, 'client', fact, pushUnique);
  }
  for (const fact of byType.get('project') || []) pushUnique(structured.projects, fact.value);
  for (const fact of byType.get('award') || []) pushUnique(structured.awards, fact.value);
  for (const fact of byType.get('publication') || []) pushUnique(structured.publications, fact.value);
  for (const fact of byType.get('interest') || []) pushUnique(structured.interests, fact.value);

  if (opts.classifiedBlocks?.length) {
    const allLines = opts.classifiedBlocks.flatMap((b) => b.lines || []);
    const locked = extractLockedIdentity(allLines, {
      headerLines: allLines.slice(0, 12),
      contact: {
        email: structured.identity.email,
        phone: structured.identity.phone,
      },
    });
    if (locked.name && locked.nameConfidence >= IDENTITY_CONFIDENCE_MIN) {
      structured.identity.name = locked.name;
    } else if (!structured.identity.name || structured.identity.name === NAME_UNCERTAIN_LABEL) {
      if (!isValidIdentityName(structured.identity.name)) {
        structured.identity.name = structured.identity.name || NAME_UNCERTAIN_LABEL;
      }
    }
    if (locked.title && locked.titleConfidence >= IDENTITY_CONFIDENCE_MIN) {
      structured.identity.title = locked.title;
    } else if (!structured.identity.title) {
      structured.identity.title = TITLE_UNCERTAIN_LABEL;
    }
  }

  const contractPass = enforceStructuredSectionContract(structured);
  reviewItems.push(...contractPass.reviewItems);

  const pendingValues = pending.map((f) => f.sourceLine || f.value).filter(Boolean);
  structured.unsorted = mergeUnsortedLines(
    structured.unsorted || [],
    pendingValues.slice(0, UNSORTED_DISPLAY_MAX)
  );
  structured.needsReview = [
    ...(structured.needsReview || []),
    ...reviewItems.map((item) => ({
      field: item.field,
      detected: item.detected,
      suggestion: item.suggestion,
      reason: item.reason,
      action: item.action,
      possibleCategories: item.possibleCategories,
      requiresUserChoice: item.requiresUserChoice,
    })),
  ];
  structured.reviewQueue = mergeReviewQueues(structured.reviewQueue || [], reviewItems);
  structured.factReviewQueue = reviewItems;

  structured.metadata = {
    ...(structured.metadata || {}),
    factPipeline: true,
    factExtractionStage: opts.factStage || 'FACT_EXTRACTION_V1',
    cvFromFactsStage: CV_FROM_FACTS_STAGE,
    factConfidenceThreshold: threshold,
    factCounts: {
      total: facts.length,
      accepted: accepted.length,
      pending: pending.length,
    },
    neverForceCategory: true,
    cvSectionContract: true,
    parserConfidenceMin: PARSER_CONFIDENCE_MIN,
    fieldExtractSource: 'facts_only',
    neverRawFieldExtract: true,
  };

  if (opts.rawText) structured.rawExtraction = String(opts.rawText).trim();

  return {
    structured,
    acceptedFacts: accepted,
    pendingFacts: pending,
    reviewQueue: reviewItems,
    threshold,
  };
}
