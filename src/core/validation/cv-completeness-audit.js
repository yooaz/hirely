/**
 * P3 — CV completeness audit: raw text vs finalResumeData coverage.
 * Target 80%+; below threshold → French banner + review queue (never silent loss).
 */

import { flattenCvDataPreservedText } from '../../debug/cv-preserved-text.js';
import {
  measureCleanedTextUtilization,
  mergeUnsortedLines,
  FINAL_CV_UTILIZATION_MIN_PCT,
} from '../parsing/no-data-loss.js';
import { buildRecruiterReviewItem } from '../parsing/recruiter-review-mode.js';
import { mergeReviewQueues } from '../parsing/review-queue-merge.js';

export const CV_COMPLETENESS_AUDIT_V1 = 'CV_COMPLETENESS_AUDIT_V1';
export const CV_COMPLETENESS_TARGET_PCT = FINAL_CV_UTILIZATION_MIN_PCT;
export const CV_UNCLASSIFIED_MSG_FR = "Une partie du CV n'a pas été classifiée";

function normLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lineAccountedFor(line, blob) {
  const k = normLine(line);
  if (!k || k.length < 3) return true;
  if (blob.includes(k)) return true;
  if (k.length >= 12) {
    const words = k.split(/\s+/).filter((w) => w.length > 2);
    if (words.length >= 2) {
      const hits = words.filter((w) => blob.includes(w)).length;
      if (hits / words.length >= 0.6) return true;
    }
  }
  return false;
}

/**
 * Map finalResumeData → cvData-like shape for retention accounting.
 * @param {object|null} finalResumeData
 */
export function finalResumeDataToAuditShape(finalResumeData) {
  const d = finalResumeData || {};
  const id = d.identity || {};
  return {
    name: id.name,
    title: id.title,
    email: id.email,
    phone: id.phone,
    location: id.location,
    linkedin: id.linkedin,
    portfolio: id.portfolio,
    summary: d.summary,
    experiences: d.experiences || [],
    education: d.education || [],
    skills: d.skills || [],
    tools: d.tools || [],
    languages: d.languages || [],
    clients: d.clients || [],
    projects: d.projects || [],
    unsorted: d.suggestions || [],
    toClassify: d.suggestions || [],
  };
}

/**
 * Flatten user-visible finalResumeData text (preview side of coverage).
 * @param {object|null} finalResumeData
 */
export function flattenFinalResumePreviewText(finalResumeData) {
  return flattenCvDataPreservedText(finalResumeDataToAuditShape(finalResumeData));
}

/**
 * Lines from source text not represented in finalResumeData preview.
 * @param {string} sourceText
 * @param {object|null} finalResumeData
 */
export function findUnclassifiedLines(sourceText, finalResumeData) {
  const clean = String(sourceText || '').trim();
  const blob = normLine(flattenFinalResumePreviewText(finalResumeData));
  return clean
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && !lineAccountedFor(l, blob));
}

/**
 * @param {string[]} lines
 * @param {object} [opts]
 */
export function buildCompletenessReviewItems(lines = [], opts = {}) {
  const out = [];
  const cap = Math.min(24, Number(opts.maxItems) || 24);
  for (const raw of lines.slice(0, cap)) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const item = buildRecruiterReviewItem({
      line,
      classification: {
        needsReview: true,
        semanticType: 'unknown',
        confidence: 35,
        reason: CV_UNCLASSIFIED_MSG_FR,
      },
    });
    if (!item) continue;
    out.push({
      ...item,
      field: 'unknown',
      detectedType: 'unclassified',
      sourceText: line,
      reason: CV_UNCLASSIFIED_MSG_FR,
      completenessAudit: true,
    });
  }
  return mergeReviewQueues(opts.existingReview || [], out);
}

/**
 * Compare raw text vs finalResumeData; measure coverage %.
 * @param {string} rawText
 * @param {object|null} finalResumeData
 * @param {{ cleanedText?: string, existingReview?: object[], maxReviewItems?: number }} [opts]
 */
export function auditCvCompleteness(rawText, finalResumeData, opts = {}) {
  const raw = String(rawText || '').trim();
  const source = String(opts.cleanedText || raw).trim();
  const auditShape = finalResumeDataToAuditShape(finalResumeData);

  if (!raw && !source) {
    return {
      version: CV_COMPLETENESS_AUDIT_V1,
      rawChars: 0,
      previewChars: 0,
      charCoveragePct: 100,
      lineCoveragePct: 100,
      coveragePct: 100,
      accountedChars: 0,
      cleanLength: 0,
      orphanLineCount: 0,
      meetsTarget: true,
      messageFr: null,
      unclassifiedLines: [],
      reviewItems: [],
      openReviewQueue: false,
    };
  }

  const rawChars = Math.max(1, raw.length);
  const previewText = flattenFinalResumePreviewText(finalResumeData);
  const previewChars = previewText.length;
  const charCoveragePct = Math.min(100, Math.round((previewChars / rawChars) * 1000) / 10);

  const utilization = measureCleanedTextUtilization(source || raw, auditShape);
  const lineCoveragePct = utilization.utilizationPct;
  /** Primary gate: preview chars / raw chars (P3 spec: 1500 raw → 700 preview = 46%). */
  const coveragePct = charCoveragePct;
  const meetsTarget = coveragePct >= CV_COMPLETENESS_TARGET_PCT;

  const unclassifiedLines = findUnclassifiedLines(source || raw, finalResumeData);
  const reviewItems = meetsTarget
    ? []
    : buildCompletenessReviewItems(unclassifiedLines, {
        existingReview: opts.existingReview,
        maxItems: opts.maxReviewItems,
      });

  return {
    version: CV_COMPLETENESS_AUDIT_V1,
    rawChars,
    previewChars,
    charCoveragePct,
    lineCoveragePct,
    coveragePct,
    accountedChars: utilization.accountedChars,
    cleanLength: utilization.cleanLength,
    orphanLineCount: utilization.orphanLineCount,
    meetsTarget,
    messageFr: meetsTarget ? null : CV_UNCLASSIFIED_MSG_FR,
    unclassifiedLines,
    reviewItems,
    openReviewQueue: !meetsTarget,
    warning: meetsTarget
      ? null
      : `${CV_UNCLASSIFIED_MSG_FR} (${coveragePct}% couverture, objectif ${CV_COMPLETENESS_TARGET_PCT}%)`,
  };
}

/**
 * Push unclassified lines into finalResumeData.suggestions (to-classify UI).
 * @param {object} finalResumeData
 * @param {string[]} lines
 */
export function applyUnclassifiedToSuggestions(finalResumeData, lines = []) {
  if (!finalResumeData || !lines.length) return finalResumeData;
  return {
    ...finalResumeData,
    suggestions: mergeUnsortedLines(finalResumeData.suggestions || [], lines),
  };
}
