/**
 * Recruiter Command Center — professional audit sections (fact-grounded).
 * McKinsey / Bain / BCG / LinkedIn Talent Solutions direction.
 */

import { detectCvArchetype, normalizeCvForAtsScoring, ARCHETYPE_PROFILES } from './ats-quality-h8.js';
import { analyzeAtsPro } from './ats-engine-pro.js';
import { resolveChecklistProfile } from './recruiter-checklist-source.js';

export const RECRUITER_COMMAND_CENTER_V2 = 'RECRUITER_COMMAND_CENTER_V2';

const SENIORITY_RE = /\b(intern|junior|associate|senior|lead|principal|staff|manager|director|head|chief|vp|vice president|partner|founder|freelance)\b/i;

const TITLE_KEYWORD_SEEDS = [
  'design', 'develop', 'engineer', 'market', 'sales', 'consult', 'manage', 'analyst',
  'product', 'creative', 'finance', 'data', 'project', 'strategy', 'brand', 'digital',
  'software', 'graphic', 'ux', 'ui', 'research', 'operations', 'hr', 'recruit',
];

const INTERVIEW_RISK_IDS = new Set([
  'summary_missing',
  'summary_thin',
  'dates_unclear',
  'impact_thin',
  'experience_thin',
  'title_missing',
  'skills_thin',
  'portfolio_missing',
  'linkedin_missing',
]);

const SALARY_BANDS_EUR = Object.freeze({
  intern: { min: 18, max: 32 },
  junior: { min: 32, max: 48 },
  mid: { min: 45, max: 72 },
  senior: { min: 62, max: 98 },
  lead: { min: 78, max: 115 },
  manager: { min: 72, max: 110 },
  director: { min: 95, max: 145 },
  executive: { min: 120, max: 200 },
  consultant: { min: 55, max: 95 },
  default: { min: 40, max: 75 },
});

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
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

function estimateYears(p) {
  const text = cvBlob(p);
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  if (years.length < 2) return years.length ? 1 : 0;
  const span = Math.max(...years) - Math.min(...years);
  return clamp(span, 0, 40);
}

function detectSeniority(title) {
  const t = cleanText(title).toLowerCase();
  if (/\b(intern|stage|stagiaire)\b/.test(t)) return 'intern';
  if (/\b(junior|jr\.?|entry)\b/.test(t)) return 'junior';
  if (/\b(senior|sr\.?|lead|principal|staff)\b/.test(t)) return 'senior';
  if (/\b(manager|head of|team lead)\b/.test(t)) return 'manager';
  if (/\b(director|vp|vice president|chief|cxo)\b/.test(t)) return 'director';
  if (/\b(founder|partner|executive)\b/.test(t)) return 'executive';
  if (/\bconsult/.test(t)) return 'consultant';
  return 'mid';
}

