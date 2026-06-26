/**
 * Education confidence — school / degree / year; force education when score > 60.
 * School names must NEVER classify as experience.
 * Dictionary matching is pure — never calls experience-parser.
 */

import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { EDUCATION_KEYWORDS, INSTITUTION_HINT_RE } from '../../data/dictionaries/educationKeywords.js';
import { escapeRegex } from '../../data/dictionaries/match-utils.js';
import {
  runParserGuarded,
  UNKNOWN_EDUCATION_SIGNALS,
  UNKNOWN_CLASSIFICATION,
} from './parser-cycle-guard.js';

export const EDUCATION_FORCE_THRESHOLD = 60;

export const EDUCATION_SCORE_WEIGHTS = {
  school: 40,
  degree: 30,
  year: 20,
};

const DEGREE_RE =
  /\b(bachelor|master|mba|phd|b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|m\.?a\.?|m\.?s\.?|m\.?f\.?a\.?|licence|license|diploma|degree|baccalauréat|baccalaureat|bac\s*\+\s*[2-5]|doctorat|doctoral|undergraduate|graduate|postgraduate|maîtrise|maitrise|deug|dut|bts|dnp|jd|md)\b/i;

const PROGRAM_RE =
  /\b(design|graphic\s+design|visual\s+communication|fine\s+arts|beaux[- ]arts|animation|illustration|fashion|architecture|communication|marketing|business|engineering|computer\s+science|informatics|studies|program|formation|parcours|specialization|spécialisation|major|minor)\b/i;

const GRAD_YEAR_RE = /\b(19|20)\d{2}\b/;
const GRADUATION_RE = /\b(graduated|graduation|diplômé|diplome|promotion|class\s+of)\b/i;

const SCHOOL_EMPLOYMENT_ROLE_RE =
  /\b(teaching\s+assistant|research\s+assistant|graduate\s+assistant|postdoctoral|postdoc|associate\s+professor|assistant\s+professor|adjunct\s+professor|full\s+professor|professor|lecturer|researcher|research\s+fellow|fellow|instructor|tutor|visiting\s+scholar)\b/i;

const EDUCATION_OCR_CORRUPT_RE =
  /\b20[MN]\b|@\s*man\b|ign\s+fin|fin\s+hie|mustrator|incesion|\bee\s+à\b|\d{4}\s+20[MN]\s*:/i;

const EDUCATION_KEYWORD_RES = EDUCATION_KEYWORDS.map((k) => {
  const t = String(k || '').trim();
  return t.length >= 2 ? new RegExp(`\\b${escapeRegex(t)}\\b`, 'i') : null;
}).filter(Boolean);

const eduSignalsCache = new Map();
const EDU_SIGNALS_CACHE_MAX = 800;

const EMPTY_SIGNALS = Object.freeze({
  score: 0,
  forceEducation: false,
  schoolMatch: false,
  degreeMatch: false,
  yearMatch: false,
  confidence: 0,
  signals: [],
  isEducationLine: false,
});

function cacheEducationSignals(line, value) {
  if (eduSignalsCache.size >= EDU_SIGNALS_CACHE_MAX) eduSignalsCache.clear();
  eduSignalsCache.set(line, value);
  return value;
}

/**
 * Pure dictionary school hit — no schools.js / parser imports.
 * @param {string} line
 */
function matchSchoolDictionary(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (findLongestDictionaryTerm(l, SCHOOL_TERMS)) return true;
  if (INSTITUTION_HINT_RE.test(l) && l.length < 120) return true;
  return EDUCATION_KEYWORD_RES.some((re) => re.test(l));
}

/**
 * @param {string} line
 * @param {boolean} [schoolKnown]
 */
function matchEducationDegree(line, schoolKnown = false) {
  const l = String(line || '').trim();
  return DEGREE_RE.test(l) || (PROGRAM_RE.test(l) && (INSTITUTION_HINT_RE.test(l) || schoolKnown));
}

export function isSchoolEmploymentLine(line) {
  const l = String(line || '').trim();
  return SCHOOL_EMPLOYMENT_ROLE_RE.test(l) && GRAD_YEAR_RE.test(l);
}

/**
 * Academic employment at a school (TA, professor, postdoc) — employer may be a university.
 * @param {string} [line]
 * @param {{ role?: string, company?: string }} [entry]
 */
export function isAcademicEmploymentContext(line = '', entry = null) {
  const l = String(line || '').trim();
  if (isSchoolEmploymentLine(l)) return true;
  const role = String(entry?.role || '').trim();
  const company = String(entry?.company || '').trim();
  if (SCHOOL_EMPLOYMENT_ROLE_RE.test(role) && matchSchoolDictionary(company)) {
    return true;
  }
  if (SCHOOL_EMPLOYMENT_ROLE_RE.test(l) && matchSchoolDictionary(l)) {
    return true;
  }
  return false;
}

/**
 * @param {string} line
 */
