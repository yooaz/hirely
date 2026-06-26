/**
 * PRODUCTION_AUDIT — release-quality gate on parser output.
 */

import { buildParserCoverageReport } from '../parsing/parser-coverage-report.js';
import { buildZeroTextLossAudit, isZeroTextLossMode } from '../parsing/zero-text-loss.js';
import { flattenStructuredFieldsOnly } from '../../debug/cv-preserved-text.js';
import { hirelyDebugLog, hirelyDebugWarn } from '../runtime/hirely-debug.js';

export const PRODUCTION_AUDIT = 'PRODUCTION_AUDIT';

export const PRODUCTION_AUDIT_THRESHOLDS = {
  coverageMinPct: 85,
  structuredCharsMinPct: 85,
  archivedCharsMaxPct: 15,
  experienceMin: 1,
  pipelineLossMax: 0,
};

/**
 * @param {object} structured
 */
function countRecoveredItems(structured) {
  const meta = structured?.metadata || {};
  let count = 0;

  const er = meta.experienceRecovery;
  if (er?.draftCount > 0) count += er.draftCount;
  else if (Array.isArray(er?.drafts)) count += er.drafts.length;

  if (meta.experienceRecovery?.recovered === true && er?.draftCount > 0) {
    count = Math.max(count, er.draftCount);
  }

  return count;
}

/**
 * @param {object} structured
 */
function countArchivedItems(structured) {
  const archive = [
    ...(structured?.unsortedArchive || []),
    ...(structured?.metadata?.unsortedArchive || []),
    ...(structured?.metadata?.UNSORTED_ARCHIVE || []),
  ];
  const unsorted = structured?.unsorted || [];
  const archiveTexts = new Set(
    archive
      .map((x) => (typeof x === 'string' ? x : x?.text || ''))
      .map((t) => t.trim())
      .filter(Boolean)
  );
  let count = archiveTexts.size;
  for (const line of unsorted) {
    const t = String(line || '').trim();
    if (t && !archiveTexts.has(t)) count += 1;
  }
  return count;
}

/**
 * Visible unsorted lines only (user-facing archive queue).
 * @param {object} structured
 */
function unsortedVisibleCharCount(structured) {
  return (structured?.unsorted || [])
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .reduce((sum, line) => sum + line.length, 0);
}

/**
 * @param {object} report
 */
export function evaluateProductionAuditPass(report) {
  const checks = {
    coverage: report.coveragePercent > PRODUCTION_AUDIT_THRESHOLDS.coverageMinPct,
    experience: report.experienceCount >= PRODUCTION_AUDIT_THRESHOLDS.experienceMin,
    structuredChars:
      report.structuredCharsPct > PRODUCTION_AUDIT_THRESHOLDS.structuredCharsMinPct,
    pipelineLoss: report.pipelineLoss <= PRODUCTION_AUDIT_THRESHOLDS.pipelineLossMax,
    archivedChars:
      report.archivedCharsPct < PRODUCTION_AUDIT_THRESHOLDS.archivedCharsMaxPct,
  };
  const pass = Object.values(checks).every(Boolean);
  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  return { pass, checks, failures };
}

/**
 * @param {string} cleanedText
 * @param {object} structured
 * @param {object} [opts]
 */
export function buildProductionAudit(cleanedText, structured, opts = {}) {
  const clean = String(cleanedText || '').trim();
  const raw = String(opts.rawText || structured?.rawExtraction || clean).trim();
  const coverage = buildParserCoverageReport(clean, structured, { rawText: raw });

  const zeroLoss =
    structured?.metadata?.zeroTextLossAudit ||
    (isZeroTextLossMode() && raw ? buildZeroTextLossAudit(raw, structured) : null);

  const rawChars = Math.max(1, zeroLoss?.rawChars ?? coverage.rawChars ?? raw.length);
  const partitionStructured = zeroLoss?.structuredChars ?? coverage.structuredChars ?? 0;
  const partitionArchived = zeroLoss?.archivedChars ?? coverage.archivedChars ?? 0;
  const cleanChars = Math.max(1, coverage.cleanChars ?? clean.length);
  const fieldsFlattenChars = flattenStructuredFieldsOnly(structured).length;
  const visibleArchiveChars = unsortedVisibleCharCount(structured);

  const structuredChars = fieldsFlattenChars;
  const archivedChars = visibleArchiveChars;

  const structuredCharsPct = Math.min(
    100,
    Math.round((fieldsFlattenChars / cleanChars) * 1000) / 10
  );
  const archivedCharsPct = Math.min(
    100,
    Math.round((visibleArchiveChars / cleanChars) * 1000) / 10
  );
  const pipelineLoss =
    zeroLoss?.lossChars ??
    coverage.lossChars ??
    Math.max(0, rawChars - partitionStructured - partitionArchived);

  const report = {
    engine: PRODUCTION_AUDIT,
    coveragePercent: coverage.coveragePercent,
    experienceCount: coverage.experienceCount,
    educationCount: coverage.educationCount,
    skillsCount: coverage.skillsCount,
    recoveredItems: countRecoveredItems(structured),
    archivedItems: countArchivedItems(structured),
    structuredChars,
    structuredCharsPct,
    archivedChars,
    archivedCharsPct,
    rawChars,
    cleanChars,
    pipelineLoss,
    zeroTextLossBalanced: zeroLoss?.balanced ?? coverage.zeroTextLossBalanced ?? null,
    thresholds: { ...PRODUCTION_AUDIT_THRESHOLDS },
  };

  const verdict = evaluateProductionAuditPass(report);
  report.pass = verdict.pass;
  report.checks = verdict.checks;
  report.failures = verdict.failures;

  return report;
}

/**
 * @param {object} report
 */
export function formatProductionAuditDisplay(report) {
  const status = report.pass ? 'PASS' : 'FAIL';
  return {
    Coverage: `${report.coveragePercent}%`,
    'Experience count': report.experienceCount,
    'Education count': report.educationCount,
    'Skills count': report.skillsCount,
    'Recovered items': report.recoveredItems,
    'Archived items': report.archivedItems,
    'Structured chars': `${report.structuredCharsPct}%`,
    'Archived chars': `${report.archivedCharsPct}%`,
    'Pipeline loss': report.pipelineLoss,
    Status: status,
  };
}

/**
 * @param {string} cleanedText
 * @param {object} structured
 * @param {object} [opts]
 */
export function logProductionAudit(cleanedText, structured, opts = {}) {
  const report = buildProductionAudit(cleanedText, structured, opts);
  hirelyDebugLog('PRODUCTION_AUDIT', formatProductionAuditDisplay(report));
  if (!report.pass) {
    hirelyDebugWarn('PRODUCTION_AUDIT_FAIL', {
      failures: report.failures,
      checks: report.checks,
    });
  }
  return report;
}

/**
 * @param {string} cleanedText
 * @param {object} structured
 * @param {object} [opts]
 */
export function runProductionAudit(cleanedText, structured, opts = {}) {
  const report = buildProductionAudit(cleanedText, structured, opts);
  if (opts.log !== false) {
    hirelyDebugLog('PRODUCTION_AUDIT', formatProductionAuditDisplay(report));
    if (!report.pass) {
      hirelyDebugWarn('PRODUCTION_AUDIT_FAIL', {
        failures: report.failures,
        checks: report.checks,
      });
    }
  }
  if (opts.strict && !report.pass) {
    throw new Error(
      `PRODUCTION_AUDIT_FAILED: ${report.failures.join(', ')} (${report.coveragePercent}% coverage, exp=${report.experienceCount})`
    );
  }
  return report;
}
