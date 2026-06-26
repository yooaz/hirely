/**
 * P7 stress gate metrics — import, parser, review, ATS, PDF.
 */

import { buildFinalResumeData } from '../../src/core/validation/final-resume-contract.js';
import { buildReviewReadinessReport, isExportReady } from '../../src/core/validation/review-readiness.js';
import { computeAtsScore } from '../../src/core/validation/ats-engine.js';
import { gradeStressFixture, extractStressMetrics } from './stress-catalog.mjs';
import { computeH6Metrics } from './h6-stress-metrics.mjs';
import {
  P7_PARSER_RECALL_MIN,
  P7_ATS_SCORE_MIN,
  P7_PIPELINE_GATES,
} from './p7-stress-catalog.mjs';

/**
 * @param {object} row partial pipeline row
 */
export function evaluateP7Gates(row) {
  const {
    fixture,
    importResult,
    rawText,
    rd,
    cv,
    h6,
    finalPack,
    reviewReport,
    atsScore,
    renderOk,
    pdfHardening,
    domAudit,
  } = row;

  const stressGrade = gradeStressFixture(importResult, extractStressMetrics(rd, cv));
  const parserBlocked = (importResult?.errors || []).includes('OCR_PARSER_GATE_BLOCKED');
  const parserRecall = h6?.overall ?? 0;

  const importOk = !!stressGrade.importSuccess;
  const recallMin =
    fixture.extractionMethod === 'pdf-ocr' || fixture.simulateOcr
      ? Math.min(P7_PARSER_RECALL_MIN, 60)
      : P7_PARSER_RECALL_MIN;
  const parserOk =
    importOk &&
    !parserBlocked &&
    !!(rd?.identity?.name || cv?.name) &&
    parserRecall >= recallMin;

  const reviewOk =
    parserOk &&
    !!finalPack?.contract?.ok &&
    !!finalPack?.contract?.renderable &&
    isExportReady(reviewReport);

  const atsTotal = atsScore?.total ?? atsScore?.score ?? 0;
  const atsChecklist = atsScore?.checklist || [];
  const atsBreakdown = atsScore?.breakdown || [];
  const atsEngineOk =
    !!atsScore &&
    Number.isFinite(atsTotal) &&
    atsTotal >= P7_ATS_SCORE_MIN &&
    (atsChecklist.length >= 5 || atsBreakdown.length >= 3);
  const atsOk = reviewOk && atsEngineOk;

  const pdfOk =
    reviewOk &&
    !!renderOk &&
    !!pdfHardening?.pass &&
    !(domAudit?.issues || []).includes('horizontal_overflow');

  const gates = { import: importOk, parser: parserOk, review: reviewOk, ats: atsOk, pdf: pdfOk };
  const fullPass = P7_PIPELINE_GATES.every((g) => gates[g]);

  /** @type {string[]} */
  const blockers = [];
  if (!importOk) blockers.push(...(stressGrade.reasons?.length ? stressGrade.reasons : ['import_failed']));
  if (importOk && !parserOk) {
    if (parserBlocked) blockers.push('OCR_PARSER_GATE_BLOCKED');
    if (parserRecall < P7_PARSER_RECALL_MIN) blockers.push(`parser_recall_${parserRecall}%`);
    if (!(rd?.identity?.name || cv?.name)) blockers.push('name_not_parsed');
  }
  if (parserOk && !reviewOk) {
    if (!finalPack?.contract?.ok) blockers.push(...(finalPack?.contract?.reasons || ['review_contract_fail']));
    if (!isExportReady(reviewReport)) {
      const missing = reviewReport?.missingSections || [];
      if (missing.length) blockers.push(`review_missing:${missing.join(',')}`);
      else blockers.push('review_not_export_ready');
    }
  }
  if (reviewOk && !atsOk) {
    if (!Number.isFinite(atsTotal)) blockers.push('ats_score_invalid');
    else if (!atsEngineOk) blockers.push('ats_engine_failed');
  }
  if (reviewOk && !pdfOk) {
    if (!renderOk) blockers.push('renderer_empty');
    if (pdfHardening?.issues?.length) blockers.push(...pdfHardening.issues.map((i) => `pdf_${i}`));
    if ((domAudit?.issues || []).includes('horizontal_overflow')) blockers.push('pdf_horizontal_overflow');
  }

  return {
    gates,
    fullPass,
    blockers: [...new Set(blockers)],
    stressGrade,
    parserRecall,
    atsTotal,
    reviewCompletionPct: reviewReport?.completionPct ?? 0,
  };
}

