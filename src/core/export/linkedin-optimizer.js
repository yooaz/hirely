/**
 * HIRELY P3 — LinkedIn optimizer (deterministic, finalResumeData only).
 * No AI. No invented facts — only composes from locked profile fields.
 */

import { ROLE_KEYWORDS } from '../../data/dictionaries/roleKeywords.js';

export const LINKEDIN_OPTIMIZER = 'LINKEDIN_OPTIMIZER_V1';

const HEADLINE_MAX = 220;
const ABOUT_MAX = 2600;
const TOP_SKILLS_MAX = 10;
const KEYWORDS_MAX = 16;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'your',
  'you',
  'our',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'this',
  'that',
  'dans',
  'pour',
  'avec',
  'une',
  'des',
  'les',
  'est',
  'son',
  'ses',
]);

const ROLE_KEYWORD_PACKS = Object.freeze({
  designer: [
    'graphic design',
    'brand identity',
    'visual identity',
    'illustration',
    'packaging',
    'editorial design',
    'creative direction',
    'art direction',
    'adobe illustrator',
    'adobe indesign',
    'photoshop',
  ],
  product: [
    'product design',
    'user research',
    'ux',
    'ui',
    'design systems',
    'prototyping',
    'figma',
    'roadmap',
    'stakeholder management',
    'agile',
  ],
  marketing: [
    'digital marketing',
    'campaign management',
    'social media',
    'content strategy',
    'seo',
    'analytics',
    'crm',
    'brand strategy',
    'email marketing',
    'growth',
  ],
  developer: [
    'javascript',
    'typescript',
    'react',
    'node.js',
    'api',
    'software development',
    'git',
    'agile',
    'full stack',
    'cloud',
  ],
  default: [
    'project management',
    'collaboration',
    'communication',
    'problem solving',
    'leadership',
    'client relations',
    'strategy',
  ],
});

const METRIC_RE =
  /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function listLines(arr) {
  return (arr || []).map((x) => normSpace(x)).filter(Boolean);
}

/**
 * @param {object|null} data
 */
export function isFinalResumeDataInput(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.identity || typeof data.identity !== 'object') return false;
  if (data.meta?.rawText || data.meta?.cleanedText) return false;
  if (data._enterprise || data.structuredResume || data.audit) return false;
  return true;
}

function detectRoleFamily(title, skills, tools) {
  const blob = `${title} ${skills.join(' ')} ${tools.join(' ')}`.toLowerCase();
  if (/\b(illustrat|graphic|brand|packaging|creative|art director|motion)\b/.test(blob)) {
    return 'designer';
  }
  if (/\b(product designer|product design|ux|ui|figma)\b/.test(blob)) return 'product';
  if (/\b(marketing|growth|seo|campaign|social media|content)\b/.test(blob)) return 'marketing';
  if (/\b(developer|engineer|software|javascript|typescript|react|backend|frontend)\b/.test(blob)) {
    return 'developer';
  }
  return 'default';
}

function pickTopSkills(finalResumeData) {
  const skills = listLines(finalResumeData.skills);
  const tools = listLines(finalResumeData.tools);
  const seen = new Set();
  const out = [];
  for (const item of [...skills, ...tools]) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= TOP_SKILLS_MAX) break;
  }
  return out;
}

function experienceHighlights(experiences = []) {
  const out = [];
  for (const exp of experiences) {
    if (!exp || typeof exp !== 'object') continue;
    const role = normSpace(exp.role);
    const company = normSpace(exp.company);
    const dates = normSpace(exp.dates);
    const bullets = listLines(exp.bullets);
    const metricBullet = bullets.find((b) => METRIC_RE.test(b)) || bullets[0] || '';
    const head = [role, company, dates].filter(Boolean).join(' — ');
    if (!head && !metricBullet) continue;
    out.push(metricBullet ? `${head}${head ? ': ' : ''}${metricBullet}` : head);
    if (out.length >= 3) break;
  }
  return out;
}

