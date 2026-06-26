/**
 * P0 — Final preview sanity check (before CV preview render).
 * Failed lines → reviewQueue; never shown in preview.
 */

import {
  dedupeEducationStrings,
  dedupeExperienceEntries,
  dedupeStringList,
  dedupeClientList,
  dedupeProjectList,
} from '../parsing/dedupe-engine.js';
import { mergeReviewQueues, normalizeReviewItem } from '../parsing/review-queue-merge.js';
import { enforceIdentityContactStrictness } from './identity-contact-strictness.js';
import { isAcceptableDisplayPhone, isAcceptableDisplayName } from './no-fake-data-policy.js';
import { applyOcrDataCleanup } from './ocr-data-cleanup.js';
import {
  auditSectionLabelLeakage,
  isSectionLabelLeakage,
  stripSectionLabelFromText,
  sanitizeExperience,
} from './section-label-leakage-guard.js';

export const FINAL_PREVIEW_SANITY_CHECK_V1 = 'FINAL_PREVIEW_SANITY_CHECK_V1';

export const PREVIEW_SANITY_RULES = Object.freeze([
  'no_fake_phone',
  'no_company_as_name',
  'no_partial_language',
  'no_ocr_fragments',
  'no_empty_sections',
  'no_duplicated_sections',
  'no_parser_labels',
]);

/**
 * @param {object} raw
 */
function buildSanityReviewItem(raw) {
  const item = normalizeReviewItem({
    ...raw,
    status: 'pending',
    action: raw.action || 'preview_sanity',
    category: raw.category || 'preview_sanity',
    confidence: raw.confidence ?? 46,
  });
  return item;
}

function experienceHasContent(exp) {
  if (!exp || typeof exp !== 'object') return false;
  if (String(exp.role || '').trim() || String(exp.company || '').trim()) return true;
  if ((exp.bullets || []).some((b) => String(b || '').trim())) return true;
  if (String(exp.description || exp.rewrittenDescription || '').trim()) return true;
  return false;
}

function pruneEmptySections(rd) {
  const out = { ...rd };
  out.summary = String(out.summary || '').trim();
  out.experiences = (out.experiences || []).filter(experienceHasContent);
  for (const key of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    out[key] = (out[key] || [])
      .map((x) => String(x || '').trim())
      .filter(Boolean);
  }
  return out;
}

/**
 * Audit-only — no mutation.
 * @param {object} [finalResumeData]
 */
export function auditFinalPreviewSanity(finalResumeData = {}) {
  const applied = applyFinalPreviewSanityCheck(finalResumeData, { auditOnly: true });
  return {
    pass: applied.violations.length === 0,
    policy: FINAL_PREVIEW_SANITY_CHECK_V1,
    rules: [...PREVIEW_SANITY_RULES],
    violations: applied.violations,
    reviewCount: applied.reviewItems.length,
  };
}

/**
 * @param {object|null} finalResumeData
 * @param {{ existingReview?: object[], auditOnly?: boolean, force?: boolean }} [opts]
 */
