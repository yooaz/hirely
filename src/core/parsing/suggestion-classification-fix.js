/**
 * P1 — Suggestion classification fix.
 * Employment / freelance lines must never surface as skills; low confidence → À valider.
 */

import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { lineIsRoleOnly, lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { isValidIdentityName, isValidIdentityTitle } from './identity-extraction.js';
import {
  COMPANY_UNCERTAIN_RE,
  isEmploymentCompanyLine,
} from './employment-suggestion-heuristics.js';

export const SUGGESTION_CLASSIFICATION_FIX_VERSION = 'suggestion-classification-fix-v1';
export const SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN = 80;

export { COMPANY_UNCERTAIN_RE, isEmploymentCompanyLine };

const STANDALONE_SKILL_DISCIPLINE_RE =
  /^(marketing|branding|sales|finance|consulting|design|illustration|typography|packaging)$/i;

const MARKETING_TITLE_RE =
  /\bmarketing\s+(coordinator|manager|director|specialist|lead|assistant|executive|strategist|analyst)\b/i;

/**
 * Single-word discipline tokens are skills in suggestions, not identity titles.
 * @param {string} line
 */
export function isStandaloneSkillDiscipline(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (isValidIdentityName(s)) return false;
  if (MARKETING_TITLE_RE.test(s)) return false;
  if (s.split(/\s+/).length > 2) return false;
  if (!STANDALONE_SKILL_DISCIPLINE_RE.test(s)) return false;
  if (lineIsRoleOnly(s) && s.split(/\s+/).length === 1) return true;
  return STANDALONE_SKILL_DISCIPLINE_RE.test(s);
}

/**
 * @param {string} line
 */
export function classifyVisualCommunicationContext(line) {
  const s = String(line || '').trim();
  if (!/^visual\s+communication$/i.test(s)) return null;
  const school = findLongestDictionaryTerm(s, SCHOOL_TERMS);
  if (school || /\b(degree|bachelor|master|ma|ba|diploma|école|school|university|formation)\b/i.test(s)) {
    return { category: 'education', confidence: 88, reason: 'visual_communication_education' };
  }
  return { category: 'skill', confidence: 72, reason: 'visual_communication_skill_ambiguous' };
}

/**
 * @param {string} line
 * @returns {{ category: string, confidence: number, needsReview: boolean, autoPlace: boolean, reason: string } | null}
 */
export function classifySuggestionCategory(line) {
  const s = String(line || '').trim();
  if (!s) {
    return {
      category: 'unknown',
      confidence: 0,
      needsReview: true,
      autoPlace: false,
      reason: 'empty',
    };
  }

  if (isEmploymentCompanyLine(s)) {
    const uncertain = COMPANY_UNCERTAIN_RE.test(s);
    const confidence = uncertain ? 76 : 92;
    return {
      category: 'experience',
      confidence,
      needsReview: confidence < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN,
      autoPlace: confidence >= SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN,
      reason: uncertain ? 'company_uncertain_review' : 'employment_freelance',
    };
  }

  const visual = classifyVisualCommunicationContext(s);
  if (visual) {
    const needsReview = visual.confidence < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN;
    return {
      category: visual.category,
      confidence: visual.confidence,
      needsReview,
      autoPlace: !needsReview,
      reason: visual.reason,
    };
  }

  if (isStandaloneSkillDiscipline(s)) {
    return {
      category: 'skill',
      confidence: 84,
      needsReview: false,
      autoPlace: true,
      reason: 'standalone_skill_discipline',
    };
  }

  if (
    isValidIdentityTitle(s) &&
    lineLooksLikeRole(s) &&
    !isStandaloneSkillDiscipline(s) &&
    s.split(/\s+/).length >= 2
  ) {
    return null;
  }

  return null;
}

/**
 * Merge P1 rules with CLASSIFICATION_ENGINE_V2 output for product suggestions.
 * @param {string} line
 * @param {{ type?: string, confidence?: number, parserDebug?: { confidenceScore?: number } } | null} [v2Hit]
 */
export function resolveSuggestionCategory(line, v2Hit = null) {
  const fixed = classifySuggestionCategory(line);
  if (fixed) {
    const category =
      fixed.needsReview || fixed.confidence < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN
        ? 'unknown'
        : fixed.category;
    return {
      category,
      predictedCategory: fixed.category,
      confidence: fixed.confidence,
      needsReview: fixed.needsReview || fixed.confidence < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN,
      autoPlace: fixed.autoPlace && fixed.confidence >= SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN,
      reason: fixed.reason,
    };
  }

  if (v2Hit?.type && v2Hit.type !== 'unknown') {
    const conf = Number(v2Hit.confidence ?? v2Hit.parserDebug?.confidenceScore ?? 0);
    const needsReview = conf < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN;
    return {
      category: needsReview ? 'unknown' : v2Hit.type,
      predictedCategory: v2Hit.type,
      confidence: conf,
      needsReview,
      autoPlace: !needsReview,
      reason: v2Hit.parserDebug?.classificationReason || 'v2_specialty',
    };
  }

  return {
    category: 'unknown',
    predictedCategory: 'unknown',
    confidence: 58,
    needsReview: true,
    autoPlace: false,
    reason: 'low_confidence_unclassified',
  };
}

/**
 * Never offer skill for employment / freelance suggestion lines.
 * @param {string} line
 * @param {{ id: string }[]} categories
 */
export function filterSuggestionCategoryOptions(line, categories) {
  if (!isEmploymentCompanyLine(line)) return categories;
  return (categories || []).filter((c) => c?.id !== 'skill');
}
