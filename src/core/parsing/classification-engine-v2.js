/**
 * CLASSIFICATION_ENGINE_V2 — precision-first line classification.
 * Wrong category = failure. Unknown = acceptable. Never force below 80% confidence.
 */

import { findLongestDictionaryTerm, CLIENT_TERMS, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import {
  COMPANY_UNCERTAIN_RE,
  isEmploymentCompanyLine,
} from './employment-suggestion-heuristics.js';

export const CLASSIFICATION_ENGINE_V2 = 'CLASSIFICATION_ENGINE_V2';
export const CLASSIFICATION_CONFIDENCE_MIN = 80;

/** Canonical section types (singular, spec). */
export const SECTION_TYPES_V2 = Object.freeze([
  'identity',
  'contact',
  'summary',
  'experience',
  'education',
  'skill',
  'tool',
  'language',
  'client',
  'project',
  'award',
  'publication',
  'interest',
  'unknown',
]);

const TYPE_TO_BUCKET = Object.freeze({
  identity: 'identity',
  contact: 'contact',
  summary: 'summary',
  experience: 'experience',
  education: 'education',
  skill: 'skills',
  tool: 'tools',
  language: 'languages',
  client: 'clients',
  project: 'projects',
  award: 'awards',
  publication: 'publications',
  interest: 'interests',
  unknown: 'unsorted',
});

const LANGUAGE_MARKERS = [
  'french',
  'english',
  'spanish',
  'german',
  'italian',
  'dutch',
  'portuguese',
  'arabic',
  'native',
  'fluent',
  'bilingual',
  'français',
  'anglais',
  'allemand',
  'espagnol',
  'italien',
  'nederlands',
  'courant',
  'vloeiend',
];

const TOOL_MARKERS = [
  'adobe',
  'photoshop',
  'figma',
  'sketch',
  'after effects',
  'aftereffects',
  'blender',
  'cinema4d',
  'cinema 4d',
  'indesign',
  'premiere',
  'lightroom',
  'xd',
  'procreate',
];

const EDUCATION_MARKERS = [
  'school',
  'university',
  'academy',
  'degree',
  'bachelor',
  'master',
  'lisaa',
  'créapole',
  'creapole',
  'parsons',
  'mit',
  'visual communication',
  'motion design',
  'product design',
  'mba',
  'phd',
  'diploma',
  'licence',
  'bts',
  'école',
  'ecole',
  'college',
  'sorbonne',
];

const SKILL_MARKERS = [
  'branding',
  'illustration',
  'design',
  'packaging',
  'editorial',
  'typography',
  'vector',
  'logo',
  'art direction',
  'visual identity',
  'poster design',
  'print production',
  'graphic design',
];

const INTEREST_MARKERS = [
  'music',
  'movies',
  'gaming',
  'reading',
  'photography',
  'travel',
  'cinema',
  'hiking',
  'cooking',
  'running',
  'chess',
  'sport',
  'football',
  'soccer',
];

/** Generic tokens that must never classify as clients on their own. */
const GENERIC_CLIENT_REJECT = new Set([
  'design',
  'designer',
  'studio',
  'agency',
  'creative',
  'professional',
  'independent',
  'freelance',
  'work',
  'brand',
  'identity',
  'visual',
  'graphic',
  'illustration',
  'branding',
  'packaging',
  'editorial',
  'typography',
  'vector',
  'logo',
  'music',
  'movies',
  'gaming',
  'reading',
  'photography',
  'travel',
  'school',
  'university',
  'academy',
  'degree',
  'bachelor',
  'master',
  'native',
  'fluent',
  'bilingual',
  'french',
  'english',
  'spanish',
  'german',
  'tools',
  'skills',
  'languages',
  'clients',
  'education',
  'experience',
]);

const TOOL_WORD_RE = new RegExp(
  `\\b(${TOOL_MARKERS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'i'
);

const SKILL_WORD_RE = new RegExp(
  `\\b(${SKILL_MARKERS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'i'
);

const EDUCATION_WORD_RE = new RegExp(
  `\\b(${EDUCATION_MARKERS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i'
);

const INTEREST_WORD_RE = new RegExp(
  `\\b(${INTEREST_MARKERS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i'
);

const EXPERIENCE_ROLE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|product\s+designer|visual\s+designer|motion\s+designer|senior\s+designer|lead\s+designer|graphiste|directeur\s+artistique|directeur\s+créatif|illustrateur)\b/i;

const DATE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b|\b(19|20)\d{2}\b/i;

const PROJECT_RE =
  /\b(project|portfolio piece|case study|campaign|series|rebrand|redesign|social network|mobile app|web app|platform|capstone|personal project|selected work|portfolio|cover illustration|campaign artwork|editorial illustration|album cover|book cover|character design|concept art|key visual|cover|muse)\b/i;

const LANGUAGE_NAME_RE =
  /\b(french|english|spanish|german|italian|dutch|portuguese|arabic|mandarin|chinese|japanese|korean|français|anglais|allemand|espagnol|italien|nederlands)\b/i;

const LANGUAGE_LEVEL_RE =
  /\b(native|fluent|bilingual|courant|vloeiend|professional|professionnel|conversational|intermediate|intermédiaire|basic|notions|débutant|c1|c2|b1|b2|a1|a2)\b/i;

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMarkerHits(text, markers) {
  const hay = String(text || '').toLowerCase();
  let n = 0;
  for (const m of markers) {
    const re = new RegExp(`\\b${escapeRe(m).replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(hay)) n += 1;
  }
  return n;
}

function splitListParts(line) {
  return String(line || '')
    .split(/\s*[,;·|]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
}

function isExperienceContext(line) {
  const l = String(line || '').trim();
  if (!DATE_RE.test(l)) return false;
  return EXPERIENCE_ROLE_RE.test(l) || /\bfreelance\b/i.test(l) || /\s[-–—@|]\s|\s+at\s+/i.test(l);
}

function isProjectContext(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 4) return false;
  if (DATE_RE.test(l) && EXPERIENCE_ROLE_RE.test(l)) return false;
  if (/\bpersonal\s+project\b/i.test(l)) return true;
  if (PROJECT_RE.test(l) && l.split(/\s+/).length <= 10) return true;
  return false;
}

function specialtyContextBlocked(line) {
  return (
    isExperienceContext(line) ||
    isProjectContext(line) ||
    isCreativeRoleLine(line) ||
    isEmploymentCompanyLine(line)
  );
}

function scoreEmploymentStrict(line) {
  const l = String(line || '').trim();
  if (!l || !isEmploymentCompanyLine(l)) return null;
  const uncertain = COMPANY_UNCERTAIN_RE.test(l);
  const confidence = uncertain ? 76 : 94;
  return {
    type: 'experience',
    confidence,
    reason: uncertain ? 'v2_employment_uncertain' : 'v2_employment_freelance',
    signals: ['experience', 'v2'],
    matched: 'employment_marker',
  };
}

function isSoftwareProductLine(line) {
  const l = String(line || '').trim();
  if (/\badobe\s+illustrator\b/i.test(l)) return true;
  if (/\badobe\s+(photoshop|indesign|premiere|creative\s+suite)\b/i.test(l)) return true;
  if (/^(photoshop|illustrator|indesign|figma|sketch|premiere|after effects|affinity designer)$/i.test(l)) {
    return true;
  }
  return false;
}

function isCreativeRoleLine(line) {
  const l = String(line || '').trim();
  if (isSoftwareProductLine(l)) return false;
  if (!EXPERIENCE_ROLE_RE.test(l)) return false;
  if (DATE_RE.test(l)) return false;
  if (l.length > 110) return false;
  return (
    /\//.test(l) ||
    /\s&\s/.test(l) ||
    /\bfreelance\b/i.test(l) ||
    (l.split(/\s+/).length <= 7 && !/,/.test(l))
  );
}

function isIllustratorSoftware(line) {
  const l = String(line || '');
  if (!/\billustrator\b/i.test(l)) return false;
  if (/\billustration\b/i.test(l)) return false;
  if (isCreativeRoleLine(l)) return false;
  if (/\b(graphic\s+designer|designer|freelance|art\s+director|creative\s+director)\b/i.test(l)) {
    return false;
  }
  return true;
}

function scoreLanguageStrict(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 120) return null;

  const hasName = LANGUAGE_NAME_RE.test(l);
  const hasLevel = LANGUAGE_LEVEL_RE.test(l);
  const markerHits = countMarkerHits(l, LANGUAGE_MARKERS);

  if (!hasName && !hasLevel && markerHits === 0) return null;
  if (TOOL_WORD_RE.test(l) && !hasName && !hasLevel) return null;
  if (SKILL_WORD_RE.test(l) && !hasName) return null;

  let confidence = 70;
  if (hasName && hasLevel) confidence = 94;
  else if (hasName && /\s[—–-]\s/.test(l)) confidence = 92;
  else if (hasName) confidence = 88;
  else if (hasLevel && markerHits > 0) confidence = 86;
  else if (markerHits >= 2) confidence = 84;
  else return null;

  return {
    type: 'language',
    confidence,
    reason: 'v2_language_strict',
    signals: ['language', 'v2'],
    matched: hasName ? l.match(LANGUAGE_NAME_RE)?.[0] : 'level',
  };
}

function scoreToolStrict(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 220) return null;
  if (isExperienceContext(l) || isProjectContext(l)) return null;

  const parts = splitListParts(l);
  const segments = parts.length >= 2 ? parts : [l];

  let toolHits = 0;
  for (const seg of segments) {
    if (TOOL_WORD_RE.test(seg) || isIllustratorSoftware(seg)) toolHits += 1;
  }

  if (toolHits === 0) return null;
  if (LANGUAGE_NAME_RE.test(l) && LANGUAGE_LEVEL_RE.test(l)) return null;
  if (EDUCATION_WORD_RE.test(l) && !TOOL_WORD_RE.test(l)) return null;
  if (/^\badobe\b$/i.test(l)) return null;

  const ratio = toolHits / segments.length;
  let confidence = ratio >= 1 ? 94 : ratio >= 0.75 ? 90 : 82;
  if (segments.length === 1 && (TOOL_WORD_RE.test(l) || isIllustratorSoftware(l))) {
    confidence = isSoftwareProductLine(l) ? 92 : 88;
  }

  return {
    type: 'tool',
    confidence,
    reason: 'v2_tool_strict',
    signals: ['tool', 'v2'],
    matched: findLongestDictionaryTerm(l, TOOL_MARKERS) || 'tool_marker',
  };
}

function scoreEducationStrict(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 240) return null;

  const schoolTerm = findLongestDictionaryTerm(l, SCHOOL_TERMS);
  const markerHits = countMarkerHits(l, EDUCATION_MARKERS);
  const hasEduWord = EDUCATION_WORD_RE.test(l) || !!schoolTerm;

  if (!hasEduWord) return null;

  let confidence = schoolTerm ? 92 : markerHits >= 2 ? 90 : 84;
  if (/\bvisual\s+communication\b/i.test(l) && schoolTerm) confidence = 96;
  if (/\b(19|20)\d{2}\b/.test(l)) confidence = Math.min(100, confidence + 4);
  if (/\s[—–-]\s/.test(l) && l.length < 140) confidence = Math.min(100, confidence + 3);

  return {
    type: 'education',
    confidence,
    reason: schoolTerm ? 'v2_education_school_entity' : 'v2_education_strict',
    signals: ['education', 'v2'],
    matched: schoolTerm || 'education_marker',
  };
}

function scoreSkillStrict(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 220) return null;

  if (/^visual\s+communication$/i.test(l)) return null;
  if (/\bvisual\s+communication\b/i.test(l) && EDUCATION_WORD_RE.test(l)) return null;
  if (findLongestDictionaryTerm(l, SCHOOL_TERMS)) return null;

  if (TOOL_WORD_RE.test(l) || isIllustratorSoftware(l)) return null;
  if (LANGUAGE_NAME_RE.test(l) && (LANGUAGE_LEVEL_RE.test(l) || /\s[—–-]\s/.test(l))) return null;
  if (findLongestDictionaryTerm(l, CLIENT_TERMS) && l.split(/\s+/).length <= 2) return null;

  const parts = splitListParts(l);
  const segments = parts.length >= 2 ? parts : [l];

  let skillHits = 0;
  for (const seg of segments) {
    if (SKILL_WORD_RE.test(seg)) skillHits += 1;
  }

  if (skillHits === 0) return null;

  const ratio = skillHits / segments.length;
  const confidence = ratio >= 1 ? 92 : ratio >= 0.6 ? 88 : 82;

  return {
    type: 'skill',
    confidence,
    reason: 'v2_skill_strict',
    signals: ['skill', 'v2'],
    matched: 'skill_marker',
  };
}

function scoreInterestStrict(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 160) return null;

  if (LANGUAGE_NAME_RE.test(l)) return null;

  const parts = splitListParts(l);
  const segments = parts.length >= 2 ? parts : [l];

  let interestHits = 0;
  for (const seg of segments) {
    if (INTEREST_WORD_RE.test(seg)) interestHits += 1;
  }

  if (interestHits === 0) return null;

  const ratio = interestHits / segments.length;
  const confidence = ratio >= 1 ? 90 : ratio >= 0.5 ? 86 : 82;

  return {
    type: 'interest',
    confidence,
    reason: 'v2_interest_strict',
    signals: ['interest', 'v2'],
    matched: 'interest_marker',
  };
}

function partIsKnownClient(part) {
  const p = String(part || '').trim();
  if (!p || p.length > 48) return false;
  const low = p.toLowerCase();
  if (GENERIC_CLIENT_REJECT.has(low)) return false;
  if (SKILL_WORD_RE.test(p) || EDUCATION_WORD_RE.test(p) || TOOL_WORD_RE.test(p)) return false;
  if (LANGUAGE_NAME_RE.test(p)) return false;
  if (PROJECT_RE.test(p)) return false;
  return !!findLongestDictionaryTerm(p, CLIENT_TERMS);
}

function scoreClientStrict(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 220) return null;
  if (isExperienceContext(l) || isProjectContext(l)) return null;
  if (isSoftwareProductLine(l)) return null;

  if (SKILL_WORD_RE.test(l) && !findLongestDictionaryTerm(l, CLIENT_TERMS)) return null;
  if (EDUCATION_WORD_RE.test(l)) return null;
  if (LANGUAGE_NAME_RE.test(l) && (LANGUAGE_LEVEL_RE.test(l) || /\s[—–-]\s/.test(l))) return null;
  if (INTEREST_WORD_RE.test(l) && !findLongestDictionaryTerm(l, CLIENT_TERMS)) return null;
  if (TOOL_WORD_RE.test(l) && !findLongestDictionaryTerm(l, CLIENT_TERMS)) return null;

  const parts = splitListParts(l);
  const segments = parts.length >= 2 ? parts : [l];

  if (segments.length === 1 && GENERIC_CLIENT_REJECT.has(l.toLowerCase())) return null;

  let clientHits = 0;
  for (const seg of segments) {
    if (partIsKnownClient(seg)) clientHits += 1;
  }

  if (clientHits === 0) return null;

  const ratio = clientHits / segments.length;
  let confidence = ratio >= 1 ? 94 : ratio >= 0.75 ? 90 : 82;
  if (segments.length === 1 && clientHits === 1) confidence = 96;

  const clientTerm = findLongestDictionaryTerm(l, CLIENT_TERMS);

  return {
    type: 'client',
    confidence,
    reason: 'v2_client_strict',
    signals: ['client', 'v2'],
    matched: clientTerm || segments[0],
  };
}

function finalizeV2Hit(hit) {
  if (!hit) return null;
  const type = hit.confidence >= CLASSIFICATION_CONFIDENCE_MIN ? hit.type : 'unknown';
  const bucket = TYPE_TO_BUCKET[type] || 'unsorted';
  const confidence =
    type === 'unknown' ? Math.min(hit.confidence, CLASSIFICATION_CONFIDENCE_MIN - 1) : hit.confidence;

  return {
    type,
    bucket,
    confidence,
    signals: hit.signals || ['v2'],
    parserDebug: {
      classificationReason: hit.reason,
      engine: CLASSIFICATION_ENGINE_V2,
      matchedTerm: hit.matched,
      confidenceScore: confidence,
      rawType: hit.type,
      rawConfidence: hit.confidence,
    },
  };
}

/**
 * Precision-first specialty classification (skill, tool, language, client, education, interest).
 * Returns null when no specialty rule applies (caller may use other classifiers).
 * @param {string} line
 * @returns {{ type: string, bucket: string, confidence: number, signals: string[], parserDebug: object } | null}
 */
export function classifySpecialtyLineV2(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return null;

  const employment = scoreEmploymentStrict(l);
  if (employment) return finalizeV2Hit(employment);

  if (specialtyContextBlocked(l)) return null;

  const scorers = [
    scoreEducationStrict,
    scoreLanguageStrict,
    scoreToolStrict,
    scoreSkillStrict,
    scoreInterestStrict,
    scoreClientStrict,
  ];

  /** @type {Array<{ type: string, confidence: number, reason: string, signals: string[], matched: string }>} */
  const candidates = [];

  for (const score of scorers) {
    const hit = score(l);
    if (hit) candidates.push(hit);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];

  const tied = candidates.filter((c) => c.confidence === best.confidence);
  if (tied.length > 1) {
    const priority = ['experience', 'education', 'language', 'tool', 'skill', 'interest', 'client'];
    tied.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));
    return finalizeV2Hit(tied[0]);
  }

  return finalizeV2Hit(best);
}

/**
 * Map V2 type to resume bucket (plural).
 * @param {string} type
 */
export function v2TypeToBucket(type) {
  return TYPE_TO_BUCKET[type] || 'unsorted';
}
