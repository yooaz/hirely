/**
 * Parser sanity pass — strict buckets, per-line confidence, UNSORTED fallback.
 */

import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { isGarbageLine } from '../../data/dictionaries/garbagePatterns.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import { ROLE_TITLE_RE } from '../../data/dictionaries/roleKeywords.js';
import { lineMatchesSchool } from '../../data/dictionaries/schools.js';
import { EDUCATION_KEYWORDS, INSTITUTION_HINT_RE } from '../../data/dictionaries/educationKeywords.js';
import { SKILLS, SKILL_HINT_RE } from '../../data/dictionaries/skills.js';
import { textContainsAny, termMatchesHay } from '../../data/dictionaries/match-utils.js';
import {
  isExperienceGateActive,
  runParserGuarded,
  withExperienceGateActive,
} from './parser-cycle-guard.js';
import {
  classifyLineByDictionary,
  blocksExperienceClassification,
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
  SCHOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import { applyDesignerSectionWeight } from './designer-cv-mode.js';
import {
  scoreEducationConfidence,
  mustNeverBeExperience,
  buildForcedEducationClassification,
} from './education-confidence.js';
import {
  isLikelyFreelanceCareerLine,
  parseFreelanceCareerLine,
  stripAgePhrase,
  isStrictSoftwareLine,
} from './classification-fixes.js';
import { splitListItems } from './rich-parser.js';
import {
  lineIsContactData,
  lineIsEducationData,
  lineIsSkillOrTagOnly,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
import {
  classifyCreativeLine,
  isCreativeNonExperienceLine,
  isAwardsLine,
} from './creative-parsing-mode.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import {
  clearParserClassificationLog,
  recordFromClassification,
} from './parser-classification-debug.js';
import { classifySpecialtyLineV2, CLASSIFICATION_CONFIDENCE_MIN } from './classification-engine-v2.js';

const EXPERIENCE_ROLE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|product\s+designer|visual\s+designer|motion\s+designer|senior\s+designer|lead\s+designer|graphiste|directeur\s+artistique|directeur\s+créatif|illustrateur)\b/i;

const INTEREST_KEYWORDS = [
  'music',
  'movies',
  'cinema',
  'reading',
  'nature',
  'soccer',
  'football',
  'sport',
  'photography',
  'travel',
  'gaming',
  'hiking',
  'cooking',
  'running',
  'chess',
];

function isLikelyGarbageLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return true;
  if (isGarbageLine(l)) return true;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && words.filter((w) => w.length <= 2).length / words.length > 0.55) {
    return true;
  }
  return false;
}

function isLikelyClient(line) {
  const l = String(line || '').trim();
  if (findLongestDictionaryTerm(l, CLIENT_TERMS)) return true;
  return CLIENT_COMPANY_KEYWORDS.some((c) => termMatchesHay(l, c));
}

function isLikelyTool(line) {
  const l = String(line || '').trim();
  if (isLikelyFreelanceCareerLine(l)) return false;
  if (isStrictSoftwareLine(l)) return true;
  if (l.includes(',') && l.length < 200) {
    const parts = splitListItems(l);
    if (parts.length >= 2 && parts.every((p) => isStrictSoftwareLine(p) || findLongestDictionaryTerm(p, TOOL_TERMS))) {
      return true;
    }
  }
  if (EXPERIENCE_ROLE_RE.test(l) && (/\//.test(l) || (!isExperienceGateActive() && passesExperienceGate(l)))) {
    return false;
  }
  if (lineMatchesSchool(l)) return false;
  if (findLongestDictionaryTerm(l, CLIENT_TERMS)) return false;
  return false;
}

function isLikelyLanguage(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 48) return false;
  return /^(english|french|german|spanish|italian|dutch|portuguese|mandarin|chinese|arabic|japanese|korean|français|anglais|allemand|espagnol|nederlands)\s*[—–-]\s*(native|fluent|bilingual|courant|vloeiend|professional|professionnel|conversational|intermediate|intermédiaire|basic|notions|débutant)/i.test(
    l
  );
}

function isLikelyEducation(line) {
  const l = String(line || '').trim();
  if (lineMatchesSchool(l)) return true;
  return EDUCATION_KEYWORDS.some((k) => termMatchesHay(l, k)) || INSTITUTION_HINT_RE.test(l);
}

