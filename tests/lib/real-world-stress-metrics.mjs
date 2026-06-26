/**
 * P0 — Real-world stress test metrics (6 extraction dimensions).
 */
import { EMAIL_RE, PHONE_RE } from '../../src/core/parsing/field-sanitize.js';
import { groundTruthForFixture } from './section-ground-truth.mjs';
import { CV_CORPUS_OVERRIDES } from './cv-corpus-catalog.mjs';
import {
  computeIdentityMetrics,
  computeBenchmarkSections,
} from './benchmark-100-metrics.mjs';
import { computeSectionMetrics, normalizeItem, extractDetectedSections } from './section-accuracy.mjs';
import { REAL_WORLD_STRESS_GOAL_PCT } from './real-world-stress-catalog.mjs';

const FAKE_NAME_PATTERNS = [/jane\s+doe/i, /john\s+doe/i, /candidate\s*name/i, /lorem\s+ipsum/i];
const I18N_KEY_RE = /\b(extractionQuality_|importProgress|downloadPdf|statusPdf)[A-Za-z]+\b/;

function skillsRecallFromResume(groundTruth, resumeData) {
  const expected = groundTruth.skills || [];
  if (!expected.length) {
    return { expected: 0, detected: 0, tp: 0, fp: 0, fn: 0, recall: 100, precision: 100 };
  }
  const detected = extractDetectedSections(resumeData);
  const blob = [
    ...(resumeData?.skills || []),
    ...(resumeData?.tools || []),
    resumeData?.summary,
    ...(resumeData?.unsorted || []),
    ...detected.skills,
    ...detected.tools,
    ...(resumeData?.experiences || []).flatMap((e) => [e.role, e.company, ...(e.bullets || [])]),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  let tp = 0;
  const falseNegatives = [];
  for (const skill of expected) {
    const needle = normalizeItem(skill);
    const tokens = needle.split(' ').filter((t) => t.length > 3);
    const hit =
      (needle.length >= 4 && blob.includes(needle)) ||
      tokens.some((t) => blob.includes(t));
    if (hit) tp += 1;
    else falseNegatives.push(skill);
  }
  const recall = Math.round((tp / expected.length) * 1000) / 10;
  const strict = computeSectionMetrics(expected, detected.skills, 'skills');
  return {
    ...strict,
    recall: Math.max(recall, Number(strict.recall || 0)),
    tp: Math.max(tp, strict.tp || 0),
    falseNegatives: recall >= (strict.recall || 0) ? falseNegatives : strict.falseNegatives,
  };
}

function parseIdentityFromText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const name = lines[0] || '';
  const contactLine = lines.find((l) => EMAIL_RE.test(l) || PHONE_RE.test(l)) || lines[2] || '';
  const email = (contactLine.match(EMAIL_RE) || [])[0] || '';
  const phone = (contactLine.match(PHONE_RE) || [])[0]?.trim() || '';
  return { name, email, phone };
}

/**
 * @param {import('./real-world-stress-catalog.mjs').RealWorldStressFixture} entry
 * @param {string} rawText
 */
export function buildRealWorldGroundTruth(entry, rawText) {
  const fixtureKey = entry.fixtureKey || entry.manifestId || entry.id;
  const parsed = groundTruthForFixture(fixtureKey, rawText);
  const identity = parseIdentityFromText(rawText);
  const corpusOverride = CV_CORPUS_OVERRIDES[fixtureKey] || {};
  const merged = { ...parsed };
  for (const key of ['experience', 'education', 'skills', 'tools', 'languages', 'clients']) {
    if (Array.isArray(corpusOverride[key])) merged[key] = [...corpusOverride[key]];
  }
  return {
    name: identity.name,
    email: identity.email,
    phone: identity.phone,
    experience: merged.experience || [],
    education: merged.education || [],
    skills: merged.skills || [],
    tools: merged.tools || [],
    languages: merged.languages || [],
    clients: merged.clients || [],
  };
}

/**
 * @param {import('./real-world-stress-catalog.mjs').RealWorldStressFixture} entry
 * @param {string} rawText
 * @param {object} importResult
 * @param {{ templateHtml?: string, flow?: object }} [extras]
 */