function salaryBand(p, archetype) {
  const title = cleanText(p?.title);
  const seniority = detectSeniority(title);
  const years = estimateYears(p);
  let band = SALARY_BANDS_EUR[seniority] || SALARY_BANDS_EUR.default;
  if (archetype === 'consultant') band = SALARY_BANDS_EUR.consultant;
  if (archetype === 'executive' || seniority === 'director' || seniority === 'executive') {
    band = SALARY_BANDS_EUR.executive;
  }
  const yearBoost = Math.min(12, Math.floor(years / 2) * 2);
  const min = band.min + yearBoost;
  const max = band.max + yearBoost;
  return {
    currency: 'EUR',
    min,
    max,
    label: `€${min}k–€${max}k`,
    seniority,
    years,
    disclaimerKey: 'rccSalaryDisclaimer',
    disclaimer: 'Indicative gross annual range based on title and experience — not employer-specific.',
  };
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

function keywordCoverage(p, archetype) {
  const targets = targetKeywords(p, archetype);
  const blob = cvBlob(p);
  const matched = [];
  const missing = [];
  for (const kw of targets) {
    if (blob.includes(kw)) matched.push(kw);
    else missing.push(kw);
  }
  const pct = targets.length ? clamp((matched.length / targets.length) * 100) : 0;
  return { pct, matched, missing, targets, tier: pct >= 75 ? 'strong' : pct >= 50 ? 'moderate' : 'weak' };
}

function atsCompatibility(scoreReport, profile, jobDescription) {
  const pro = analyzeAtsPro(profile, { jobDescription });
  if (pro?.ready) {
    return {
      engine: pro.version,
      score: pro.score,
      corePct: pro.score,
      tier: pro.band?.tier || (pro.score >= 82 ? 'high' : pro.score >= 62 ? 'moderate' : 'low'),
      confidence: pro.confidence,
      dimensions: (pro.dimensions || []).map((d) => ({
        id: d.id,
        label: d.label,
        points: d.score,
        max: 100,
        pct: d.pct,
      })),
      highlights: pro.highlights || [],
      gaps: pro.gaps || [],
      risks: pro.risks || [],
      recommendations: pro.recommendations || [],
      benchmarks: pro.benchmarks || [],
    };
  }

  const breakdown = scoreReport?.breakdown || [];
  const formatting = breakdown.find((c) => c.id === 'formatting');
  const skills = breakdown.find((c) => c.id === 'skills');
  const experience = breakdown.find((c) => c.id === 'experience');
  const dims = breakdown.map((c) => ({
    id: c.id,
    label: c.label || c.id,
    points: c.points ?? 0,
    max: c.max ?? 0,
    pct: c.max ? clamp((c.points / c.max) * 100) : 0,
  }));
  const corePct =
    dims.length > 0
      ? clamp(dims.reduce((s, d) => s + d.pct, 0) / dims.length)
      : clamp(scoreReport?.total ?? 0);
  return {
    engine: 'legacy',
    score: clamp(scoreReport?.total ?? 0),
    corePct,
    tier: corePct >= 80 ? 'high' : corePct >= 55 ? 'moderate' : 'low',
    dimensions: dims.slice(0, 6),
    highlights: [
      experience?.points >= (experience?.max || 1) * 0.7 ? 'Experience section ATS-parseable' : null,
      skills?.points >= (skills?.max || 1) * 0.6 ? 'Skills keywords present' : null,
      formatting?.points >= (formatting?.max || 1) * 0.8 ? 'Clean formatting for parsers' : null,
    ].filter(Boolean),
    gaps: [
      experience?.points < (experience?.max || 1) * 0.5 ? 'Experience needs dates and structure' : null,
      skills?.points < (skills?.max || 1) * 0.5 ? 'Skills section thin for ATS' : null,
      formatting?.points < (formatting?.max || 1) * 0.6 ? 'Formatting may confuse ATS parsers' : null,
    ].filter(Boolean),
    risks: [],
    recommendations: [],
    benchmarks: [],
  };
}

function marketPositioning(p, archetype, score, years) {
  const arch = ARCHETYPE_PROFILES[archetype] || ARCHETYPE_PROFILES.general;
  const title = cleanText(p?.title) || 'Professional';
  let tier = 'competitive';
  let headline = 'Competitive profile for target role';
  if (score >= 82 && years >= 3) {
    tier = 'strong';
    headline = 'Strong market positioning';
  } else if (score < 55 || years < 1) {
    tier = 'developing';
    headline = 'Profile needs differentiation';
  }
  const signals = [];
  if (years >= 5) signals.push(`${years}+ years track record`);
  if (arch.portfolioMatters && (p?.portfolio || p?.linkedin)) signals.push('Portfolio / professional presence');
  if ((p?.skills || []).length >= 8) signals.push('Broad skill footprint');
  if (archetype !== 'general') signals.push(`${archetype.charAt(0).toUpperCase() + archetype.slice(1)} market segment`);
  return {
    tier,
    headline,
    title,
    archetype,
    years,
    signals: signals.slice(0, 4),
    narrative: `Positioned as a ${title} candidate in the ${archetype} segment with ${years || 'limited'} years of visible experience.`,
  };
}

function interviewRiskAreas(review) {
  const risks = [];
  for (const w of review?.weaknesses || []) {
    if (INTERVIEW_RISK_IDS.has(w.id)) {
      risks.push({
        id: w.id,
        level: ['summary_missing', 'impact_thin', 'dates_unclear', 'title_missing'].includes(w.id) ? 'high' : 'medium',
        label: w.label,
        labelKey: w.labelKey,
      });
    }
  }
  for (const m of review?.missing || []) {
    if (['email', 'experience', 'name', 'title'].includes(m.id)) {
      risks.push({
        id: m.id,
        level: 'high',
        label: m.label,
        labelKey: m.labelKey,
      });
    }
  }
  const seen = new Set();
  return risks.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).slice(0, 6);
}

