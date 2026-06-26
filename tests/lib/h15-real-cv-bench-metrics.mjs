/**
 * H15 — Real CV quality benchmark metrics.
 */

import { EMAIL_RE, PHONE_RE } from '../../src/core/parsing/field-sanitize.js';
import { groundTruthForFixture } from './section-ground-truth.mjs';
import { CV_CORPUS_OVERRIDES } from './cv-corpus-catalog.mjs';
import {
  computeIdentityMetrics,
  computeBenchmarkSections,
} from './benchmark-100-metrics.mjs';
import { computeSectionMetrics } from './section-accuracy.mjs';
import { isParserGarbage } from '../../src/core/validation/final-resume-data-cleanup.js';
import {
  hasUrlOrDomainSignal,
  OCR_HEADER_CATEGORY_IN_NAME_RE,
} from '../../src/core/parsing/ocr-classification-rules.js';
import { auditSemanticConfidenceGate } from '../../src/core/validation/semantic-confidence-gate.js';
import { auditSemanticMisclassifications } from '../../src/core/parsing/semantic-classifier-v2.js';
import { buildFinalResumeData } from '../../src/core/validation/final-resume-contract.js';
import { mergeReviewQueues } from '../../src/core/parsing/review-queue-merge.js';
import { pendingReviewItems } from '../../src/core/parsing/review-queue.js';
import { resumeDataToCvData } from '../../src/core/resume-data.js';

export const H15_BENCH_GOALS = Object.freeze({
  nameAccuracy: 90,
  contactAccuracy: 95,
  criticalGarbage: 0,
});

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
 * @param {import('./h15-real-cv-bench-catalog.mjs').H15BenchFixture} entry
 * @param {string} rawText
 */
