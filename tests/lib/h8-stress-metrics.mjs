/**
 * H8 generalization stress — extraction + pipeline stage metrics.
 */
import { evaluateGenericUsability } from './p1-generic-stress-metrics.mjs';

export const H8_EXTRACTION_GOAL_PCT = 95;

/**
 * @param {string} rawText — canonical source (pre-OCR noise)
 * @param {object} resumeData
 * @param {object} cvData
 */
export function evaluateExtractionSuccess(rawText, resumeData, cvData) {
  const usability = evaluateGenericUsability(rawText, resumeData, cvData);
  return {
    success: usability.usable,
    failures: usability.failures,
    checks: usability.checks,
  };
}

/**
 * @param {object} row
 */
export function evaluatePipelineStages(row) {
  const stages = {
    ocr: row.ocrOk !== false,
    parser: row.parserOk !== false,
    normalizer: row.normalizerOk !== false,
    renderer: row.renderOk === true,
    pdf: row.pdfOk === true,
  };
  const pipelinePass = Object.values(stages).every(Boolean);
  return { stages, pipelinePass };
}

/**
 * @param {Array<object>} rows
 */
export function aggregateH8Stress(rows) {
  const n = rows.length || 1;
  const extracted = rows.filter((r) => r.extraction?.success).length;
  const extractionRate = Math.round((extracted / n) * 1000) / 10;
  const pipelinePass = rows.filter((r) => r.pipeline?.pipelinePass).length;
  const pipelineRate = Math.round((pipelinePass / n) * 1000) / 10;

  const byArchetype = {};
  for (const r of rows) {
    byArchetype[r.archetype] = byArchetype[r.archetype] || { total: 0, extracted: 0, pipeline: 0 };
    byArchetype[r.archetype].total++;
    if (r.extraction?.success) byArchetype[r.archetype].extracted++;
    if (r.pipeline?.pipelinePass) byArchetype[r.archetype].pipeline++;
  }

  const failureCauses = {};
  for (const r of rows) {
    for (const f of r.extraction?.failures || []) {
      failureCauses[f] = (failureCauses[f] || 0) + 1;
    }
    if (!r.pipeline?.stages?.pdf) failureCauses.pdf_export = (failureCauses.pdf_export || 0) + 1;
    if (!r.pipeline?.stages?.renderer) failureCauses.render = (failureCauses.render || 0) + 1;
  }

  return {
    count: n,
    extracted,
    extractionRate,
    pipelinePass,
    pipelineRate,
    pass: extractionRate >= H8_EXTRACTION_GOAL_PCT,
    goal: H8_EXTRACTION_GOAL_PCT,
    byArchetype,
    failureCauses: Object.entries(failureCauses)
      .sort((a, b) => b[1] - a[1])
      .map(([cause, count]) => ({ cause, count })),
  };
}
