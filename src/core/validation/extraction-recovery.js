/**
 * HIRELY EXTRACTION RECOVERY — never fail silently on low confidence.
 * Surfaces detected issues, missing sections, low-confidence fields; blocks broken CV output.
 */

import { buildReviewReadinessReport } from './review-readiness.js';
import { auditFinalCvPlaceholders } from './final-cv-placeholder-guard.js';
import { isUncertainIdentityName } from '../display/undetected-label.js';
import {
  CONFIDENCE_TIER,
  confidenceTier,
  EXTRACTION_CONFIDENCE_TIERS_V1,
} from './extraction-confidence-tiers.js';
import {
  scoreCvFieldConfidence,
  FIELD_REVIEW_THRESHOLD,
  EXTRACTION_FIELD_CONFIDENCE_V2,
} from '../extraction/field-confidence-v2.js';
import { P0_CONFIDENCE_THRESHOLD } from '../parsing/p0-threshold.js';
import { assessPreviewRenderGate } from './preview-render-gate.js';
import { buildRecoveryGuidanceSummary } from './extraction-recovery-guidance.js';
import {
  buildExtractionRecoveryContext,
  buildExtractionRecoveryDebugObject,
} from './extraction-recovery-context.js';

export const EXTRACTION_RECOVERY_V1 = 'EXTRACTION_RECOVERY_V1';
export const RECOVERY_LOW_CONFIDENCE_MIN = P0_CONFIDENCE_THRESHOLD;

const REQUIRED_SECTIONS = Object.freeze([
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
]);

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function finalResumeToCvShape(finalResumeData) {
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
    experience: (d.experiences || []).map((e) => {
      if (typeof e === 'string') return e;
      return [e?.role, e?.company, e?.dates].filter(Boolean).join(' — ') || JSON.stringify(e);
    }),
    education: d.education || [],
    skills: d.skills || [],
    tools: d.tools || [],
    languages: d.languages || [],
    reviewQueue: d.reviewQueue || [],
    meta: d.meta || {},
  };
}

function mapReviewItemToIssue(item, idx) {
  const field = String(item?.field || item?.detectedType || 'unknown');
  return {
    id: item?.id || `issue-${idx}`,
    field,
    message: norm(item?.reason || item?.suggestion || 'Needs review'),
    sourceText: norm(item?.sourceText || item?.detected || ''),
    confidence: Number(item?.confidence) || 0,
    action: item?.action || 'edit',
    status: item?.status || 'pending',
  };
}

function buildMissingSections(readiness, cvShape) {
  const fromReadiness = readiness?.missingSections || [];
  const mapped = REQUIRED_SECTIONS.filter((s) => {
    if (fromReadiness.includes(s.id)) return true;
    if (fromReadiness.includes('identity') && (s.id === 'name' || s.id === 'email')) return true;
    if (fromReadiness.includes('contact') && s.id === 'email') return true;
    if (fromReadiness.includes('content') && s.id === 'experience') return true;
    return false;
  }).map((s) => ({ id: s.id, label: s.label }));

  const seen = new Set(mapped.map((m) => m.id));
  for (const key of fromReadiness) {
    if (seen.has(key)) continue;
    const def = REQUIRED_SECTIONS.find((s) => s.id === key);
    mapped.push({ id: key, label: def?.label || key });
    seen.add(key);
  }

  if (!mapped.length && cvShape) {
    if (!norm(cvShape.name)) mapped.push({ id: 'name', label: 'Name' });
    if (!norm(cvShape.email)) mapped.push({ id: 'email', label: 'Email' });
    if (!(cvShape.experience || []).filter(Boolean).length) {
      mapped.push({ id: 'experience', label: 'Experience' });
    }
  }

  return mapped;
}

function buildLowConfidenceFields(cvShape, metaReport) {
  const fromMeta = metaReport?.fields || cvShape?.meta?.fieldConfidenceV2?.fields;
  if (Array.isArray(fromMeta) && fromMeta.length) {
    return fromMeta
      .filter((f) => f.needsReview || f.confidence < FIELD_REVIEW_THRESHOLD)
      .map((f) => ({
        field: f.field,
        value: norm(f.value),
        confidence: f.confidence,
        tier: confidenceTier(f.confidence, { field: f.field }),
        action: 'edit',
      }));
  }

  const scored = scoreCvFieldConfidence(cvShape);
  return scored.fields
    .filter((f) => f.needsReview)
    .map((f) => ({
      field: f.field,
      value: norm(f.value),
      confidence: f.confidence,
      tier: confidenceTier(f.confidence, { field: f.field }),
      action: 'edit',
    }));
}

