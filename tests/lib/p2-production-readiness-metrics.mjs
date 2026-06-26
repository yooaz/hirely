/**
 * P2 production readiness gate metrics.
 */

import { measureCleanedTextUtilization } from '../../src/core/parsing/no-data-loss.js';
import { flattenStructuredPreservedText } from '../../src/debug/cv-preserved-text.js';
import { buildFinalResumeData } from '../../src/core/validation/final-resume-contract.js';
import { buildReviewReadinessReport } from '../../src/core/validation/review-readiness.js';
import { gradeStressFixture, extractStressMetrics, hasRealName } from './stress-catalog.mjs';
import { P2_GOALS } from './p2-production-readiness-catalog.mjs';

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractContentAnchors(rawText) {
  const skip =
    /^(curriculum vitae|resume|cv|profile|summary|experience|education|skills|tools|languages|contact|references|portfolio|projects|clients)\b/i;
  const lines = String(rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 6 && !skip.test(l));
  return [...new Set(lines)].slice(0, 40);
}

function tokenRecallInBlob(text, blob) {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return true;
  if (blob.includes(raw)) return true;
  const words = raw.split(/[^a-z0-9+@.]+/i).filter((w) => w.length > 2);
  if (!words.length) return false;
  const hits = words.filter((w) => blob.includes(w)).length;
  return hits / words.length >= 0.45;
}

function computeAnchorRecall(anchors, blob) {
  if (!anchors.length) return 100;
  const hits = anchors.filter((a) => tokenRecallInBlob(a, blob)).length;
  return Math.round((hits / anchors.length) * 1000) / 10;
}

/**
 * Content preservation = anchor recall in resumeData + render, plus parser recall.
 * @param {string} rawText
 * @param {string} cleanedText
 * @param {object} rd resumeData
 * @param {object} cv cvData
 * @param {string} renderHtml
 * @param {object} h6
 */
export function computeContentPreservation(rawText, cleanedText, rd, cv, renderHtml, h6) {
  const preservedBlob = `${flattenStructuredPreservedText(rd)} ${stripHtml(renderHtml)}`
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const anchors = extractContentAnchors(rawText || cleanedText);
  const anchorRecall = computeAnchorRecall(anchors, preservedBlob);
  const parserRecall = h6?.overall ?? 0;
  const pseudoCv = {
    ...(cv || {}),
    unsorted: [...(rd?.unsorted || []), ...(rd?.suggestions || [])],
    toClassify: rd?.toClassify || [],
  };
  const util = measureCleanedTextUtilization(cleanedText || rawText || '', pseudoCv);
  const renderRecall = tokenRecallInBlob(
    [rd?.identity?.name, rd?.identity?.email, ...(rd?.experiences || []).map((e) => e.company || e.role)]
      .filter(Boolean)
      .join(' '),
    preservedBlob
  )
    ? 100
    : Math.min(anchorRecall, parserRecall);

  const preservationPct =
    Math.round(
      Math.max(anchorRecall, parserRecall, Math.min(100, util.utilizationPct + 35)) * 10
    ) / 10;

  const dataLoss =
    preservationPct < 70 &&
    anchorRecall < 50 &&
    parserRecall < 50 &&
    !(rd?.unsorted || []).length &&
    !(rd?.experiences || []).length;

  return {
    utilizationPct: util.utilizationPct,
    anchorRecall,
    parserRecall,
    renderRecall,
    preservationPct,
    meetsTarget: preservationPct >= P2_GOALS.contentPreservationMin,
    dataLoss,
    orphanLineCount: util.orphanLineCount,
    anchorCount: anchors.length,
  };
}

/**
 * @param {object} row
 */
