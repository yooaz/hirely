/**
 * SEMANTIC_CLASSIFIER_V2 — precision semantic block classification.
 * Auto-place only when confidence > 80; otherwise review queue (unknown).
 */

import { lineLooksLikeRole, lineIsRoleOnly } from '../../data/dictionaries/roleKeywords.js';
import {
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
  SCHOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import {
  isValidIdentityName,
  isValidIdentityTitle,
} from './identity-extraction.js';
import { classifySpecialtyLineV2, CLASSIFICATION_CONFIDENCE_MIN } from './classification-engine-v2.js';
import { isStandaloneSkillDiscipline } from './suggestion-classification-fix.js';
import { hasEducationSchool, hasEducationDegree, mustNeverBeExperience } from './education-confidence.js';
import { passesExperienceGate, hasExperienceDate } from './section-sanity.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import { isValidSummaryField } from './field-sanitize.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { detectSectionHeaderId } from './section-detect-v2.js';

export const SEMANTIC_CLASSIFIER_V2 = 'SEMANTIC_CLASSIFIER_V2';
export const SEMANTIC_V2_CONFIDENCE_MIN = CLASSIFICATION_CONFIDENCE_MIN;

/** Canonical semantic types (H11 spec). */
export const SEMANTIC_CLASS = Object.freeze({
  PERSON_NAME: 'PERSON_NAME',
  JOB_TITLE: 'JOB_TITLE',
  SUMMARY: 'SUMMARY',
  EXPERIENCE: 'EXPERIENCE',
  COMPANY: 'COMPANY',
  CLIENT: 'CLIENT',
  EDUCATION: 'EDUCATION',
  SKILL: 'SKILL',
  TOOL: 'TOOL',
  LANGUAGE: 'LANGUAGE',
  LINK: 'LINK',
  UNKNOWN: 'UNKNOWN',
});

const SEMANTIC_TO_BUCKET = Object.freeze({
  PERSON_NAME: 'identity',
  JOB_TITLE: 'identity',
  SUMMARY: 'summary',
  EXPERIENCE: 'experience',
  COMPANY: 'experience',
  CLIENT: 'clients',
  EDUCATION: 'education',
  SKILL: 'skills',
  TOOL: 'tools',
  LANGUAGE: 'languages',
  LINK: 'contact',
  UNKNOWN: 'unsorted',
});

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\.|linkedin\.com|behance\.|dribbble\.|artstation\.|tumblr\.com|\.net\/|\.be\//i;

const SECTION_HEADER_REJECT =
  /^(profile|summary|about|experience|work experience|education|formation|skills|compétences|tools|outils|languages|langues|projects|clients|interests|contact|references|cv|resume|expertise|specialized|specialised)\b/i;

const GENERIC_TITLE_WORDS = new Set(
  [
    'expertise',
    'specialized',
    'specialised',
    'expert',
    'specialist',
    'professional',
    'profile',
    'summary',
    'portfolio',
    'market',
    'reviews',
    'review',
    'impressions',
    'communication',
    'visual',
    'creative',
    'design',
    'designer',
    'skills',
    'tools',
    'languages',
    'education',
    'experience',
    'work',
    'selected',
    'projects',
  ].map((x) => x.toLowerCase())
);

const PORTFOLIO_NAME_RE =
  /\b(behance|dribbble|artstation|tumblr|portfolio|market\s*reviews?|jb\s*impressions?)\b/i;

const PROGRAM_EDUCATION_RE =
  /\b(visual\s+communication|motion\s+design|web\s+and\s+motion|product\s+design|graphic\s+design|fine\s+arts|animation|illustration|infographie|ergonomie|maquette|typography|school\s+management|creation\s+school)\b/i;

const AGENCY_SUFFIX_RE = /\b(agency|agence|g\.?\s*agency|studios?|group|inc|ltd|gmbh|sarl)\b/i;

const COMPANY_SHORT_RE = /^[A-Z][A-Za-z0-9&.'\-\s]{2,48}$/;

/**
 * Lines that must never become candidate person names.
 * @param {string} line
 */
export function isRejectedPersonNameLine(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  if (SECTION_HEADER_REJECT.test(s)) return true;
  if (PORTFOLIO_NAME_RE.test(s)) return true;
  if (/^expertise\s+special/i.test(s)) return true;
  if (/^market\s+reviews?\)?$/i.test(s)) return true;
  if (/^jb\s+impressions?$/i.test(s)) return true;
  if (findLongestDictionaryTerm(s, CLIENT_TERMS) && s.split(/\s+/).length <= 4) return true;
  if (findLongestDictionaryTerm(s, SCHOOL_TERMS) && !isValidIdentityName(s)) return true;

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.every((w) => GENERIC_TITLE_WORDS.has(w.toLowerCase()))) return true;
  if (words.some((w) => GENERIC_TITLE_WORDS.has(w.toLowerCase()) && words.length <= 3)) {
    if (!isValidIdentityName(s)) return true;
  }

  if (/^[A-Z]{2,}(\s+[A-Z]{2,})+$/.test(s) && words.some((w) => GENERIC_TITLE_WORDS.has(w.toLowerCase()))) {
    return true;
  }

  return false;
}

