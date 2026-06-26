/**
 * Import Quality Score — three real pipeline metrics (0–100 each).
 * Extraction Quality · Parser Quality · CV Completeness
 */

import { assessImportQuality } from './extraction-quality.js';
import { structuredCompleteness } from '../parsing/field-sanitize.js';
import { assessFieldCompleteness } from '../parsing/field-completeness-gate.js';

export const IMPORT_QUALITY_SCORE_V1 = 'IMPORT_QUALITY_SCORE_V1';

const WEIGHTS = Object.freeze({
  extraction: 0.35,
  parser: 0.34,
  completeness: 0.31,
});

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function avgSectionConfidence(cvData, structuredResume, audit) {
  const sectionConf =
    cvData?.sectionConfidence ||
    structuredResume?.sectionConfidence ||
    audit?.extractionReport?.sectionConfidence ||
    {};
  const values = Object.values(sectionConf).filter((n) => typeof n === 'number' && n > 0);
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function checklistCompletenessPct(recruiterScore) {
  const list = recruiterScore?.checklist;
  if (!Array.isArray(list) || !list.length) return null;
  const ok = list.filter((item) => item?.ok).length;
  return Math.round((ok / list.length) * 100);
}

/**
 * @param {object} [input]
 * @returns {object|null}
 */
export function computeImportQualityScore(input = {}) {
  const rawText = String(input.rawText || '');
  const cleanedText = String(input.cleanedText || rawText);
  const cvData = input.cvData || null;
  const structuredResume = input.structuredResume || null;
  const audit = input.audit || {};
  const pipeline = input.pipeline || {};

  if (!cvData && !rawText.trim() && !cleanedText.trim()) return null;

  const importQuality =
    input.importQuality ||
    audit.importQuality ||
    assessImportQuality({
      rawText,
      cleanedText,
      cvData,
      structuredResume,
      audit,
      extractionMethod: input.extractionMethod || audit.extractionMethod || pipeline.method,
    });

  const fieldCompleteness =
    input.fieldCompleteness ||
    audit.fieldCompleteness ||
    assessFieldCompleteness(cvData || {}, rawText, cleanedText);

  const metrics = importQuality.metrics || {};
  const retentionPct =
    pipeline.retention?.retentionPct ??
    audit.contentUtilizationPct ??
    audit.extractionReport?.retentionPercentage ??
    null;
  const extractionStageScore =
    pipeline.stages?.score?.extractionScore ??
    audit.extractionScore ??
    audit.extractionReport?.extractionScore ??
    null;
  const readablePct = metrics.readableLineRatio ?? 100;
  const corruptPct = metrics.corruptedTokenRatio ?? 0;
  const reviewN =
    audit.extractionReport?.reviewQueueCount ??
    audit.reviewQueue?.length ??
    (Array.isArray(cvData?.reviewQueue) ? cvData.reviewQueue.length : 0);

  let extraction = importQuality.score;
  if (retentionPct != null) {
    extraction = extraction * 0.55 + retentionPct * 0.45;
  }
  if (extractionStageScore != null) {
    extraction = extraction * 0.7 + extractionStageScore * 0.3;
  }
  extraction = extraction * 0.85 + readablePct * 0.1 + (100 - corruptPct) * 0.05;
  extraction = clamp(extraction);

  let parser = fieldCompleteness.utilizationPct ?? 0;
  const avgConf = avgSectionConfidence(cvData, structuredResume, audit);
  if (avgConf != null) {
    parser = parser * 0.55 + avgConf * 0.45;
  }
  parser -= Math.min(20, reviewN * 4);
  if (fieldCompleteness.parserFail) parser = Math.min(parser, 40);
  if (fieldCompleteness.severeContentLoss) parser = Math.min(parser, 45);
  parser = clamp(parser);

  const struct = structuredCompleteness(cvData || {});
  const fieldFlags = fieldCompleteness.fields || {};
  const fieldKeys = Object.keys(fieldFlags);
  const fieldPct = fieldKeys.length
    ? Math.round((fieldKeys.filter((k) => fieldFlags[k]).length / fieldKeys.length) * 100)
    : 0;
  let completeness = struct.pct * 0.55 + fieldPct * 0.45;
  const checkPct = checklistCompletenessPct(input.recruiterScore);
  if (checkPct != null) {
    completeness = completeness * 0.65 + checkPct * 0.35;
  }
  completeness = clamp(completeness);

  const overall = clamp(
    extraction * WEIGHTS.extraction + parser * WEIGHTS.parser + completeness * WEIGHTS.completeness
  );

  return {
    version: IMPORT_QUALITY_SCORE_V1,
    extraction,
    parser,
    completeness,
    overall,
    weights: { ...WEIGHTS },
    metrics: {
      retentionPct,
      utilizationPct: fieldCompleteness.utilizationPct ?? null,
      structuredCompletenessPct: struct.pct,
      importQualityBase: importQuality.score,
      extractionStageScore,
      readableLineRatio: readablePct,
      corruptedTokenRatio: corruptPct,
      suspiciousLineRatio: metrics.suspiciousLineRatio ?? null,
      reviewQueueCount: reviewN,
      missingSections: struct.missing,
      fieldChecks: fieldFlags,
    },
    breakdown: [
      {
        id: 'extraction',
        label: 'Extraction Quality',
        labelKey: 'iqExtraction',
        points: extraction,
        max: 100,
      },
      {
        id: 'parser',
        label: 'Parser Quality',
        labelKey: 'iqParser',
        points: parser,
        max: 100,
      },
      {
        id: 'completeness',
        label: 'CV Completeness',
        labelKey: 'iqCompleteness',
        points: completeness,
        max: 100,
      },
    ],
  };
}

/**
 * @param {ReturnType<typeof computeImportQualityScore>} report
 */
export function buildImportQualityMetricRows(report) {
  if (!report) return null;
  return [
    ['Extraction', { score: report.extraction }],
    ['Parser', { score: report.parser }],
    ['CV Completeness', { score: report.completeness }],
  ];
}