function recruiterConfidence(scoreReport) {
  const total = clamp(scoreReport?.total ?? 0);
  const iq = scoreReport?.importQualityScore;
  const extraction = clamp(iq?.extraction ?? iq?.score ?? total);
  const completeness = clamp(iq?.completeness ?? scoreReport?.completeness?.score ?? total);
  const confidence = clamp(total * 0.5 + extraction * 0.25 + completeness * 0.25);
  return {
    score: confidence,
    tier: confidence >= 80 ? 'high' : confidence >= 60 ? 'moderate' : 'low',
    factors: [
      { label: 'Recruiter score', pct: total },
      { label: 'Extraction quality', pct: extraction },
      { label: 'Profile completeness', pct: completeness },
    ],
  };
}

function executiveSummary(review, scoreReport, market) {
  const rv = review || {};
  return {
    headline: rv.headline || market.headline,
    headlineKey: rv.headlineKey,
    summary: rv.summary || market.narrative,
    summaryKey: rv.summaryKey,
    score: clamp(scoreReport?.total ?? 0),
    tier: rv.tier || (scoreReport?.total >= 75 ? 'ready' : scoreReport?.total >= 55 ? 'good' : 'needs_work'),
  };
}

/**
 * @param {{ scoreReport?: object|null, cvData?: object|null, finalResumeData?: object|null, resumeData?: object|null, jobDescription?: string, job?: string }} input
 */
export function buildRecruiterCommandCenterAudit(input = {}) {
  const scoreReport = input.scoreReport || null;
  const profile = resolveChecklistProfile({
    cvData: input.cvData,
    finalResumeData: input.finalResumeData,
    resumeData: input.resumeData,
  });

  if (!profile || !scoreReport) {
    return {
      version: RECRUITER_COMMAND_CENTER_V2,
      ready: false,
      recruiterConfidence: { score: 0, tier: 'low', factors: [] },
      executiveSummary: {
        headline: 'Import your CV',
        summary: 'Upload or paste your CV to generate a recruiter audit.',
        score: 0,
        tier: 'empty',
      },
      strengths: [],
      weaknesses: [],
      atsCompatibility: { score: 0, corePct: 0, tier: 'low', dimensions: [], highlights: [], gaps: [] },
      keywordCoverage: { pct: 0, matched: [], missing: [], targets: [], tier: 'weak' },
      marketPositioning: { tier: 'developing', headline: '—', signals: [], narrative: '—' },
      salaryEstimation: null,
      interviewRiskAreas: [],
    };
  }

  const p = normalizeCvForAtsScoring(profile);
  const archetype = detectCvArchetype(p);
  const review = scoreReport.cvReview || scoreReport.trustedReview || null;
  const years = estimateYears(p);
  const market = marketPositioning(p, archetype, scoreReport.total ?? 0, years);

  return {
    version: RECRUITER_COMMAND_CENTER_V2,
    ready: true,
    recruiterConfidence: recruiterConfidence(scoreReport),
    executiveSummary: executiveSummary(review, scoreReport, market),
    strengths: (review?.strengths || []).slice(0, 8),
    weaknesses: (review?.weaknesses || []).slice(0, 8),
    missing: (review?.missing || []).slice(0, 6),
    atsCompatibility: atsCompatibility(scoreReport, p, input.jobDescription || input.job || ''),
    atsPro: analyzeAtsPro(p, { jobDescription: input.jobDescription || input.job || '' }),
    keywordCoverage: keywordCoverage(p, archetype),
    marketPositioning: market,
    salaryEstimation: salaryBand(p, archetype),
    interviewRiskAreas: interviewRiskAreas(review),
    archetype,
  };
}