function isLikelyInterest(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  const low = t.toLowerCase();
  if (INTEREST_KEYWORDS.some((k) => low === k || low.startsWith(`${k} `))) return true;
  const parts = low.split(/[,;·|]/).map((p) => p.trim()).filter(Boolean);
  if (
    parts.length >= 2 &&
    parts.every((p) => INTEREST_KEYWORDS.some((k) => p === k || p.startsWith(`${k} `)))
  ) {
    return true;
  }
  if (new RegExp(`\\b(${INTEREST_KEYWORDS.join('|')})\\b`, 'i').test(t) && t.split(/\s+/).length <= 6) {
    return true;
  }
  return false;
}

export const SANITY_CONFIDENCE_THRESHOLD = CLASSIFICATION_CONFIDENCE_MIN;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\./i;

const DATE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b|\b(19|20)\d{2}\b/i;

const EMPLOYMENT_MARKER_RE =
  /\b(freelance|full[- ]?time|part[- ]?time|internship|intern|stage|stagiaire|contract|permanent|cdd|cdi|employed|employment)\b/i;

const PROJECT_RE =
  /\b(project|portfolio piece|case study|campaign|series|rebrand|redesign|social network|mobile app|web app|platform|capstone|personal project|selected work|portfolio|cover illustration|campaign artwork|editorial illustration|album cover|book cover|character design|concept art|key visual)\b/i;

const PROJECT_ARTWORK_RE = /\b(cover|artwork|illustration for|muse)\b/i;

const TITLE_CASE_PROJECT_RE = /^[A-Z][\p{L}\p{M}'’-]+(?:\s+[A-Z][\p{L}\p{M}'’-]+){1,5}$/u;

const SKILL_SINGLE_RE =
  /\b(drawing|illustration|sketching|branding|typography|storyboarding|photography|copywriting|layout|retouching)\b/i;

const SKILL_PHRASE_RE =
  /\b(illustration|graphic design|branding|editorial|packaging|visual identity|art direction|logo design|print production|ui design|ux design)\b/i;

const EMPLOYER_SEP_RE = /\s[-–—@|]\s|\s+at\s+/i;

export const SECTION_BUCKETS = [
  'identity',
  'contact',
  'summary',
  'experience',
  'clients',
  'awards',
  'exhibitions',
  'publications',
  'portfolioLinks',
  'education',
  'skills',
  'tools',
  'languages',
  'projects',
  'certifications',
  'volunteer',
  'interests',
  'unsorted',
];

