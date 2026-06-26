/**
 * H6 stress metrics — identity + section recall + completeness.
 */

import { extractDetectedSections, computeSectionMetrics } from './section-accuracy.mjs';
import { groundTruthForFixture } from './section-ground-truth.mjs';
import { hasRealName, hasEmail, hasPhone } from './stress-catalog.mjs';

function pctRecall(metrics) {
  if (!metrics?.expected) return metrics?.detected ? 100 : 100;
  return Math.round(Number(metrics.recall) || 0);
}

/**
 * @param {string} fixtureId
 * @param {string} rawText
 * @param {object} resumeData sanitized resumeData
 * @param {object} cvData
 */
export function computeH6Metrics(fixtureId, rawText, resumeData, cvData) {
  const ground = groundTruthForFixture(fixtureId, rawText);
  const detected = extractDetectedSections(resumeData);

  const identitySignals = [
    hasRealName(resumeData?.identity?.name || cvData?.name),
    hasEmail(resumeData?.identity?.email || cvData?.email),
    hasPhone(resumeData?.identity?.phone || cvData?.phone),
  ];
  const identityPct = Math.round((identitySignals.filter(Boolean).length / 3) * 100);

  const experience = computeSectionMetrics(ground.experience, detected.experience, 'experience');
  const education = computeSectionMetrics(ground.education, detected.education, 'education');
  const skills = computeSectionMetrics(ground.skills, detected.skills, 'skills');
  const languages = computeSectionMetrics(ground.languages, detected.languages, 'languages');

  const sectionScores = [
    ground.experience.length ? pctRecall(experience) : null,
    ground.education.length ? pctRecall(education) : null,
    ground.skills.length ? pctRecall(skills) : null,
    ground.languages.length ? pctRecall(languages) : null,
  ].filter((n) => n != null);

  const completenessPct = sectionScores.length
    ? Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length)
    : 0;

  const overallPct = Math.round(
    (identityPct + (sectionScores.length ? sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length : 0)) /
      (sectionScores.length ? 2 : 1)
  );

  const failures = [];
  if (identityPct < 100) {
    if (!identitySignals[0]) failures.push({ dimension: 'identity', issue: 'Name not detected' });
    if (!identitySignals[1]) failures.push({ dimension: 'identity', issue: 'Email not detected' });
    if (!identitySignals[2]) failures.push({ dimension: 'identity', issue: 'Phone not detected' });
  }
  for (const [dim, m] of [
    ['experience', experience],
    ['education', education],
    ['skills', skills],
    ['languages', languages],
  ]) {
    if (!m.expected) continue;
    if (pctRecall(m) < 80) {
      for (const fn of m.falseNegatives || []) {
        failures.push({ dimension: dim, issue: `Missing: ${fn}` });
      }
    }
  }

  return {
    identity: identityPct,
    experience: pctRecall(experience),
    education: pctRecall(education),
    skills: pctRecall(skills),
    languages: pctRecall(languages),
    completeness: completenessPct,
    overall: overallPct,
    failures,
    ground,
    detected,
    sections: { experience, education, skills, languages },
  };
}
