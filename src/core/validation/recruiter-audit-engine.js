/**
 * Recruiter Audit Engine — post-extraction six-dimension review.
 * ATS · Clarity · Experience · Structure · Keyword · Trust → overall /100.
 * Output reads like a recruiter review (strengths, weaknesses, recommendations).
 */

import { detectCvArchetype, normalizeCvForAtsScoring, ARCHETYPE_PROFILES } from './ats-quality-h8.js';
import { analyzeAtsPro } from './ats-engine-pro.js';
import { computeRecruiterScoreV2 } from './recruiter-score-v2.js';
import { computeTrustScore } from './trust-score.js';
import { computeTrustedCvReview } from './trusted-cv-review-engine.js';
import { auditRecruiterQuality, collectExperienceRows } from './recruiter-quality-audit.js';
import { resolveChecklistProfile } from './recruiter-checklist-source.js';
import { cvDataV2ToLegacy } from '../extraction/cv-data-v2.js';

export const RECRUITER_AUDIT_ENGINE = 'RECRUITER_AUDIT_ENGINE_V1';

/** @type {Record<string, { id: string, label: string, weight: number }>} */
export const AUDIT_DIMENSIONS = Object.freeze({
  ats: { id: 'ats', label: 'ATS', weight: 20 },
  clarity: { id: 'clarity', label: 'Clarity', weight: 18 },
  experience: { id: 'experience', label: 'Experience', weight: 20 },
  structure: { id: 'structure', label: 'Structure', weight: 15 },
  keyword: { id: 'keyword', label: 'Keyword', weight: 12 },
  trust: { id: 'trust', label: 'Trust', weight: 15 },
});

const TITLE_KEYWORD_SEEDS = [
  'design', 'develop', 'engineer', 'market', 'sales', 'consult', 'manage', 'analyst',
  'product', 'creative', 'finance', 'data', 'project', 'strategy', 'brand', 'digital',
  'software', 'graphic', 'ux', 'ui', 'research', 'operations', 'hr', 'recruit',
];

const METRIC_RE =
  /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;
const ACTION_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(n) || 0)));
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function resolveProfile(input = {}) {
  if (input.profile) return input.profile;
  const legacy =
    input.cvData ||
    (input.cvDataV2 ? cvDataV2ToLegacy(input.cvDataV2) : null);
  return resolveChecklistProfile({
    cvData: legacy,
    finalResumeData: input.finalResumeData ?? null,
    resumeData: input.resumeData ?? null,
  });
}

function cvBlob(p) {
  const parts = [
    p?.summary,
    ...(p?.skills || []),
    ...(p?.tools || []),
    ...(p?.experience || []),
    ...(p?.experiences || []).map((e) =>
      [e?.role, e?.company, e?.description, e?.rewrittenDescription, ...(e?.bullets || [])].join(' ')
    ),
  ];
  return parts.filter(Boolean).join('\n').toLowerCase();
}

function targetKeywords(p, archetype) {
  const title = cleanText(p?.title).toLowerCase();
  const seeds = new Set();
  for (const kw of TITLE_KEYWORD_SEEDS) {
    if (title.includes(kw)) seeds.add(kw);
  }
  for (const word of title.split(/\s+/).filter((w) => w.length > 3)) seeds.add(word);
  if (archetype && archetype !== 'general') seeds.add(archetype);
  if (!seeds.size) seeds.add('professional');
  return [...seeds].slice(0, 12);
}

function keywordCoverageScore(p, archetype) {
  const targets = targetKeywords(p, archetype);
  const blob = cvBlob(p);
  const matched = targets.filter((kw) => blob.includes(kw));
  return {
    score: targets.length ? clamp((matched.length / targets.length) * 100) : 0,
    matched,
    missing: targets.filter((kw) => !blob.includes(kw)),
    targets,
  };
}

function pillarPct(breakdown, id) {
  const cat = (breakdown || []).find((c) => c.id === id);
  if (!cat || !cat.max) return null;
  return clamp((cat.points / cat.max) * 100);
}

function scoreClarity(p, atsPro, quality, cvDataV2) {
  const readability = atsPro?.dimensions?.find((d) => d.id === 'readability');
  let score = readability?.pct ?? readability?.score ?? 55;

  const summary = cleanText(p?.summary);
  if (summary.length >= 50 && summary.length <= 320) score += 12;
  else if (summary.length > 0) score += 4;
  else score -= 10;

  const weakDesc = quality?.checks?.find((c) => c.id === 'weak_descriptions');
  if (weakDesc?.status === 'ok') score += 8;
  else if (weakDesc?.status === 'warn') score -= 6;
  else if (weakDesc?.status === 'fail') score -= 14;

  const conf = cvDataV2?.meta?.overallConfidence;
  if (typeof conf === 'number' && conf > 0) {
    score = score * 0.75 + conf * 0.25;
  }

  return clamp(score);
}