export function isCorruptEducationLine(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  if (EDUCATION_OCR_CORRUPT_RE.test(s)) return true;
  if (/creation\s+school\s+management.*@\s*man/i.test(s)) return true;
  return false;
}

/**
 * @param {string} line
 */
export function hasEducationDegree(line) {
  const l = String(line || '').trim();
  const schoolKnown = matchSchoolDictionary(l);
  return matchEducationDegree(l, schoolKnown);
}

/**
 * @param {string} line
 */
export function hasEducationYear(line) {
  const l = String(line || '').trim();
  return GRAD_YEAR_RE.test(l) || GRADUATION_RE.test(l);
}

/**
 * @param {string} line
 */
export function hasEducationSchool(line) {
  return matchSchoolDictionary(line);
}

/**
 * Single-pass education signals for a line (cached). Never calls experience-parser.
 * @param {string} line
 */
function computeEducationLineSignals(line) {
  const l = String(line || '').trim();
  if (!l) return EMPTY_SIGNALS;
  if (eduSignalsCache.has(l)) return eduSignalsCache.get(l);

  if (isSchoolEmploymentLine(l)) {
    return cacheEducationSignals(l, {
      ...EMPTY_SIGNALS,
      signals: ['school_employment'],
    });
  }

  if (isCorruptEducationLine(l)) {
    return cacheEducationSignals(l, {
      ...EMPTY_SIGNALS,
      signals: ['ocr_corrupt'],
    });
  }

  const signals = [];
  let score = 0;

  const schoolMatch = matchSchoolDictionary(l);
  const degreeMatch = matchEducationDegree(l, schoolMatch);
  const yearMatch = hasEducationYear(l);

  if (schoolMatch) {
    score += EDUCATION_SCORE_WEIGHTS.school;
    signals.push('school');
  }
  if (degreeMatch) {
    score += EDUCATION_SCORE_WEIGHTS.degree;
    signals.push('degree');
  }
  if (yearMatch) {
    score += EDUCATION_SCORE_WEIGHTS.year;
    signals.push('year');
  }

  const forceEducation = score > EDUCATION_FORCE_THRESHOLD || (schoolMatch && (degreeMatch || yearMatch));
  const isEducationLine =
    forceEducation ||
    schoolMatch ||
    /\b(university|école|ecole|school|bachelor|master|mba|diploma|licence|lisaa|créapole|creapole)\b/i.test(l);

  return cacheEducationSignals(l, {
    score,
    forceEducation,
    schoolMatch,
    degreeMatch,
    yearMatch,
    confidence: Math.min(100, score),
    signals,
    isEducationLine,
  });
}

/**
 * Single-pass education signals for a line (cached). Never calls experience-parser.
 * @param {string} line
 */
export function getEducationLineSignals(line) {
  const l = String(line || '').trim();
  if (!l) return EMPTY_SIGNALS;
  return runParserGuarded(
    'edu_signals',
    l,
    () => computeEducationLineSignals(l),
    () => UNKNOWN_EDUCATION_SIGNALS
  );
}

/**
 * @param {string} line
 */
export function scoreEducationConfidence(line) {
  const edu = getEducationLineSignals(line);
  if (edu.unknown) {
    return {
      score: 0,
      forceEducation: false,
      schoolMatch: false,
      degreeMatch: false,
      yearMatch: false,
      confidence: 0,
      signals: ['unknown_cycle'],
      unknown: true,
    };
  }
  return {
    score: edu.score,
    forceEducation: edu.forceEducation,
    schoolMatch: edu.schoolMatch,
    degreeMatch: edu.degreeMatch,
    yearMatch: edu.yearMatch,
    confidence: edu.confidence,
    signals: edu.signals,
  };
}

/**
 * Lines that must never enter the experience bucket.
 * @param {string} line
 */
export function mustNeverBeExperience(line) {
  if (isSchoolEmploymentLine(line)) return false;
  const edu = getEducationLineSignals(line);
  if (edu.unknown) return false;
  return edu.schoolMatch || edu.forceEducation;
}

/**
 * @param {string} line
 */
export function buildForcedEducationClassification(line) {
  const edu = getEducationLineSignals(line);
  if (edu.unknown) {
    return { ...UNKNOWN_CLASSIFICATION };
  }
  const schoolTerm = findLongestDictionaryTerm(line, SCHOOL_TERMS);
  return {
    bucket: 'education',
    confidence: Math.max(edu.confidence, edu.forceEducation ? 92 : 85),
    signals: ['education_confidence', ...edu.signals],
    parserDebug: {
      classificationReason: edu.forceEducation ? 'education_confidence_forced' : 'education_school_block',
      matchedDictionary: schoolTerm ? 'schools' : null,
      matchedTerm: schoolTerm,
      confidenceScore: edu.score,
      educationScore: edu.score,
      forceEducation: edu.forceEducation,
    },
  };
}
