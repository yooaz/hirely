/**
 * Skill recovery — harvest relevant skills from experience, projects, and portfolio text.
 */

import { SKILLS } from '../../data/dictionaries/skills.js';
import { extractSpecialtiesFromText } from './experience-semantic-layer.js';

export const SKILL_RECOVERY = 'SKILL_RECOVERY';
export const SKILL_RECOVERY_MIN = 5;
export const SKILL_RECOVERY_MAX = 15;

const SKILL_REJECT_RE =
  /\b(photograph|photography|movies?|reading|nature|music|hobby|hobbies|gaming|chess|running|open\s+source)\b/i;

const CREATIVE_SKILL_PRIORITY = [
  'Illustration',
  'Graphic Design',
  'Editorial Design',
  'Packaging',
  'Logo Design',
  'Brand Identity',
  'Art Direction',
  'Visual Identity',
  'Print Production',
  'Poster Design',
  'Typography',
  'Creative Direction',
  'Motion Design',
];

const PROFESSIONAL_SKILL_PRIORITY = [
  'Product Strategy',
  'Agile',
  'SQL',
  'User Research',
  'Growth Marketing',
  'SEO',
  'Content Strategy',
  'Campaign Management',
  'Analytics',
  'System Design',
  'API Design',
  'Distributed Systems',
  'Mentoring',
  'Code Review',
  'Leadership',
  'Project Management',
  'Strategy',
  'Financial Modeling',
  'Stakeholder Management',
  'Facilitation',
];

const HARVEST_RULES = [
  { pattern: /\billustrat(?:ion|or|ions)\b/i, label: 'Illustration' },
  { pattern: /\bgraphic\s+design(?:er)?\b/i, label: 'Graphic Design' },
  { pattern: /\bedition(?:al)?(?:\s*design)?\b/i, label: 'Editorial Design' },
  { pattern: /\bpackag(?:ing)?(?:\s*design)?\b/i, label: 'Packaging' },
  { pattern: /\blogo(?:s)?(?:\s*design)?\b/i, label: 'Logo Design' },
  {
    pattern: /\b(?:brand\s+identity|corporate\s+identity|visual\s+identity|branding)\b/i,
    label: 'Brand Identity',
  },
  { pattern: /\bart\s+direction\b/i, label: 'Art Direction' },
  { pattern: /\bcreative\s+direction\b/i, label: 'Creative Direction' },
  { pattern: /\bposter(?:s)?(?:\s*design)?\b/i, label: 'Poster Design' },
  { pattern: /\btypography\b/i, label: 'Typography' },
  { pattern: /\bprint(?:\s*production)?\b/i, label: 'Print Production' },
  { pattern: /\bmotion\s+design\b/i, label: 'Motion Design' },
  { pattern: /\bvisual\s+storytelling\b/i, label: 'Illustration' },
  { pattern: /\bsystem\s+design\b/i, label: 'System Design' },
  { pattern: /\bapi\s+design\b/i, label: 'API Design' },
  { pattern: /\bdistributed\s+systems\b/i, label: 'Distributed Systems' },
  { pattern: /\bmentoring\b/i, label: 'Mentoring' },
  { pattern: /\bcode\s+review\b/i, label: 'Code Review' },
  { pattern: /\bgrowth\s+marketing\b/i, label: 'Growth Marketing' },
  { pattern: /\bcontent\s+strategy\b/i, label: 'Content Strategy' },
  { pattern: /\bcampaign\s+management\b/i, label: 'Campaign Management' },
  { pattern: /\buser\s+research\b/i, label: 'User Research' },
  { pattern: /\bproduct\s+strategy\b/i, label: 'Product Strategy' },
  { pattern: /\bfinancial\s+modeling\b/i, label: 'Financial Modeling' },
  { pattern: /\bstakeholder\s+management\b/i, label: 'Stakeholder Management' },
  { pattern: /\bdata\s+analysis\b/i, label: 'Data Analysis' },
];

const SPECIALTY_TO_SKILL = {
  'Packaging Design': 'Packaging',
  'Logo Design': 'Logo Design',
  'Poster Design': 'Poster Design',
  'Editorial Design': 'Editorial Design',
  'Visual Identity': 'Brand Identity',
  Branding: 'Brand Identity',
  'Art Direction': 'Art Direction',
  Illustration: 'Illustration',
  'Print Design': 'Print Production',
  Typography: 'Typography',
  'Motion Design': 'Motion Design',
  'Product Design': 'Product Design',
  'UI Design': 'UI Design',
  'UX Design': 'UX Design',
  'Web Design': 'Web Design',
  'Digital Marketing': 'Growth Marketing',
  'Project Management': 'Project Management',
  'Data Analysis': 'Data Analysis',
  'Software Development': 'System Design',
};

function normSkill(label) {
  return String(label || '').replace(/\s+/g, ' ').trim();
}

function isRejectedSkill(label) {
  const t = normSkill(label);
  if (!t || t.length < 3 || t.length > 72) return true;
  if (/^photograph:?$/i.test(t)) return true;
  if (SKILL_REJECT_RE.test(t)) return true;
  return false;
}

