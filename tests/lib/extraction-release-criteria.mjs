/**
 * Extraction release criteria — single source of truth for npm test / CI.
 */

import { buildProductionAudit } from '../../src/core/validation/production-audit.js';
import { buildParserCoverageReport } from '../../src/core/parsing/parser-coverage-report.js';
import { runSectionEngineV2 } from '../../src/core/parsing/section-engine-v2.js';
import { runResumeGraphEngine } from '../../src/core/parsing/resume-graph-engine.js';
import { postProcessOcrText } from '../../src/core/parsing/ocr-postprocess.js';
import {
  detectCreativeCvMode,
} from '../../src/core/parsing/creative-cv-mode.js';
import {
  isValidIdentityName,
} from '../../src/core/parsing/identity-extraction.js';
import { NAME_UNCERTAIN_LABEL } from '../../src/core/parsing/parser-recovery.js';

export const EXTRACTION_RELEASE_THRESHOLDS = {
  coverageMinPct: 90,
  experienceMin: 1,
  parserLossMaxPct: 5,
  pipelineLossMax: 0,
  identityRequired: true,
};

/** Simulated scanned PDF OCR output (no browser). */
export const SCANNED_OCR_FIXTURE = `Yohann Azancot
Graphic Designer
yoaz@hotmail.fr
+33 6 49 43 48 39
Experience
Lead Illustrator — Independent — 2011–Present
Nike, Adobe, Louis Vuitton
Education
LISAA — Web & Motion Design
Skills
Illustration, Graphic Design, Visual Identity`;

/**
 * Parse text through SECTION_ENGINE_V2 + graph JSON.
 * @param {string} raw
 * @param {object} [opts]
 */
export function parseTextForRelease(raw, opts = {}) {
  const text = String(raw || '').trim();
  const cleaned = opts.ocr
    ? postProcessOcrText(text, { ocr: true })
    : text;
  const engine = runSectionEngineV2(cleaned, {
    rawText: text,
    extractionMethod: opts.extractionMethod || 'paste',
  });
  const structured = engine.structured;
  const resumeJson =
    engine.resumeJson ||
    runResumeGraphEngine(structured, {}).resumeJson;
  return { cleaned, engine, structured, resumeJson };
}

/**
 * @param {string} raw
 * @param {object} structured
 * @param {object} resumeJson
 */
export function measureExtractionMetrics(raw, structured, resumeJson) {
  const clean = String(structured?.metadata?.cleanedText || raw).trim();
  const coverage = buildParserCoverageReport(clean, structured, { rawText: raw });
  const audit = buildProductionAudit(clean, structured, { rawText: raw });
  const zero = structured?.metadata?.zeroTextLossAudit;
  const parserLossPct =
    zero?.balanced === true
      ? 0
      : Math.max(
          0,
          Math.round((100 - coverage.coveragePercent) * 10) / 10
        );

  const name = String(structured?.identity?.name || resumeJson?.name || '').trim();
  const identityOk =
    name.length > 0 &&
    name !== NAME_UNCERTAIN_LABEL &&
    isValidIdentityName(name);

  return {
    coveragePercent: coverage.coveragePercent,
    experienceCount: coverage.experienceCount,
    skillsCount: coverage.skillsCount,
    languageCount: (structured?.languages || []).length,
    pipelineLoss: audit.pipelineLoss,
    parserLossPct,
    zeroTextLossBalanced: audit.zeroTextLossBalanced,
    identityOk,
    name,
    title: String(structured?.identity?.title || resumeJson?.title || '').trim(),
  };
}

/**
 * @param {object} metrics
 * @param {object} [extra]
 */
