/**
 * Multilingual CV section heading dictionary (FR + EN).
 * Maps normalized heading text → canonical segment section id.
 */

import { normalizeHeaderText } from './section-fuzzy.js';

/** @enum {string} */
export const CV_SECTION = Object.freeze({
  CONTACT: 'contact',
  SUMMARY: 'summary',
  EXPERIENCE: 'experience',
  EDUCATION: 'education',
  SKILLS: 'skills',
  LANGUAGES: 'languages',
  CERTIFICATIONS: 'certifications',
  PROJECTS: 'projects',
  INTERESTS: 'interests',
  OTHER: 'other',
});

/**
 * @typedef {object} SectionHeadingEntry
 * @property {string} section — CV_SECTION value
 * @property {string[]} en
 * @property {string[]} fr
 * @property {number} [confidence] — base match confidence
 */

/** Longer phrases first within each section when matching. */
export const SECTION_HEADING_DICTIONARY = [
  {
    section: CV_SECTION.CONTACT,
    confidence: 0.96,
    en: ['contact', 'contact information', 'contact details', 'reach me', 'get in touch'],
    fr: ['contact', 'coordonnees', 'coordonnées', 'informations personnelles'],
  },
  {
    section: CV_SECTION.SUMMARY,
    confidence: 0.95,
    en: [
      'profile',
      'professional profile',
      'summary',
      'professional summary',
      'about',
      'about me',
      'objective',
      'personal statement',
      'career summary',
    ],
    fr: ['profil', 'profil professionnel', 'a propos', 'à propos', 'presentation', 'présentation'],
  },
  {
    section: CV_SECTION.EXPERIENCE,
    confidence: 0.96,
    en: [
      'work experience',
      'professional experience',
      'employment history',
      'work history',
      'career history',
      'experience',
      'employment',
      'career',
    ],
    fr: [
      'experience professionnelle',
      'experiences professionnelles',
      'parcours professionnel',
      'emplois',
      'experience',
      'expérience',
      'parcours',
    ],
  },
  {
    section: CV_SECTION.EDUCATION,
    confidence: 0.95,
    en: ['education', 'academic background', 'academic', 'studies', 'qualifications', 'scholarship'],
    fr: ['formation', 'formations', 'etudes', 'études', 'diplomes', 'diplômes', 'scolarite', 'scolarité'],
  },
  {
    section: CV_SECTION.SKILLS,
    confidence: 0.94,
    en: [
      'technical skills',
      'core skills',
      'skills',
      'competencies',
      'expertise',
      'tools',
      'software',
      'technologies',
      'tech stack',
    ],
    fr: ['competences', 'compétences', 'aptitudes', 'outils', 'logiciels', 'technologies'],
  },
  {
    section: CV_SECTION.LANGUAGES,
    confidence: 0.95,
    en: ['languages', 'language skills', 'linguistic skills'],
    fr: ['langues', 'langue', 'competences linguistiques', 'compétences linguistiques'],
  },
  {
    section: CV_SECTION.CERTIFICATIONS,
    confidence: 0.94,
    en: ['certifications', 'certificates', 'licenses', 'credentials', 'professional certifications'],
    fr: ['certifications', 'certificats', 'habilitations', 'agrements', 'agréments'],
  },
  {
    section: CV_SECTION.PROJECTS,
    confidence: 0.93,
    en: ['projects', 'selected projects', 'portfolio projects', 'personal projects', 'portfolio', 'selected work'],
    fr: ['projets', 'projets personnels', 'realisations', 'réalisations', 'portfolio'],
  },
  {
    section: CV_SECTION.INTERESTS,
    confidence: 0.93,
    en: ['interests', 'interest', 'hobbies', 'personal interests', 'leisure'],
    fr: ['interets', 'intérêts', 'interet', 'intérêt', 'centres d interet', "centres d'intérêt", 'loisirs'],
  },
];

const FLATTENED_HEADINGS = buildFlattenedIndex();

function buildFlattenedIndex() {
  /** @type {Array<{ section: string, norm: string, confidence: number, lang: string }>} */
  const rows = [];
  for (const entry of SECTION_HEADING_DICTIONARY) {
    for (const phrase of entry.en || []) {
      rows.push({
        section: entry.section,
        norm: normalizeHeadingPhrase(phrase),
        confidence: entry.confidence ?? 0.92,
        lang: 'en',
      });
    }
    for (const phrase of entry.fr || []) {
      rows.push({
        section: entry.section,
        norm: normalizeHeadingPhrase(phrase),
        confidence: entry.confidence ?? 0.92,
        lang: 'fr',
      });
    }
  }
  return rows.sort((a, b) => b.norm.length - a.norm.length);
}

/**
 * @param {string} phrase
 */