export function computeRealWorldStressMetrics(entry, rawText, importResult, extras = {}) {
  const groundTruth = buildRealWorldGroundTruth(entry, rawText);
  const resumeData = importResult?.resumeData || {};
  const cvData = importResult?.templateData || {};

  const identity = computeIdentityMetrics(groundTruth, resumeData, cvData);
  const sections = computeBenchmarkSections(groundTruth, resumeData);
  const skillsSection = skillsRecallFromResume(groundTruth, resumeData);

  const identityAccuracy = identity.strict?.name ? 100 : 0;
  const emailAccuracy =
    groundTruth.email && identity.strict?.email ? 100 : groundTruth.email ? 0 : 100;
  const phoneAccuracy =
    groundTruth.phone && identity.strict?.phone ? 100 : groundTruth.phone ? 0 : 100;

  const experienceAccuracy = Number(sections.experience.recall || 0);
  const educationAccuracy = Number(sections.education.recall || 0);
  const skillsAccuracy = Number(skillsSection.recall || 0);

  const dimensions = [
    identityAccuracy,
    emailAccuracy,
    phoneAccuracy,
    experienceAccuracy,
    educationAccuracy,
    skillsAccuracy,
  ];
  const extractionAccuracy =
    Math.round((dimensions.reduce((s, v) => s + v, 0) / dimensions.length) * 10) / 10;

  const importBlocked =
    !importResult?.resumeData ||
    (importResult?.errors?.length > 0 && !resumeData?.experiences?.length && !resumeData?.skills?.length);

  const templateHtml = String(extras.templateHtml || '');
  const previewPlain = templateHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const importSuccess = !importBlocked && !!(resumeData?.identity?.name || resumeData?.experiences?.length || resumeData?.skills?.length);
  const reviewSuccess =
    importSuccess &&
    !importResult?.errors?.some((e) => /IMPORT_TIMEOUT|STUCK|CRASH/i.test(String(e))) &&
    (importResult?.importStatus !== 'IMPORT_FAILED' || !!resumeData?.experiences?.length);
  const templateSuccess =
    reviewSuccess && templateHtml.length > 200 && previewPlain.length > 80 && !FAKE_NAME_PATTERNS.some((re) => re.test(previewPlain));
  const pdfExportSuccess = templateSuccess && extras.flow?.pdfExportSuccess !== false;
  const noFakeData = !FAKE_NAME_PATTERNS.some((re) => re.test(previewPlain)) && !FAKE_NAME_PATTERNS.some((re) => re.test(String(resumeData?.identity?.name || '')));
  const noRawI18n = !I18N_KEY_RE.test(previewPlain);

  return {
    id: entry.id,
    label: entry.label,
    role: entry.role,
    format: entry.format,
    extractionMethod: entry.extractionMethod,
    identityAccuracy,
    emailAccuracy,
    phoneAccuracy,
    experienceAccuracy,
    educationAccuracy,
    skillsAccuracy,
    extractionAccuracy,
    importStatus: importResult?.importStatus || null,
    importErrors: importResult?.errors || [],
    importBlocked,
    importSuccess,
    reviewSuccess,
    templateSuccess,
    pdfExportSuccess,
    noFakeData,
    noRawI18n,
    identity: {
      expected: identity.expectedValues,
      detected: identity.detectedValues,
      strict: identity.strict,
      failures: identity.failures,
    },
    sections: {
      experience: sections.experience,
      education: sections.education,
      skills: skillsSection,
    },
    pass:
      !importBlocked &&
      extractionAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
      importSuccess &&
      reviewSuccess &&
      templateSuccess &&
      noFakeData &&
      noRawI18n,
  };
}

/**
 * @param {ReturnType<typeof computeRealWorldStressMetrics>[]} rows
 */
