import { buildAlternationRe } from './match-utils.js';

/** Competencies matched in skills sections and comma lists. */
export const SKILLS = [
  'Illustration',
  'Graphic Design',
  'Visual Identity',
  'Branding',
  'Typography',
  'Packaging',
  'Poster Design',
  'Print Production',
  'Art Direction',
  'Creative Direction',
  'Motion Design',
  'UI Design',
  'UX Design',
  'Product Design',
  'Web Design',
  'Editorial Design',
  'Logo Design',
  'Brand Strategy',
  'Marketing',
  'Photography',
  'Storyboarding',
  'User Research',
  'Product Strategy',
  'Agile',
  'Scrum',
  'Leadership',
  'Project Management',
  'SQL',
  'Data Analysis',
];

/** Broader hints when explicit skill tokens are absent. */
export const SKILL_HINT_TERMS = [
  'design',
  'illustration',
  'branding',
  'typography',
  'packaging',
  'poster',
  'print',
  'motion',
  'creative',
  'strategy',
  'ui',
  'ux',
  'research',
  'leadership',
  'identity',
];

export const SKILL_TERM_RE = buildAlternationRe(SKILLS);
export const SKILL_HINT_RE = buildAlternationRe(SKILL_HINT_TERMS);
