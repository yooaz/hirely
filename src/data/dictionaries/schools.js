import { findLongestMatchingTerm } from './match-utils.js';
import { INSTITUTION_HINT_RE } from './educationKeywords.js';
import { SCHOOL_TERMS, schoolsData } from './json-dictionary-match.js';

/** Known school / institution names — canonical list in schools.json */
export const SCHOOL_NAMES = SCHOOL_TERMS.length ? SCHOOL_TERMS : schoolsData.terms || [];

/** @deprecated Prefer findLongestMatchingTerm — kept for legacy imports. */
export const SCHOOL_NAME_RE = null;

/**
 * Pure school line match — dictionary only, no parser imports.
 * @param {unknown} line
 */
export function lineMatchesSchool(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 140) return false;
  if (findLongestMatchingTerm(l, SCHOOL_TERMS)) return true;
  if (INSTITUTION_HINT_RE.test(l) && /\b(19|20)\d{2}\b/.test(l)) return true;
  if (INSTITUTION_HINT_RE.test(l) && l.length < 90) return true;
  return false;
}
