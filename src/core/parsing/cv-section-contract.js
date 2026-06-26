/**
 * CV Section Contract — strict rules per section.
 * Violations: reject assignment → review queue; never display invalid content.
 */

import { isLikelyTool, isLikelyClient } from './line-cleaner.js';
import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { isLikelySkillLine } from './section-sanity.js';
import { lineMatchesSchool } from '../../data/dictionaries/schools.js';
import { SKILLS, SKILL_TERM_RE } from '../../data/dictionaries/skills.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import { normalizeReviewItem, mergeReviewQueues } from './review-queue-merge.js';
import { suggestPossibleCategories } from './review-queue-categories.js';
import { mergeUnsortedLines } from './no-data-loss.js';

export const CV_SECTION_CONTRACT_VERSION = 'cv-section-contract-v1';

/** Allowed language names (strict whitelist). */
export const ALLOWED_LANGUAGE_NAMES = Object.freeze([
  'french',
  'english',
  'spanish',
  'german',
  'dutch',
  'italian',
  'portuguese',
  'arabic',
]);

/** Allowed proficiency tokens. */
export const ALLOWED_LANGUAGE_PROFICIENCY = Object.freeze(['native', 'fluent', 'bilingual']);

const LANG_SET = new Set(ALLOWED_LANGUAGE_NAMES);
const PROF_SET = new Set(ALLOWED_LANGUAGE_PROFICIENCY);

const LANG_ALIASES = Object.freeze({
  français: 'french',
  francais: 'french',
  anglais: 'english',
  allemand: 'german',
  espagnol: 'spanish',
  italiano: 'italian',
  nederlands: 'dutch',
});

function normalizeToken(token) {
  return String(token || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '');
}

function normalizeLanguageName(token) {
  const t = normalizeToken(token);
  return LANG_ALIASES[t] || t;
}

/**
 * @param {string} value
 */
export function satisfiesLanguageContract(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 64) {
    return { valid: false, reason: 'Language line empty or too long' };
  }

  const low = raw.toLowerCase();
  if (PROF_SET.has(low)) {
    return { valid: true };
  }

  const dashParts = raw.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (dashParts.length === 2) {
    const lang = normalizeLanguageName(dashParts[0]);
    const prof = normalizeToken(dashParts[1]);
    if (LANG_SET.has(lang) && PROF_SET.has(prof)) {
      return { valid: true };
    }
    return { valid: false, reason: `Language not in contract: ${raw}` };
  }

  const paren = raw.match(/^([A-Za-zÀ-ÿ' -]+)\s*\(\s*([A-Za-zÀ-ÿ]+)\s*\)$/i);
  if (paren) {
    const lang = normalizeLanguageName(paren[1]);
    const prof = normalizeToken(paren[2]);
    if (LANG_SET.has(lang) && PROF_SET.has(prof)) {
      return { valid: true };
    }
    return { valid: false, reason: `Language not in contract: ${raw}` };
  }

  const langOnly = normalizeLanguageName(raw.split(/\s+/)[0]);
  if (LANG_SET.has(langOnly) && raw.split(/\s+/).length <= 2) {
    return { valid: true };
  }

  return { valid: false, reason: `Language not in contract: ${raw}` };
}

/**
 * @param {string} value
 */
export function satisfiesToolContract(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 80) {
    return { valid: false, reason: 'Tool line empty or too long' };
  }
  if (isLikelyTool(raw)) {
    return { valid: true };
  }
  const toolHit = TOOLS.some((t) =>
    new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(raw)
  );
  if (toolHit) {
    return { valid: true };
  }
  return { valid: false, reason: 'Tool must be a software name' };
}

/**
 * @param {string} value
 */
export function satisfiesClientContract(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 80) {
    return { valid: false, reason: 'Client line empty or too long' };
  }
  if (isLikelyClient(raw)) {
    return { valid: true };
  }
  if (findLongestDictionaryTerm(raw, CLIENT_TERMS)) {
    return { valid: true };
  }
  if (CLIENT_COMPANY_KEYWORDS.some((c) => c.toLowerCase() === raw.toLowerCase())) {
    return { valid: true };
  }
  return { valid: false, reason: 'Client must be a company name' };
}

/**
 * @param {string} value
 */
export function satisfiesEducationContract(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 140) {
    return { valid: false, reason: 'Education line empty or too long' };
  }
  if (lineMatchesSchool(raw)) {
    return { valid: true };
  }
  return { valid: false, reason: 'Education must contain a school name' };
}

/**
 * @param {string} value
 */
export function satisfiesSkillContract(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 80) {
    return { valid: false, reason: 'Skill line empty or too long' };
  }
  if (isLikelyTool(raw)) {
    return { valid: false, reason: 'Software belongs in Tools, not Skills' };
  }
  if (isLikelyClient(raw)) {
    return { valid: false, reason: 'Company belongs in Clients, not Skills' };
  }
  if (satisfiesLanguageContract(raw).valid) {
    return { valid: false, reason: 'Language belongs in Languages, not Skills' };
  }
  if (SKILL_TERM_RE.test(raw) || SKILLS.some((s) => s.toLowerCase() === raw.toLowerCase())) {
    return { valid: true };
  }
  if (isLikelySkillLine(raw)) {
    return { valid: true };
  }
  return { valid: false, reason: 'Skill must be a professional capability' };
}