function scoreExperience(p, h8, quality) {
  const expPct = pillarPct(h8?.breakdown, 'experience');
  let score = expPct ?? 45;

  const rows = collectExperienceRows(p);
  if (rows.length >= 2) score += 8;
  else if (rows.length === 1) score += 2;
  else score -= 15;

  let metricHits = 0;
  let actionHits = 0;
  for (const r of rows) {
    const blob = [r.line, ...(r.bullets || [])].join(' ');
    if (METRIC_RE.test(blob)) metricHits += 1;
    if (ACTION_RE.test(blob)) actionHits += 1;
  }
  if (metricHits >= 2) score += 10;
  else if (metricHits === 1) score += 4;
  if (actionHits >= rows.length && rows.length) score += 6;

  const datesCheck = quality?.checks?.find((c) => c.id === 'missing_dates');
  if (datesCheck?.status === 'ok') score += 6;
  else if (datesCheck?.status === 'warn') score -= 4;
  else if (datesCheck?.status === 'fail') score -= 10;

  return clamp(score);
}

function scoreStructure(p, atsPro, h8) {
  const sectionsDim = atsPro?.dimensions?.find((d) => d.id === 'sections');
  let score = sectionsDim?.pct ?? sectionsDim?.score ?? pillarPct(h8?.breakdown, 'formatting') ?? 50;

  const sectionFlags = [
    cleanText(p?.name).length >= 2,
    cleanText(p?.title).length >= 2,
    /@/.test(String(p?.email || '')),
    cleanText(p?.summary).length >= 30,
    (p?.experience?.length || p?.experiences?.length || 0) > 0,
    (p?.education?.length || 0) > 0,
    (p?.skills?.length || 0) >= 3,
  ];
  const present = sectionFlags.filter(Boolean).length;
  score = score * 0.6 + (present / sectionFlags.length) * 100 * 0.4;

  return clamp(score);
}

function bandFromOverall(total) {
  if (total >= 85) return { tier: 'excellent', label: 'Excellent — recruiter-ready', labelKey: 'auditBandExcellent' };
  if (total >= 72) return { tier: 'strong', label: 'Strong — competitive profile', labelKey: 'auditBandStrong' };
  if (total >= 58) return { tier: 'good', label: 'Good — minor improvements needed', labelKey: 'auditBandGood' };
  if (total >= 42) return { tier: 'developing', label: 'Developing — notable gaps to address', labelKey: 'auditBandDeveloping' };
  return { tier: 'needs_work', label: 'Needs work — significant revision required', labelKey: 'auditBandNeedsWork' };
}