function buildHeadline(finalResumeData) {
  const identity = finalResumeData.identity || {};
  const title = normSpace(identity.title);
  const location = normSpace(identity.location);
  const topSkills = pickTopSkills(finalResumeData).slice(0, 2);
  const parts = [];
  if (title) parts.push(title);
  if (topSkills.length) parts.push(topSkills.join(' · '));
  if (location) parts.push(location);
  let headline = parts.join(' | ');
  if (!headline && normSpace(identity.name)) headline = normSpace(identity.name);
  return headline.slice(0, HEADLINE_MAX);
}

function buildAbout(finalResumeData) {
  const identity = finalResumeData.identity || {};
  const summary = normSpace(finalResumeData.summary);
  const highlights = experienceHighlights(finalResumeData.experiences);
  const education = listLines(finalResumeData.education).slice(0, 1);
  const clients = listLines(finalResumeData.clients).slice(0, 4);
  const parts = [];

  if (summary.length >= 40) {
    parts.push(summary);
  } else if (summary) {
    parts.push(summary);
  } else if (normSpace(identity.title)) {
    parts.push(
      `${normSpace(identity.title)}${normSpace(identity.location) ? ` based in ${normSpace(identity.location)}` : ''}.`
    );
  }

  if (highlights.length) {
    parts.push('');
    parts.push('Highlights');
    highlights.forEach((line) => parts.push(`• ${line}`));
  }

  if (education.length) {
    parts.push('');
    parts.push(`Education: ${education[0]}`);
  }

  if (clients.length) {
    parts.push('');
    parts.push(`Clients & brands: ${clients.join(', ')}`);
  }

  const about = parts.join('\n').trim();
  return about.slice(0, ABOUT_MAX);
}

function tokenizeKeywordSource(finalResumeData) {
  const chunks = [
    normSpace(finalResumeData.identity?.title),
    normSpace(finalResumeData.identity?.name),
    normSpace(finalResumeData.summary),
    ...listLines(finalResumeData.skills),
    ...listLines(finalResumeData.tools),
    ...listLines(finalResumeData.languages),
    ...listLines(finalResumeData.clients),
    ...listLines(finalResumeData.education),
  ];

  for (const exp of finalResumeData.experiences || []) {
    if (!exp || typeof exp !== 'object') continue;
    chunks.push(normSpace(exp.role), normSpace(exp.company), normSpace(exp.dates));
    chunks.push(...listLines(exp.bullets));
  }

  return chunks.join(' ').toLowerCase();
}