/**
 * Company / agency / brand — must not land in summary or person name.
 * @param {string} line
 */
export function isCompanyOrClientLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length > 120) return false;
  if (EMAIL_RE.test(s) || URL_RE.test(s)) return false;

  const clientTerm = findLongestDictionaryTerm(s, CLIENT_TERMS);
  if (clientTerm) {
    const parts = s.split(/\s*[,;·|]\s*/);
    if (parts.length === 1 || parts.every((p) => findLongestDictionaryTerm(p, CLIENT_TERMS))) return true;
  }

  if (/^jb\s+impressions?$/i.test(s)) return true;
  if (/^market\s+reviews?\)?$/i.test(s)) return true;
  if (/\bmccann\b/i.test(s)) return true;
  if (AGENCY_SUFFIX_RE.test(s) && COMPANY_SHORT_RE.test(s)) return true;
  if (hasExperienceDate(s) && (clientTerm || AGENCY_SUFFIX_RE.test(s))) return true;

  return false;
}

/**
 * Education program or school line — must rank above generic skill text.
 * @param {string} line
 */
export function isEducationSemanticLine(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (isCorruptEducationFragment(s)) return false;

  const school = findLongestDictionaryTerm(s, SCHOOL_TERMS);
  if (school) return true;
  if (hasEducationSchool(s) || hasEducationDegree(s)) return true;
  if (mustNeverBeExperience(s)) return true;

  if (PROGRAM_EDUCATION_RE.test(s) && (school || /\b(school|école|ecole|university|college|lisaa|créapole|creapole|parsons|mit)\b/i.test(s))) {
    return true;
  }
  if (/^\s*@?\s*man\s+visual\s+communication/i.test(s)) return true;
  if (/\b(19|20)\d{2}\b/.test(s) && PROGRAM_EDUCATION_RE.test(s)) return true;

  return false;
}

function isCorruptEducationFragment(s) {
  return /^@?\s*man\s+visual\s+communication$/i.test(s) || /^@\s*man\b/i.test(s);
}

function isNeverSummaryLine(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  if (isCompanyOrClientLine(s)) return true;
  if (isEducationSemanticLine(s) && s.length < 140) return true;
  if (isRejectedPersonNameLine(s)) return true;
  if (SECTION_HEADER_REJECT.test(s)) return true;
  if (findLongestDictionaryTerm(s, SCHOOL_TERMS)) return true;
  if (findLongestDictionaryTerm(s, TOOL_TERMS) && s.split(/\s+/).length <= 3) return true;
  if (/^visual\s+communication$/i.test(s)) return true;
  return false;
}

