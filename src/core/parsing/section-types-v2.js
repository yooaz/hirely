/**
 * SECTION_ENGINE_V2 — canonical section IDs (detect → classify → extract).
 */

export const SECTION_ENGINE_V2 = 'SECTION_ENGINE_V2';

/** @readonly */
export const SECTION_IDS = Object.freeze({
  PROFILE: 'PROFILE',
  SUMMARY: 'SUMMARY',
  EXPERIENCE: 'EXPERIENCE',
  EDUCATION: 'EDUCATION',
  SKILLS: 'SKILLS',
  TOOLS: 'TOOLS',
  LANGUAGES: 'LANGUAGES',
  PROJECTS: 'PROJECTS',
  CLIENTS: 'CLIENTS',
  AWARDS: 'AWARDS',
  PUBLICATIONS: 'PUBLICATIONS',
  EXHIBITIONS: 'EXHIBITIONS',
  PORTFOLIO: 'PORTFOLIO',
  CERTIFICATIONS: 'CERTIFICATIONS',
  VOLUNTEER: 'VOLUNTEER',
  INTERESTS: 'INTERESTS',
  CONTACT: 'CONTACT',
  /** Lines before the first explicit header */
  PREAMBLE: 'PREAMBLE',
  UNKNOWN: 'UNKNOWN',
});

/** Header aliases → SECTION_IDS (order: longer phrases first per type) */
export const SECTION_HEADER_ALIASES = [
  { id: SECTION_IDS.CONTACT, patterns: [/^contact$/i, /^coordonnées$/i, /^reach me$/i, /^kontakt$/i] },
  {
    id: SECTION_IDS.PROFILE,
    patterns: [/^profile$/i, /^profil$/i, /^about me$/i, /^über mich$/i],
  },
  {
    id: SECTION_IDS.SUMMARY,
    patterns: [
      /^summary$/i,
      /^about$/i,
      /^objective$/i,
      /^personal statement$/i,
      /^professional summary$/i,
    ],
  },
  {
    id: SECTION_IDS.EXPERIENCE,
    patterns: [
      /^work experience$/i,
      /^professional experience$/i,
      /^employment history$/i,
      /^work history$/i,
      /^experience$/i,
      /^employment$/i,
      /^career$/i,
      /^parcours$/i,
    ],
  },
  {
    id: SECTION_IDS.EDUCATION,
    patterns: [
      /^academic background$/i,
      /^education$/i,
      /^formation$/i,
      /^studies$/i,
      /^academic$/i,
      /^qualifications$/i,
    ],
  },
  {
    id: SECTION_IDS.SKILLS,
    patterns: [
      /^technical skills$/i,
      /^skills$/i,
      /^compétences$/i,
      /^competencies$/i,
      /^expertise$/i,
      /^core competencies$/i,
    ],
  },
  {
    id: SECTION_IDS.TOOLS,
    patterns: [/^tools$/i, /^software$/i, /^technologies$/i, /^tech stack$/i, /^outils$/i, /^logiciels$/i],
  },
  {
    id: SECTION_IDS.LANGUAGES,
    patterns: [/^languages$/i, /^langues$/i, /^language skills$/i],
  },
  {
    id: SECTION_IDS.PROJECTS,
    patterns: [/^projects$/i, /^selected projects$/i, /^portfolio projects$/i, /^selected work$/i],
  },
  {
    id: SECTION_IDS.CLIENTS,
    patterns: [/^clients$/i, /^brands$/i, /^selected clients$/i, /^key clients$/i, /^references$/i],
  },
  {
    id: SECTION_IDS.AWARDS,
    patterns: [/^awards$/i, /^honors$/i, /^honours$/i, /^distinctions$/i],
  },
  {
    id: SECTION_IDS.PUBLICATIONS,
    patterns: [/^publications$/i, /^press$/i, /^media coverage$/i, /^editorial$/i],
  },
  {
    id: SECTION_IDS.EXHIBITIONS,
    patterns: [/^exhibitions?$/i, /^shows$/i, /^galleries$/i, /^expositions?$/i],
  },
  {
    id: SECTION_IDS.PORTFOLIO,
    patterns: [/^portfolio$/i, /^portfolio links?$/i, /^online portfolio$/i, /^websites?$/i],
  },
  {
    id: SECTION_IDS.CERTIFICATIONS,
    patterns: [
      /^certifications?$/i,
      /^certificates?$/i,
      /^licenses?$/i,
      /^licences?$/i,
      /^credentials$/i,
      /^professional certifications?$/i,
    ],
  },
  {
    id: SECTION_IDS.VOLUNTEER,
    patterns: [/^volunteer(?:ing)?$/i, /^volunteer experience$/i, /^community service$/i],
  },
  {
    id: SECTION_IDS.INTERESTS,
    patterns: [/^interests?$/i, /^hobbies$/i, /^personal interests?$/i],
  },
];

/** Map V2 id → structured-resume bucket key */
export const SECTION_TO_RESUME_KEY = {
  [SECTION_IDS.PROFILE]: 'profile',
  [SECTION_IDS.SUMMARY]: 'summary',
  [SECTION_IDS.EXPERIENCE]: 'experience',
  [SECTION_IDS.EDUCATION]: 'education',
  [SECTION_IDS.SKILLS]: 'skills',
  [SECTION_IDS.TOOLS]: 'tools',
  [SECTION_IDS.LANGUAGES]: 'languages',
  [SECTION_IDS.PROJECTS]: 'projects',
  [SECTION_IDS.CLIENTS]: 'clients',
  [SECTION_IDS.AWARDS]: 'awards',
  [SECTION_IDS.PUBLICATIONS]: 'publications',
  [SECTION_IDS.EXHIBITIONS]: 'exhibitions',
  [SECTION_IDS.PORTFOLIO]: 'portfolioLinks',
  [SECTION_IDS.CERTIFICATIONS]: 'certifications',
  [SECTION_IDS.VOLUNTEER]: 'volunteer',
  [SECTION_IDS.INTERESTS]: 'interests',
  [SECTION_IDS.CONTACT]: 'contact',
  [SECTION_IDS.PREAMBLE]: 'top',
  [SECTION_IDS.UNKNOWN]: 'unsorted',
};

/**
 * @typedef {object} SectionBlockV2
 * @property {string} id
 * @property {string} type — SECTION_IDS value
 * @property {string[]} lines
 * @property {string|null} headerLine
 * @property {number} startLine
 * @property {number} endLine
 * @property {number} [detectedConfidence]
 * @property {number} [classifiedConfidence]
 * @property {string} [classifyReason]
 */