const CONTRACT_VALIDATORS = Object.freeze({
  language: satisfiesLanguageContract,
  tool: satisfiesToolContract,
  client: satisfiesClientContract,
  education: satisfiesEducationContract,
  skill: satisfiesSkillContract,
});

/**
 * @param {string} sectionType — singular fact type
 * @param {string} value
 */
export function validateCvSectionItem(sectionType, value) {
  const type = String(sectionType || '').trim().toLowerCase();
  const validator = CONTRACT_VALIDATORS[type];
  if (!validator) {
    return { valid: true, section: type };
  }
  const result = validator(value);
  return { ...result, section: type };
}

/**
 * @param {object} fact
 * @param {string} sectionType
 * @param {string} reason
 */
export function contractViolationReviewItem(fact, sectionType, reason) {
  const value = String(fact?.value || fact || '').trim();
  const possibleCategories = suggestPossibleCategories(value, sectionType);
  return normalizeReviewItem({
    field: sectionType,
    detectedType: sectionType,
    detected: value,
    sourceText: fact?.sourceLine || value,
    sourceLines: [fact?.sourceLine || value].filter(Boolean),
    confidence: Math.round((fact?.confidence || 0.5) * 100),
    reason: `Section contract: ${reason}`,
    suggestion: 'Choose the correct section or edit before accepting',
    action: 'section_contract_violation',
    status: 'pending',
    possibleCategories,
    requiresUserChoice: true,
    factId: fact?.id,
  });
}

const STRUCTURED_FIELD_MAP = Object.freeze({
  language: 'languages',
  tool: 'tools',
  client: 'clients',
  education: 'education',
  skill: 'skills',
});

/**
 * Assign fact to structured section only if contract passes; else review queue.
 * @param {object} structured
 * @param {object[]} reviewItems
 * @param {string} factType
 * @param {object} fact
 * @param {function} pushUnique
 */
export function assignFactWithContract(structured, reviewItems, factType, fact, pushUnique) {
  const field = STRUCTURED_FIELD_MAP[factType];
  if (!field) return;

  const check = validateCvSectionItem(factType, fact.value);
  if (check.valid) {
    pushUnique(structured[field], fact.value);
  } else {
    reviewItems.push(contractViolationReviewItem(fact, factType, check.reason));
  }
}

/**
 * Strip contract violations from structured resume; queue rejected items.
 * @param {object} structured
 */
export function enforceStructuredSectionContract(structured) {
  const s = structured || {};
  const reviewItems = [];

  for (const [type, field] of Object.entries(STRUCTURED_FIELD_MAP)) {
    const kept = [];
    for (const item of s[field] || []) {
      const check = validateCvSectionItem(type, item);
      if (check.valid) kept.push(item);
      else reviewItems.push(contractViolationReviewItem({ value: item }, type, check.reason));
    }
    s[field] = kept;
  }

  if (reviewItems.length) {
    s.reviewQueue = mergeReviewQueues(s.reviewQueue || [], reviewItems);
    s.factReviewQueue = mergeReviewQueues(s.factReviewQueue || [], reviewItems);
    s.unsorted = mergeUnsortedLines(
      s.unsorted || [],
      reviewItems.map((i) => i.detected)
    );
    s.needsReview = [
      ...(s.needsReview || []),
      ...reviewItems.map((item) => ({
        field: item.field,
        detected: item.detected,
        suggestion: item.suggestion,
        reason: item.reason,
        action: item.action,
        possibleCategories: item.possibleCategories,
        requiresUserChoice: item.requiresUserChoice,
      })),
    ];
  }

  s.metadata = {
    ...(s.metadata || {}),
    cvSectionContract: CV_SECTION_CONTRACT_VERSION,
    contractViolations: reviewItems.length,
  };

  return { structured: s, reviewItems };
}

const CV_DATA_FIELD_MAP = Object.freeze({
  language: 'languages',
  tool: 'tools',
  client: 'clients',
  education: 'education',
  skill: 'skills',
});

/**
 * Strip invalid section content from cvData before display/export.
 * @param {object} cvData
 * @param {object} [opts]
 */
function buildContractExemptSet(exemptValues = []) {
  const set = new Set();
  for (const v of exemptValues) {
    const t = String(v || '').trim().toLowerCase();
    if (t) set.add(t);
  }
  return set;
}

export function enforceCvDataSectionContract(cvData, opts = {}) {
  const d = { ...(cvData || {}) };
  const reviewItems = [];
  const exempt = buildContractExemptSet(opts.exemptValues || []);

  for (const [type, field] of Object.entries(CV_DATA_FIELD_MAP)) {
    const kept = [];
    for (const item of d[field] || []) {
      const low = String(item || '').trim().toLowerCase();
      if (exempt.has(low)) {
        kept.push(item);
        continue;
      }
      const check = validateCvSectionItem(type, item);
      if (check.valid) kept.push(item);
      else reviewItems.push(contractViolationReviewItem({ value: item }, type, check.reason));
    }
    d[field] = kept;
  }

  if (reviewItems.length) {
    if (opts.mergeReview !== false) {
      d.reviewQueue = mergeReviewQueues(d.reviewQueue || [], reviewItems);
    }
    d.unsorted = mergeUnsortedLines(
      d.unsorted || [],
      reviewItems.map((i) => i.detected)
    );
    d._contractViolations = (d._contractViolations || 0) + reviewItems.length;
  }

  return d;
}