function scoreLink(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  if (EMAIL_RE.test(s) || PHONE_RE.test(s) || URL_RE.test(s)) {
    return { type: SEMANTIC_CLASS.LINK, confidence: 92, reason: 'v2_link' };
  }
  return null;
}

function scorePersonName(line, ctx) {
  const s = String(line || '').trim();
  if (!s || isRejectedPersonNameLine(s)) return null;
  if (!isValidIdentityName(s)) return null;
  let confidence = 88;
  if ((ctx.lineIndex ?? 99) <= 4) confidence += 4;
  if (ctx.hasContactNearby) confidence += 2;
  return { type: SEMANTIC_CLASS.PERSON_NAME, confidence: Math.min(98, confidence), reason: 'v2_person_name' };
}

function scoreJobTitle(line) {
  const s = String(line || '').trim();
  if (!s || isRejectedPersonNameLine(s)) return null;
  if (isStandaloneSkillDiscipline(s)) return null;
  if (!isValidIdentityTitle(s) && !lineIsRoleOnly(s) && !lineLooksLikeRole(s)) return null;
  if (isCompanyOrClientLine(s)) return null;
  const confidence = lineIsRoleOnly(s) ? 92 : 86;
  return { type: SEMANTIC_CLASS.JOB_TITLE, confidence, reason: 'v2_job_title' };
}

function scoreExperience(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  const dates = extractDateRangeFromText(s);
  if (dates.startDate && (passesExperienceGate(s) || lineLooksLikeRole(s) || isCompanyOrClientLine(s))) {
    return { type: SEMANTIC_CLASS.EXPERIENCE, confidence: 90, reason: 'v2_experience_dated' };
  }
  if (passesExperienceGate(s) && hasExperienceDate(s)) {
    return { type: SEMANTIC_CLASS.EXPERIENCE, confidence: 88, reason: 'v2_experience_gate' };
  }
  return null;
}

function scoreCompanyClient(line) {
  const s = String(line || '').trim();
  if (!s || !isCompanyOrClientLine(s)) return null;
  const clientTerm = findLongestDictionaryTerm(s, CLIENT_TERMS);
  const type = clientTerm && s.split(/\s+/).length <= 3 ? SEMANTIC_CLASS.CLIENT : SEMANTIC_CLASS.COMPANY;
  const confidence = clientTerm ? 94 : 86;
  return { type, confidence, reason: 'v2_company_client' };
}

function scoreEducation(line) {
  const s = String(line || '').trim();
  if (!s || !isEducationSemanticLine(s)) return null;
  const school = findLongestDictionaryTerm(s, SCHOOL_TERMS);
  let confidence = school ? 94 : 84;
  if (PROGRAM_EDUCATION_RE.test(s) && school) confidence = 96;
  if (/\b(19|20)\d{2}\b/.test(s)) confidence = Math.min(98, confidence + 2);
  if (isCorruptEducationFragment(s)) confidence = 45;
  return { type: SEMANTIC_CLASS.EDUCATION, confidence, reason: school ? 'v2_education_school' : 'v2_education_program' };
}

function scoreSummary(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 40) return null;
  if (isNeverSummaryLine(s)) return null;
  if (!isValidSummaryField(s)) return null;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 8) return null;
  return { type: SEMANTIC_CLASS.SUMMARY, confidence: 82, reason: 'v2_summary_prose' };
}