function extractRecruiterKeywords(finalResumeData) {
  const corpus = tokenizeKeywordSource(finalResumeData);
  const title = normSpace(finalResumeData.identity?.title);
  const skills = listLines(finalResumeData.skills);
  const tools = listLines(finalResumeData.tools);
  const family = detectRoleFamily(title, skills, tools);
  const seen = new Set();
  const out = [];

  const add = (phrase) => {
    const p = normSpace(phrase);
    if (!p || p.length < 3) return;
    const key = p.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  if (title) {
    title
      .split(/\s*[\/|,&–—]+\s*/)
      .map((x) => normSpace(x))
      .filter(Boolean)
      .forEach(add);
  }

  for (const skill of [...skills, ...tools]) add(skill);

  for (const role of ROLE_KEYWORDS) {
    if (corpus.includes(role.toLowerCase())) add(role);
  }

  for (const phrase of ROLE_KEYWORD_PACKS[family] || ROLE_KEYWORD_PACKS.default) {
    if (corpus.includes(phrase.toLowerCase())) add(phrase);
  }

  for (const exp of finalResumeData.experiences || []) {
    if (!exp?.role) continue;
    add(exp.role);
    if (exp.company) add(exp.company);
  }

  return out.slice(0, KEYWORDS_MAX);
}

function findMissingKeywords(finalResumeData, presentKeywords) {
  const corpus = tokenizeKeywordSource(finalResumeData);
  const title = normSpace(finalResumeData.identity?.title);
  const skills = listLines(finalResumeData.skills);
  const tools = listLines(finalResumeData.tools);
  const family = detectRoleFamily(title, skills, tools);
  const pack = ROLE_KEYWORD_PACKS[family] || ROLE_KEYWORD_PACKS.default;
  const present = new Set(presentKeywords.map((k) => k.toLowerCase()));

  const missing = [];
  for (const phrase of pack) {
    const key = phrase.toLowerCase();
    if (present.has(key)) continue;
    if (corpus.includes(key)) continue;
    missing.push(phrase);
    if (missing.length >= 8) break;
  }
  return missing;
}

function strengthBand(score) {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs work';
}

function computeStrength(finalResumeData, recruiterKeywords, missingKeywords) {
  const identity = finalResumeData.identity || {};
  const title = normSpace(identity.title);
  const summary = normSpace(finalResumeData.summary);
  const topSkills = pickTopSkills(finalResumeData);
  const highlights = experienceHighlights(finalResumeData.experiences);
  const family = detectRoleFamily(title, listLines(finalResumeData.skills), listLines(finalResumeData.tools));
  const pack = ROLE_KEYWORD_PACKS[family] || ROLE_KEYWORD_PACKS.default;
  const covered = pack.filter((k) => recruiterKeywords.some((r) => r.toLowerCase() === k.toLowerCase())).length;
  const keywordPct = pack.length ? Math.round((covered / pack.length) * 100) : 0;

  const signals = [];
  let score = 0;

  if (title.length >= 3) {
    score += 20;
    signals.push({ id: 'headline', ok: true, label: 'Clear professional title' });
  } else {
    signals.push({ id: 'headline', ok: false, label: 'Add a clear job title' });
  }

  if (summary.length >= 80) {
    score += 25;
    signals.push({ id: 'about', ok: true, label: 'Summary ready for About section' });
  } else if (summary.length >= 40) {
    score += 15;
    signals.push({ id: 'about', ok: false, label: 'Expand summary for LinkedIn About' });
  } else {
    signals.push({ id: 'about', ok: false, label: 'Write a professional summary' });
  }

  if (topSkills.length >= 5) {
    score += 20;
    signals.push({ id: 'skills', ok: true, label: 'Strong skills coverage' });
  } else if (topSkills.length >= 2) {
    score += 10;
    signals.push({ id: 'skills', ok: false, label: 'Add more top skills' });
  } else {
    signals.push({ id: 'skills', ok: false, label: 'List core skills and tools' });
  }

  if (highlights.length >= 2) {
    score += 15;
    signals.push({ id: 'experience', ok: true, label: 'Experience highlights available' });
  } else if (highlights.length >= 1) {
    score += 8;
    signals.push({ id: 'experience', ok: false, label: 'Add more experience proof points' });
  } else {
    signals.push({ id: 'experience', ok: false, label: 'Add experience entries with outcomes' });
  }

  if (keywordPct >= 60) {
    score += 20;
    signals.push({ id: 'keywords', ok: true, label: 'Good recruiter keyword coverage' });
  } else if (keywordPct >= 30) {
    score += 10;
    signals.push({ id: 'keywords', ok: false, label: 'Increase role-relevant keywords' });
  } else {
    signals.push({ id: 'keywords', ok: false, label: 'Missing core recruiter keywords' });
  }

  if (normSpace(identity.linkedin)) {
    score = Math.min(100, score + 5);
    signals.push({ id: 'linkedin', ok: true, label: 'LinkedIn URL present on CV' });
  } else {
    signals.push({ id: 'linkedin', ok: false, label: 'Add LinkedIn URL to contact' });
  }

  if (missingKeywords.length > 4) score = Math.max(0, score - 8);

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    band: strengthBand(score),
    keywordCoverage: keywordPct,
    signals,
  };
}