/**
 * @param {object} importResult
 * @param {object} rd sanitized resumeData
 * @param {object} cv cvData
 * @param {number} atsTotal
 */
export function buildP7ReviewAndAts(importResult, rd, cv, atsTotal = null) {
  const finalPack = buildFinalResumeData(importResult?.resumeData || rd);
  const cvForReview = finalPack.cvData || cv;
  const atsScore = computeAtsScore(cvForReview, { resumeData: finalPack.finalResumeData || rd });
  const scoreTotal = atsTotal ?? atsScore?.total ?? atsScore?.score ?? 0;
  const reviewReport = buildReviewReadinessReport(cvForReview, {
    atsScore: scoreTotal,
    atsBand: atsScore?.band ?? null,
    toClassifyCount: importResult?.reviewQueue?.length || 0,
  });
  return { finalPack, reviewReport, atsScore };
}

/**
 * @param {Array<{ gates: Record<string, boolean>, blockers: string[], fixture: object }>} rows
 */
export function aggregateP7Stress(rows) {
  const n = rows.length || 1;
  const gateCounts = Object.fromEntries(P7_PIPELINE_GATES.map((g) => [g, 0]));
  let fullPass = 0;

  for (const row of rows) {
    const g = row.gates || row.evaluation?.gates || {};
    for (const key of P7_PIPELINE_GATES) {
      if (g[key]) gateCounts[key]++;
    }
    if (row.fullPass || row.evaluation?.fullPass) fullPass++;
  }

  const rates = Object.fromEntries(
    P7_PIPELINE_GATES.map((g) => [g, Math.round((gateCounts[g] / n) * 100)])
  );

  return {
    count: rows.length,
    gateCounts,
    rates,
    fullPass,
    fullPassRate: Math.round((fullPass / n) * 100),
    successRate: Math.round((fullPass / n) * 100),
    failureRate: Math.round(((n - fullPass) / n) * 100),
  };
}

/**
 * Rank blockers by frequency for remediation priority.
 * @param {Array<{ fixture: object, blockers: string[] }>} rows
 */
export function rankP7Blockers(rows) {
  const counts = new Map();
  const gateWeight = { import: 5, parser: 4, review: 3, ats: 2, pdf: 1 };

  for (const row of rows) {
    const blockers = row.blockers || row.evaluation?.blockers || [];
    for (const b of blockers) {
      const prev = counts.get(b) || { count: 0, fixtures: [] };
      prev.count++;
      prev.fixtures.push(row.fixture?.id || row.id);
      counts.set(b, prev);
    }
  }

  const ranked = [...counts.entries()]
    .map(([issue, meta]) => {
      let weight = 1;
      if (/import|OCR_PARSER|RAW_TEXT/i.test(issue)) weight = gateWeight.import;
      else if (/parser|recall|name_not/i.test(issue)) weight = gateWeight.parser;
      else if (/review/i.test(issue)) weight = gateWeight.review;
      else if (/ats/i.test(issue)) weight = gateWeight.ats;
      else if (/pdf|render/i.test(issue)) weight = gateWeight.pdf;
      return {
        issue,
        count: meta.count,
        fixtures: [...new Set(meta.fixtures)],
        priority: meta.count * weight,
      };
    })
    .sort((a, b) => b.priority - a.priority || b.count - a.count);

  return ranked;
}

/**
 * @param {string} fixtureId ground-truth key (manifestId when OCR variant)
 */
export function h6FixtureKey(fixture) {
  return fixture.manifestId || fixture.id;
}