function looksLikePersonName(line) {
  const words = String(line || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (PROJECT_RE.test(line) || PROJECT_ARTWORK_RE.test(line) || /\bcover\b/i.test(line)) return false;
  return words.every((w) => /^[A-ZÀ-Ö][a-zà-ÿ'-]{1,}$/.test(w));
}

function looksLikeSentence(line) {
  const l = String(line || '').trim();
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  return /\b(the|and|with|for|that|which|was|were|is|are|have|has|from|into|about)\b/i.test(l);
}

export function hasExperienceDate(line) {
  return DATE_RE.test(String(line || ''));
}

export function hasExperienceJobTitle(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 6) return false;
  if (isLikelyPortfolioProject(l)) return false;
  if (EXPERIENCE_ROLE_RE.test(l) && /\//.test(l) && l.split(/\s+/).length >= 3) return true;
  if (EXPERIENCE_ROLE_RE.test(l) && (hasExperienceDate(l) || EMPLOYMENT_MARKER_RE.test(l))) return true;
  if (EXPERIENCE_ROLE_RE.test(l) && hasExperienceCompany(l)) return true;
  if (!ROLE_TITLE_RE.test(l)) return false;
  const words = l.replace(/[&/]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 2) return false;
  if (SKILL_SINGLE_RE.test(l) && words.length <= 2 && !hasExperienceDate(l)) return false;
  if (!hasExperienceDate(l) && !EMPLOYMENT_MARKER_RE.test(l) && !hasExperienceCompany(l)) return false;
  return true;
}

/** Employer in context — not a standalone brand line (Nike alone → client). */
export function hasExperienceCompany(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length === 1 && isLikelyClient(l)) return false;
  if (EMPLOYER_SEP_RE.test(l) && words.length >= 2) return true;
  if (isLikelyClient(l) && (hasExperienceDate(l) || EXPERIENCE_ROLE_RE.test(l) || EMPLOYMENT_MARKER_RE.test(l))) {
    return true;
  }
  if (/\b(inc|ltd|llc|gmbh|sarl|sa|corp|studio|agency|group)\b/i.test(l) && words.length >= 2) return true;
  return false;
}

/**
 * Experience requires date + (role or company). No date-only or keyword-only lines.
 */
function passesExperienceGateInner(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 6) return false;
  if (isLikelyFreelanceCareerLine(l)) {
    return !!parseFreelanceCareerLine(l);
  }
  if (isLikelyPortfolioProject(l)) return false;
  if (lineIsContactData(l) || lineIsEducationData(l) || lineIsSkillOrTagOnly(l)) return false;
  if (mustNeverBeExperience(l)) return false;
  if (blocksExperienceClassification(l)) return false;
  if (/^(profile(\s+work)?\s+experience|work\s+experience|professional\s+experience)\b/i.test(l)) {
    return false;
  }

  const date = hasExperienceDate(l);
  if (!date) return false;

  const title = hasExperienceJobTitle(l);
  const company = hasExperienceCompany(l);
  if (!title && !company) return false;

  const dates = extractDateRangeFromText(l);
  const rest = stripAgePhrase(l.replace(DATE_RE, '').trim());
  const entry = {
    role: title ? rest : '',
    company: !title && company ? rest : '',
    startDate: dates.startDate,
    endDate: dates.endDate,
  };
  return (
    qualifiesStrictExperience(entry, l) &&
    scoreStrictExperienceEntry(entry, l) >= EXPERIENCE_PARSER_CONFIDENCE_MIN
  );
}

/**
 * Experience requires date + (role or company). No date-only or keyword-only lines.
 */
export function passesExperienceGate(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  return runParserGuarded(
    'exp_gate',
    l,
    () => withExperienceGateActive(() => passesExperienceGateInner(l)) ?? false,
    () => false
  );
}

export function isLikelyPortfolioProject(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 4) return false;
  if (lineMatchesSchool(l) || isLikelyEducation(l)) return false;
  if (SKILL_HINT_RE.test(l) && l.includes(',')) return false;
  if (hasExperienceDate(l) && (EXPERIENCE_ROLE_RE.test(l) || EMPLOYMENT_MARKER_RE.test(l))) {
    return false;
  }
  if (/\bpersonal\s+project\b/i.test(l)) return true;
  if (PROJECT_RE.test(l)) return true;
  if (PROJECT_ARTWORK_RE.test(l) && l.split(/\s+/).length <= 8) return true;
  if (/\bcover\b/i.test(l) && l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 8) return true;

  const words = l.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 8 && !hasExperienceDate(l) && !EMPLOYMENT_MARKER_RE.test(l)) {
    if (looksLikePersonName(l)) return false;
    if (/\b(drawing|illustration|design|identity|network|app|character|editorial|series|poster)\b/i.test(l)) {
      return true;
    }
    if (
      (PROJECT_ARTWORK_RE.test(l) || PROJECT_RE.test(l) || /\bcover\b/i.test(l)) &&
      TITLE_CASE_PROJECT_RE.test(l) &&
      !isLikelyClient(l) &&
      !EXPERIENCE_ROLE_RE.test(l)
    ) {
      return true;
    }
  }
  return false;
}

export function isLikelySkillLine(line) {
  const l = String(line || '').trim();
  if (!l || isLikelyTool(l) || isLikelyClient(l) || isLikelyLanguage(l) || isLikelyInterest(l)) {
    return false;
  }
  if (passesExperienceGate(l) || isLikelyPortfolioProject(l)) return false;
  if (looksLikeSentence(l)) return false;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length === 1 && SKILL_SINGLE_RE.test(l)) return true;
  if (words.length <= 4 && SKILL_PHRASE_RE.test(l) && l.length < 100 && !EMAIL_RE.test(l)) return true;
  if (l.includes(',') && l.length < 120 && SKILL_PHRASE_RE.test(l)) return true;
  if (l.includes(',') && l.length < 200 && !passesExperienceGate(l) && !EMAIL_RE.test(l)) {
    const parts = splitListItems(l);
    if (parts.length >= 2 && parts.length <= 14) return true;
  }
  return false;
}

function isLikelyIdentityLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 52 || l.length < 3) return false;
  if (isGarbageLine(l)) return false;
  if (EMAIL_RE.test(l) || PHONE_RE.test(l) || URL_RE.test(l) || hasExperienceDate(l)) return false;
  if (passesExperienceGate(l) || isLikelyPortfolioProject(l) || isSectionHeaderLike(l)) return false;
  if (/\b(maybe|perhaps|something|ambiguous|unknown|vague)\b/i.test(l)) return false;
  if (looksLikeSentence(l)) return false;
  if (TOOLS.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(l)) && l.includes(',')) return false;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4 && looksLikePersonName(l) && !isLikelyClient(l)) return true;
  return false;
}

function scoreEducationLineEnterprise(line) {
  const l = String(line || '').trim();
  if (!l) return 0;
  let score = 0;
  if (lineMatchesSchool(l)) score += 55;
  if (INSTITUTION_HINT_RE.test(l)) score += 30;
  if (EDUCATION_KEYWORDS.some((k) => termMatchesHay(l, k))) {
    score += 28;
  }
  if (/\s[—–-]\s/.test(l) && l.length < 120) score += 15;
  if (/\b(19|20)\d{2}\b/.test(l)) score += 12;
  return Math.min(100, score);
}

function looksLikeSummaryLine(line) {
  const l = String(line || '').trim();
  if (l.length < 36 || l.length > 520) return false;
  if (passesExperienceGate(l) || lineMatchesSchool(l)) return false;
  return looksLikeSentence(l) || /^(creative|experienced|passionate|professional)\b/i.test(l);
}

function isSectionHeaderLike(line) {
  return /^(experience|education|skills|tools|languages|clients|projects|profile|summary|contact)\b/i.test(
    String(line || '').trim()
  );
}

function scoreClient(line) {
  const l = String(line || '').trim();
  const words = l.split(/\s+/).filter(Boolean);
  if (isLikelyClient(l) && words.length <= 4 && !hasExperienceDate(l) && !EXPERIENCE_ROLE_RE.test(l)) {
    return { bucket: 'clients', confidence: words.length === 1 ? 96 : 88, signals: ['brand'] };
  }
  return null;
}

export function scoreExperience(line) {
  if (isLikelyPortfolioProject(line)) return null;
  const l = String(line || '').trim();
  if (lineIsContactData(l) || lineIsEducationData(l) || lineIsSkillOrTagOnly(l)) return null;
  if (mustNeverBeExperience(l)) return null;
  if (blocksExperienceClassification(l)) return null;
  if (!hasExperienceDate(l)) return null;

  const title = hasExperienceJobTitle(line);
  const company = hasExperienceCompany(line);
  const dates = extractDateRangeFromText(l);
  const conf = scoreStrictExperienceEntry({
    role: title ? l.replace(DATE_RE, '').trim() : '',
    company: company ? l.replace(DATE_RE, '').trim() : '',
    startDate: dates.startDate,
    endDate: dates.endDate,
  });
  if (conf < EXPERIENCE_PARSER_CONFIDENCE_MIN) return null;
  const signals = [
    dates.startDate ? 'date' : null,
    title ? 'jobTitle' : null,
    company ? 'company' : null,
  ].filter(Boolean);
  return { bucket: 'experience', confidence: conf, signals };
}

/**
 * @returns {{ bucket: string, confidence: number, signals: string[] }}
 */
