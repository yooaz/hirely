/**
 * ATS Engine Pro — real ATS compatibility checker.
 * Analyzes keywords, format, sections, readability, contact, experience, skills.
 * Benchmarks: Greenhouse, Lever, Workday, SmartRecruiters.
 */

import {
  detectCvArchetype,
  normalizeCvForAtsScoring,
  ARCHETYPE_PROFILES,
} from './ats-quality-h8.js';

export const ATS_ENGINE_PRO = 'ATS_ENGINE_PRO_V1';

/** @type {Record<string, { id: string, label: string, labelKey: string, weight: number }>} */
export const ATS_PRO_DIMENSIONS = Object.freeze({
  keywords: { id: 'keywords', label: 'Keywords', labelKey: 'atsProKeywords', weight: 14 },
  format: { id: 'format', label: 'Format', labelKey: 'atsProFormat', weight: 14 },
  sections: { id: 'sections', label: 'Sections', labelKey: 'atsProSections', weight: 16 },
  readability: { id: 'readability', label: 'Readability', labelKey: 'atsProReadability', weight: 12 },
  contact: { id: 'contact', label: 'Contact', labelKey: 'atsProContact', weight: 14 },
  experience: { id: 'experience', label: 'Experience', labelKey: 'atsProExperience', weight: 20 },
  skills: { id: 'skills', label: 'Skills relevance', labelKey: 'atsProSkills', weight: 20 },
});

