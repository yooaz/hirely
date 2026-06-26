/**
 * Skills section pollution filter — denylist + context rules.
 * Prevents clients, companies, portfolio captions, education bleed, and OCR junk
 * from entering structured skill output.
 */

import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { hasEducationSchool } from './education-confidence.js';
import { clientNamesInText, lineIsClientList } from './field-sanitize.js';
import { passesExperienceGate } from './section-sanity.js';
import { extractDateRangeFromText } from './parser-recovery.js';

export const SKILLS_POLLUTION_FILTER = 'SKILLS_POLLUTION_FILTER_V2';

const CLIENT_LIST_PREFIX_RE =
  /\bclients?\s*(?:include|includes|included|such as|like|worked with|for)\s*[:—-]?\s*/i;

const PORTFOLIO_CAPTION_RE =
  /\b(personal\s+project|personal\s+artwork|t-shirt\s+design\s+for|fortune\s+500\s+cover|compelling\s+illustration\s+for|portrait\s+of|creation\s+of\s+an\s+illustration|page\s*\d+\s*portfolio|portfolio)\b/i;

const EXPERIENCE_ROLE_LINE_RE =
  /\b(freelanc(?:er|e)?|internship|intern|stage|art\s+director|graphic\s+designer\s*&\s*illustrator|illustrator\s*,\s*graphic\s+designer)\b/i;

const JOB_TITLE_BLEED_RE =
  /^(graphic\s+designer\s*&\s*illustrator|freelancer?\s+illustrator|illustrator\s+and\s+graphic\s+designer)\b/i;

const INTEREST_HOBBY_RE =
  /^(photography|art|snowboard|soccer|drawing|movies|reading|music|nature|hobby|hobbies)$/i;

const EDUCATION_PROGRAM_RE =
  /\b(web\s+and\s+motion\s+design|visual\s+communication|product\s+design|multisectoral\s+year|bachelor|master|diploma|licence)\b/i;

const OCR_JUNK_RE =
  /(?:\b[a-z]{1,2}\s+){4,}|^[^a-zA-ZÀ-ÿ]{3,}$|\bundefined\b|\bnull\b|^[|¦‖§¶†‡◆◇]+$|(?:\b[a-z]\s+){3,}[a-z]\b|\b[a-z]{1,2}[0-9]{2,}\b/i;

const OCR_FRAGMENT_RE =
  /^[a-z]{1,3}$|^[A-Z]{1,2}$|^\d+$|^[a-z]+\d{3,}$|^[|¦‖§¶†‡◆◇•\-–—]+$/;

const EMPLOYER_LABEL_RE =
  /\b(inc\.?|ltd\.?|gmbh|s\.?a\.?|corp\.?|agency|studios?|group|holdings?)\b/i;

const STANDALONE_ADOBE_RE = /^adobe$/i;

const SOFT_SKILL_TERMS = [
  'Leadership',
  'Communication',
  'Teamwork',
  'Collaboration',
  'Problem Solving',
  'Time Management',
  'Mentoring',
  'Facilitation',
  'Stakeholder Management',
];

const CLIENT_DENY_EXACT = new Set(
  [
    'Nike',
    'Converse',
    'Pantone',
    'Adobe',
    'Arte',
    'Marvel',
    'Louis Vuitton',
    'PlayStation',
    'adidas',
    'Cadillac',
    'Fortune',
    'McCann',
    'Havas',
    'Publicis',
    'BETC',
    'DDB',
    'AKQA',
  ].map((s) => s.toLowerCase())
);

/**
 * @typedef {object} SkillPollutionContext
 * @property {string} [section]
 * @property {string} [sourceLine]
 * @property {boolean} [isSkillsSection]
 */

/**
 * @param {string} token
 */
export function isDeniedClientBrand(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  const low = t.toLowerCase();
  if (CLIENT_DENY_EXACT.has(low)) return true;
  return CLIENT_COMPANY_KEYWORDS.some(
    (c) => c.toLowerCase() === low || (c.length >= 4 && low === c.toLowerCase())
  );
}