export function normalizeHeadingPhrase(phrase) {
  return normalizeHeaderText(phrase);
}

/**
 * @param {string} text
 * @param {object} [opts]
 * @returns {{ section: string, confidence: number, rule: string, lang: string|null, matched: string }|null}
 */
export function matchSectionHeading(text, opts = {}) {
  const raw = String(text || '').trim();
  if (!raw || raw.length < 2 || raw.length > 56) return null;

  const norm = normalizeHeaderText(raw);
  if (!norm || looksLikeContentRow(norm)) return null;

  for (const row of FLATTENED_HEADINGS) {
    if (norm === row.norm) {
      return {
        section: row.section,
        confidence: row.confidence,
        rule: 'heading_dictionary_exact',
        lang: row.lang,
        matched: row.norm,
      };
    }
  }

  for (const row of FLATTENED_HEADINGS) {
    if (norm.startsWith(`${row.norm} `) || norm.endsWith(` ${row.norm}`)) {
      return {
        section: row.section,
        confidence: Math.max(0.82, row.confidence - 0.06),
        rule: 'heading_dictionary_prefix',
        lang: row.lang,
        matched: row.norm,
      };
    }
  }

  if (!opts.typographyOnly) return null;

  const typo = scoreTypographyHeading(raw);
  if (typo.score < (opts.typographyThreshold ?? 0.55)) return null;

  return {
    section: CV_SECTION.OTHER,
    confidence: typo.score * 0.6,
    rule: 'typography_heading_unknown',
    lang: null,
    matched: raw,
  };
}

/**
 * @param {string} norm
 */
function looksLikeContentRow(norm) {
  if (!norm) return true;
  if (/\b(19|20)\d{2}\b/.test(norm)) return true;
  if (/\s[—–-]\s/.test(norm) && norm.length > 24) return true;
  if (norm.length > 44) return true;
  if (/[@+]/.test(norm)) return true;
  return false;
}

/**
 * Typography / style heading signals (no dictionary match).
 * @param {string} text
 * @param {object} [opts]
 */
export function scoreTypographyHeading(text, opts = {}) {
  const raw = String(text || '').trim();
  const words = raw.split(/\s+/).filter(Boolean);
  let score = 0;

  if (!raw || words.length > 6 || raw.length > 48) {
    return { score: 0, signals: [] };
  }

  /** @type {string[]} */
  const signals = [];

  if (words.length <= 4 && raw.length <= 36) {
    score += 0.22;
    signals.push('short_line');
  }

  const upperRatio = (raw.replace(/[^A-Za-zÀ-ÿ]/g, '').match(/[A-ZÀ-Ö]/g) || []).length;
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, '').length;
  if (letters >= 3 && upperRatio / letters >= 0.85 && raw === raw.toUpperCase()) {
    score += 0.38;
    signals.push('all_caps');
  }

  if (/^[A-ZÀ-Ö][a-zà-ö]+(?:\s+[A-ZÀ-Ö][a-zà-ö]+){0,3}$/.test(raw)) {
    score += 0.18;
    signals.push('title_case');
  }

  if (opts.bbox?.height && opts.medianLineHeight && opts.bbox.height >= opts.medianLineHeight * 1.06) {
    score += 0.14;
    signals.push('taller_line');
  }

  if (opts.zoneRole === 'sidebar' && words.length <= 2) {
    score += 0.08;
    signals.push('sidebar_short');
  }

  if (opts.gapBefore && opts.medianLineHeight && opts.gapBefore >= opts.medianLineHeight * 1.35) {
    score += 0.12;
    signals.push('vertical_gap');
  }

  return { score: Math.min(1, score), signals };
}

/**
 * @param {string} key — legacy fuzzy section key
 */
export function fuzzyKeyToCvSection(key) {
  const map = {
    contact: CV_SECTION.CONTACT,
    location: CV_SECTION.CONTACT,
    profile: CV_SECTION.SUMMARY,
    summary: CV_SECTION.SUMMARY,
    experience: CV_SECTION.EXPERIENCE,
    education: CV_SECTION.EDUCATION,
    skills: CV_SECTION.SKILLS,
    tools: CV_SECTION.SKILLS,
    languages: CV_SECTION.LANGUAGES,
    certifications: CV_SECTION.CERTIFICATIONS,
    projects: CV_SECTION.PROJECTS,
    portfolioLinks: CV_SECTION.PROJECTS,
    interests: CV_SECTION.INTERESTS,
    clients: CV_SECTION.OTHER,
    awards: CV_SECTION.OTHER,
    publications: CV_SECTION.OTHER,
    exhibitions: CV_SECTION.OTHER,
    volunteer: CV_SECTION.OTHER,
  };
  return map[key] || CV_SECTION.OTHER;
}