export function evaluateReleaseMetrics(metrics, extra = {}) {
  const failures = [];
  const t = EXTRACTION_RELEASE_THRESHOLDS;

  if (metrics.coveragePercent <= t.coverageMinPct) {
    failures.push(`coverage ${metrics.coveragePercent}% ≤ ${t.coverageMinPct}%`);
  }
  if (metrics.experienceCount < t.experienceMin) {
    failures.push(`experience count ${metrics.experienceCount} < ${t.experienceMin}`);
  }
  if (t.identityRequired && !metrics.identityOk) {
    failures.push(`identity not detected (name="${metrics.name}")`);
  }
  if (metrics.pipelineLoss > t.pipelineLossMax) {
    failures.push(`pipeline loss ${metrics.pipelineLoss} > ${t.pipelineLossMax}`);
  }
  if (metrics.parserLossPct >= t.parserLossMaxPct) {
    failures.push(`parser loss ${metrics.parserLossPct}% ≥ ${t.parserLossMaxPct}%`);
  }
  if (metrics.zeroTextLossBalanced === false) {
    failures.push('zero text loss not balanced');
  }

  for (const f of extra.failures || []) failures.push(f);

  return {
    pass: failures.length === 0,
    failures,
    metrics,
  };
}

/**
 * Designer CV — YOAZ golden bar.
 * @param {string} raw
 */
export function evaluateDesignerCv(raw) {
  const { structured, resumeJson } = parseTextForRelease(raw);
  const metrics = measureExtractionMetrics(raw, structured, resumeJson);
  const extra = { failures: [] };
  const title = metrics.title.toLowerCase();
  if (!title.includes('graphic designer')) {
    extra.failures.push(`title missing "Graphic Designer" (got "${metrics.title}")`);
  }
  if (!title.includes('illustrator')) {
    extra.failures.push(`title missing "Illustrator" (got "${metrics.title}")`);
  }
  if (metrics.name !== 'Yohann Azancot') {
    extra.failures.push(`name expected "Yohann Azancot" got "${metrics.name}"`);
  }
  if ((structured?.experiences || []).length < 10) {
    extra.failures.push(
      `designer experience ${(structured?.experiences || []).length} < 10`
    );
  }
  if (metrics.skillsCount < 10) {
    extra.failures.push(`skills ${metrics.skillsCount} < 10`);
  }
  if (metrics.languageCount < 1) {
    extra.failures.push('languages < 1');
  }
  if (structured?.metadata?.neverBuildJsonFromOcr !== true) {
    extra.failures.push('JSON must come from graph engine');
  }
  return evaluateReleaseMetrics(metrics, extra);
}

/**
 * Creative CV fixture.
 * @param {string} raw
 */
export function evaluateCreativeCv(raw) {
  const mode = detectCreativeCvMode(raw);
  const { structured, resumeJson } = parseTextForRelease(raw);
  const metrics = measureExtractionMetrics(raw, structured, resumeJson);
  const extra = { failures: [] };
  if (!mode.active) extra.failures.push('CREATIVE_CV_MODE not active');
  if (!(structured.clients || []).length) {
    extra.failures.push('clients empty');
  }
  if (!(structured.experiences || []).length) {
    extra.failures.push('no experiences in creative CV');
  }
  const expHay = (structured.experiences || [])
    .map((e) => `${e.role} ${e.company}`)
    .join('\n');
  if (/^(Adobe|Nike),?$/im.test(expHay)) {
    extra.failures.push('standalone brand rows in experience');
  }
  return evaluateReleaseMetrics(metrics, extra);
}

/**
 * Scanned PDF path — OCR post-process + parse (no browser).
 */
export function evaluateScannedPdfPath() {
  const raw = SCANNED_OCR_FIXTURE;
  const { structured, resumeJson } = parseTextForRelease(raw, {
    ocr: true,
    extractionMethod: 'ocr',
  });
  const metrics = measureExtractionMetrics(raw, structured, resumeJson);
  const extra = { failures: [] };
  if (!/yohann/i.test(metrics.name)) {
    extra.failures.push('scanned path: name not detected');
  }
  if (!/designer|illustrator/i.test(metrics.title)) {
    extra.failures.push('scanned path: title missing');
  }
  return evaluateReleaseMetrics(metrics, extra);
}