function buildSuggestions(finalResumeData, strength, missingKeywords) {
  const suggestions = [];
  const identity = finalResumeData.identity || {};
  const headline = buildHeadline(finalResumeData);
  const about = buildAbout(finalResumeData);

  for (const signal of strength.signals || []) {
    if (signal.ok) continue;
    if (signal.id === 'headline') {
      suggestions.push({
        id: 'headline-title',
        priority: 'high',
        text: 'Use your CV job title as the first segment of your LinkedIn headline.',
      });
    }
    if (signal.id === 'about') {
      suggestions.push({
        id: 'about-summary',
        priority: 'high',
        text: 'Paste or adapt your CV summary into LinkedIn About, then add 2–3 bullet highlights from experience.',
      });
    }
    if (signal.id === 'skills') {
      suggestions.push({
        id: 'skills-pin',
        priority: 'medium',
        text: 'Pin your top skills on LinkedIn using the same order as your CV skills and tools.',
      });
    }
    if (signal.id === 'experience') {
      suggestions.push({
        id: 'experience-proof',
        priority: 'high',
        text: 'Add one measurable outcome per role (%, revenue, volume, or scope) in About or experience.',
      });
    }
    if (signal.id === 'keywords') {
      suggestions.push({
        id: 'keywords-coverage',
        priority: 'medium',
        text: 'Weave missing recruiter keywords into your headline, About, and skills — without keyword stuffing.',
      });
    }
  }

  for (const keyword of missingKeywords.slice(0, 4)) {
    suggestions.push({
      id: `missing-${keyword.replace(/\s+/g, '-')}`,
      priority: 'medium',
      text: `Add "${keyword}" to your headline, About, or skills if it matches your real work.`,
    });
  }

  if (headline.length > HEADLINE_MAX - 10) {
    suggestions.push({
      id: 'headline-length',
      priority: 'low',
      text: 'Shorten the headline to stay under LinkedIn’s 220-character limit.',
    });
  }

  if (about.length < 120) {
    suggestions.push({
      id: 'about-depth',
      priority: 'medium',
      text: 'Expand About with one paragraph on expertise plus 2–3 proof bullets from your CV.',
    });
  }

  if (!normSpace(identity.location) && normSpace(identity.title)) {
    suggestions.push({
      id: 'location',
      priority: 'low',
      text: 'Add your city to the headline or profile location for local recruiter discovery.',
    });
  }

  const seen = new Set();
  return suggestions
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .slice(0, 8);
}

/**
 * @param {object|null} finalResumeData
 * @returns {object|null}
 */
export function buildLinkedInOptimization(finalResumeData) {
  if (!isFinalResumeDataInput(finalResumeData)) return null;

  const headline = buildHeadline(finalResumeData);
  const about = buildAbout(finalResumeData);
  const topSkills = pickTopSkills(finalResumeData);
  const recruiterKeywords = extractRecruiterKeywords(finalResumeData);
  const missingKeywords = findMissingKeywords(finalResumeData, recruiterKeywords);
  const strength = computeStrength(finalResumeData, recruiterKeywords, missingKeywords);
  const suggestions = buildSuggestions(finalResumeData, strength, missingKeywords);

  return {
    version: LINKEDIN_OPTIMIZER,
    source: 'finalResumeData',
    headline,
    about,
    topSkills,
    recruiterKeywords,
    strength,
    missingKeywords,
    suggestions,
  };
}

/**
 * Plain-text bundle for LinkedIn tab / export.
 * @param {ReturnType<typeof buildLinkedInOptimization>} result
 */
export function formatLinkedInOptimizationText(result) {
  if (!result) return '';
  const lines = [
    'LINKEDIN HEADLINE',
    result.headline,
    '',
    'LINKEDIN ABOUT',
    result.about,
    '',
    'TOP SKILLS',
    ...result.topSkills.map((s) => `• ${s}`),
    '',
    'RECRUITER KEYWORDS',
    result.recruiterKeywords.join(', '),
    '',
    `CURRENT STRENGTH: ${result.strength.score}/100 (${result.strength.band})`,
    '',
    'MISSING KEYWORDS',
    ...(result.missingKeywords.length
      ? result.missingKeywords.map((k) => `• ${k}`)
      : ['• (none — strong keyword coverage)']),
    '',
    'OPTIMIZATION SUGGESTIONS',
    ...result.suggestions.map((s) => `• ${s.text}`),
  ];
  return lines.join('\n').trim();
}