function detectProfileMode(blob) {
  const b = String(blob || '');
  if (/\b(illustrator|graphic\s+designer|art\s+director|creative\s+director|packaging|poster)\b/i.test(b)) {
    return 'creative';
  }
  if (/\b(engineer|developer|kubernetes|typescript|python|microservices|api)\b/i.test(b)) {
    return 'tech';
  }
  if (/\b(marketing|seo|campaign|growth|analytics|brand\s+campaign)\b/i.test(b)) {
    return 'marketing';
  }
  if (/\b(consultant|strategy|facilitation|stakeholder)\b/i.test(b)) {
    return 'consulting';
  }
  return 'general';
}

function collectHarvestBlob(rd) {
  const parts = [
    rd.summary,
    ...(rd.skills || []).filter((s) => !/^photograph:?$/i.test(String(s || '').trim())),
    ...(rd.projects || []),
    ...(rd.portfolioLinks || []),
    ...(rd.unsorted || []).filter((s) => !/^photograph:?$/i.test(String(s || '').trim())),
    ...(rd.experiences || []).flatMap((e) => [
      e.role,
      e.company,
      e.description,
      e.dates,
      ...(e.bullets || []),
      ...(e.specialties || []),
    ]),
  ];
  return parts.filter(Boolean).join(' ');
}

function prioritizeSkills(skills, blob) {
  const mode = detectProfileMode(blob);
  const priority =
    mode === 'creative'
      ? CREATIVE_SKILL_PRIORITY
      : mode === 'tech' || mode === 'marketing' || mode === 'consulting'
        ? [...CREATIVE_SKILL_PRIORITY, ...PROFESSIONAL_SKILL_PRIORITY]
        : [...CREATIVE_SKILL_PRIORITY, ...PROFESSIONAL_SKILL_PRIORITY, ...SKILLS];

  const ordered = [];
  const seen = new Set();
  for (const canon of priority) {
    const hit = skills.find((s) => s.toLowerCase() === canon.toLowerCase());
    if (hit && !seen.has(hit.toLowerCase())) {
      seen.add(hit.toLowerCase());
      ordered.push(hit);
    }
  }
  for (const s of skills) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(s);
    }
  }
  return ordered;
}

function backfillSkills(skills, blob, min) {
  const out = [...skills];
  const has = new Set(out.map((s) => s.toLowerCase()));
  for (const rule of HARVEST_RULES) {
    if (out.length >= min) break;
    if (has.has(rule.label.toLowerCase())) continue;
    if (rule.pattern.test(blob)) {
      out.push(rule.label);
      has.add(rule.label.toLowerCase());
    }
  }
  for (const skill of SKILLS) {
    if (out.length >= min) break;
    if (isRejectedSkill(skill) || has.has(skill.toLowerCase())) continue;
    const re = new RegExp(`\\b${skill.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(blob)) {
      out.push(skill);
      has.add(skill.toLowerCase());
    }
  }
  return out;
}

/**
 * Harvest skills from experience, project, and portfolio descriptions.
 * @param {import('../resume-data.js').ResumeData} rd
 * @param {object} [opts]
 * @returns {string[]}
 */
export function harvestSkillsFromDescriptions(rd, opts = {}) {
  const min = opts.min ?? SKILL_RECOVERY_MIN;
  const max = opts.max ?? SKILL_RECOVERY_MAX;
  const blob = collectHarvestBlob(rd);
  const seen = new Set();
  const skills = [];

  const add = (label) => {
    const t = normSkill(label);
    if (!t || isRejectedSkill(t)) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    skills.push(t);
  };

  for (const raw of rd.skills || []) {
    const parts = String(raw || '')
      .split(/[,;·]/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts.length ? parts : [String(raw || '').trim()]) {
      if (isRejectedSkill(part)) continue;
      const dictHit = SKILLS.find((s) => s.toLowerCase() === part.toLowerCase());
      if (dictHit) add(dictHit);
      else add(part);
    }
  }

  for (const exp of rd.experiences || []) {
    const expBlob = [exp.role, exp.description, ...(exp.bullets || [])].filter(Boolean).join(' ');
    for (const spec of extractSpecialtiesFromText(expBlob)) {
      add(SPECIALTY_TO_SKILL[spec] || spec);
    }
    for (const spec of exp.specialties || []) {
      add(SPECIALTY_TO_SKILL[spec] || spec);
    }
  }

  for (const rule of HARVEST_RULES) {
    if (rule.pattern.test(blob)) add(rule.label);
  }

  for (const skill of SKILLS) {
    if (isRejectedSkill(skill)) continue;
    const re = new RegExp(`\\b${skill.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(blob)) add(skill);
  }

  if (/\bposters?\b/i.test(blob)) add('Editorial Design');
  if (/\blogos?\b/i.test(blob)) add('Logo Design');
  if (/\bidentit(?:y|ies)\b/i.test(blob)) add('Brand Identity');

  let ordered = prioritizeSkills(skills, blob);
  if (ordered.length < min) ordered = backfillSkills(ordered, blob, min);
  return ordered.slice(0, max);
}

/**
 * Apply skill recovery to resume data (mutates rd.skills).
 * @param {import('../resume-data.js').ResumeData} rd
 * @param {object} [opts]
 */
export function applySkillRecovery(rd, opts = {}) {
  if (!rd || typeof rd !== 'object') return rd;
  rd.skills = harvestSkillsFromDescriptions(rd, opts);
  return rd;
}