export function classifyLineWithConfidence(line) {
  const l = String(line || '').trim();
  if (!l) return { bucket: 'empty', confidence: 0, signals: [] };
  if (isLikelyGarbageLine(l) || isGarbageLine(l)) {
    const r = { bucket: 'garbage', confidence: 95, signals: ['garbage'] };
    recordFromClassification(r, l);
    return r;
  }

  const v2Early = classifySpecialtyLineV2(l);
  if (v2Early && v2Early.bucket !== 'unsorted') {
    recordFromClassification(v2Early, l);
    return v2Early;
  }

  const creativeHit = classifyCreativeLine(l);
  if (creativeHit) {
    recordFromClassification(creativeHit, l);
    return creativeHit;
  }

  const dictHit = classifyLineByDictionary(l);
  if (dictHit?.bucket === 'education') {
    const v2Edu = classifySpecialtyLineV2(l);
    if (v2Edu?.bucket === 'education') {
      recordFromClassification(v2Edu, l);
      return v2Edu;
    }
  }

  const expBeforeEdu = scoreExperience(l);
  if (expBeforeEdu) {
    recordFromClassification(expBeforeEdu, l);
    return expBeforeEdu;
  }

  const eduConf = scoreEducationConfidence(l);
  if (eduConf.unknown) {
    const r = { bucket: 'unknown', confidence: 0, signals: ['unknown_cycle'] };
    recordFromClassification(r, l);
    return r;
  }
  if (eduConf.forceEducation || eduConf.schoolMatch) {
    const v2Edu = classifySpecialtyLineV2(l);
    if (v2Edu?.bucket === 'education') {
      recordFromClassification(v2Edu, l);
      return v2Edu;
    }
    const r = buildForcedEducationClassification(l);
    if (r.confidence >= CLASSIFICATION_CONFIDENCE_MIN) {
      recordFromClassification(r, l);
      return r;
    }
  }

  if (dictHit?.bucket === 'contact') {
    recordFromClassification(dictHit, l);
    return dictHit;
  }

  if (isLikelyIdentityLine(l)) {
    const r = { bucket: 'identity', confidence: 76, signals: ['identity'] };
    recordFromClassification(r, l);
    return r;
  }

  if (lineMatchesSchool(l) || (isLikelyEducation(l) && !passesExperienceGate(l))) {
    const v2Edu = classifySpecialtyLineV2(l);
    if (v2Edu?.bucket === 'education') {
      recordFromClassification(v2Edu, l);
      return v2Edu;
    }
  }

  if (looksLikeSummaryLine(l)) {
    return { bucket: 'summary', confidence: 82, signals: ['summary'] };
  }

  if (isLikelyPortfolioProject(l)) {
    return { bucket: 'projects', confidence: 86, signals: ['portfolio'] };
  }

  if (looksLikeSummaryLine(l)) {
    return { bucket: 'summary', confidence: 82, signals: ['summary'] };
  }

  if (isCreativeNonExperienceLine(l)) {
    const ch = classifyCreativeLine(l);
    if (ch) {
      recordFromClassification(ch, l);
      return ch;
    }
  }

  const expEarly = scoreExperience(l);
  if (expEarly) return expEarly;

  if (looksLikeSummaryLine(l)) {
    return { bucket: 'summary', confidence: 82, signals: ['summary'] };
  }

  if (EMAIL_RE.test(l) && l.length < 80) {
    return { bucket: 'contact', confidence: 95, signals: ['email'] };
  }
  if (PHONE_RE.test(l) && l.length < 40 && !hasExperienceDate(l)) {
    return { bucket: 'contact', confidence: 95, signals: ['phone'] };
  }
  if (URL_RE.test(l)) return { bucket: 'contact', confidence: 90, signals: ['url'] };

  const v2Late = classifySpecialtyLineV2(l);
  if (v2Late) {
    recordFromClassification(v2Late, l);
    return v2Late;
  }

  if (
    ROLE_TITLE_RE.test(l) &&
    l.length < 90 &&
    !EMAIL_RE.test(l) &&
    !l.includes(',') &&
    !hasExperienceDate(l)
  ) {
    return { bucket: 'identity', confidence: 82, signals: ['title'] };
  }

  if (looksLikeSummaryLine(l)) {
    return { bucket: 'summary', confidence: 80, signals: ['summary'] };
  }
  if (/^(experience|education|skills|tools|languages|clients|projects)\b/i.test(l)) {
    return { bucket: 'header', confidence: 90, signals: ['header'] };
  }

  const r = { bucket: 'unsorted', confidence: 35, signals: ['low-confidence'] };
  recordFromClassification(r, l);
  return r;
}

function initSectionConfidence() {
  const o = { unsorted: 0, projects: 0 };
  for (const k of SECTION_BUCKETS) o[k] = 0;
  return o;
}

