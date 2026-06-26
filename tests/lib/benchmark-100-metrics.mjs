/**
 * 100 CV benchmark metrics — identity + section recall.
 */

import { extractDetectedSections, computeSectionMetrics, normalizeItem } from './section-accuracy.mjs';
import { hasRealName, hasEmail, hasPhone } from './stress-catalog.mjs';

export const BENCHMARK_100_GOALS = {
  experienceRecall: 85,
  educationRecall: 90,
  identityRecall: 98,
};

function phoneDigits(text) {
  return String(text || '').replace(/\D/g, '');
}

function namesMatch(expected, detected) {
  const exp = normalizeItem(expected);
  const det = normalizeItem(detected);
  if (!exp || !det) return false;
  if (exp === det) return true;
  const expParts = exp.split(' ').filter((t) => t.length > 1);
  const detParts = det.split(' ').filter((t) => t.length > 1);
  if (expParts.length < 2) return det.includes(exp) || exp.includes(det);
  const last = expParts[expParts.length - 1];
  const first = expParts[0];
  return detParts.includes(first) && detParts.includes(last);
}

function emailsMatch(expected, detected) {
  const exp = String(expected || '').trim().toLowerCase();
  const det = String(detected || '').trim().toLowerCase();
  if (!exp || !det) return false;
  if (exp === det) return true;
  const expLocal = exp.split('@')[0];
  const detLocal = det.split('@')[0];
  return expLocal.length >= 3 && expLocal === detLocal;
}

function phonesMatch(expected, detected) {
  const exp = phoneDigits(expected);
  const det = phoneDigits(detected);
  if (!exp || !det || exp.length < 8 || det.length < 8) return false;
  const expTail = exp.slice(-10);
  const detTail = det.slice(-10);
  return expTail === detTail || exp.includes(detTail) || det.includes(expTail);
}

/**
 * @param {object} groundTruth
 * @param {object} resumeData
 * @param {object} [cvData]
 */
export function computeIdentityMetrics(groundTruth, resumeData, cvData = {}) {
  const identity = resumeData?.identity || {};
  const expected = {
    name: String(groundTruth?.name || '').trim(),
    email: String(groundTruth?.email || '').trim(),
    phone: String(groundTruth?.phone || '').trim(),
  };
  const detected = {
    name: String(identity.name || cvData?.name || '').trim(),
    email: String(identity.email || cvData?.email || '').trim(),
    phone: String(identity.phone || cvData?.phone || '').trim(),
  };

  const checks = {
    name: namesMatch(expected.name, detected.name) || hasRealName(detected.name),
    email: emailsMatch(expected.email, detected.email) || hasEmail(detected.email),
    phone: phonesMatch(expected.phone, detected.phone) || hasPhone(detected.phone),
  };

  const strict = {
    name: namesMatch(expected.name, detected.name),
    email: emailsMatch(expected.email, detected.email),
    phone: phonesMatch(expected.phone, detected.phone),
  };

  const expectedCount = 3;
  const hit = Object.values(strict).filter(Boolean).length;

  return {
    expected: expectedCount,
    hit,
    recall: Math.round((hit / expectedCount) * 1000) / 10,
    checks,
    strict,
    expectedValues: expected,
    detectedValues: detected,
    failures: [
      !strict.name && 'name',
      !strict.email && 'email',
      !strict.phone && 'phone',
    ].filter(Boolean),
  };
}

/**
 * @param {object} groundTruth
 * @param {object} resumeData
 */
export function computeBenchmarkSections(groundTruth, resumeData) {
  const detected = extractDetectedSections(resumeData);
  const experience = computeSectionMetrics(groundTruth.experience || [], detected.experience, 'experience');
  const education = computeSectionMetrics(groundTruth.education || [], detected.education, 'education');
  const skills = computeSectionMetrics(groundTruth.skills || [], detected.skills, 'skills');
  return { experience, education, skills, detected };
}

/**
 * @param {object} fixture
 * @param {object} importResult
 */