/** Platform weight profiles (must sum to 100) */
export const ATS_PLATFORM_BENCHMARKS = Object.freeze({
  greenhouse: {
    id: 'greenhouse',
    label: 'Greenhouse',
    vendor: 'Greenhouse',
    weights: {
      sections: 20,
      contact: 15,
      experience: 25,
      format: 15,
      keywords: 10,
      readability: 8,
      skills: 7,
    },
    notes: 'Strong structured-field parser; rewards standard headings and parseable experience blocks.',
  },
  lever: {
    id: 'lever',
    label: 'Lever',
    vendor: 'Lever',
    weights: {
      experience: 22,
      contact: 18,
      sections: 18,
      skills: 12,
      keywords: 12,
      format: 10,
      readability: 8,
    },
    notes: 'Contact + chronology sensitive; expects clear role/company/date tuples.',
  },
  workday: {
    id: 'workday',
    label: 'Workday',
    vendor: 'Workday',
    weights: {
      format: 22,
      sections: 20,
      experience: 20,
      skills: 15,
      contact: 12,
      keywords: 6,
      readability: 5,
    },
    notes: 'Strict formatting; penalizes tables, columns, and non-standard section labels.',
  },
  smartrecruiters: {
    id: 'smartrecruiters',
    label: 'SmartRecruiters',
    vendor: 'SmartRecruiters',
    weights: {
      keywords: 28,
      skills: 22,
      experience: 18,
      sections: 12,
      contact: 10,
      format: 5,
      readability: 5,
    },
    notes: 'Keyword and skills taxonomy heavy; boolean search compatibility matters.',
  },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YEAR_RE = /\b((?:19|20)\d{2})\b/;
const PARSER_GARBAGE_RE = /\b(id=|href=|instagram\.com|utm_|gclid=|font-family:|@media)\b/i;
const SPECIAL_CHAR_HEAVY_RE = /[^\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF]{6,}/;
const ALL_CAPS_BLOCK_RE = /^[A-Z\s\d.,!?\-–—]{24,}$/m;
const ACTION_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;
const METRIC_RE =
  /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;

const ARCHETYPE_SKILL_SEEDS = Object.freeze({
  designer: ['figma', 'illustration', 'branding', 'adobe', 'creative', 'visual', 'typography', 'packaging'],
  developer: ['javascript', 'python', 'react', 'node', 'sql', 'aws', 'api', 'git', 'typescript', 'docker'],
  marketing: ['seo', 'campaign', 'content', 'analytics', 'social', 'brand', 'crm', 'hubspot', 'growth'],
  sales: ['pipeline', 'quota', 'crm', 'negotiation', 'b2b', 'saas', 'prospecting', 'revenue'],
  student: ['internship', 'university', 'research', 'project', 'coursework'],
  executive: ['strategy', 'leadership', 'p&l', 'board', 'transformation', 'stakeholder'],
  academic: ['research', 'publication', 'phd', 'methodology', 'teaching'],
  consultant: ['strategy', 'advisory', 'stakeholder', 'analysis', 'framework', 'client'],
  recruiter: ['sourcing', 'talent', 'hiring', 'ats', 'interview', 'pipeline'],
  product: ['roadmap', 'agile', 'stakeholder', 'user research', 'prd', 'metrics'],
  general: ['communication', 'project', 'analysis', 'collaboration', 'microsoft', 'excel'],
});

const STANDARD_SECTION_IDS = ['experience', 'education', 'skills', 'summary', 'contact'];

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function cvBlob(p) {
  return [
    p?.name,
    p?.title,
    p?.summary,
    ...(p?.skills || []),
    ...(p?.tools || []),
    ...(p?.experience || []),
    ...(p?.education || []),
    ...(p?.languages || []),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function titleTokens(title) {
  return cleanText(title)
    .toLowerCase()
    .split(/[\s/|,–—\-]+/)
    .filter((w) => w.length > 3 && !/^(and|the|for|with|senior|junior|lead)$/.test(w));
}

function jobTokens(jobDescription) {
  const blob = cleanText(jobDescription).toLowerCase();
  if (!blob) return [];
  const words = blob.match(/\b[a-z][a-z0-9+#.-]{2,}\b/g) || [];
  const freq = new Map();
  for (const w of words) {
    if (w.length < 4 || /^(with|that|this|will|have|your|from|they|their|about)$/.test(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
}

function analyzeKeywords(p, archetype, jobDescription) {
  const blob = cvBlob(p);
  const titleKw = titleTokens(p?.title);
  const seeds = new Set([...(ARCHETYPE_SKILL_SEEDS[archetype] || ARCHETYPE_SKILL_SEEDS.general), ...titleKw]);
  const archetypeTargets = [...seeds].slice(0, 12);
  const archetypeMatched = archetypeTargets.filter((kw) => blob.includes(kw));
  const archetypeMissing = archetypeTargets.filter((kw) => !blob.includes(kw));
  const archetypeScore = archetypeTargets.length
    ? (archetypeMatched.length / archetypeTargets.length) * 100
    : 35;

  const jobKw = jobTokens(jobDescription);
  const jobMatched = jobKw.filter((k) => blob.includes(k));
  const jobMissing = jobKw.filter((k) => !blob.includes(k));
  const jobScore = jobKw.length ? (jobMatched.length / jobKw.length) * 100 : null;

  let score;
  if (jobScore !== null) {
    score = clamp(archetypeScore * 0.38 + jobScore * 0.62);
  } else {
    score = clamp(archetypeScore * 0.85 + (archetypeMatched.length >= 4 ? 15 : 0));
  }

  const matched = [...new Set([...archetypeMatched, ...jobMatched])];
  const missing = [...new Set([...archetypeMissing, ...jobMissing])].slice(0, 8);

  const passes = [];
  const issues = [];
  if (archetypeMatched.length >= 5) passes.push('Strong role keyword footprint');
  if (titleKw.length && titleKw.some((t) => blob.includes(t))) passes.push('Title keywords echoed in body');
  if (jobScore !== null && jobScore >= 55) passes.push('Job description keyword alignment');
  if (jobScore !== null && jobScore < 35) issues.push('CV text misses many job posting keywords');
  if (missing.length > 8) issues.push('Several target keywords missing from CV text');
  if (!titleKw.length) issues.push('Job title too short for keyword anchoring');

  return {
    id: 'keywords',
    score: clamp(score),
    matched,
    missing,
    targets: [...archetypeTargets, ...jobKw].slice(0, 16),
    jobMatched,
    jobMissing: jobMissing.slice(0, 6),
    passes,
    issues,
  };
}

function analyzeFormat(p) {
  let score = 88;
  const passes = [];
  const issues = [];

  const expLines = (p?.experience || []).map(String);
  for (const line of expLines) {
    if (line.length > 340) {
      score -= 18;
      issues.push('Overlong experience lines may break parsers');
      break;
    }
    if (PARSER_GARBAGE_RE.test(line)) {
      score -= 28;
      issues.push('HTML or parser noise detected in experience text');
      break;
    }
  }

  const summary = cleanText(p?.summary);
  if (summary && PARSER_GARBAGE_RE.test(summary)) {
    score -= 20;
    issues.push('Summary contains non-parseable markup or URLs');
  }
  if (summary && SPECIAL_CHAR_HEAVY_RE.test(summary)) {
    score -= 12;
    issues.push('Unusual symbols may confuse Workday parsers');
  }
  if (ALL_CAPS_BLOCK_RE.test(summary)) {
    score -= 10;
    issues.push('All-caps blocks reduce parser readability');
  }

  if (score >= 75) passes.push('Clean, text-first formatting');
  if (!issues.length) passes.push('No parser-blocking noise detected');

  return { id: 'format', score: clamp(score), passes, issues };
}

function hasEmail(p) {
  return EMAIL_RE.test(cleanText(p?.email));
}
function hasPhone(p) {
  const digits = String(p?.phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}
function hasLocation(p) {
  return cleanText(p?.location).length >= 2;
}
function hasLinkedIn(p) {
  const v = cleanText(p?.linkedin);
  return /linkedin\.com/i.test(v) || /^https?:\/\//i.test(v);
}

function analyzeSections(p, profile) {
  const present = [];
  const missing = [];
  let score = 0;

  const checks = {
    contact: hasEmail(p) || hasPhone(p),
    experience: (p?.experience || []).length > 0 || (p?.experiences || []).length > 0,
    education: (p?.education || []).length > 0 || profile.educationOptional,
    skills: (p?._skillsCombined || []).length > 0,
    summary: cleanText(p?.summary).length >= 40,
  };

  if (checks.contact) {
    present.push('contact');
    score += 22;
  } else missing.push('contact');
  if (checks.experience) {
    present.push('experience');
    score += 28;
  } else missing.push('experience');
  if (checks.education) {
    present.push('education');
    score += 16;
  } else missing.push('education');
  if (checks.skills) {
    present.push('skills');
    score += 20;
  } else missing.push('skills');
  if (checks.summary) {
    present.push('summary');
    score += 14;
  } else missing.push('summary');

  const passes = present.map((s) => `Section present: ${s}`);
  const issues = missing.map((s) => `Missing or thin section: ${s}`);

  return { id: 'sections', score: clamp(score), present, missing, passes, issues };
}

function analyzeReadability(p) {
  let score = 50;
  const passes = [];
  const issues = [];
  const summary = cleanText(p?.summary);
  const exp = (p?.experience || []).map(String).filter(Boolean);

  if (summary.length >= 50 && summary.length <= 480) {
    score += 22;
    passes.push('Summary length is ATS-friendly');
  } else if (!summary.length) {
    score -= 12;
    issues.push('No professional summary for quick scan');
  } else if (summary.length > 480) {
    score -= 8;
    issues.push('Summary may be too long for 6-second scan');
  }

  const actionLines = exp.filter((l) => ACTION_RE.test(l)).length;
  const metricLines = exp.filter((l) => METRIC_RE.test(l)).length;
  if (actionLines >= 2) {
    score += 16;
    passes.push('Action-oriented experience bullets');
  } else if (exp.length && !actionLines) {
    score -= 10;
    issues.push('Experience lacks action verbs');
  }
  if (metricLines >= 1) {
    score += 12;
    passes.push('Quantified impact present');
  }

  const avgLen = exp.length ? exp.reduce((s, l) => s + l.length, 0) / exp.length : 0;
  if (avgLen > 0 && avgLen < 180) {
    score += 8;
    passes.push('Concise bullet density');
  } else if (avgLen > 260) {
    score -= 8;
    issues.push('Bullets are dense — split for readability');
  }

  return { id: 'readability', score: clamp(score), passes, issues };
}

function analyzeContact(p) {
  let score = 0;
  const passes = [];
  const issues = [];

  if (hasEmail(p)) {
    score += 42;
    passes.push('Email present — required by most ATS');
  } else issues.push('Email missing — high rejection risk');
  if (hasPhone(p)) {
    score += 22;
    passes.push('Phone listed');
  } else issues.push('Phone missing');
  if (hasLocation(p)) {
    score += 18;
    passes.push('Location helps geo filters');
  }
  if (hasLinkedIn(p)) {
    score += 18;
    passes.push('LinkedIn URL parseable');
  }

  return { id: 'contact', score: clamp(score), passes, issues };
}

function structuredDatesPresent(p) {
  return (p?.experiences || []).some((e) => e?.startDate || e?.dates || YEAR_RE.test(String(e?.endDate || '')));
}

function analyzeExperience(p, profile) {
  const exp = (p?.experience || []).map(String).filter(Boolean);
  const structured = p?.experiences || [];
  let score = 0;
  const passes = [];
  const issues = [];

  if (!exp.length && !structured.length) {
    return {
      id: 'experience',
      score: 0,
      passes: [],
      issues: ['No experience section — ATS will rank low'],
      entryCount: 0,
      datedCount: 0,
    };
  }

  score += 28;
  passes.push('Experience section detected');

  const target = profile.experienceTarget || 1;
  if (exp.length >= target) {
    score += 18;
    passes.push(`${exp.length} role entries`);
  } else {
    issues.push('Add more experience entries');
  }

  const dated = exp.filter((l) => YEAR_RE.test(l)).length;
  if (dated >= Math.min(exp.length, 1) || structuredDatesPresent(p)) {
    score += 24;
    passes.push('Date ranges present');
  } else {
    score -= 8;
    issues.push('Experience dates missing — chronology unclear');
  }

  const withCompanyRole = structured.filter((e) => e?.company && e?.role).length;
  if (withCompanyRole >= 1 || exp.some((l) => /[—–\-|]/.test(l))) {
    score += 16;
    passes.push('Company and role separated');
  } else {
    issues.push('Role/company structure unclear');
  }

  const bullets = structured.reduce((n, e) => n + (e?.bullets || []).filter(Boolean).length, 0);
  if (bullets >= 3 || exp.length >= 3) {
    score += 14;
    passes.push('Multiple impact lines per role');
  }

  return {
    id: 'experience',
    score: clamp(score),
    passes,
    issues,
    entryCount: exp.length || structured.length,
    datedCount: dated,
  };
}

function analyzeSkillsRelevance(p, archetype) {
  const skills = (p?._skillsCombined || []).map((s) => String(s).toLowerCase());
  const seeds = ARCHETYPE_SKILL_SEEDS[archetype] || ARCHETYPE_SKILL_SEEDS.general;
  const titleKw = titleTokens(p?.title);

  let score = 0;
  const passes = [];
  const issues = [];
  const relevant = [];
  const irrelevant = [];

  if (!skills.length) {
    return {
      id: 'skills',
      score: 8,
      passes: [],
      issues: ['Skills section empty — SmartRecruiters keyword match will fail'],
      relevant: [],
      count: 0,
    };
  }

  score += 20;
  passes.push(`${skills.length} skills listed`);

  for (const sk of skills) {
    const hit =
      seeds.some((seed) => sk.includes(seed) || seed.includes(sk)) ||
      titleKw.some((t) => sk.includes(t) || t.includes(sk));
    if (hit) relevant.push(sk);
    else if (skills.length > 6) irrelevant.push(sk);
  }

  const relevancePct = skills.length ? relevant.length / skills.length : 0;
  score += clamp(relevancePct * 55);
  if (relevancePct >= 0.5) passes.push('Skills align with target role');
  else issues.push('Several skills may not match role keywords');

  if (skills.length >= 5 && skills.length <= 18) {
    score += 15;
    passes.push('Skill count in ATS sweet spot (5–18)');
  } else if (skills.length > 22) {
    score -= 10;
    issues.push('Too many skills — dilutes keyword signal');
  } else if (skills.length < 3) {
    issues.push('Skills section thin for boolean search');
  }

  const dupes = skills.filter((s, i) => skills.indexOf(s) !== i);
  if (dupes.length) {
    score -= 6;
    issues.push('Duplicate skills detected');
  }

  return {
    id: 'skills',
    score: clamp(score),
    passes,
    issues,
    relevant: relevant.slice(0, 8),
    irrelevant: irrelevant.slice(0, 4),
    count: skills.length,
  };
}

function dimensionRows(analyses) {
  return Object.values(ATS_PRO_DIMENSIONS).map((meta) => {
    const a = analyses[meta.id] || { score: 0, passes: [], issues: [] };
    return {
      id: meta.id,
      label: meta.label,
      labelKey: meta.labelKey,
      weight: meta.weight,
      score: a.score,
      max: 100,
      pct: a.score,
      passes: a.passes || [],
      issues: a.issues || [],
      detail: a,
    };
  });
}

function weightedScore(analyses, weights) {
  let total = 0;
  let wSum = 0;
  for (const [id, w] of Object.entries(weights)) {
    const s = analyses[id]?.score ?? 0;
    total += s * w;
    wSum += w;
  }
  return wSum ? clamp(total / wSum) : 0;
}

function platformTier(score) {
  if (score >= 82) return 'high';
  if (score >= 62) return 'moderate';
  return 'low';
}

function buildPlatformBenchmarks(analyses) {
  return Object.values(ATS_PLATFORM_BENCHMARKS).map((platform) => {
    const score = weightedScore(analyses, platform.weights);
    const weakDims = Object.entries(platform.weights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id)
      .filter((id) => (analyses[id]?.score ?? 0) < 62);

    const risks = weakDims.map((id) => {
      const dim = ATS_PRO_DIMENSIONS[id];
      const issue = analyses[id]?.issues?.[0];
      return {
        id: `${platform.id}_${id}`,
        level: (analyses[id]?.score ?? 0) < 45 ? 'high' : 'medium',
        label: issue || `${dim?.label || id} below ${platform.label} threshold`,
        platform: platform.id,
        dimension: id,
      };
    });

    const passes = Object.entries(platform.weights)
      .filter(([id]) => (analyses[id]?.score ?? 0) >= 78)
      .slice(0, 3)
      .map(([id]) => `${ATS_PRO_DIMENSIONS[id]?.label}: strong`);

    return {
      id: platform.id,
      label: platform.label,
      vendor: platform.vendor,
      score,
      tier: platformTier(score),
      notes: platform.notes,
      topWeights: Object.entries(platform.weights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, w]) => ({ dimension: id, weight: w })),
      risks,
      passes,
    };
  });
}

function buildRisks(analyses, platforms) {
  /** @type {{ id: string, level: string, label: string, dimension: string, platform?: string }[]} */
  const risks = [];

  const riskRules = [
    { dim: 'contact', test: () => analyses.contact?.score < 45, id: 'contact_missing', level: 'high', label: 'Contact block incomplete — parsers may drop candidate' },
    { dim: 'format', test: () => analyses.format?.score < 55, id: 'format_noise', level: 'high', label: 'Formatting noise may break Workday / legacy parsers' },
    { dim: 'experience', test: () => analyses.experience?.score < 50, id: 'experience_structure', level: 'high', label: 'Experience structure not ATS-parseable' },
    { dim: 'sections', test: () => analyses.sections?.score < 55, id: 'sections_missing', level: 'high', label: 'Core ATS sections missing' },
    { dim: 'keywords', test: () => analyses.keywords?.score < 50, id: 'keywords_weak', level: 'medium', label: 'Keyword match weak for SmartRecruiters search' },
    { dim: 'skills', test: () => analyses.skills?.score < 50, id: 'skills_irrelevant', level: 'medium', label: 'Skills relevance low for role targeting' },
    { dim: 'readability', test: () => analyses.readability?.score < 48, id: 'readability_low', level: 'medium', label: 'Low scan readability for recruiter review' },
  ];

  for (const rule of riskRules) {
    if (rule.test()) {
      risks.push({ id: rule.id, level: rule.level, label: rule.label, dimension: rule.dim });
    }
  }

  for (const p of platforms) {
    for (const r of p.risks || []) {
      if (r.level === 'high' && !risks.some((x) => x.id === r.id)) risks.push(r);
    }
  }

  const seen = new Set();
  return risks
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, 8);
}

function buildRecommendations(analyses, risks, archetype) {
  const RECS = {
    contact_missing: { priority: 'high', action: 'Add a professional email and phone at the top of your CV.', dimension: 'contact' },
    format_noise: { priority: 'high', action: 'Remove HTML, URLs, and special symbols from body text — use plain text sections.', dimension: 'format' },
    experience_structure: { priority: 'high', action: 'Format each role as Company — Title — Dates with 2–4 bullet points.', dimension: 'experience' },
    sections_missing: { priority: 'high', action: 'Add standard sections: Experience, Education, Skills, and a short Summary.', dimension: 'sections' },
    keywords_weak: { priority: 'medium', action: 'Mirror your target job title and role keywords in summary and skills.', dimension: 'keywords' },
    skills_irrelevant: { priority: 'medium', action: `List 6–12 tools and skills relevant to ${archetype} roles; remove generic filler.`, dimension: 'skills' },
    readability_low: { priority: 'medium', action: 'Use action verbs and one metric per bullet; keep lines under 180 characters.', dimension: 'readability' },
  };

  const dimActions = {
    contact: analyses.contact?.issues?.[0] ? { priority: 'high', action: 'Add email, phone, and city for ATS contact parsing.', dimension: 'contact' } : null,
    experience: analyses.experience?.issues?.[0]
      ? { priority: 'high', action: 'Add year ranges to every role (e.g. 2020–Present).', dimension: 'experience' }
      : null,
    keywords: analyses.keywords?.missing?.length
      ? { priority: 'medium', action: `Add missing keywords: ${analyses.keywords.missing.slice(0, 4).join(', ')}.`, dimension: 'keywords' }
      : null,
    skills: analyses.skills?.issues?.[0]
      ? { priority: 'medium', action: 'Prioritize role-relevant skills; group tools separately.', dimension: 'skills' }
      : null,
  };

  const out = [];
  for (const r of risks) {
    const rec = RECS[r.id];
    if (rec) out.push({ ...rec, riskId: r.id });
  }
  for (const rec of Object.values(dimActions)) {
    if (rec && !out.some((o) => o.dimension === rec.dimension)) out.push(rec);
  }

  const order = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
  return out.slice(0, 6);
}

function computeConfidence(analyses, score) {
  const dims = Object.values(analyses).map((a) => a.score ?? 0);
  const spread = dims.length ? Math.max(...dims) - Math.min(...dims) : 0;
  const completeDims = dims.filter((d) => d >= 40).length;
  const signal = clamp(score * 0.55 + completeDims * 6 - spread * 0.15);
  return {
    score: signal,
    tier: signal >= 80 ? 'high' : signal >= 60 ? 'moderate' : 'low',
    factors: [
      { label: 'ATS composite score', pct: score },
      { label: 'Dimension consistency', pct: clamp(100 - spread) },
      { label: 'Section signal strength', pct: clamp(completeDims * 14) },
    ],
  };
}

function scoreBand(score) {
  if (score >= 82) return { label: 'Excellent', labelKey: 'atsProBandExcellent', tier: 'high' };
  if (score >= 65) return { label: 'Good', labelKey: 'atsProBandGood', tier: 'moderate' };
  if (score >= 45) return { label: 'Fair', labelKey: 'atsProBandFair', tier: 'moderate' };
  return { label: 'At risk', labelKey: 'atsProBandAtRisk', tier: 'low' };
}

/**
 * Run ATS Engine Pro analysis.
 * @param {object|null} cvData
 * @param {{ jobDescription?: string, job?: string, templateId?: string, timestamp?: number }} [opts]
 */
export function analyzeAtsPro(cvData, opts = {}) {
  if (!cvData || typeof cvData !== 'object') {
    return {
      version: ATS_ENGINE_PRO,
      ready: false,
      score: 0,
      atsScore: 0,
      band: scoreBand(0),
      confidence: { score: 0, tier: 'low', factors: [] },
      dimensions: [],
      risks: [{ id: 'empty', level: 'high', label: 'No CV data to analyze', dimension: 'sections' }],
      recommendations: [{ priority: 'high', action: 'Import or paste your CV to run ATS analysis.', dimension: 'sections' }],
      benchmarks: [],
      analyzedAt: opts.timestamp ?? Date.now(),
    };
  }

  const p = normalizeCvForAtsScoring(cvData);
  const archetype = detectCvArchetype(p);
  const profile = ARCHETYPE_PROFILES[archetype] || ARCHETYPE_PROFILES.general;
  const jobDescription = cleanText(opts.jobDescription || opts.job || '');

  const analyses = {
    keywords: analyzeKeywords(p, archetype, jobDescription),
    format: analyzeFormat(p),
    sections: analyzeSections(p, profile),
    readability: analyzeReadability(p),
    contact: analyzeContact(p),
    experience: analyzeExperience(p, profile),
    skills: analyzeSkillsRelevance(p, archetype),
  };

  const dimensions = dimensionRows(analyses);
  const composite = clamp(
    dimensions.reduce((s, d) => s + d.score * d.weight, 0) /
      dimensions.reduce((s, d) => s + d.weight, 0)
  );

  const benchmarks = buildPlatformBenchmarks(analyses);
  const risks = buildRisks(analyses, benchmarks);
  const recommendations = buildRecommendations(analyses, risks, archetype);
  const confidence = computeConfidence(analyses, composite);

  return {
    version: ATS_ENGINE_PRO,
    ready: true,
    pipeline: 'ats-engine-pro',
    archetype,
    score: composite,
    atsScore: composite,
    band: scoreBand(composite),
    confidence,
    dimensions,
    analyses,
    risks,
    recommendations,
    benchmarks,
    highlights: dimensions.filter((d) => d.pct >= 78).map((d) => `${d.label}: ${d.pct}%`),
    gaps: dimensions.filter((d) => d.pct < 55).map((d) => `${d.label}: needs work (${d.pct}%)`),
    analyzedAt: opts.timestamp ?? Date.now(),
  };
}

/** @deprecated alias */
export function computeAtsProScore(cvData, opts) {
  return analyzeAtsPro(cvData, opts);
}