function bumpConfidence(tally, bucket, confidence) {
  if (!tally[bucket]) tally[bucket] = { sum: 0, n: 0 };
  tally[bucket].sum += confidence;
  tally[bucket].n += 1;
}

function finalizeConfidence(tally) {
  const out = initSectionConfidence();
  for (const [key, v] of Object.entries(tally)) {
    if (!v?.n) {
      out[key] = 0;
      continue;
    }
    out[key] = Math.round(v.sum / v.n);
  }
  return out;
}

/** Confidence that a line belongs in an explicit section (header-assigned). */
function rawConfidenceForSection(line, sectionKey) {
  const l = String(line || '').trim();
  if (!l) return { confidence: 0, ok: false };
  const classified = classifyLineWithConfidence(l);

  if (sectionKey === 'experience') {
    if (mustNeverBeExperience(l) || blocksExperienceClassification(l)) {
      return { confidence: 0, ok: false };
    }
    const exp = scoreExperience(l);
    const conf = exp?.confidence ?? 0;
    return { confidence: conf, ok: passesExperienceGate(l) && conf >= SANITY_CONFIDENCE_THRESHOLD };
  }
  if (sectionKey === 'education') {
    const ok =
      isLikelyEducation(l) ||
      (/\b(19|20)\d{2}\b/.test(l) &&
        /\b(master|bachelor|mba|phd|degree|diploma|university|école|ecole|school|college|sorbonne|licence)\b/i.test(
          l
        ));
    return { confidence: ok ? 88 : 40, ok };
  }
  if (sectionKey === 'skills') {
    const ok = isLikelySkillLine(l) || (l.includes(',') && l.length < 200 && !passesExperienceGate(l));
    return { confidence: ok ? 85 : 35, ok };
  }
  if (sectionKey === 'tools') {
    const ok = isLikelyTool(l);
    return { confidence: ok ? 94 : 30, ok };
  }
  if (sectionKey === 'languages') {
    const ok = isLikelyLanguage(l);
    return { confidence: ok ? 90 : 35, ok };
  }
  if (sectionKey === 'clients') {
    const ok = isLikelyClient(l);
    return { confidence: ok ? 96 : 40, ok };
  }
  if (sectionKey === 'awards') {
    const ok = classified.bucket === 'awards' || isAwardsLine(l);
    return { confidence: ok ? 90 : 35, ok };
  }
  if (sectionKey === 'exhibitions') {
    const ok = classified.bucket === 'exhibitions';
    return { confidence: ok ? 88 : 35, ok };
  }
  if (sectionKey === 'publications') {
    const ok = classified.bucket === 'publications';
    return { confidence: ok ? 88 : 35, ok };
  }
  if (sectionKey === 'portfolioLinks') {
    const ok = classified.bucket === 'portfolioLinks';
    return { confidence: ok ? 94 : 35, ok };
  }
  if (sectionKey === 'interests') {
    const parts = l.split(/[,;·|]/).map((p) => p.trim()).filter(Boolean);
    const ok =
      parts.length >= 2
        ? parts.every((p) => isLikelyInterest(p))
        : isLikelyInterest(l);
    return { confidence: ok ? 82 : 35, ok };
  }
  if (sectionKey === 'projects') {
    const ok = isLikelyPortfolioProject(l);
    return { confidence: ok ? 78 : 35, ok };
  }
  if (sectionKey === 'certifications' || sectionKey === 'volunteer') {
    const ok = l.length >= 3 && classified.bucket !== 'garbage';
    return { confidence: ok ? 76 : 35, ok };
  }
  if (sectionKey === 'summary' || sectionKey === 'profile') {
    const ok = l.length >= 24 && classified.bucket !== 'garbage';
    return { confidence: ok ? 80 : 40, ok };
  }
  if (sectionKey === 'contact' || sectionKey === 'location') {
    const ok = classified.bucket === 'contact';
    return { confidence: ok ? classified.confidence : 30, ok };
  }

  const ok = classified.bucket === sectionKey && classified.confidence >= SANITY_CONFIDENCE_THRESHOLD;
  return { confidence: classified.confidence, ok };
}

export function confidenceForSection(line, sectionKey, opts = {}) {
  const result = rawConfidenceForSection(line, sectionKey);
  if (!opts?.designerMode?.active) return result;
  return {
    ...result,
    confidence: applyDesignerSectionWeight(result.confidence, sectionKey, opts.designerMode),
  };
}