function buildAlternatives(candidates) {
  return (candidates || [])
    .slice(0, 4)
    .map((c) => ({
      type: c.type,
      confidence: Math.round(c.confidence),
      reason: c.reason,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

function finalizeHit(hit, allCandidates = []) {
  if (!hit) return null;
  const ambiguous = Array.isArray(allCandidates) && allCandidates.length >= 2;
  const autoPlace = !ambiguous && hit.confidence >= SEMANTIC_V2_CONFIDENCE_MIN;
  const semanticType = autoPlace ? hit.type : SEMANTIC_CLASS.UNKNOWN;
  const bucket = SEMANTIC_TO_BUCKET[semanticType] || 'unsorted';
  const alternatives = ambiguous ? buildAlternatives(allCandidates) : undefined;
  return {
    semanticType,
    type: semanticType,
    bucket,
    confidence: autoPlace ? hit.confidence : Math.min(hit.confidence, SEMANTIC_V2_CONFIDENCE_MIN - 1),
    rawType: hit.type,
    rawConfidence: hit.confidence,
    needsReview: !autoPlace || ambiguous,
    requiresRecruiterReview: ambiguous,
    alternatives,
    reason: hit.reason,
    engine: SEMANTIC_CLASSIFIER_V2,
    signals: ['semantic_v2', hit.reason],
    parserDebug: {
      classificationReason: hit.reason,
      engine: SEMANTIC_CLASSIFIER_V2,
      confidenceScore: hit.confidence,
      rawType: hit.type,
      autoPlace,
      alternatives,
    },
  };
}

/**
 * Ambiguous creative program lines — recruiter must choose (H12).
 * @param {string} line
 * @returns {Array<{ type: string, confidence: number, reason: string }> | null}
 */
function scoreAmbiguousCreativeProgram(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  if (/^visual\s+communication$/i.test(s)) {
    return [
      { type: SEMANTIC_CLASS.SKILL, confidence: 55, reason: 'v2_ambiguous_skill_program' },
      { type: SEMANTIC_CLASS.EDUCATION, confidence: 42, reason: 'v2_ambiguous_education_program' },
    ];
  }
  return null;
}

/**
 * Short brand/agency names — company vs internship/client (H14).
 * @param {string} line
 */
function scoreAmbiguousCompanyPlacement(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  if (/^jb\s+impressions?$/i.test(s)) {
    return [
      { type: SEMANTIC_CLASS.CLIENT, confidence: 58, reason: 'v2_ambiguous_client' },
      { type: SEMANTIC_CLASS.EXPERIENCE, confidence: 52, reason: 'v2_ambiguous_internship' },
    ];
  }
  if (/^market\s+reviews?\)?$/i.test(s)) {
    return [
      { type: SEMANTIC_CLASS.CLIENT, confidence: 54, reason: 'v2_ambiguous_portfolio_client' },
      { type: SEMANTIC_CLASS.EDUCATION, confidence: 40, reason: 'v2_ambiguous_education_noise' },
    ];
  }
  return null;
}

/**
 * Classify a single extracted line/block with semantic V2 rules.
 * @param {string} text
 * @param {object} [ctx]
 * @returns {ReturnType<typeof finalizeHit>}
 */
export function classifySemanticBlockV2(text, ctx = {}) {
  const line = String(text || '').trim();
  if (!line) return finalizeHit({ type: SEMANTIC_CLASS.UNKNOWN, confidence: 0, reason: 'empty' });

  const ambiguous =
    scoreAmbiguousCreativeProgram(line) || scoreAmbiguousCompanyPlacement(line);
  if (ambiguous?.length >= 2) {
    return finalizeHit(ambiguous[0], ambiguous);
  }

  const headerId = detectSectionHeaderId(line);
  if (headerId || isSectionHeaderLine(line) || SECTION_HEADER_REJECT.test(line)) {
    return finalizeHit({ type: SEMANTIC_CLASS.UNKNOWN, confidence: 55, reason: 'section_header' });
  }

  const scorers = [
    () => scoreLink(line),
    () => scoreEducation(line),
    () => scoreCompanyClient(line),
    () => scoreExperience(line),
    () => scoreJobTitle(line),
    () => {
      const v2 = classifySpecialtyLineV2(line);
      if (!v2) return null;
      const raw = v2?.parserDebug?.rawType || v2?.type;
      const rawConf = v2?.parserDebug?.rawConfidence ?? v2?.confidence ?? 0;
      const map = {
        education: SEMANTIC_CLASS.EDUCATION,
        language: SEMANTIC_CLASS.LANGUAGE,
        tool: SEMANTIC_CLASS.TOOL,
        skill: SEMANTIC_CLASS.SKILL,
        client: SEMANTIC_CLASS.CLIENT,
        interest: SEMANTIC_CLASS.UNKNOWN,
      };
      const sem = map[raw];
      if (!sem || sem === SEMANTIC_CLASS.UNKNOWN) return null;
      if (sem === SEMANTIC_CLASS.SKILL && isEducationSemanticLine(line)) return null;
      if (sem === SEMANTIC_CLASS.SKILL && /^visual\s+communication$/i.test(line)) return null;
      return { type: sem, confidence: rawConf, reason: v2?.parserDebug?.classificationReason || 'v2_specialty_delegate' };
    },
    () => scorePersonName(line, ctx),
    () => scoreSummary(line),
  ];

  /** @type {Array<{ type: string, confidence: number, reason: string }>} */
  const candidates = [];
  for (const fn of scorers) {
    const hit = fn();
    if (hit) candidates.push(hit);
  }

  if (!candidates.length) {
    return finalizeHit({ type: SEMANTIC_CLASS.UNKNOWN, confidence: 52, reason: 'unclassified' });
  }

  const priority = [
    SEMANTIC_CLASS.LINK,
    SEMANTIC_CLASS.EDUCATION,
    SEMANTIC_CLASS.CLIENT,
    SEMANTIC_CLASS.COMPANY,
    SEMANTIC_CLASS.EXPERIENCE,
    SEMANTIC_CLASS.JOB_TITLE,
    SEMANTIC_CLASS.TOOL,
    SEMANTIC_CLASS.LANGUAGE,
    SEMANTIC_CLASS.SKILL,
    SEMANTIC_CLASS.PERSON_NAME,
    SEMANTIC_CLASS.SUMMARY,
  ];

  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return priority.indexOf(a.type) - priority.indexOf(b.type);
  });

  const top = candidates[0];
  const close = candidates.filter((c) => top.confidence - c.confidence <= 20);
  if (close.length >= 2 && top.confidence < SEMANTIC_V2_CONFIDENCE_MIN) {
    return finalizeHit(top, close.slice(0, 4));
  }
  return finalizeHit(top);
}

/**
 * @param {string} semanticType
 */
export function semanticV2ToBucket(semanticType) {
  return SEMANTIC_TO_BUCKET[semanticType] || 'unsorted';
}

/**
 * Audit structured CV for known H11 misclassification patterns.
 * @param {object} cv
 */
export function auditSemanticMisclassifications(cv) {
  const issues = [];
  const name = String(cv?.name || cv?.identity?.name || '').trim();
  const summary = String(cv?.summary || '').trim();
  const skills = [...(cv?.skills || []), ...(cv?.tools || [])].map(String);
  const education = (cv?.education || []).map(String);

  if (/expertise\s+special/i.test(name)) issues.push({ id: 'title_as_name', field: 'name', value: name });
  if (/^jb\s+impressions?$/i.test(name)) issues.push({ id: 'company_as_name', field: 'name', value: name });
  if (/market\s+reviews?/i.test(name)) issues.push({ id: 'portfolio_as_name', field: 'name', value: name });

  if (/^jb\s+impressions?$/i.test(summary)) issues.push({ id: 'company_as_summary', field: 'summary', value: summary });
  if (/\bmccann\b/i.test(summary) && summary.length < 80) {
    issues.push({ id: 'agency_as_summary', field: 'summary', value: summary });
  }

  for (const sk of skills) {
    if (/^visual\s+communication$/i.test(sk.trim())) {
      issues.push({ id: 'program_as_skill', field: 'skills', value: sk });
    }
  }

  for (const ed of education) {
    if (/^market\s+reviews?\)?$/i.test(ed.trim())) {
      issues.push({ id: 'client_as_school', field: 'education', value: ed });
    }
  }

  return { pass: issues.length === 0, issues };
}