/**
 * @param {string} token
 */
export function isOcrSkillFragment(token) {
  const t = String(token || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2) return true;
  if (isDeniedClientBrand(t)) return false;
  if (OCR_FRAGMENT_RE.test(t)) return true;
  if (t.length <= 4 && /^[a-z0-9]{1,4}$/.test(t) && !/^(css|html|sql|git|figma|sass|less|java|perl|ruby|rust|scss)$/i.test(t)) {
    return true;
  }
  const letters = (t.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const digits = (t.match(/\d/g) || []).length;
  if (digits > letters) return true;
  if (/\s/.test(t) && t.length <= 6 && !/[A-Z]/.test(t)) return true;
  return false;
}

/**
 * @param {string} token
 * @param {SkillPollutionContext} [ctx]
 */
export function pollutionReason(token, ctx = {}) {
  const t = String(token || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2 || t.length > 72) return 'invalid_length';
  if (OCR_JUNK_RE.test(t)) return 'ocr_junk';
  if (STANDALONE_ADOBE_RE.test(t)) return 'standalone_adobe_client';
  if (isDeniedClientBrand(t)) return 'client_brand';
  if (isOcrSkillFragment(t)) return 'ocr_fragment';
  const sourceLine = String(ctx.sourceLine || t).trim();
  if (CLIENT_LIST_PREFIX_RE.test(sourceLine)) return 'client_list_line';
  if (lineIsClientList(sourceLine) && clientNamesInText(sourceLine).length >= 2) return 'client_list_line';
  if (clientNamesInText(t).length && !ctx.isSkillsSection) return 'client_name_cross_section';
  if (PORTFOLIO_CAPTION_RE.test(sourceLine) || PORTFOLIO_CAPTION_RE.test(t)) return 'portfolio_caption';
  if (/^personal\b/i.test(t) && /\b(project|artwork)\b/i.test(sourceLine)) return 'portfolio_caption';
  if (hasEducationSchool(t) || findLongestDictionaryTerm(t, SCHOOL_TERMS)) return 'education_school';
  if (EDUCATION_PROGRAM_RE.test(t) || EDUCATION_PROGRAM_RE.test(sourceLine)) return 'education_program';
  if (/\b(19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/.test(sourceLine)) return 'education_dates';
  if (extractDateRangeFromText(sourceLine).startDate && hasEducationSchool(sourceLine)) return 'education_bleed';
  if (!ctx.isSkillsSection) {
    if (EXPERIENCE_ROLE_LINE_RE.test(sourceLine)) return 'experience_role_line';
    if (JOB_TITLE_BLEED_RE.test(sourceLine)) return 'job_title_bleed';
    if (passesExperienceGate(sourceLine) && /\b(19|20)\d{2}\b/.test(sourceLine)) return 'experience_dated_line';
  }
  if (INTEREST_HOBBY_RE.test(t) && !/\b(design|software|tool)\b/i.test(t)) return 'interest_hobby';
  if (/^(education|experience|clients?|contact|profile|languages?|interests?|tools?|skills?)$/i.test(t)) {
    return 'section_header_label';
  }
  if (termMatchesHay(t, 'McCann') || termMatchesHay(t, 'impressions')) return 'employer_agency';
  if (EMPLOYER_LABEL_RE.test(t) && t.length > 12) return 'employer_label';
  return null;
}

/**
 * @param {string} token
 * @param {SkillPollutionContext} [ctx]
 */
export function isSkillsSectionPollution(token, ctx = {}) {
  return pollutionReason(token, ctx) != null;
}

/**
 * @param {string} token
 */
export function isSoftSkillTerm(token) {
  const low = String(token || '').trim().toLowerCase();
  return SOFT_SKILL_TERMS.some((s) => s.toLowerCase() === low);
}

export { SOFT_SKILL_TERMS };