function buildRecommendations({ weaknesses, quality, atsPro, keyword, overall }) {
  const recs = [];
  const seen = new Set();
  const push = (item) => {
    const key = item.id || item.action || item.label;
    if (seen.has(key)) return;
    seen.add(key);
    recs.push(item);
  };

  for (const w of weaknesses || []) {
    if (w.id === 'summary_missing' || w.id === 'summary_thin') {
      push({
        id: 'rec-summary',
        priority: 'high',
        action: 'Add a 2–3 sentence professional summary that states your role, years of experience, and top value proposition.',
        dimension: 'clarity',
      });
    }
    if (w.id === 'impact_thin' || w.id === 'weak_descriptions') {
      push({
        id: 'rec-impact',
        priority: 'high',
        action: 'Rewrite experience bullets with action verbs and quantified outcomes (%, revenue, team size, delivery time).',
        dimension: 'experience',
      });
    }
    if (w.id === 'dates_unclear' || w.id === 'missing_dates') {
      push({
        id: 'rec-dates',
        priority: 'medium',
        action: 'Add clear start/end dates to every role (e.g. Jan 2020 – Present) so recruiters can assess tenure quickly.',
        dimension: 'experience',
      });
    }
    if (w.id === 'skills_thin') {
      push({
        id: 'rec-skills',
        priority: 'medium',
        action: 'Expand your skills section with role-relevant tools and competencies — aim for 8–12 targeted keywords.',
        dimension: 'keyword',
      });
    }
    if (w.id === 'linkedin_missing') {
      push({
        id: 'rec-linkedin',
        priority: 'low',
        action: 'Include your LinkedIn URL in the header — recruiters often cross-check profiles before outreach.',
        dimension: 'trust',
      });
    }
  }

  for (const fix of quality?.fixes || []) {
    push({
      id: `rec-${fix.id}`,
      priority: fix.severity === 'high' ? 'high' : fix.severity === 'medium' ? 'medium' : 'low',
      action: fix.fix || fix.issue,
      dimension: fix.category || 'structure',
    });
  }

  for (const r of atsPro?.recommendations || []) {
    push({
      id: `rec-ats-${r.dimension || 'general'}`,
      priority: r.priority || 'medium',
      action: r.action,
      dimension: r.dimension || 'ats',
    });
  }

  if ((keyword?.missing || []).length >= 3) {
    push({
      id: 'rec-keywords',
      priority: 'medium',
      action: `Weave missing role keywords into your summary and experience: ${keyword.missing.slice(0, 4).join(', ')}.`,
      dimension: 'keyword',
    });
  }

  if (overall < 58) {
    push({
      id: 'rec-overall',
      priority: 'high',
      action: 'Prioritize contact completeness, dated experience entries, and a concise summary before applying to competitive roles.',
      dimension: 'structure',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
  return recs.slice(0, 8);
}

function recruiterHeadline(review, overall, name, title) {
  const who = name ? `${name}` : 'This candidate';
  const role = title ? ` (${title})` : '';
  if (overall >= 82) {
    return `${who}${role} presents a polished, ATS-friendly profile that would pass initial recruiter screening.`;
  }
  if (overall >= 65) {
    return `${who}${role} shows a solid foundation — a few targeted edits would strengthen shortlist potential.`;
  }
  if (overall >= 48) {
    return `${who}${role} has extractable experience but gaps in structure and clarity would slow recruiter review.`;
  }
  return `${who}${role} requires substantial revision before this CV would compete in a typical ATS + recruiter workflow.`;
}

/**
 * @param {object|null} input
 * @param {{ cvData?: object, cvDataV2?: object, resumeData?: object, finalResumeData?: object, jobDescription?: string, importQualityScore?: object }} [opts]
 */
export function runRecruiterAuditEngine(input, opts = {}) {
  const merged = typeof input === 'object' && input !== null && !opts.cvData && !opts.cvDataV2
    ? input
    : { cvData: input, ...opts };

  const profile = resolveProfile(merged);
  if (!profile) {
    return {
      version: RECRUITER_AUDIT_ENGINE,
      ready: false,
      overall: 0,
      band: bandFromOverall(0),
      dimensions: Object.values(AUDIT_DIMENSIONS).map((d) => ({ ...d, score: 0 })),
      strengths: [],
      weaknesses: [],
      recommendations: [],
      reviewText: '',
      headline: 'Import your CV to generate a recruiter audit.',
      quality: null,
      atsPro: null,
      trust: null,
    };
  }

  const p = normalizeCvForAtsScoring(profile);
  const archetype = detectCvArchetype(p);
  const quality = auditRecruiterQuality(profile, { resumeData: merged.resumeData });
  const h8 = computeRecruiterScoreV2(profile);
  const atsPro = analyzeAtsPro(p, { jobDescription: merged.jobDescription || merged.job || '' });
  const trustReport = computeTrustScore(profile, {
    finalResumeData: merged.finalResumeData ?? null,
    resumeData: merged.resumeData ?? null,
    importQualityScore: merged.importQualityScore ?? null,
  });
  const trustedReview = computeTrustedCvReview(profile, {
    finalResumeData: merged.finalResumeData ?? null,
    resumeData: merged.resumeData ?? null,
  });
  const keyword = keywordCoverageScore(p, archetype);

  const scores = {
    ats: clamp(atsPro?.score ?? h8?.total ?? quality?.panel?.ats ?? 0),
    clarity: scoreClarity(p, atsPro, quality, merged.cvDataV2),
    experience: scoreExperience(p, h8, quality),
    structure: scoreStructure(p, atsPro, h8),
    keyword: keyword.score,
    trust: clamp(trustReport?.trustScore?.rawWeighted ?? trustReport?.total ?? h8?.total ?? 0),
  };

  let overall = 0;
  const dimensions = Object.values(AUDIT_DIMENSIONS).map((dim) => {
    const score = scores[dim.id] ?? 0;
    overall += score * (dim.weight / 100);
    return { ...dim, score, weightPct: dim.weight };
  });
  overall = clamp(overall);

  const strengths = (trustedReview?.strengths || []).slice(0, 6).map((s) => ({
    id: s.id,
    label: s.label,
    labelKey: s.labelKey,
    kind: 'strength',
  }));

  const weaknesses = [
    ...(trustedReview?.weaknesses || []),
    ...(trustedReview?.missing || []).map((m) => ({ ...m, kind: 'missing' })),
  ]
    .slice(0, 8)
    .map((w) => ({
      id: w.id,
      label: w.label,
      labelKey: w.labelKey,
      kind: w.kind || 'weakness',
    }));

  const recommendations = buildRecommendations({
    weaknesses,
    quality,
    atsPro,
    keyword,
    overall,
  });

  const band = bandFromOverall(overall);
  const headline = recruiterHeadline(trustedReview, overall, cleanText(p?.name), cleanText(p?.title));
  const reviewText = formatRecruiterReviewText({
    overall,
    band,
    dimensions,
    strengths,
    weaknesses,
    recommendations,
    headline,
    name: cleanText(p?.name),
    title: cleanText(p?.title),
    archetype,
  });

  return {
    version: RECRUITER_AUDIT_ENGINE,
    ready: true,
    overall,
    score: overall,
    band,
    dimensions,
    scores,
    strengths,
    weaknesses,
    recommendations,
    headline,
    reviewText,
    archetype,
    keywordCoverage: keyword,
    quality,
    atsPro,
    trust: trustReport,
    trustedReview,
    h8,
    hallucinationSafe: true,
    analyzedAt: Date.now(),
  };
}

/**
 * Recruiter-style narrative block (markdown).
 * @param {object} audit
 */
export function formatRecruiterReviewText(audit) {
  if (!audit) return '';
  const lines = [];
  const nameLine = [audit.name, audit.title].filter(Boolean).join(' · ');
  lines.push('# Recruiter Review');
  lines.push('');
  if (nameLine) lines.push(`**Candidate:** ${nameLine}`);
  lines.push(`**Overall score:** ${audit.overall}/100 — ${audit.band?.label || ''}`);
  lines.push('');
  lines.push(audit.headline || '');
  lines.push('');
  lines.push('## Dimension scores');
  lines.push('');
  lines.push('| Dimension | Score |');
  lines.push('|-----------|------:|');
  for (const d of audit.dimensions || []) {
    lines.push(`| ${d.label} | ${d.score} |`);
  }
  lines.push('');
  lines.push('## Strengths');
  lines.push('');
  if (audit.strengths?.length) {
    for (const s of audit.strengths) lines.push(`- ${s.label}`);
  } else {
    lines.push('- _(No standout strengths detected — focus on recommendations below.)_');
  }
  lines.push('');
  lines.push('## Weaknesses');
  lines.push('');
  if (audit.weaknesses?.length) {
    for (const w of audit.weaknesses) lines.push(`- ${w.label}`);
  } else {
    lines.push('- _(No critical weaknesses flagged.)_');
  }
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  if (audit.recommendations?.length) {
    audit.recommendations.forEach((r, i) => {
      lines.push(`${i + 1}. **[${r.priority}]** ${r.action}`);
    });
  } else {
    lines.push('1. Profile is in good shape — tailor keywords to each target role before applying.');
  }
  lines.push('');
  if (audit.archetype) {
    lines.push(`_Archetype: ${audit.archetype} · Engine: ${RECRUITER_AUDIT_ENGINE}_`);
  }
  return lines.join('\n');
}

/**
 * Attach audit to an import / extraction result object.
 * @param {object} result
 */
export function attachRecruiterAuditToImportResult(result = {}) {
  if (!result || typeof result !== 'object') return result;
  const cvData =
    result.templateData ||
    result.cvData ||
    (result.cvDataV2 ? cvDataV2ToLegacy(result.cvDataV2) : null);
  if (!cvData) return result;

  const audit = runRecruiterAuditEngine({
    cvData,
    cvDataV2: result.cvDataV2 || null,
    resumeData: result.resumeData || null,
    finalResumeData: result.finalResumeData || result.resumeData || null,
    importQualityScore: result.importQualityScore || null,
  });

  return {
    ...result,
    recruiterAudit: audit,
    auditScore: audit.overall,
    auditReviewText: audit.reviewText,
  };
}