function buildDetectedIssues(reviewQueue = [], placeholderAudit = null) {
  const pending = (reviewQueue || []).filter((i) => i && i.status === 'pending');
  const issues = pending.map(mapReviewItemToIssue);

  for (const v of placeholderAudit?.violations || []) {
    issues.push({
      id: `placeholder-${v.section}-${issues.length}`,
      field: v.section,
      message: `Placeholder content blocked from CV: "${norm(v.text).slice(0, 80)}"`,
      sourceText: norm(v.text),
      confidence: 0,
      action: 'edit',
      status: 'pending',
      placeholder: true,
    });
  }

  const seen = new Set();
  return issues.filter((i) => {
    const key = `${i.field}::${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {{
 *   finalResumeData?: object|null,
 *   cvData?: object|null,
 *   reviewQueue?: object[],
 *   contract?: object|null,
 *   importQualityScore?: number|null,
 *   toClassifyCount?: number,
 * }} input
 */
export function runExtractionRecovery(input = {}) {
  const frd = input.finalResumeData || null;
  const cvShape =
    input.cvData && typeof input.cvData === 'object'
      ? input.cvData
      : finalResumeToCvShape(frd);

  const reviewQueue = input.reviewQueue || cvShape.reviewQueue || frd?.reviewQueue || [];
  const readiness = buildReviewReadinessReport(cvShape, {
    toClassifyCount: input.toClassifyCount ?? 0,
  });

  const placeholderAudit = frd ? auditFinalCvPlaceholders(frd) : { violations: [] };
  const detectedIssues = buildDetectedIssues(reviewQueue, placeholderAudit);
  const missingSections = buildMissingSections(readiness, cvShape);
  const lowConfidenceFields = buildLowConfidenceFields(cvShape, cvShape.meta?.fieldConfidenceV2);

  const fieldScored = scoreCvFieldConfidence(cvShape);
  const overallConfidence = fieldScored.overall;
  const extractionQuality =
    input.importQualityScore != null ? Number(input.importQualityScore) : overallConfidence;

  const hasPlaceholderViolations = (placeholderAudit.violations || []).length > 0;
  const hasCriticalMissing = missingSections.some((s) =>
    ['name', 'email', 'experience'].includes(s.id)
  );
  const hasLowConfidence = lowConfidenceFields.length > 0 || overallConfidence < RECOVERY_LOW_CONFIDENCE_MIN;
  const hasPendingIssues = detectedIssues.length > 0;

  const contractRenderable = input.contract?.renderable !== false && !!frd;
  const outputSafe =
    contractRenderable &&
    !hasPlaceholderViolations &&
    !hasCriticalMissing &&
    readiness.exportReady !== false &&
    overallConfidence >= 40;

  const blockRender =
    hasPlaceholderViolations ||
    (!norm(cvShape.name) && !norm(cvShape.email)) ||
    isUncertainIdentityName(cvShape.name);

  const showRecovery =
    hasLowConfidence || hasPendingIssues || missingSections.length > 0 || !outputSafe || blockRender;

  const silentFailurePrevented = showRecovery;

  return {
    version: EXTRACTION_RECOVERY_V1,
    ready: true,
    showRecovery,
    silentFailurePrevented,
    outputSafe,
    blockRender,
    overallConfidence,
    extractionQuality,
    confidenceTier: confidenceTier(overallConfidence),
    detectedIssues,
    missingSections,
    lowConfidenceFields,
    counts: {
      issues: detectedIssues.length,
      missing: missingSections.length,
      lowConfidence: lowConfidenceFields.length,
    },
    readiness,
    placeholderAudit,
    fieldConfidence: {
      version: EXTRACTION_FIELD_CONFIDENCE_V2,
      threshold: FIELD_REVIEW_THRESHOLD,
      overall: fieldScored.overall,
      flaggedCount: fieldScored.flaggedCount,
    },
    tiers: {
      engine: EXTRACTION_CONFIDENCE_TIERS_V1,
      low: CONFIDENCE_TIER.LOW,
      medium: CONFIDENCE_TIER.MEDIUM,
      high: CONFIDENCE_TIER.HIGH,
    },
    message: showRecovery
      ? 'Extraction needs your review before this CV is export-ready.'
      : 'Extraction confidence is sufficient.',
  };
}

/**
 * @param {object|null} report
 */
export function isCvOutputSafe(report) {
  return !!(report && report.outputSafe && !report.blockRender);
}

/**
 * @param {object|null} report
 */
export function shouldShowExtractionRecovery(report) {
  return !!(report && report.showRecovery);
}

function mergeDetectedIssues(baseIssues = [], gateIssues = []) {
  const seen = new Set();
  const out = [];
  for (const item of [...gateIssues, ...baseIssues]) {
    const key = `${item.code || ''}::${item.field || ''}::${item.message || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Full recovery report — merges extraction recovery, preview gate, diagnostics, and guidance.
 * @param {object} input
 */
export function buildMergedExtractionRecoveryReport(input = {}) {
  const frd = input.finalResumeData || null;
  const cvShape =
    input.cvData && typeof input.cvData === 'object'
      ? input.cvData
      : finalResumeToCvShape(frd);

  const base = runExtractionRecovery({
    finalResumeData: frd,
    cvData: cvShape,
    reviewQueue: input.reviewQueue,
    contract: input.contract,
    importQualityScore: input.importQualityScore,
    toClassifyCount: input.toClassifyCount,
  });

  const previewGate =
    input.previewGate ||
    assessPreviewRenderGate(cvShape, {
      bridgeLocked: input.bridgeLocked === true,
      extractionUnstructured: input.extractionUnstructured === true,
      rawTextLength: Number(input.rawTextLength) || 0,
      userConfirmedPartial: input.userConfirmedPartial === true,
      recoveryOverrides: input.recoveryOverrides || null,
    });

  const diagnostics = buildExtractionRecoveryContext({
    resumeData: frd,
    metadata: frd?.meta || input.metadata || null,
    enterprise: input.enterprise || null,
    runtime: input.runtime || null,
    missingSections: base.missingSections,
  });

  const guidance = buildRecoveryGuidanceSummary({
    previewGate,
    diagnostics,
  });

  const gateIssues = guidance.issues.map((i) => ({
    id: i.id,
    field: i.field,
    code: i.code,
    message: i.message,
    title: i.title,
    hint: i.hint,
    detail: i.detail,
    severity: i.severity,
    actions: i.actions,
    sourceText: i.value || i.detail || '',
    confidence: i.severity === 'critical' ? 0 : 40,
    action: i.actions?.[0] || 'edit',
    status: 'pending',
    userFacing: true,
    source: i.source,
  }));

  const blockRender = base.blockRender || previewGate.blockPremiumRender === true;
  const showRecovery =
    base.showRecovery || previewGate.blockPremiumRender || gateIssues.length > 0;

  const detectedIssues = mergeDetectedIssues(base.detectedIssues, gateIssues);
  const debug = buildExtractionRecoveryDebugObject({
    previewGate,
    guidance,
    resumeData: frd,
    metadata: frd?.meta || input.metadata,
    enterprise: input.enterprise,
    runtime: input.runtime,
  });

  return {
    ...base,
    showRecovery,
    blockRender,
    outputSafe: base.outputSafe && !previewGate.blockPremiumRender,
    previewGate,
    guidance,
    diagnostics,
    debug,
    detectedIssues,
    recoveryMode: previewGate.blockPremiumRender === true,
    primaryActions: guidance.primaryActions,
    suggestions: guidance.suggestions,
    confidenceSummary: {
      overall: base.overallConfidence,
      tier: base.confidenceTier,
      extractionMethod: diagnostics.extractionMethod,
      parserInputSource: diagnostics.parserInputSource,
      ocrCompleted: diagnostics.ocrCompleted,
      positionedLineCount: diagnostics.positionedLineCount,
      spatialBlockCount: diagnostics.spatialBlockCount,
    },
    counts: {
      ...base.counts,
      issues: detectedIssues.length,
      gateIssues: gateIssues.length,
      suggestions: (guidance.suggestions || []).length,
    },
    message: guidance.lead || base.message,
  };
}
