import { buildAlternationRe } from './match-utils.js';

/** Job titles / roles — general heuristics (not person-specific). */
export const ROLE_KEYWORDS = [
  'designer',
  'illustrator',
  'developer',
  'engineer',
  'manager',
  'consultant',
  'director',
  'founder',
  'student',
  'intern',
  'product',
  'marketing',
  'sales',
  'finance',
  'analyst',
  'writer',
  'photographer',
  'architect',
  'teacher',
  'recruiter',
  'assistant',
  'coordinator',
  'strategist',
  'creative',
  'art director',
  'creative director',
  'product designer',
  'graphic designer',
  'software engineer',
  'data scientist',
  'project manager',
  'account manager',
  'executive',
  'vice president',
  'chief',
  'head of',
  'lead',
  'senior',
  'junior',
  'freelance',
  'contractor',
  'specialist',
  'associate',
  'partner',
  'administrator',
  'officer',
  'supervisor',
  'producer',
  'editor',
  'researcher',
  'scientist',
  'nurse',
  'physician',
  'attorney',
  'lawyer',
  'paralegal',
  'accountant',
  'auditor',
  'coach',
  'trainer',
];

export const ROLE_TITLE_RE = buildAlternationRe(ROLE_KEYWORDS);

export function lineLooksLikeRole(line) {
  return ROLE_TITLE_RE.test(String(line || ''));
}

/** True when line is mostly a role phrase, not a person name. */
export function lineIsRoleOnly(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 72) return false;
  const words = l.replace(/[^A-Za-zÀ-ÿ\s&/-]/g, ' ').split(/\s+/).filter(Boolean);
  if (
    words.length === 2 &&
    words.every((w) => /^[A-ZÀ-Ö][a-zà-ö'-]+$/.test(w)) &&
    !lineLooksLikeRole(l)
  ) {
    return false;
  }
  if (!lineLooksLikeRole(l)) return false;
  if (words.length > 6) return false;
  return true;
}