const HEADER_BUCKETS = [
  'identity',
  'contact',
  'location',
  'summary',
  'profile',
  'experience',
  'achievements',
  'awards',
  'exhibitions',
  'publications',
  'portfolioLinks',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'interests',
  'projects',
  'certifications',
  'volunteer',
];

/**
 * Orphans from `top` → classify; header buckets → validate only (no cross-bucket steals).
 */
export function applySectionSanityPass(blocks, opts = {}) {
  const out = { ...blocks };
  out.unsorted = [...(blocks.unsorted || [])];
  out.projects = [...(blocks.projects || [])];
  const tally = {};
  for (const [key, conf] of Object.entries(blocks.sectionConfidence || {})) {
    if (Number(conf) > 0) bumpConfidence(tally, key, Number(conf));
  }

  for (const line of blocks.top || []) {
    const { bucket, confidence } = classifyLineWithConfidence(line);
    if (bucket === 'garbage' || bucket === 'empty' || bucket === 'header') continue;
    if (confidence < SANITY_CONFIDENCE_THRESHOLD || bucket === 'unsorted') {
      out.unsorted.push(line);
      bumpConfidence(tally, 'unsorted', confidence);
      continue;
    }
    let target = bucket === 'profile' ? 'summary' : bucket;
    if (target === 'identity') {
      out.identity = out.identity || [];
      out.identity.push(line);
      bumpConfidence(tally, 'identity', confidence);
      continue;
    }
    out[target] = out[target] || [];
    out[target].push(line);
    bumpConfidence(tally, target, confidence);
  }
  out.top = [];

  const REROUTE_BUCKETS = new Set([
    'education',
    'clients',
    'tools',
    'languages',
    'skills',
    'projects',
    'awards',
    'exhibitions',
    'publications',
    'portfolioLinks',
  ]);

  for (const key of HEADER_BUCKETS) {
    const lines = [...(out[key] || [])];
    const kept = [];
    for (const line of lines) {
      const classified = classifyLineWithConfidence(line);
      const natural = classified.bucket === 'profile' ? 'summary' : classified.bucket;
      if (key === 'experience' && (mustNeverBeExperience(line) || natural === 'education')) {
        out.education = out.education || [];
        out.education.push(line);
        bumpConfidence(tally, 'education', classified.confidence || 90);
        continue;
      }
      if (key === 'experience' && isCreativeNonExperienceLine(line)) {
        const target =
          classified.bucket === 'clients' ||
          classified.bucket === 'awards' ||
          classified.bucket === 'exhibitions' ||
          classified.bucket === 'publications' ||
          classified.bucket === 'portfolioLinks' ||
          classified.bucket === 'projects'
            ? classified.bucket
            : 'clients';
        out[target] = out[target] || [];
        out[target].push(line);
        bumpConfidence(tally, target, classified.confidence || 88);
        continue;
      }
      if (
        natural !== key &&
        REROUTE_BUCKETS.has(natural) &&
        classified.confidence >= SANITY_CONFIDENCE_THRESHOLD
      ) {
        out[natural] = out[natural] || [];
        out[natural].push(line);
        bumpConfidence(tally, natural, classified.confidence);
        continue;
      }
      const { confidence, ok } = confidenceForSection(line, key, opts);
      if (!ok || confidence < SANITY_CONFIDENCE_THRESHOLD) {
        if (
          natural !== key &&
          REROUTE_BUCKETS.has(natural) &&
          classified.confidence >= SANITY_CONFIDENCE_THRESHOLD
        ) {
          out[natural] = out[natural] || [];
          out[natural].push(line);
          bumpConfidence(tally, natural, classified.confidence);
          continue;
        }
        out.unsorted.push(line);
        bumpConfidence(tally, 'unsorted', confidence);
        continue;
      }
      kept.push(line);
      bumpConfidence(tally, key, confidence);
    }
    out[key] = kept;
  }

  out.sectionConfidence = finalizeConfidence(tally);
  for (const k of SECTION_BUCKETS) {
    if (!out[k]) out[k] = [];
  }
  if (!out.unsorted) out.unsorted = [];
  if (!out.projects) out.projects = [];

  return out;
}
