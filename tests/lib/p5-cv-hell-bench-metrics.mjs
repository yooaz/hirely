/**
 * P5 — CV Hell benchmark metrics.
 */

import { buildH15GroundTruth } from './h15-real-cv-bench-metrics.mjs';
import {
  computeIdentityMetrics,
  computeBenchmarkSections,
} from './benchmark-100-metrics.mjs';
import { computeSectionMetrics } from './section-accuracy.mjs';
import { extractDetectedSections } from './section-accuracy.mjs';
import { buildFinalResumeData } from '../../src/core/validation/final-resume-contract.js';

export const P5_HELL_GOALS = Object.freeze({
  nameAccuracy: 95,
  contactAccuracy: 95,
  experienceAccuracy: 90,
  educationAccuracy: 85,
  skillsAccuracy: 85,
});

/**
 * @param {import('./p5-cv-hell-bench-catalog.mjs').P5HellFixture} entry
 * @param {string} canonicalText — ground-truth source (pre-layout)
 * @param {object} importResult
 */
export function computeP5HellMetrics(entry, canonicalText, importResult) {
  const groundTruthEntry = {
    ...entry,
    manifestId: entry.fixtureKey || entry.manifestId || entry.id,
    fixtureKey: entry.fixtureKey || entry.manifestId,
  };
  const groundTruth = buildH15GroundTruth(groundTruthEntry, canonicalText);
  const resumeData = importResult?.resumeData || {};
  const built = buildFinalResumeData(resumeData, {
    rawText: canonicalText,
    cleanedText: canonicalText,
    existingReview: importResult?.reviewQueue || [],
    silent: true,
  });

  const identity = computeIdentityMetrics(groundTruth, resumeData, built.cvData);
  const sections = computeBenchmarkSections(groundTruth, resumeData);
  const detected = extractDetectedSections(resumeData);
  const tools = computeSectionMetrics(groundTruth.tools || [], detected.tools || [], 'tools');
  const languages = computeSectionMetrics(groundTruth.languages || [], detected.languages || [], 'languages');

  const nameAccuracy = identity.strict?.name ? 100 : 0;
  const contactExpected = [groundTruth.email, groundTruth.phone].filter(Boolean).length;
  const contactHit = [
    groundTruth.email ? identity.strict?.email : null,
    groundTruth.phone ? identity.strict?.phone : null,
  ].filter((v) => v === true).length;
  const contactAccuracy = contactExpected
    ? Math.round((contactHit / contactExpected) * 1000) / 10
    : 100;

  return {
    id: entry.id,
    label: entry.label,
    layout: entry.layout,
    archetype: entry.archetype,
    extractionMethod: entry.extractionMethod,
    nameAccuracy,
    contactAccuracy,
    experienceAccuracy: Number(sections.experience.recall || 0),
    educationAccuracy: Number(sections.education.recall || 0),
    skillsAccuracy: Number(sections.skills.recall || 0),
    toolsAccuracy: Number(tools.recall || 0),
    languagesAccuracy: Number(languages.recall || 0),
    identity: {
      expected: identity.expectedValues,
      detected: identity.detectedValues,
      strict: identity.strict,
    },
    sections: {
      experience: sections.experience,
      education: sections.education,
      skills: sections.skills,
      tools,
      languages,
    },
  };
}

/**
 * @param {ReturnType<typeof computeP5HellMetrics>[]} rows
 */
export function aggregateP5HellBench(rows) {
  const n = rows.length || 1;
  const avg = (key) =>
    Math.round((rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n) * 10) / 10;

  const nameHits = rows.filter((r) => r.nameAccuracy >= 100).length;
  const contactEligible = rows.filter((r) => {
    const exp = r.identity?.expected || {};
    return !!(exp.email || exp.phone);
  });
  const contactHits = contactEligible.filter((r) => r.contactAccuracy >= 100).length;
  const contactDenom = contactEligible.length || n;

  const nameAccuracy = Math.round((nameHits / n) * 1000) / 10;
  const contactAccuracy = Math.round((contactHits / contactDenom) * 1000) / 10;
  const experienceAccuracy = avg('experienceAccuracy');
  const educationAccuracy = avg('educationAccuracy');
  const skillsAccuracy = avg('skillsAccuracy');
  const toolsAccuracy = avg('toolsAccuracy');
  const languagesAccuracy = avg('languagesAccuracy');

  const byLayout = {};
  for (const row of rows) {
    if (!byLayout[row.layout]) {
      byLayout[row.layout] = { count: 0, nameHits: 0, experienceSum: 0 };
    }
    const b = byLayout[row.layout];
    b.count += 1;
    if (row.nameAccuracy >= 100) b.nameHits += 1;
    b.experienceSum += row.experienceAccuracy || 0;
  }
  for (const key of Object.keys(byLayout)) {
    const b = byLayout[key];
    b.nameAccuracy = Math.round((b.nameHits / b.count) * 1000) / 10;
    b.experienceAccuracy = Math.round((b.experienceSum / b.count) * 10) / 10;
  }

  const pass =
    nameAccuracy > P5_HELL_GOALS.nameAccuracy &&
    contactAccuracy > P5_HELL_GOALS.contactAccuracy &&
    experienceAccuracy > P5_HELL_GOALS.experienceAccuracy &&
    educationAccuracy > P5_HELL_GOALS.educationAccuracy &&
    skillsAccuracy > P5_HELL_GOALS.skillsAccuracy;

  return {
    count: rows.length,
    nameAccuracy,
    contactAccuracy,
    experienceAccuracy,
    educationAccuracy,
    skillsAccuracy,
    toolsAccuracy,
    languagesAccuracy,
    byLayout,
    goals: P5_HELL_GOALS,
    pass,
  };
}
