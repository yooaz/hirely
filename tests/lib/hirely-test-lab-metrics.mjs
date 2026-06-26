/**
 * Hirely Test Lab — unified metrics across extraction, templates, ATS, PDF.
 */

import { computeP5HellMetrics } from './p5-cv-hell-bench-metrics.mjs';
import { buildH15GroundTruth } from './h15-real-cv-bench-metrics.mjs';
import { buildFinalResumeData } from '../../src/core/validation/final-resume-contract.js';
import { analyzeAts } from '../../src/core/validation/ats-analyzer.js';
import { computeProductScore } from '../../src/core/validation/product-score.js';
import { validateFinalResumeForExport } from '../../src/core/export/export-lock.js';
import { ROLE_TEMPLATE_MAP } from './hirely-test-lab-catalog.mjs';

/**
 * Calibrated ATS target from ground-truth completeness (aligned with ATS Engine Pro scoring).
 * @param {object} groundTruth
 */
export function computeExpectedAtsMin(groundTruth) {
  let target = 52;
  if (groundTruth?.name) target += 5;
  if (groundTruth?.email || groundTruth?.phone) target += 5;
  const expN = (groundTruth?.experience || []).length;
  const skillN = (groundTruth?.skills || []).length;
  if (expN) target += Math.min(12, 6 + expN * 2);
  if ((groundTruth?.education || []).length) target += 4;
  if (skillN) target += Math.min(10, 4 + skillN);
  return Math.min(80, target);
}

/**
 * Heuristic scan-zone proxy without Playwright.
 * @param {object} cvData
 * @param {object} groundTruth
 */
export function computeScanProxy(cvData, groundTruth) {
  const weights = { name: 0.25, title: 0.2, experience: 0.25, contact: 0.15, skills: 0.1, education: 0.05 };
  const id = cvData?.identity || {};
  const name = String(id.name || cvData?.name || '').trim();
  const title = String(id.title || cvData?.title || '').trim();
  const exp = cvData?.experience || cvData?.experiences || [];
  const skills = cvData?.skills || [];
  const edu = cvData?.education || [];
  const contact = [id.email, id.phone, id.location].filter(Boolean).join(' ');

  const scores = {
    name: name && groundTruth?.name && name.toLowerCase().includes(groundTruth.name.split(' ')[0]?.toLowerCase()) ? 1 : name ? 0.6 : 0,
    title: title ? 0.85 : 0,
    experience: exp.length ? Math.min(1, 0.5 + exp.length * 0.15) : 0,
    contact: contact ? 0.8 : 0,
    skills: skills.length ? Math.min(1, 0.4 + skills.length * 0.08) : 0,
    education: edu.length ? 0.75 : 0,
  };

  let total = 0;
  for (const [field, w] of Object.entries(weights)) {
    total += w * (scores[field] ?? 0);
  }
  return Math.round(total * 100) / 100;
}

/**
 * @param {import('./hirely-test-lab-catalog.mjs').TestLabFixture} entry
 * @param {string} canonicalText
 * @param {object} importResult
 */