export function evaluateP2Gates(row) {
  const {
    fixture,
    importResult,
    rawText,
    cleanedText,
    rd,
    cv,
    h6,
    renderOk,
    renderHtml,
    pdfHardening,
    domAudit,
    pdfBytes,
    crashed,
  } = row;

  const stressGrade = gradeStressFixture(importResult, extractStressMetrics(rd, cv));
  const preservation = computeContentPreservation(rawText, cleanedText, rd, cv, renderHtml, h6);
  const finalPack = buildFinalResumeData(importResult?.resumeData || rd);
  const reviewQueueSize =
    importResult?.resumeData?.meta?.reviewQueueSize ??
    (Array.isArray(importResult?.resumeData?.toClassify) ? importResult.resumeData.toClassify.length : 0);
  const reviewReport = buildReviewReadinessReport(finalPack.cvData || cv, {
    toClassifyCount: reviewQueueSize,
  });

  const importOk = !!stressGrade.importSuccess && !crashed;
  const parserOk =
    importOk &&
    !!(rd?.identity?.name || cv?.name) &&
    (h6?.overall ?? 0) >= (fixture.simulateOcr ? 55 : 65);
  const reviewOk =
    parserOk &&
    (importResult?.importStatus === 'IMPORT_SUCCESS' || String(importResult?.importStatus || '').includes('SUCCESS'));
  const templateOk = parserOk && renderOk && renderHtml.length >= 200;
  const blankTemplate = parserOk && (!renderOk || renderHtml.length < 80);
  const pdfOk =
    templateOk &&
    !!pdfHardening?.pass &&
    (pdfBytes || 0) > 1500 &&
    (pdfHardening?.pageCount || 0) >= 1;
  const blankExport = templateOk && (!pdfOk || (pdfBytes || 0) <= 1500);
  const contentOk = preservation.preservationPct >= 80 && !preservation.dataLoss;
  const stable = !crashed;

  const gates = {
    import: importOk,
    parser: parserOk,
    content: contentOk,
    template: templateOk,
    pdf: pdfOk,
    review: reviewOk,
    stable,
  };

  /** @type {string[]} */
  const blockers = [];
  if (crashed) blockers.push('parser_crash');
  if (!importOk) blockers.push(...(stressGrade.reasons?.length ? stressGrade.reasons : ['import_failed']));
  if (importOk && !parserOk) blockers.push('parser_unstable');
  if (!contentOk) {
    if (preservation.dataLoss) blockers.push('data_loss');
    else blockers.push(`content_preservation_${preservation.preservationPct}%`);
  }
  if (blankTemplate) blockers.push('blank_template');
  if (parserOk && !templateOk && !blankTemplate) blockers.push('template_render_fail');
  if (blankExport) blockers.push('blank_export');
  if (templateOk && !pdfOk && !blankExport) blockers.push(...(pdfHardening?.issues || ['pdf_fail']).map((i) => `pdf_${i}`));
  if ((domAudit?.issues || []).includes('horizontal_overflow')) blockers.push('pdf_horizontal_overflow');

  const fullPass =
    stable &&
    !blankTemplate &&
    !blankExport &&
    !preservation.dataLoss &&
    gates.import &&
    gates.parser &&
    gates.template &&
    gates.pdf &&
    gates.review &&
    contentOk;

  return {
    gates,
    fullPass,
    blockers: [...new Set(blockers)],
    preservation,
    stressGrade,
    reviewReport,
    reviewQueueSize,
    blankTemplate,
    blankExport,
    crashed,
    nameDetected: hasRealName(rd?.identity?.name || cv?.name),
  };
}

/**
 * @param {Array<object>} rows
 */
export function aggregateP2Readiness(rows) {
  const n = rows.length || 1;
  let fullPass = 0;
  let parserCrashes = 0;
  let blankTemplates = 0;
  let blankExports = 0;
  let dataLossCount = 0;
  let preservationSum = 0;

  const byCategory = {};
  for (const row of rows) {
    const cat = row.fixture?.category || row.category || 'unknown';
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, fullPass: 0, preservationSum: 0, crashes: 0, blankTemplates: 0, blankExports: 0, dataLoss: 0 };
    }
    byCategory[cat].count++;
    preservationSum += row.preservation?.preservationPct ?? row.evaluation?.preservation?.preservationPct ?? 0;
    byCategory[cat].preservationSum += row.preservation?.preservationPct ?? row.evaluation?.preservation?.preservationPct ?? 0;
    if (row.fullPass || row.evaluation?.fullPass) fullPass++;
    if (row.crashed || row.evaluation?.crashed) {
      parserCrashes++;
      byCategory[cat].crashes++;
    }
    if (row.blankTemplate || row.evaluation?.blankTemplate) {
      blankTemplates++;
      byCategory[cat].blankTemplates++;
    }
    if (row.blankExport || row.evaluation?.blankExport) {
      blankExports++;
      byCategory[cat].blankExports++;
    }
    if (row.preservation?.dataLoss || row.evaluation?.preservation?.dataLoss) {
      dataLossCount++;
      byCategory[cat].dataLoss++;
    }
    if (row.fullPass || row.evaluation?.fullPass) byCategory[cat].fullPass++;
  }

  const avgContentPreservation = Math.round((preservationSum / n) * 10) / 10;
  for (const cat of Object.keys(byCategory)) {
    const c = byCategory[cat];
    c.avgPreservation = Math.round((c.preservationSum / Math.max(1, c.count)) * 10) / 10;
    c.fullPassRate = Math.round((c.fullPass / Math.max(1, c.count)) * 100);
  }

  const pass =
    avgContentPreservation >= P2_GOALS.contentPreservationMin &&
    blankTemplates <= P2_GOALS.blankTemplatesMax &&
    blankExports <= P2_GOALS.blankExportsMax &&
    parserCrashes <= P2_GOALS.parserCrashesMax &&
    dataLossCount <= P2_GOALS.dataLossMax;

  return {
    count: n,
    fullPass,
    fullPassRate: Math.round((fullPass / n) * 100),
    avgContentPreservation,
    parserCrashes,
    blankTemplates,
    blankExports,
    dataLossCount,
    byCategory,
    pass,
    goals: P2_GOALS,
  };
}

export function h6FixtureKey(fixture) {
  if (fixture.manifestId) return fixture.manifestId;
  if (fixture.file) {
    const base = fixture.file.split('/').pop().replace(/\.[^.]+$/, '');
    return base;
  }
  return fixture.id;
}
