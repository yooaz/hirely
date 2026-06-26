/**
 * P1 CV corpus metrics — identity, experience, education, skills, languages.
 */
import {
  computeIdentityMetrics,
  computeBenchmarkSections,
} from './benchmark-100-metrics.mjs';
import { computeSectionMetrics } from './section-accuracy.mjs';

export const CV_CORPUS_GOALS = {
  identity: 95,
  experience: 90,
  education: 90,
  skills: 85,
};

/**
 * @param {object} fixture
 * @param {object} importResult
 */
export function computeCvCorpusMetrics(fixture, importResult) {
  const resumeData = importResult?.resumeData || {};
  const cvData = importResult?.templateData || importResult?.cvData || {};
  const groundTruth = fixture.groundTruth || {};

  const identity = computeIdentityMetrics(groundTruth, resumeData, cvData);
  const sections = computeBenchmarkSections(groundTruth, resumeData);
  const languages = computeSectionMetrics(
    groundTruth.languages || [],
    sections.detected.languages || [],
    'languages'
  );

  const failures = [];
  for (const dim of identity.failures) {
    failures.push({ dimension: 'identity', issue: `${dim} not extracted` });
  }
  for (const [dim, metrics] of [
    ['experience', sections.experience],
    ['education', sections.education],
    ['skills', sections.skills],
    ['languages', languages],
  ]) {
    for (const fn of metrics.falseNegatives || []) {
      failures.push({ dimension: dim, issue: `Missing: ${fn}` });
    }
  }

  return {
    id: fixture.id,
    archetype: fixture.archetype,
    label: fixture.label,
    identity,
    identityRecall: identity.recall,
    experienceRecall: Number(sections.experience.recall || 0),
    educationRecall: Number(sections.education.recall || 0),
    skillsRecall: Number(sections.skills.recall || 0),
    languagesRecall: Number(languages.recall || 0),
    failures,
    sections: { ...sections, languages },
    importStatus: importResult?.importStatus || null,
    importErrors: importResult?.errors || [],
  };
}

/**
 * @param {Array<ReturnType<typeof computeCvCorpusMetrics>>} rows
 */
export function aggregateCvCorpus(rows) {
  const n = rows.length || 1;

  const identityHits = rows.reduce((s, r) => s + (r.identity?.hit || 0), 0);
  const identityExpected = rows.reduce((s, r) => s + (r.identity?.expected || 0), 0);

  const sectionTp = (key) =>
    rows.reduce((s, r) => {
      if (key === 'languages') return s + (r.sections?.languages?.tp || 0);
      return s + (r.sections?.[key]?.tp || 0);
    }, 0);
  const sectionExpected = (key) =>
    rows.reduce((s, r) => {
      if (key === 'languages') return s + (r.sections?.languages?.expected || 0);
      return s + (r.sections?.[key]?.expected || 0);
    }, 0);

  const recallFrom = (tp, expected) =>
    expected ? Math.round((tp / expected) * 1000) / 10 : 100;

  const identityRecall = recallFrom(identityHits, identityExpected);
  const experienceRecall = recallFrom(sectionTp('experience'), sectionExpected('experience'));
  const educationRecall = recallFrom(sectionTp('education'), sectionExpected('education'));
  const skillsRecall = recallFrom(sectionTp('skills'), sectionExpected('skills'));
  const languagesRecall = recallFrom(sectionTp('languages'), sectionExpected('languages'));

  const avg = (key) =>
    Math.round((rows.reduce((s, r) => s + (r[key] || 0), 0) / n) * 10) / 10;

  const failureCauses = {};
  for (const row of rows) {
    for (const f of row.failures || []) {
      const key = `${f.dimension}:${String(f.issue).split(':')[0].trim()}`;
      failureCauses[key] = (failureCauses[key] || 0) + 1;
    }
  }

  const sortedFailures = Object.entries(failureCauses)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({ cause, count }));

  const pass =
    identityRecall >= CV_CORPUS_GOALS.identity &&
    experienceRecall >= CV_CORPUS_GOALS.experience &&
    educationRecall >= CV_CORPUS_GOALS.education &&
    skillsRecall >= CV_CORPUS_GOALS.skills;

  return {
    count: rows.length,
    identityRecall,
    experienceRecall,
    educationRecall,
    skillsRecall,
    languagesRecall,
    avgIdentity: avg('identityRecall'),
    avgExperience: avg('experienceRecall'),
    avgEducation: avg('educationRecall'),
    avgSkills: avg('skillsRecall'),
    avgLanguages: avg('languagesRecall'),
    failureCauses: sortedFailures,
    pass,
    goals: CV_CORPUS_GOALS,
  };
}