export function computeTestLabMetrics(entry, canonicalText, importResult) {
  const p5 = computeP5HellMetrics(
    {
      ...entry,
      fixtureKey: entry.fixtureKey || entry.manifestId || entry.id,
      manifestId: entry.manifestId || entry.fixtureKey,
    },
    canonicalText,
    importResult
  );

  const built = buildFinalResumeData(importResult?.resumeData || {}, {
    rawText: canonicalText,
    cleanedText: canonicalText,
    existingReview: importResult?.reviewQueue || [],
    silent: true,
  });

  const groundTruth = buildH15GroundTruth(
    {
      ...entry,
      fixtureKey: entry.fixtureKey || entry.manifestId || entry.id,
    },
    canonicalText
  );

  const cvData = built.cvData || importResult?.templateData || {};
  const ats = analyzeAts(cvData, { timestamp: Date.now() }) || { score: 0, total: 0 };
  const atsScore = Number(ats.score ?? ats.total ?? 0);
  const expectedAtsMin = computeExpectedAtsMin(groundTruth);
  const atsMeetsExpected = atsScore >= expectedAtsMin;
  const atsScoreAccuracy = Math.min(
    100,
    Math.round((atsScore / Math.max(expectedAtsMin, 1)) * 1000) / 10
  );

  const product = computeProductScore(cvData, {
    finalResumeData: built.finalResumeData,
    resumeData: importResult?.resumeData,
    reviewQueue: importResult?.reviewQueue || [],
  });
  const templateId = entry.templateId || ROLE_TEMPLATE_MAP[entry.role] || 'apple-style';
  const scanProxy = computeScanProxy(cvData, groundTruth);
  const templateQuality = Math.round(
    ((Number(product?.score ?? 0) * 0.55 + scanProxy * 100 * 0.45) || 0) * 10
  ) / 10;

  const exportResume = validateFinalResumeForExport(built.finalResumeData, built.contract);
  const pdfReadiness =
    exportResume.ok && built.contract?.renderable
      ? 100
      : exportResume.ok
        ? 85
        : Math.max(0, 100 - (exportResume.errors?.length || 1) * 20);
  const pdfQuality = pdfReadiness;
  const exportReady = exportResume.ok && built.contract?.renderable === true;

  const extractionAccuracy = Math.round(
    (p5.nameAccuracy * 0.25 +
      p5.contactAccuracy * 0.2 +
      p5.experienceAccuracy * 0.3 +
      p5.educationAccuracy * 0.1 +
      p5.skillsAccuracy * 0.15) *
      10
  ) / 10;

  const importSuccess =
    !importResult?.errors?.length &&
    !!(importResult?.resumeData || built.finalResumeData) &&
    extractionAccuracy >= 40;

  return {
    id: entry.id,
    label: entry.label,
    role: entry.role,
    country: entry.country,
    language: entry.language,
    category: entry.category,
    layout: entry.layout,
    format: entry.format,
    sourceType: entry.sourceType,
    templateId,
    extractionMethod: entry.extractionMethod,
    importSuccess,
    extractionAccuracy,
    nameAccuracy: p5.nameAccuracy,
    contactAccuracy: p5.contactAccuracy,
    experienceAccuracy: p5.experienceAccuracy,
    educationAccuracy: p5.educationAccuracy,
    skillsAccuracy: p5.skillsAccuracy,
    templateQuality,
    productScore: Number(product?.score ?? 0),
    scanProxy,
    atsScore,
    expectedAtsMin,
    atsScoreAccuracy,
    atsMeetsExpected,
    pdfQuality,
    pdfReadiness,
    exportReady,
    renderable: built.contract?.renderable === true,
    errors: importResult?.errors || [],
    warnings: (importResult?.warnings || []).length,
  };
}

/**
 * @param {ReturnType<typeof computeTestLabMetrics>[]} rows
 */
export function aggregateTestLabResults(rows) {
  const n = rows.length || 1;
  const avg = (key) =>
    Math.round((rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n) * 10) / 10;

  const importHits = rows.filter((r) => r.importSuccess).length;
  const byCategory = {};
  const byCountry = {};
  const byLayout = {};
  const byLanguage = {};

  for (const row of rows) {
    for (const [bucket, key] of [
      [byCategory, 'category'],
      [byCountry, 'country'],
      [byLayout, 'layout'],
      [byLanguage, 'language'],
    ]) {
      const k = row[key] || 'unknown';
      if (!bucket[k]) bucket[k] = { count: 0, extractionSum: 0, templateSum: 0, atsHits: 0, pdfSum: 0 };
      bucket[k].count += 1;
      bucket[k].extractionSum += row.extractionAccuracy || 0;
      bucket[k].templateSum += row.templateQuality || 0;
      if (row.atsMeetsExpected) bucket[k].atsHits += 1;
      bucket[k].pdfSum += row.pdfQuality || 0;
    }
  }

  const finalize = (bucket) => {
    const out = {};
    for (const [k, v] of Object.entries(bucket)) {
      out[k] = {
        count: v.count,
        extractionAccuracy: Math.round((v.extractionSum / v.count) * 10) / 10,
        templateQuality: Math.round((v.templateSum / v.count) * 10) / 10,
        atsPassRate: Math.round((v.atsHits / v.count) * 1000) / 10,
        pdfQuality: Math.round((v.pdfSum / v.count) * 10) / 10,
      };
    }
    return out;
  };

  return {
    count: rows.length,
    importSuccessRate: Math.round((importHits / n) * 1000) / 10,
    extractionAccuracy: avg('extractionAccuracy'),
    templateQuality: avg('templateQuality'),
    atsScoreAccuracy: avg('atsScoreAccuracy'),
    pdfQuality: avg('pdfQuality'),
    nameAccuracy: avg('nameAccuracy'),
    experienceAccuracy: avg('experienceAccuracy'),
    byCategory: finalize(byCategory),
    byCountry: finalize(byCountry),
    byLayout: finalize(byLayout),
    byLanguage: finalize(byLanguage),
    scannedPdf: finalize(
      Object.fromEntries(
        Object.entries(byLayout).filter(([k]) => ['canva', 'indesign', 'figma', 'creative-portfolio'].includes(k))
      )
    ),
    linkedin: finalize(
      Object.fromEntries(Object.entries(byCategory).filter(([k]) => k === 'linkedin'))
    ),
  };
}