export function applyFinalPreviewSanityCheck(finalResumeData, opts = {}) {
  if (!finalResumeData || typeof finalResumeData !== 'object') {
    return {
      finalResumeData: null,
      reviewItems: mergeReviewQueues(opts.existingReview || []),
      violations: [],
      stats: { queued: 0 },
    };
  }

  if (
    !opts.force &&
    !opts.auditOnly &&
    finalResumeData.metaSafe?.previewSanityCheck === FINAL_PREVIEW_SANITY_CHECK_V1
  ) {
    return {
      finalResumeData,
      reviewItems: mergeReviewQueues(opts.existingReview || []),
      violations: [],
      stats: { queued: 0, skipped: true },
    };
  }

  const violations = [];
  const reviewItems = [];
  let rd = {
    ...finalResumeData,
    identity: { ...(finalResumeData.identity || {}) },
  };

  const identityResult = enforceIdentityContactStrictness(rd.identity, {
    experiences: rd.experiences || [],
    existingReviewItems: [],
    sourceText: opts.sourceText || opts.rawText || opts.cleanedText || '',
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
  });
  rd.identity = identityResult.identity;
  for (const item of identityResult.reviewItems || []) {
    reviewItems.push(item);
    const field = String(item.field || '');
    if (field.includes('phone')) violations.push({ rule: 'no_fake_phone', field, detail: item.sourceText || item.detected });
    if (field.includes('name')) violations.push({ rule: 'no_company_as_name', field, detail: item.sourceText || item.detected });
  }

  const phone = String(rd.identity?.phone || '').trim();
  if (phone && !isAcceptableDisplayPhone(phone)) {
    violations.push({ rule: 'no_fake_phone', field: 'identity.phone', detail: phone });
    delete rd.identity.phone;
  }

  const name = String(rd.identity?.name || '').trim();
  if (name && !isAcceptableDisplayName(name, rd.experiences || [])) {
    violations.push({ rule: 'no_company_as_name', field: 'identity.name', detail: name });
  }

  const ocrPass = applyOcrDataCleanup(rd, { existingReviewItems: [] });
  rd = ocrPass.resumeData;
  for (const item of ocrPass.reviewItems || []) {
    reviewItems.push(item);
    violations.push({
      rule: 'no_ocr_fragments',
      field: item.field || 'ocr',
      detail: item.sourceText || item.detected,
    });
  }
  for (const v of ocrPass.violations || []) {
    violations.push({
      rule: v.rule === 'section_label' ? 'no_parser_labels' : v.rule === 'partial_language' ? 'no_partial_language' : 'no_ocr_fragments',
      field: v.field,
      detail: v.detail,
    });
  }

  rd.summary = String(rd.summary || '').trim();

  rd.experiences = dedupeExperienceEntries(rd.experiences || []);
  rd.education = dedupeEducationStrings(rd.education || [], { identity: rd.identity });
  rd.skills = dedupeStringList(rd.skills);
  rd.tools = dedupeStringList(rd.tools);
  rd.languages = dedupeStringList(rd.languages);
  rd.clients = dedupeClientList(rd.clients);
  rd.projects = dedupeProjectList(rd.projects);

  rd = pruneEmptySections(rd);

  const labelAudit = auditSectionLabelLeakage(rd);
  if (labelAudit.violations.length) {
    for (const v of labelAudit.violations) {
      violations.push({ rule: 'no_parser_labels', field: v.section, detail: v.text });
      const review = buildSanityReviewItem({
        field: v.section,
        detected: v.text,
        sourceText: v.text,
        reason: 'Parser label leaked into preview content',
      });
      if (review) reviewItems.push(review);
    }
    if (!opts.auditOnly) {
      rd.summary = stripSectionLabelFromText(rd.summary);
      for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects']) {
        rd[field] = (rd[field] || []).filter((line) => !isSectionLabelLeakage(line));
      }
      rd.experiences = (rd.experiences || [])
        .map((exp) => (typeof exp === 'string' ? stripSectionLabelFromText(exp) : sanitizeExperience(exp).exp))
        .filter(Boolean);
      rd = pruneEmptySections(rd);
    }
  }

  const mergedReview = mergeReviewQueues(opts.existingReview || [], reviewItems);

  if (opts.auditOnly) {
    return {
      finalResumeData,
      reviewItems: mergedReview,
      violations,
      stats: { queued: reviewItems.length, auditOnly: true },
    };
  }

  rd.metaSafe = {
    ...(rd.metaSafe || {}),
    previewSanityCheck: FINAL_PREVIEW_SANITY_CHECK_V1,
    previewSanityAt: new Date().toISOString(),
    previewSanityViolations: violations.slice(0, 48),
  };

  return {
    finalResumeData: rd,
    reviewItems: mergedReview,
    violations,
    stats: {
      queued: reviewItems.length,
      violationCount: violations.length,
    },
  };
}