export function buildH15GroundTruth(entry, rawText) {
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

function walkFinalResumeTexts(frd) {
  /** @type {{ section: string, text: string }[]} */
  const rows = [];
  const id = frd?.identity || {};
  for (const [field, text] of Object.entries(id)) {
    const t = String(text || '').trim();
    if (t) rows.push({ section: `identity.${field}`, text: t });
  }
  if (String(frd?.summary || '').trim()) {
    rows.push({ section: 'summary', text: String(frd.summary).trim() });
  }
  for (const exp of frd?.experiences || []) {
    for (const [field, val] of Object.entries(exp || {})) {
      if (field === 'bullets' && Array.isArray(val)) {
        for (const b of val) {
          const t = String(b || '').trim();
          if (t) rows.push({ section: 'experiences.bullet', text: t });
        }
      } else {
        const t = String(val || '').trim();
        if (t) rows.push({ section: `experiences.${field}`, text: t });
      }
    }
  }
  for (const key of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    for (const item of frd?.[key] || []) {
      const t = String(item || '').trim();
      if (t) rows.push({ section: key, text: t });
    }
  }
  return rows;
}

/**
 * @param {object|null} frd
 */
export function detectCriticalGarbage(frd) {
  /** @type {{ id: string, section: string, text: string, severity: string }[]} */
  const issues = [];
  if (!frd) return { critical: issues, count: 0 };

  const cv = resumeDataToCvData({
    identity: frd.identity,
    summary: frd.summary,
    experiences: frd.experiences,
    education: frd.education,
    skills: frd.skills,
    tools: frd.tools,
    languages: frd.languages,
    clients: frd.clients,
  });
  const mis = auditSemanticMisclassifications(cv);
  for (const issue of mis.issues || []) {
    issues.push({
      id: issue.id,
      section: issue.field,
      text: String(issue.value || '').slice(0, 120),
      severity: 'critical',
    });
  }

  for (const { section, text } of walkFinalResumeTexts(frd)) {
    if (isParserGarbage(text)) {
      issues.push({ id: 'parser_garbage', section, text: text.slice(0, 120), severity: 'critical' });
    }
    const isContactField = /identity\.(website|linkedin|email)$/.test(section);
    if (hasUrlOrDomainSignal(text) && !isContactField && section !== 'identity.website' && section !== 'identity.linkedin') {
      if (!/github\.com/i.test(text)) {
        issues.push({ id: 'url_domain_leak', section, text: text.slice(0, 120), severity: 'critical' });
      }
    }
    if (section === 'identity.name' && OCR_HEADER_CATEGORY_IN_NAME_RE.test(text)) {
      issues.push({ id: 'ocr_header_in_name', section, text: text.slice(0, 120), severity: 'critical' });
    }
    if (/^visual\s+communication$/i.test(text) && section !== 'suggestions') {
      issues.push({ id: 'ambiguous_program_placed', section, text, severity: 'critical' });
    }
    if (/^jb\s+impressions?$/i.test(text) && /^identity\.(name|title)$/.test(section)) {
      issues.push({ id: 'company_as_identity', section, text, severity: 'critical' });
    }
  }

  const seen = new Set();
  const critical = issues.filter((i) => {
    const key = `${i.id}|${i.section}|${i.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return i.severity === 'critical';
  });

  return { critical, count: critical.length };
}

/**
 * @param {import('./h15-real-cv-bench-catalog.mjs').H15BenchFixture} entry
 * @param {string} rawText
 * @param {object} importResult
 */
export function computeH15BenchMetrics(entry, rawText, importResult) {
  const groundTruth = buildH15GroundTruth(entry, rawText);
  const resumeData = importResult?.resumeData || {};
  const built = buildFinalResumeData(resumeData, {
    existingReview: importResult?.reviewQueue || [],
    silent: true,
  });
  const frd = built.finalResumeData;
  const reviewItems = mergeReviewQueues(importResult?.reviewQueue || [], built.reviewItems || []);
  const pendingReview = pendingReviewItems(reviewItems);

  const identity = computeIdentityMetrics(groundTruth, resumeData, built.cvData);
  const sections = computeBenchmarkSections(groundTruth, resumeData);
  const languages = computeSectionMetrics(
    groundTruth.languages || [],
    sections.detected.languages || [],
    'languages'
  );

  const nameAccuracy = identity.strict?.name ? 100 : 0;
  const contactExpected = [groundTruth.email, groundTruth.phone].filter(Boolean).length;
  const contactHit = [
    groundTruth.email ? identity.strict?.email : null,
    groundTruth.phone ? identity.strict?.phone : null,
  ].filter((v) => v === true).length;
  const contactAccuracy = contactExpected
    ? Math.round((contactHit / contactExpected) * 1000) / 10
    : 100;

  const garbage = detectCriticalGarbage(frd);
  const semanticAudit = auditSemanticConfidenceGate(frd, pendingReview);
  const cleanCvPreview = semanticAudit.pass && garbage.count === 0 && !!frd;

  return {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    extractionMethod: entry.extractionMethod,
    nameAccuracy,
    contactAccuracy,
    experienceAccuracy: Number(sections.experience.recall || 0),
    educationAccuracy: Number(sections.education.recall || 0),
    skillsAccuracy: Number(sections.skills.recall || 0),
    languagesAccuracy: Number(languages.recall || 0),
    garbageLeakage: garbage.count,
    criticalGarbage: garbage.critical,
    manualReviewCount: pendingReview.length,
    cleanCvPreview,
    semanticGateIssues: semanticAudit.issues?.length || 0,
    importStatus: importResult?.importStatus || null,
    importErrors: importResult?.errors || [],
    identity: {
      expected: identity.expectedValues,
      detected: identity.detectedValues,
      strict: identity.strict,
    },
    sections: {
      experience: sections.experience,
      education: sections.education,
      skills: sections.skills,
      languages,
    },
    pass: {
      name: nameAccuracy >= 100,
      contact: contactAccuracy >= 100 || contactExpected === 0,
      garbage: garbage.count === H15_BENCH_GOALS.criticalGarbage,
      preview: cleanCvPreview,
    },
  };
}

/**
 * @param {ReturnType<typeof computeH15BenchMetrics>[]} rows
 */
export function aggregateH15Bench(rows) {
  const n = rows.length || 1;
  const avg = (key) =>
    Math.round((rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n) * 10) / 10;

  const nameHits = rows.filter((r) => r.nameAccuracy >= 100).length;
  const contactEligible = rows.filter((r) => {
    const exp = r.identity?.expected || r.identity?.expectedValues || {};
    return !!(exp.email || exp.phone);
  });
  const contactHits = contactEligible.filter((r) => r.contactAccuracy >= 100).length;
  const contactDenom = contactEligible.length || n;

  const criticalGarbageTotal = rows.reduce((s, r) => s + (r.garbageLeakage || 0), 0);
  const cleanPreviewCount = rows.filter((r) => r.cleanCvPreview).length;
  const reviewTotal = rows.reduce((s, r) => s + (r.manualReviewCount || 0), 0);

  const byCategory = {};
  for (const row of rows) {
    if (!byCategory[row.category]) {
      byCategory[row.category] = { count: 0, nameHits: 0, cleanPreview: 0, garbage: 0 };
    }
    const b = byCategory[row.category];
    b.count += 1;
    if (row.nameAccuracy >= 100) b.nameHits += 1;
    if (row.cleanCvPreview) b.cleanPreview += 1;
    b.garbage += row.garbageLeakage || 0;
  }

  const nameAccuracy = Math.round((nameHits / n) * 1000) / 10;
  const contactAccuracy = Math.round((contactHits / contactDenom) * 1000) / 10;

  const pass =
    nameAccuracy >= H15_BENCH_GOALS.nameAccuracy &&
    contactAccuracy >= H15_BENCH_GOALS.contactAccuracy &&
    criticalGarbageTotal === H15_BENCH_GOALS.criticalGarbage &&
    cleanPreviewCount === n;

  return {
    count: rows.length,
    nameAccuracy,
    contactAccuracy,
    experienceAccuracy: avg('experienceAccuracy'),
    educationAccuracy: avg('educationAccuracy'),
    skillsAccuracy: avg('skillsAccuracy'),
    languagesAccuracy: avg('languagesAccuracy'),
    criticalGarbageTotal,
    manualReviewTotal: reviewTotal,
    manualReviewAvg: Math.round((reviewTotal / n) * 10) / 10,
    cleanPreviewCount,
    cleanPreviewRate: Math.round((cleanPreviewCount / n) * 1000) / 10,
    byCategory,
    pass,
    goals: H15_BENCH_GOALS,
  };
}