export function aggregateRealWorldStress(rows) {
  const n = rows.length || 1;
  const avg = (key) =>
    Math.round((rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n) * 10) / 10;

  const passCount = rows.filter((r) => r.pass).length;
  const failCount = n - passCount;

  const byRole = {};
  const byFormat = {};
  const rootCauses = {};

  for (const row of rows) {
    if (!byRole[row.role]) byRole[row.role] = { count: 0, pass: 0, avgAccuracy: 0 };
    if (!byFormat[row.format]) byFormat[row.format] = { count: 0, pass: 0, avgAccuracy: 0 };
    byRole[row.role].count += 1;
    byRole[row.role].pass += row.pass ? 1 : 0;
    byRole[row.role].avgAccuracy += row.extractionAccuracy;
    byFormat[row.format].count += 1;
    byFormat[row.format].pass += row.pass ? 1 : 0;
    byFormat[row.format].avgAccuracy += row.extractionAccuracy;

    if (!row.pass) {
      for (const f of row.identity?.failures || []) {
        rootCauses[`identity_${f}`] = (rootCauses[`identity_${f}`] || 0) + 1;
      }
      if (row.experienceAccuracy < REAL_WORLD_STRESS_GOAL_PCT) {
        rootCauses.experience_recall_low = (rootCauses.experience_recall_low || 0) + 1;
      }
      if (row.skillsAccuracy < REAL_WORLD_STRESS_GOAL_PCT) {
        rootCauses.skills_recall_low = (rootCauses.skills_recall_low || 0) + 1;
      }
      if (row.importBlocked) rootCauses.import_blocked = (rootCauses.import_blocked || 0) + 1;
    }
  }

  for (const bucket of [byRole, byFormat]) {
    for (const k of Object.keys(bucket)) {
      bucket[k].avgAccuracy = Math.round((bucket[k].avgAccuracy / bucket[k].count) * 10) / 10;
      bucket[k].passRate = Math.round((bucket[k].pass / bucket[k].count) * 1000) / 10;
    }
  }

  const identityAccuracy = avg('identityAccuracy');
  const emailAccuracy = avg('emailAccuracy');
  const phoneAccuracy = avg('phoneAccuracy');
  const experienceAccuracy = avg('experienceAccuracy');
  const educationAccuracy = avg('educationAccuracy');
  const skillsAccuracy = avg('skillsAccuracy');
  const extractionAccuracy = avg('extractionAccuracy');
  const successRate = Math.round((passCount / n) * 1000) / 10;
  const failureRate = Math.round((failCount / n) * 1000) / 10;

  const importSuccessRate = Math.round((rows.filter((r) => r.importSuccess).length / n) * 1000) / 10;
  const reviewSuccessRate = Math.round((rows.filter((r) => r.reviewSuccess).length / n) * 1000) / 10;
  const templateSuccessRate = Math.round((rows.filter((r) => r.templateSuccess).length / n) * 1000) / 10;
  const pdfExportSuccessRate = Math.round((rows.filter((r) => r.pdfExportSuccess).length / n) * 1000) / 10;
  const noFakeDataRate = Math.round((rows.filter((r) => r.noFakeData).length / n) * 1000) / 10;
  const noRawI18nRate = Math.round((rows.filter((r) => r.noRawI18n).length / n) * 1000) / 10;

  const pass =
    extractionAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
    identityAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
    emailAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
    phoneAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
    experienceAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
    educationAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
    skillsAccuracy >= REAL_WORLD_STRESS_GOAL_PCT &&
    importSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT &&
    reviewSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT &&
    templateSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT &&
    pdfExportSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT &&
    noFakeDataRate >= 100 &&
    noRawI18nRate >= 100;

  return {
    count: rows.length,
    passCount,
    failCount,
    successRate,
    failureRate,
    identityAccuracy,
    emailAccuracy,
    phoneAccuracy,
    experienceAccuracy,
    educationAccuracy,
    skillsAccuracy,
    extractionAccuracy,
    importSuccessRate,
    reviewSuccessRate,
    templateSuccessRate,
    pdfExportSuccessRate,
    noFakeDataRate,
    noRawI18nRate,
    pass,
    goalPct: REAL_WORLD_STRESS_GOAL_PCT,
    byRole,
    byFormat,
    rootCauses: Object.entries(rootCauses)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count),
  };
}