export function computeBenchmark100Metrics(fixture, importResult) {
  const resumeData = importResult?.resumeData || {};
  const cvData = importResult?.templateData || importResult?.cvData || {};
  const groundTruth = fixture.groundTruth || {};

  const identity = computeIdentityMetrics(groundTruth, resumeData, cvData);
  const sections = computeBenchmarkSections(groundTruth, resumeData);

  const failures = [];
  for (const dim of identity.failures) {
    failures.push({ dimension: 'identity', issue: `${dim} not extracted` });
  }
  for (const [dim, metrics] of [
    ['experience', sections.experience],
    ['education', sections.education],
    ['skills', sections.skills],
  ]) {
    for (const fn of metrics.falseNegatives || []) {
      failures.push({ dimension: dim, issue: `Missing: ${fn}` });
    }
  }

  const overallScore = Math.round(
    (identity.recall +
      Number(sections.experience.recall || 0) +
      Number(sections.education.recall || 0) +
      Number(sections.skills.recall || 0)) /
      4
  );

  return {
    id: fixture.id,
    archetype: fixture.archetype,
    label: fixture.label,
    identity,
    identityRecall: identity.recall,
    experienceRecall: Number(sections.experience.recall || 0),
    educationRecall: Number(sections.education.recall || 0),
    skillsRecall: Number(sections.skills.recall || 0),
    overallScore,
    failures,
    sections,
    importStatus: importResult?.importStatus || null,
    importErrors: importResult?.errors || [],
  };
}

/**
 * @param {Array<ReturnType<typeof computeBenchmark100Metrics>>} rows
 */
export function aggregateBenchmark100(rows) {
  const n = rows.length || 1;
  const identityHits = rows.reduce((s, r) => s + (r.identity?.hit || 0), 0);
  const identityExpected = rows.reduce((s, r) => s + (r.identity?.expected || 0), 0);

  const sum = (key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
  const avg = (key) => Math.round((sum(key) / n) * 10) / 10;
  const min = (key) => Math.min(...rows.map((r) => r[key] ?? 100));
  const max = (key) => Math.max(...rows.map((r) => r[key] ?? 0));

  const expTp = rows.reduce((s, r) => s + (r.sections?.experience?.tp || 0), 0);
  const expExpected = rows.reduce((s, r) => s + (r.sections?.experience?.expected || 0), 0);
  const eduTp = rows.reduce((s, r) => s + (r.sections?.education?.tp || 0), 0);
  const eduExpected = rows.reduce((s, r) => s + (r.sections?.education?.expected || 0), 0);
  const skillTp = rows.reduce((s, r) => s + (r.sections?.skills?.tp || 0), 0);
  const skillExpected = rows.reduce((s, r) => s + (r.sections?.skills?.expected || 0), 0);

  const aggregateRecall = (tp, expected) =>
    expected ? Math.round((tp / expected) * 1000) / 10 : 100;

  const identityRecall = aggregateRecall(identityHits, identityExpected);
  const experienceRecall = aggregateRecall(expTp, expExpected);
  const educationRecall = aggregateRecall(eduTp, eduExpected);
  const skillsRecall = aggregateRecall(skillTp, skillExpected);

  const failureCauses = {};
  for (const row of rows) {
    for (const f of row.failures || []) {
      const key = `${f.dimension}:${f.issue.split(':')[0].trim()}`;
      failureCauses[key] = (failureCauses[key] || 0) + 1;
    }
  }

  const sortedFailures = Object.entries(failureCauses)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({ cause, count }));

  const pass =
    experienceRecall > BENCHMARK_100_GOALS.experienceRecall &&
    educationRecall > BENCHMARK_100_GOALS.educationRecall &&
    identityRecall > BENCHMARK_100_GOALS.identityRecall;

  return {
    count: rows.length,
    identityRecall,
    experienceRecall,
    educationRecall,
    skillsRecall,
    avgOverall: avg('overallScore'),
    minOverall: min('overallScore'),
    maxOverall: max('overallScore'),
    avgIdentity: avg('identityRecall'),
    minIdentity: min('identityRecall'),
    maxIdentity: max('identityRecall'),
    avgExperience: avg('experienceRecall'),
    minExperience: min('experienceRecall'),
    maxExperience: max('experienceRecall'),
    avgEducation: avg('educationRecall'),
    minEducation: min('educationRecall'),
    maxEducation: max('educationRecall'),
    avgSkills: avg('skillsRecall'),
    minSkills: min('skillsRecall'),
    maxSkills: max('skillsRecall'),
    failureCauses: sortedFailures,
    pass,
    goals: BENCHMARK_100_GOALS,
  };
}
