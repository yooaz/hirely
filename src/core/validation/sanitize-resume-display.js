/**
 * sanitizeResumeForDisplay — final gate before CV render.
 * CONFIDENT → CV | UNCERTAIN → Suggestions | BAD → hidden
 */

import { applyUniversalSafetyGate } from './universal-safety-gate.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import {
  extractIdentityHeaderLines,
  isValidIdentityName,
  looksLikeCompanyOrAgencyName,
  nameCollidesWithEmployers,
  repairIdentityFromOcrSignals,
} from '../parsing/identity-extraction.js';
import {
  isValidEducationItem,
  isValidSummaryField,
  isValidTitleField,
  isOcrGarbageText,
} from '../parsing/field-sanitize.js';
import { isSkillsSectionPollution } from '../parsing/skills-section-pollution-filter.js';
import { validatePhone } from '../parsing/rich-parser.js';
import {
  normalizeContactPhone,
  buildPhoneReviewItem,
  phoneHasYearOrDatePollution,
  PHONE_DISPLAY_CONFIDENCE_MIN,
  scorePhoneExtraction,
  validatePhoneStrict,
} from '../parsing/phone-normalize.js';
import {
  NAME_UNCERTAIN_LABEL,
  EMAIL_UNCERTAIN_LABEL,
  PHONE_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
  extractDateRangeFromText,
} from '../parsing/parser-recovery.js';
import { applyYoazBiasGuard } from './yoaz-bias-guard.js';
import { applyPersonCompanyDisambiguation } from '../parsing/person-company-disambiguation.js';
import { lockResumeDataShape } from '../pipeline/hirely-flow-lock.js';
import { isCorruptEducationLine } from '../parsing/education-confidence.js';
import {
  extractCleanClientBrands,
  normalizeFreelanceExperienceRole,
  normalizeLanguageDisplayLine,
  polishResumeOutput,
  tryRecoverSchoolEducation,
} from '../parsing/resume-output-quality.js';
import {
  extractStrictLanguageLine,
  isForbiddenLanguageLine,
} from '../parsing/strict-language-extraction.js';
import { CLIENT_ANCHOR_TARGETS } from '../parsing/client-detection-engine.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import {
  formatSafeEducationEntry,
  SAFE_EDUCATION_CONFIDENCE_MIN,
} from '../parsing/education-recovery.js';
import {
  dedupeEducationStrings,
  dedupeExperienceEntries,
  experienceDedupeKey,
} from '../parsing/dedupe-engine.js';
import { scoreEducationLine } from './confidence-gate.js';
import {
  parseFreelanceCareerLine,
  parseUrlMergedExperienceLine,
} from '../parsing/classification-fixes.js';
import {
  enforceIdentityContactStrictness,
  assessIdentityPhoneStrict,
  stripPersonNameEmployerArtifacts,
} from './identity-contact-strictness.js';
import { extractIdentityPhone } from './identity-contact.js';

const CONTACT_PHONE_SIGNAL_RE =
  /(?:\+\d{1,3}[\s.-]?\d|0[1-9](?:[\s.-]?\d{2}){4})/;
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { logRenderPipelineCounts } from '../runtime/render-pipeline-trace.js';
import {
  filterProductSuggestions,
  isGenericRewriteSuggestion,
  isVagueSuggestionLine,
} from '../parsing/suggestion-confidence-score.js';
import { reconstructExperienceSemantics } from '../parsing/experience-semantic-layer.js';
import { normalizeAllEducation, normalizeEducationEntry } from '../parsing/education-normalization-layer.js';
import {
  harvestSkillsFromDescriptions,
  SKILL_RECOVERY_MIN,
  SKILL_RECOVERY_MAX,
} from '../parsing/skill-recovery.js';
import { experienceNormalizer } from '../parsing/experience-intelligence.js';
import {
  auditInventedExperience,
  INVENTED_EXPERIENCE_BULLET_RE,
  stripInventedExperiences,
} from '../parsing/invented-experience-guard.js';
import { mustNeverMergeExperiences } from '../parsing/experience-reconstruction-engine.js';
import {
  emailLocalPartNameHint,
  MANGLED_DOMAIN_NOISE_RE,
  PERSON_NAME_CAPS_SEGMENT_RE,
  PERSON_NAME_SEGMENT_RE,
  URL_OR_DOMAIN_SIGNAL_RE,
} from '../parsing/ocr-classification-rules.js';

export const SANITIZE_RESUME_DISPLAY = 'SANITIZE_RESUME_DISPLAY_V2';
export const DISPLAY_SUGGESTIONS_MAX = 2;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_TITLE_RE =
  /\b(graphic\s+designer|illustrator|art\s+director|motion\s+designer|product\s+designer|creative\s+director)\b/i;

const OCR_CORRUPT_RE =
  /\b(incision|wustrator|snoutors|illusthatch|gradric|mustrator|mustrations?|adress|address\s+illustr|graphic designer\s*\d+\s*illustrator|v3\s*2)\b|\.com[a-z]{0,8}\b|^\s*\+\+|(?:tumblr|behance|dribbble)/i;

const DUPLICATE_DATE_RE =
  /(\b(?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|\d{4}))\s*[-–—]\s*\1/i;

const FAKE_PHONE_RE =
  /^\s*(?:\d{4}\s+\d{4}|\d{4}\s*[-–—]\s*\d{4}|\b(?:19|20)\d{2}\s*[-–—]\s*(?:\d{4}|present|présent|current)|\d{1,3}\s+(?:19|20)\d{2}\s+(?:19|20)\d{2})\s*$/i;

const PHONE_EDU_MIX_RE =
  /\+\d{1,3}[\d\s().-]{6,}.*\b(?:(?:19|20)\d{2}|lisaa|créapole|creapole|school|university|bachelor|master|diploma|école|ecole)\b/i;

const INVALID_LANGUAGE_RE =
  /\b(video\s*game|game\s*design|marketing\s*stud(?:y|ies)|technologie\s*marketing)\b/i;

const EDUCATION_SIGNAL_RE =
  /\b(university|école|ecole|school|bachelor|master|mba|diploma|licence|lisaa|créapole|creapole|degree|b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?)\b/i;

const DEGREE_MARKERS_RE =
  /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|m\.?\s*b\.?\s*a\.?|mba|ph\.?\s*d\.?|bachelor|master|diploma)\b/i;

const LANGUAGE_OK_RE =
  /\b(french|english|spanish|german|dutch|italian|portuguese|arabic|mandarin|français|anglais|espagnol|allemand|néerlandais|italien|portugais|arabe|native|fluent|bilingual|conversational|professional|courant|bilingue|natif|maternelle)\b/i;

/** Display-only creative CV tool allowlist. */
const DISPLAY_TOOLS_ALLOWLIST = new Set(
  [
    'photoshop',
    'illustrator',
    'indesign',
    'figma',
    'adobe',
    'after effects',
    'procreate',
    'git',
    'sql',
    'excel',
    'powerpoint',
    'tableau',
    'docker',
    'aws',
    'postgresql',
    'postgres',
    'hubspot',
    'canva',
    'google analytics',
    'meta ads manager',
    'javascript',
    'typescript',
    'python',
    'node.js',
    'react',
    ...TOOLS.map((t) => String(t).toLowerCase()),
  ].map((x) => x.toLowerCase())
);

const TOOL_OK_RE =
  /\b(photoshop|illustrator|indesign|figma|after effects|procreate|adobe)\b/i;

const TOOL_OCR_GARBAGE_RE = /^\[\d+\]|m[eE]\]|^\[|indesign\s+me\b/i;

const TOOL_REJECT_BASE_RE =
  /\b(graphic\s+designer|art\s+director|motion\s+designer|creative\s+director|freelance|independent|internship|mccann|interest|photograph|photography|movies?|reading|nature|drawing|marketing\s+stud|native|fluent|bilingual|b\s*wma)\b/i;

function isToolRejectLine(line) {
  const s = String(line || '').trim();
  return TOOL_REJECT_BASE_RE.test(s) || MANGLED_DOMAIN_NOISE_RE.test(s) || URL_OR_DOMAIN_SIGNAL_RE.test(s);
}

const NAME_TOKEN_STOP = new Set(
  [
    'graphic',
    'designer',
    'illustrator',
    'freelance',
    'independent',
    'profile',
    'contact',
    'education',
    'experience',
    'skills',
    'tools',
    'languages',
    'work',
    'creative',
    'senior',
    'lead',
    'director',
    'agency',
    'paris',
    'present',
    'native',
    'fluent',
    'english',
    'french',
    'adobe',
    'nike',
    'marvel',
    'lisaa',
    'creapole',
    'packaging',
    'posters',
    'logos',
    'illustration',
    'internship',
    'motion',
    'visual',
    'communication',
    'portfolio',
    'linkedin',
    'phone',
    'email',
    'years',
    'year',
    'old',
    'created',
    'creation',
    'web',
    'weband',
    'school',
    'management',
    'design',
    'observation',
    'maquette',
    'program',
    'programme',
    'degree',
    'bachelor',
    'master',
    'university',
    'college',
    'animation',
  ].map((x) => x.toLowerCase())
);

const SUGGESTION_GARBAGE_RE =
  /^(movies?|b\s*wma|interest|photograph|photography|native|fluent|bilingual|freelance|graphic\s+designer?|illustrator\s*\/\s*graphic|reading|nature|drawing|print|logo|vector)$/i;

const SUGGESTION_GARBAGE_CONTAINS_RE =
  /\bb\s*wma\b|market\s*reviews?|@\s*\d+\s*\w*\s*market|^\s*@\s*\d|marketing\s*stud|technologie\s*marketing/i;

function isSuggestionDomainNoise(line) {
  const s = String(line || '').trim();
  return MANGLED_DOMAIN_NOISE_RE.test(s) || URL_OR_DOMAIN_SIGNAL_RE.test(s);
}

const SUGGESTION_SOCIAL_NOISE_RE =
  /^[»@Q]\s*|^\s*ic\)\s*|portfolio\s*:/i;

const SUGGESTION_WEAK_OCR_RE =
  /^[a-z]{1,3}$|^[A-Z]{1,2}$|^\d+$|^[^\w\s]{1,4}$|^[a-z]\s+[a-z]{1,2}$|^[A-Z]{2,}\s+\d+|^v\d+\s*[a-z]$/i;

const EDU_DATE_GARBAGE_RE = /\b20[MN]\b|@\s*man\b|ign\s+fin|fin\s+hie/i;

function lineMentionsKnownClient(line) {
  return Boolean(findLongestDictionaryTerm(String(line || ''), CLIENT_TERMS));
}

const SKILL_OK_RE =
  /\b(illustration|graphic design|branding|packaging|typography|visual identity|web design|art direction|system design|api design|distributed systems|mentoring|code review|growth marketing|seo|content strategy|campaign management|analytics|product strategy|user research|roadmapping|recruiting|sourcing|interviewing|ats management|strategy|operations|financial modeling|stakeholder management|facilitation|agile|leadership|communication|employer branding)\b/i;

const SPECIALTY_SKILL_MAP = {
  'Packaging Design': 'Packaging',
  'Logo Design': 'Logo Design',
  'Poster Design': 'Poster Design',
  'Editorial Design': 'Editorial Design',
  'Visual Identity': 'Visual Identity',
  'Illustration': 'Illustration',
  'Branding': 'Visual Identity',
  'Art Direction': 'Art Direction',
};

const CORE_CREATIVE_SKILLS = [
  'Illustration',
  'Graphic Design',
  'Packaging',
  'Logo Design',
  'Visual Identity',
  'Editorial Design',
];

function isDisplaySkillLine(s) {
  const t = String(s || '').trim();
  if (!t || t.length > 72 || OCR_CORRUPT_RE.test(t)) return false;
  if (/^-\s+/.test(t)) return false;
  if (/\b(created|built|designed|managed|led|delivered|developed)\b/i.test(t) && t.length > 36) return false;
  if (/\b(photograph|photography|movies?|reading|nature|interest)\b/i.test(t)) return false;
  if (/\bart\s+director\s+illustration\b/i.test(t)) return false;
  if (/\b(19|20)\d{2}\s*[-–—]/.test(t)) return false;
  if (LANGUAGE_OK_RE.test(t) && !TOOL_OK_RE.test(t)) return false;
  if (lineMentionsKnownClient(t)) return false;
  if (EDUCATION_SIGNAL_RE.test(t) && /\b(19|20)\d{2}\b/.test(t)) return false;
  if (SKILL_OK_RE.test(t)) return true;
  if (t.length <= 40 && /^[A-Za-z][A-Za-z\s/&+-]{2,}$/.test(t) && !EXPERIENCE_ROLE_MARKERS_RE.test(t)) return true;
  return false;
}

const EXPERIENCE_ROLE_MARKERS_RE =
  /\b(engineer|developer|manager|director|analyst|consultant|recruiter|designer|executive|illustrator)\b/i;

const FREELANCE_ILLUSTRATOR_GRAPHIC_RE =
  /\b(?:freelance\s+)?illustrator\s+(?:and\s+|\/?\s*)?graphic\b/i;

function stripToolOcrGarbage(s) {
  return String(s || '')
    .replace(/^\[\d+\]\s*/g, '')
    .replace(/\[[\d\w]*\]?\s*$/g, '')
    .replace(/\bm[eE]\]\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function titleCaseTool(word) {
  const w = String(word || '').trim();
  if (!w) return '';
  if (/^after effects$/i.test(w)) return 'After Effects';
  if (/^indesign$/i.test(w)) return 'InDesign';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** @returns {string} canonical tool label or '' */
function canonicalDisplayTool(s) {
  const cleaned = stripToolOcrGarbage(s);
  if (!cleaned || TOOL_OCR_GARBAGE_RE.test(cleaned) || isToolRejectLine(cleaned)) return '';
  if (LANGUAGE_OK_RE.test(cleaned) && !TOOL_OK_RE.test(cleaned)) return '';
  if (/\b(graphic\s+designer|freelance|illustrator\s+and)\b/i.test(cleaned)) return '';

  const low = cleaned.toLowerCase();
  if (DISPLAY_TOOLS_ALLOWLIST.has(low)) return titleCaseTool(low);
  if (/^adobe\s+(photoshop|illustrator|indesign|after effects)$/i.test(cleaned)) {
    const m = cleaned.match(/^adobe\s+(\S+(?:\s+\S+)?)$/i);
    return m ? `Adobe ${titleCaseTool(m[1])}` : 'Adobe';
  }
  if (/\badobe\b/i.test(low) && !/\b(photoshop|illustrator|indesign)\b/i.test(low)) return 'Adobe';
  for (const tool of DISPLAY_TOOLS_ALLOWLIST) {
    if (new RegExp(`\\b${tool.replace(/\s+/g, '\\s+')}\\b`, 'i').test(low)) return titleCaseTool(tool);
  }
  return '';
}

function isKnownSoftwareTool(s) {
  return !!canonicalDisplayTool(s);
}

function isDisplayToolLine(s) {
  return !!canonicalDisplayTool(s);
}

function finalizeDisplayTools(tools = []) {
  const list = (tools || []).map((t) => String(t || '').trim()).filter(Boolean);
  const lower = list.map((t) => t.toLowerCase());
  const out = [];
  const add = (label) => {
    const t = String(label || '').trim();
    if (!t) return;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    out.push(t);
  };

  if (lower.some((t) => t === 'illustrator' || t === 'adobe illustrator')) add('Adobe Illustrator');
  if (lower.some((t) => t === 'photoshop' || t === 'adobe photoshop')) add('Photoshop');
  if (lower.some((t) => t === 'indesign' || t === 'adobe indesign')) add('InDesign');
  if (lower.some((t) => t === 'after effects' || t === 'adobe after effects')) add('After Effects');
  if (lower.some((t) => t === 'figma')) add('Figma');
  if (lower.some((t) => t === 'procreate')) add('Procreate');

  return out.length ? out : list;
}

function enrichDisplaySkills(rd) {
  const skills = [...(rd.skills || [])];
  const seen = new Set(skills.map((s) => s.toLowerCase()));

  const add = (label) => {
    const t = String(label || '').trim();
    if (!t || seen.has(t.toLowerCase())) return;
    if (!isDisplaySkillLine(t)) return;
    seen.add(t.toLowerCase());
    skills.push(t);
  };

  for (const exp of rd.experiences || []) {
    for (const spec of exp.specialties || []) {
      add(SPECIALTY_SKILL_MAP[spec] || String(spec).replace(/\s+Design$/i, '').trim());
    }
  }

  const blob = [
    rd.summary,
    ...(rd.experiences || []).flatMap((e) => [e.description, ...(e.bullets || [])]),
  ]
    .filter(Boolean)
    .join(' ');

  for (const skill of CORE_CREATIVE_SKILLS) {
    const re = new RegExp(`\\b${skill.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(blob)) add(skill);
  }

  const ordered = [];
  for (const canon of CORE_CREATIVE_SKILLS) {
    const hit = skills.find((s) => s.toLowerCase() === canon.toLowerCase());
    if (hit) ordered.push(hit);
  }
  for (const s of skills) {
    if (!ordered.some((o) => o.toLowerCase() === s.toLowerCase())) ordered.push(s);
  }
  rd.skills = ordered.slice(0, 12);
}

function languageBaseKey(norm) {
  const low = String(norm || '').toLowerCase();
  if (/\b(english|anglais)\b/.test(low)) return 'english';
  if (/\b(french|français|francais)\b/.test(low)) return 'french';
  if (/\b(spanish|espagnol)\b/.test(low)) return 'spanish';
  if (/\b(german|allemand)\b/.test(low)) return 'german';
  return low.split(/\s*[—–-]\s*/)[0].trim();
}

function languageProficiencyRank(norm) {
  const low = String(norm || '').toLowerCase();
  if (/\b(fluent|courant)\b/.test(low)) return 3;
  if (/\b(bilingual|bilingue)\b/.test(low)) return 2;
  if (/\b(native|natif|maternelle)\b/.test(low)) return 1;
  return 0;
}

function cleanEducationDateArtifacts(line) {
  let s = String(line || '').trim();
  if (!s) return '';
  s = s.replace(/\b20M\b/gi, '2009');
  s = s.replace(/\b20N\b/gi, '2010');
  s = s.replace(/\b(19|20)(\d{2})\s+(19|20)\2\b/g, '$1$2');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function fixEducationDisplayDates(line) {
  let s = cleanEducationDateArtifacts(String(line || '').trim());
  if (!s) return '';
  return s.replace(/\b(\d{4})\s*[-–—]\s*\1\b/g, '$1');
}

function fixEducationOcrWording(line) {
  let s = String(line || '').trim();
  s = s.replace(/\bweband\b/gi, 'Web and');
  s = s.replace(/\bweb\s+and\s+motion\s+design\b/gi, 'Web and Motion Design');
  s = s.replace(/creative\s+school\s+management\s+observation[^—–-]*/gi, 'Creative school management');
  s = s.replace(/\bobservation,\s*maquette,\s*packaging\.?\b/gi, '');
  s = s.replace(/\s*—\s*—\s*[–-]\s*—/g, ' — ');
  s = s.replace(/\)\s*(?=—|$)/g, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}


function buildEducationYearHints(education) {
  const hints = new Map();
  for (const item of education || []) {
    const raw = String(item || '').trim();
    const twin = raw.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
    if (!twin) continue;
    const schoolTag = raw.match(
      /\b(lisaa|créapole|creapole|école|ecole|university|college|school)\b/i
    );
    if (schoolTag) {
      const key = schoolTag[1]
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
      hints.set(key, { start: twin[1], end: twin[2] });
    }
    const colonSchool = raw.match(/:\s*([A-Za-zÀ-ÿ][\w\s.'-]{1,40})/);
    if (colonSchool) {
      const key = colonSchool[1].split(/[,]/)[0].trim().toLowerCase().slice(0, 20);
      if (key.length >= 3) hints.set(key, { start: twin[1], end: twin[2] });
    }
  }
  return hints;
}

function lookupEducationYearHint(school, hints) {
  if (!hints?.size || !school) return null;
  const key = String(school)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (hints.has(key)) return hints.get(key);
  for (const [hintKey, span] of hints.entries()) {
    if (key.includes(hintKey) || hintKey.includes(key)) return span;
  }
  return null;
}

function formatDisplayEducationLine(line, yearHints) {
  let s = fixEducationOcrWording(fixEducationDisplayDates(line));
  if (!s || EDU_DATE_GARBAGE_RE.test(s) || isCorruptEducationLine(s)) return '';
  if (/—\s*—/.test(s)) return '';

  const dates = extractDateRangeFromText(s);
  const twin = s.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  let start = dates.startDate || twin?.[1] || '';
  let end = dates.endDate || twin?.[2] || '';

  const segments = s.split(/\s*[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (!segments.length) return s;

  const school = segments[0].replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
  const hinted = lookupEducationYearHint(school, yearHints);
  if (hinted) {
    start = hinted.start;
    end = hinted.end;
  } else if (start && (!end || start === end)) {
    const years = [...new Set([...s.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => m[1]))];
    if (years.length >= 2) {
      const nums = years.map((y) => parseInt(y, 10)).filter((n) => !Number.isNaN(n));
      start = String(Math.min(...nums));
      end = String(Math.max(...nums));
    }
  }
  const yearOnlyRe = /^(?:19|20)\d{2}(?:\s*[-–—]\s*(?:19|20)\d{2}|(?:\s+to\s+)?(?:19|20)\d{2})?$/i;
  const program = fixEducationOcrWording(
    segments
      .slice(1)
      .filter((p) => !yearOnlyRe.test(p))
      .join(' — ')
      .replace(/\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\b/g, '')
      .replace(/\s*—\s*—\s*/g, ' — ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const dateLabel =
    start && end && start !== end ? `${start}–${end}` : start || end || '';
  if (school && program && dateLabel) return `${school} — ${program} — ${dateLabel}`;
  if (school && program) return `${school} — ${program}`;
  if (school && dateLabel) return `${school} — ${dateLabel}`;
  return s;
}

function normalizeSuggestionKey(line) {
  return String(line || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildFinalCvUsedIndex(rd) {
  const exact = new Set();
  const phrases = [];
  const add = (value) => {
    const t = normalizeSuggestionKey(value);
    if (!t || t.length < 3) return;
    exact.add(t);
    if (t.length >= 8) phrases.push(t);
  };

  const id = rd?.identity || {};
  add(id.name);
  add(id.title);
  add(id.email);
  add(id.phone);
  add(id.location);
  add(id.linkedin);
  add(id.portfolio);
  add(rd?.summary);

  for (const exp of rd?.experiences || []) {
    add(exp?.role);
    add(exp?.company);
    add(exp?.dates);
    add(exp?.location);
    add(exp?.description);
    add(exp?.originalDescription);
    add(exp?.rewrittenDescription);
    for (const b of exp?.bullets || []) add(b);
  }

  for (const list of [
    rd?.education,
    rd?.skills,
    rd?.tools,
    rd?.languages,
    rd?.clients,
    rd?.projects,
  ]) {
    for (const item of list || []) add(item);
  }

  return { exact, phrases };
}

function isSuggestionUsedInFinalCv(line, cvIndex) {
  const t = normalizeSuggestionKey(line);
  if (!t) return true;
  if (cvIndex.exact.has(t)) return true;
  for (const phrase of cvIndex.phrases) {
    if (phrase.length >= 8 && (t.includes(phrase) || phrase.includes(t))) return true;
  }
  return false;
}

function isMeaningfulSuggestion(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 4 || s.length > 140) return false;
  if (isGenericRewriteSuggestion(s) || isVagueSuggestionLine(s)) return false;
  if (SUGGESTION_GARBAGE_RE.test(s)) return false;
  if (SUGGESTION_GARBAGE_CONTAINS_RE.test(s)) return false;
  if (isSuggestionDomainNoise(s)) return false;
  if (SUGGESTION_SOCIAL_NOISE_RE.test(s)) return false;
  if (SUGGESTION_WEAK_OCR_RE.test(s)) return false;
  if (OCR_CORRUPT_RE.test(s)) return false;
  if (EDU_DATE_GARBAGE_RE.test(s)) return false;
  if (/^(english|french|spanish|german)(\s+(native|fluent))?$/i.test(s)) return false;
  if (isDisplayToolLine(s) || isKnownSoftwareTool(s)) return false;
  if (LANGUAGE_OK_RE.test(s) && !SKILL_OK_RE.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length < 6) return false;
  return true;
}

function capMeaningfulSuggestions(list, max = DISPLAY_SUGGESTIONS_MAX, rd = {}) {
  const cvIndex = buildFinalCvUsedIndex(rd);
  const candidates = [];

  for (const item of list || []) {
    const text = String(item || '').trim();
    if (!text || !isMeaningfulSuggestion(text)) continue;
    if (isSuggestionUsedInFinalCv(text, cvIndex)) continue;
    candidates.push({ id: `sug-${candidates.length}`, text });
  }

  const filtered = filterProductSuggestions(candidates, { maxVisible: max, resumeData: rd });
  return filtered.items
    .filter((it) => it.classification === 'LOW_CONFIDENCE' && isMeaningfulSuggestion(it.text))
    .map((it) => String(it.text || '').trim())
    .filter(Boolean);
}

/**
 * Recover a person name from import filename (e.g. "cv2022 marie dupont copie.pdf").
 * @param {string} fileName
 */
function parsePersonNameFromFileName(fileName) {
  let base = String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!base) return '';

  base = base
    .replace(/\bcv\d*\b/gi, ' ')
    .replace(/\b(resume|curriculum|vitae|copie|copy|draft|final|version)\b/gi, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = base.split(/\s+/).filter((w) => w.length >= 2);
  if (parts.length < 2 || parts.length > 4) return '';

  const candidate = parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return isValidIdentityName(candidate) ? candidate : '';
}

function isWeakDisplaySummary(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 24) return true;
  if (OCR_CORRUPT_RE.test(s)) return true;
  if (/\bedition,\s*logos?\b/i.test(s)) return true;
  if (/^\d+[- ]year[- ]old\b/i.test(s)) return true;
  if (/^illustrator and graphic designer\b/i.test(s)) return true;
  if (/\(\s*nike\b/i.test(s) && !/\.\s+[A-Z]/.test(s)) return true;
  return false;
}

/**
 * Recover recruiter-friendly summary from OCR profile blob when parser left it empty.
 * @param {import('../resume-data.js').ResumeData} rd
 * @param {string} blob
 */
function recoverDisplaySummary(rd, blob = '') {
  const current = String(rd?.summary || '').trim();
  if (current.length >= 40 && !isWeakDisplaySummary(current)) return current;

  const lines = String(blob || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const profIdx = lines.findIndex((l) => /^profile\b|^profil\b|^about\b|^summary\b/i.test(l));
  if (profIdx >= 0) {
    const chunk = [];
    for (let i = profIdx; i < Math.min(lines.length, profIdx + 8); i++) {
      const line = lines[i];
      if (i > profIdx && /^(experience|expérience|work experience|formation|education|skills|compétences|tools|outils|languages|langues|clients)\b/i.test(line)) {
        break;
      }
      if (/\b(19|20)\d{2}\s*[-–—:]\s*(?:freelance|designer|illustrator|lead|senior|art)\b/i.test(line) && chunk.length) {
        break;
      }
      const cleaned = line
        .replace(/^profile\s*work\s*experience\b/gi, '')
        .replace(/^profile\b|^profil\b|^about\b|^summary\b/gi, '')
        .trim();
      if (cleaned.length >= 12 && !EMAIL_RE.test(cleaned) && !validatePhone(cleaned)) {
        chunk.push(cleaned);
      }
    }
    if (chunk.length) {
      let joined = chunk
        .join(' ')
        .replace(/\b\d{1,2}[- ]year[- ]old\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (joined.length >= 40 && joined.length <= 480 && !OCR_CORRUPT_RE.test(joined)) {
        return joined.charAt(0).toUpperCase() + joined.slice(1);
      }
    }
  }

  const expIdx = lines.findIndex(
    (l) =>
      /^(experience|expérience|work experience)\b/i.test(l) ||
      /\b(19|20)\d{2}\s*[-–—:]\s*(?:freelance|designer|illustrator|lead|senior|art)\b/i.test(l)
  );
  if (expIdx > 2) {
    const chunk = lines.slice(0, expIdx).filter((l) => {
      if (l.length < 20 || l.length > 220) return false;
      if (EMAIL_RE.test(l) || validatePhone(l)) return false;
      if (/^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+){1,3}$/.test(l)) return false;
      if (lineLooksLikeRole(l) && l.length < 60) return false;
      return /\b(illustrator|graphic|designer|creative|visual|packaging|logo|poster|brand)\b/i.test(l);
    });
    if (chunk.length) {
      const joined = chunk
        .join(' ')
        .replace(/\b\d{1,2}[- ]year[- ]old\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (joined.length >= 40 && joined.length <= 480 && !OCR_CORRUPT_RE.test(joined)) {
        return joined.charAt(0).toUpperCase() + joined.slice(1);
      }
    }
  }

  const title = String(rd?.identity?.title || '').trim();
  const clients = (rd?.clients || []).map((c) => String(c || '').trim()).filter(Boolean);
  if (title && clients.length >= 3 && isAllowedDisplayTitle(title)) {
    const role = title.replace(/\s*&\s*/g, ' and ');
    const fallback =
      `${role} specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging and brand assets for cultural and commercial projects.`;
    if (fallback.length >= 50 && fallback.length <= 320 && !OCR_CORRUPT_RE.test(fallback)) {
      return fallback;
    }
  }

  return '';
}

/**
 * Generic person-name recovery from OCR/header blob (never email local-part alone).
 * @param {object} identity
 * @param {string} blob
 * @param {object} [meta]
 */
function recoverDisplayIdentityName(identity = {}, blob = '', meta = {}, experiences = []) {
  const current = String(identity?.name || '').trim();
  if (isValidDisplayName(current, experiences)) return current;

  const fromFile = parsePersonNameFromFileName(meta?.fileName);
  if (fromFile && isValidDisplayName(fromFile, experiences)) return fromFile;

  for (const c of meta?.nameCandidates || []) {
    const cand = String(c || '').trim();
    if (isValidDisplayName(cand, experiences)) return cand;
  }

  const headerLines = extractIdentityHeaderLines(
    String(blob || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    24
  );
  const email = String(identity?.email || '').trim();
  const emailHint = emailLocalPartNameHint(email);
  if (emailHint) {
    for (const line of headerLines) {
      if (!line.toLowerCase().includes(emailHint)) continue;
      const caps = line.match(PERSON_NAME_CAPS_SEGMENT_RE);
      if (caps) {
        const candidate = `${caps[1]} ${caps[2]}`;
        if (isValidDisplayName(candidate, experiences)) return candidate;
      }
    }
  }

  const emailIdx = email
    ? headerLines.findIndex((l) => l.toLowerCase().includes(email.toLowerCase()))
    : -1;
  const window =
    emailIdx >= 0
      ? headerLines.slice(Math.max(0, emailIdx - 4), Math.min(headerLines.length, emailIdx + 3))
      : headerLines.slice(0, 12);

  for (const line of window) {
    if (!line || line.length > 60) continue;
    if (EMAIL_RE.test(line) || validatePhone(line)) continue;
    if (lineLooksLikeRole(line)) continue;
    if (isValidDisplayName(line, experiences)) return line;
  }

  for (const line of headerLines) {
    const parts = line.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const caps = part.match(PERSON_NAME_SEGMENT_RE);
      if (caps) {
        const candidate = `${caps[1]} ${caps[2].charAt(0)}${caps[2].slice(1).toLowerCase()}`;
        if (isValidDisplayName(candidate, experiences)) return candidate;
      }
    }
  }

  return '';
}

function employerTokensFromExperiences(experiences = []) {
  const tokens = new Set();
  for (const exp of experiences || []) {
    for (const part of [exp?.company, exp?.role]) {
      const s = String(part || '').trim().toLowerCase();
      if (!s || s.length < 3) continue;
      tokens.add(s);
      s.split(/\s+/).filter((w) => w.length >= 4).forEach((w) => tokens.add(w));
    }
  }
  return tokens;
}

function clientHarvestLines(lines = [], experiences = []) {
  const employers = employerTokensFromExperiences(experiences);
  return (lines || []).filter((line) => {
    const s = String(line || '').trim();
    if (!s) return false;
    if (isToolDerivedClientLine(s)) return false;
    if (/\b(19|20)\d{2}\s*[-–—]/.test(s) && EXPERIENCE_ROLE_MARKERS_RE.test(s)) return false;
    if (/^(senior|lead|digital|marketing|software|business)\s+/i.test(s) && /\s[—–-]\s/.test(s)) return false;
    const low = s.toLowerCase();
    for (const emp of employers) {
      if (emp.length >= 4 && (low === emp || low.includes(emp))) return false;
    }
    return true;
  });
}

const TOOL_BRAND_SUBSTRING_RE =
  /\b(google\s+analytics|meta\s+ads|ads\s+manager|hubspot|salesforce|workday|greenhouse|tableau|powerpoint|linkedin\s+recruiter)\b/i;

function stripEmployerClients(clients = [], experiences = []) {
  const employers = employerTokensFromExperiences(experiences);
  return (clients || []).filter((c) => {
    const low = String(c || '').trim().toLowerCase();
    if (!low) return false;
    if (CLIENT_ANCHOR_TARGETS.some((a) => a.toLowerCase() === low)) return true;
    if (findLongestDictionaryTerm(c, CLIENT_TERMS)) return true;
    for (const emp of employers) {
      if (emp.length >= 4 && (low === emp || emp.includes(low) || low.includes(emp))) return false;
    }
    return true;
  });
}

function isToolDerivedClientLine(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  return TOOL_BRAND_SUBSTRING_RE.test(s) || TOOL_OK_RE.test(s);
}

function pushUnsorted(list, line, meta) {
  const t = String(line || '').trim();
  if (!t || t.length < 2) return list;
  const k = t.toLowerCase();
  if (list.some((x) => String(x).trim().toLowerCase() === k)) return list;
  meta.rejected = (meta.rejected || 0) + 1;
  return [...list, t];
}

function isAllowedDisplayTitle(title) {
  const s = String(title || '').trim();
  if (!s || s === TITLE_UNCERTAIN_LABEL) return false;
  if (OCR_CORRUPT_RE.test(s)) return false;
  if (!ALLOWED_TITLE_RE.test(s)) return false;
  return isValidTitleField(s);
}

function isValidDisplayName(name, experiences = []) {
  const s = String(name || '').trim();
  if (!s || s === NAME_UNCERTAIN_LABEL) return false;
  if (/,/.test(s)) return false;
  if (OCR_CORRUPT_RE.test(s)) return false;
  if (looksLikeCompanyOrAgencyName(s)) return false;
  if (nameCollidesWithEmployers(s, experiences)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return isValidIdentityName(s);
}

function experienceLineKey(exp) {
  return experienceDedupeKey(exp);
}

function isFreelanceExperience(exp) {
  const blob = `${exp?.role || ''} ${exp?.company || ''}`.toLowerCase();
  return /\b(independent|freelance|self[- ]?employed)\b/.test(blob);
}

function experienceQualityScore(exp) {
  let score = 0;
  const role = String(exp?.role || '');
  const bullets = (exp?.bullets || []).join(' ');
  if (FREELANCE_ILLUSTRATOR_GRAPHIC_RE.test(role)) score += 120;
  else if (/\bfreelance\b/i.test(role) && /\billustrator\b/i.test(role)) score += 90;
  else if (/\bgraphic\s+designer\b/i.test(role)) score += 50;
  if (/posters|packaging|logos|visual identity|editorial illustration/i.test(bullets)) score += 80;
  if (ACTION_BULLET_RE.test(bullets)) score += 15;
  return score;
}

function mergeDisplayExperiences(primary, secondary) {
  const a = { ...(primary || {}) };
  const b = { ...(secondary || {}) };
  const winner = experienceQualityScore(a) >= experienceQualityScore(b) ? a : b;
  const loser = winner === a ? b : a;
  const bullets = [
    ...(winner.bullets || []),
    ...(loser.bullets || []),
    winner.description,
    loser.description,
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const uniqBullets = [...new Set(bullets)].slice(0, 4);
  return {
    ...winner,
    role: winner.role || loser.role,
    company: winner.company || loser.company,
    dates: winner.dates || loser.dates,
    startDate: winner.startDate || loser.startDate,
    endDate: winner.endDate || loser.endDate,
    bullets: uniqBullets.length ? uniqBullets : winner.bullets,
  };
}

function preserveDisplayBullets(exp, max = 4) {
  const bullets = (exp?.bullets || [])
    .map((b) => String(b || '').trim())
    .filter((b) => b && !INVENTED_EXPERIENCE_BULLET_RE.test(b));
  if (!bullets.length && exp?.description) {
    const desc = String(exp.description || '').trim();
    if (desc && !INVENTED_EXPERIENCE_BULLET_RE.test(desc)) bullets.push(desc);
  }
  return [...new Set(bullets)].slice(0, max);
}

function normalizeFreelanceHeroExperience(exp) {
  const out = { ...(exp || {}) };
  if (!out.role) out.role = 'Freelance Illustrator / Graphic Designer';
  if (!out.company) out.company = 'Independent / Freelance';
  out.bullets = preserveDisplayBullets(out);
  return out;
}

function distinctEmployerCount(experiences = []) {
  const set = new Set();
  for (const exp of experiences) {
    const c = String(exp?.company || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (c.length > 2) set.add(c);
  }
  return set.size;
}

function collapseRecruiterReadyExperiences(experiences, stats) {
  const list = (experiences || []).filter(Boolean);
  return list.slice(0, 12).map((exp) => {
    if (isFreelanceExperience(exp) && list.filter(isFreelanceExperience).length === 1) {
      return normalizeFreelanceHeroExperience(exp);
    }
    return exp;
  });
}

function pickTopDisplayEducation(lines, stats) {
  const byProgram = new Map();
  for (const line of lines || []) {
    const s = String(line || '').trim();
    if (!s) continue;
    const norm = normalizeEducationEntry(s, {});
    const schoolKey = (norm?.school || s.split(/\s*[—–-]\s*/)[0] || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    if (!schoolKey || schoolKey.length < 3) continue;
    const programKey = String(norm?.program || '_')
      .trim()
      .toLowerCase();
    const key = `${schoolKey}|${programKey}`;
    const conf = scoreEducationLine(norm?.display || s);
    const prev = byProgram.get(key);
    if (!prev || conf > prev.conf) {
      byProgram.set(key, { line: norm?.display || s, conf });
    }
  }

  return [...byProgram.values()]
    .sort((a, b) => b.conf - a.conf)
    .map((v) => v.line);
}

function finalizeDisplaySkillsList(rd) {
  const filtered = (rd.skills || []).map((s) => String(s || '').trim()).filter(isDisplaySkillLine);
  const blob = [
    rd.summary,
    ...(rd.skills || []),
    ...(rd.experiences || []).flatMap((e) => [e.description, ...(e.bullets || [])]),
  ]
    .filter(Boolean)
    .join(' ');
  const ordered = [];
  for (const canon of CORE_CREATIVE_SKILLS) {
    const listed = filtered.some((s) => s.toLowerCase() === canon.toLowerCase());
    const re = new RegExp(`\\b${canon.replace(/\s+/g, '\\s+')}\\b`, 'i');
    const inferred =
      (canon === 'Logo Design' && /\blogos?\b/i.test(blob)) ||
      (canon === 'Editorial Design' && /\bposters?\b/i.test(blob)) ||
      (canon === 'Packaging' && /\bpackaging\b/i.test(blob));
    if (listed || re.test(blob) || inferred) ordered.push(canon);
  }
  const merged = [];
  const seen = new Set();
  for (const skill of [...ordered, ...filtered]) {
    const key = String(skill || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(String(skill).trim());
  }
  rd.skills = merged.slice(0, 16);
}

function isGarbledExperienceEntry(exp) {
  const role = String(exp?.role || '');
  const company = String(exp?.company || '');
  const blob = `${role} ${company}`;
  if ((blob.match(/independent\s*\/\s*freelance/gi) || []).length > 1) return true;
  if (/—\s*—/.test(role) || /—\s*—/.test(company)) return true;
  if (role.length > 72 && /\bfreelanc/i.test(role)) return true;
  if (company.length > 42 && /[—–-]/.test(company) && /\b(intern|engineer|assistant|professor|manager)\b/i.test(company)) {
    return true;
  }
  return false;
}

const ACTION_BULLET_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|collaborated|conçu|dirigé|livré)\b/i;

function enrichDisplayBullets(bullets = []) {
  return (bullets || [])
    .map((b) => String(b || '').trim())
    .filter(Boolean)
    .map((b) => {
      if (ACTION_BULLET_RE.test(b)) return b;
      const low = b.toLowerCase();
      if (/^(posters|packaging|logos?|brand|visual)/.test(low)) {
        return `Created ${low}`;
      }
      return `Delivered ${low.charAt(0).toLowerCase()}${low.slice(1)}`;
    });
}

function syncExperienceTextFromBullets(exp) {
  if (!exp || typeof exp !== 'object') return exp;
  const bullets = (exp.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
  if (!bullets.length) return exp;
  const text = bullets.join(' · ');
  const desc = String(exp.rewrittenDescription || exp.description || '').trim();
  if (
    !desc ||
    text.length > desc.length ||
    (ACTION_BULLET_RE.test(text) && !ACTION_BULLET_RE.test(desc))
  ) {
    return { ...exp, description: text, rewrittenDescription: text };
  }
  return exp;
}

function normalizeFreelanceCompanyLabel(company) {
  let c = String(company || '').trim();
  if (!c) return c;
  c = c.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();
  if (/^independent\s+freelance$/i.test(c)) return 'Independent / Freelance';
  return c;
}

function normalizeDisplayExperience(exp) {
  const out = { ...(exp || {}) };
  if (out.semanticReconstruction) {
    if (out.role) {
      let role = String(out.role).replace(/\s*&\s*/g, ' / ').replace(/\s+/g, ' ').trim();
      if (FREELANCE_ILLUSTRATOR_GRAPHIC_RE.test(role)) {
        role = 'Freelance Illustrator / Graphic Designer';
      } else if (/\billustrator\b/i.test(role) && /\bgraphic\s+designer\b/i.test(role) && !/\//.test(role)) {
        role = /\bfreelanc/i.test(role)
          ? 'Freelance Illustrator / Graphic Designer'
          : 'Illustrator / Graphic Designer';
      }
      out.role = role;
    }
    if (out.company) out.company = normalizeFreelanceCompanyLabel(out.company);
    if (!out.bullets?.length && out.description) out.bullets = [out.description];
    out.bullets = enrichDisplayBullets(out.bullets);
    return syncExperienceTextFromBullets(out);
  }

  let role = String(out.role || '').trim().replace(/\s+/g, ' ');
  let company = String(out.company || '').trim().replace(/\s+/g, ' ');
  company = normalizeFreelanceCompanyLabel(company);

  if (FREELANCE_ILLUSTRATOR_GRAPHIC_RE.test(role)) {
    role = 'Freelance Illustrator / Graphic Designer';
  } else if (/\billustrator\s+and\s+graphic\b/i.test(role)) {
    role = 'Freelance Illustrator / Graphic Designer';
  } else if (/\band\s+graphic\s*$/i.test(role) && /\billustrator\b/i.test(role)) {
    role = role.replace(/\s+and\s+graphic\s*$/i, ' / Graphic Designer');
  }

  const agencyRoleMatch =
    role.match(
      /^(.+?)\s*[-–—]\s*([A-Za-z][\w\s.&']+?)\s*[-–—]\s*((?:19|20)\d{2}(?:\s*[-–—]\s*(?:\d{4}|present|présent|current))?)\s*$/i
    ) ||
    role.match(
      /^(.+?)\s*-\s*(.+?)\s*-\s*((?:19|20)\d{2}(?:-(?:\d{4}|present|présent|current))?)\s*$/i
    );
  if (agencyRoleMatch) {
    role = agencyRoleMatch[1].trim();
    company = agencyRoleMatch[2].trim();
    if (!out.dates) out.dates = agencyRoleMatch[3].trim();
  } else {
    const roleAgency = role.match(/^(.+?)\s*[-–—]\s*(.+)$/i);
    const freelancePlaceholder =
      !company || /\b(independent\s*\/\s*freelance|self[- ]?employed|freelance)\b/i.test(company);
    if (
      roleAgency &&
      freelancePlaceholder &&
      /\b(agency|studio|group|mccann|ogilvy|publicis|wpp|bbdo|ddb)\b/i.test(roleAgency[2])
    ) {
      role = roleAgency[1].trim();
      company = roleAgency[2].trim();
    }
  }
  if (/\bgraphic\s+designer\s*[-–—]\s*intern\b/i.test(role)) {
    const m = role.match(/^(.+?)\s*[-–—]\s*(intern.*)$/i);
    if (m && !company) {
      role = m[1].trim();
      company = m[2].trim();
    }
  }

  if (company && FREELANCE_ILLUSTRATOR_GRAPHIC_RE.test(company)) {
    role = role || 'Freelance Illustrator / Graphic Designer';
    company = 'Independent / Freelance';
  }

  role = role.replace(/\s+and\s+graphic\b/gi, ' / Graphic Designer').replace(/\s*[-–—]\s*$/g, '').trim();
  company = company.replace(/\s*[-–—]\s*$/g, '').trim();
  if (role) out.role = normalizeFreelanceExperienceRole(role);
  if (company) out.company = normalizeFreelanceCompanyLabel(company);
  if (out.dates) out.dates = String(out.dates).replace(/\s+/g, ' ').trim();

  const semantic = reconstructExperienceSemantics(out);
  if (semantic.semanticReconstruction) {
    if (semantic.role) semantic.role = String(semantic.role).replace(/\s*&\s*/g, ' / ');
    if (!semantic.bullets?.length && semantic.description) {
      semantic.bullets = [semantic.description];
    }
    semantic.bullets = enrichDisplayBullets(semantic.bullets);
    return syncExperienceTextFromBullets(semantic);
  }

  out.bullets = enrichDisplayBullets(out.bullets);
  return syncExperienceTextFromBullets(out);
}

function isCorruptExperience(exp) {
  if (auditInventedExperience(exp).invented) return true;

  const role = String(exp?.role || '').trim();
  const company = String(exp?.company || '').trim();
  const dates = String(exp?.dates || '').trim();
  const blob = `${role} ${company} ${dates}`;
  if (/^:\s*/.test(role) || /^:\s*/.test(company)) return true;
  if (OCR_CORRUPT_RE.test(blob)) return true;
  if (DUPLICATE_DATE_RE.test(blob)) return true;
  if (/\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent)\s*[-–—]\s*(19|20)\d{2}/i.test(blob)) return true;
  if ((exp?.bullets || []).some((b) => INVENTED_EXPERIENCE_BULLET_RE.test(String(b || '').trim()))) return true;
  if (/^contributed\s+as\s+at\b/i.test(blob)) return true;

  const hasDate =
    extractDateRangeFromText(dates).startDate ||
    /\b(19|20)\d{2}\b/.test(`${exp?.startDate || ''} ${dates}`);
  const hasRole = !!(role && !/^at\s+/i.test(role) && !/^(present|présent|current)$/i.test(role));
  const hasCompany = !!(company && !/^(present|présent|current|now)$/i.test(company));
  if (!hasDate || !hasRole || !hasCompany) return true;
  if (/^(native|fluent|conversational|professional|intermediate|bilingual)$/i.test(company)) return true;
  if (/designed and delivered creative work/i.test(role) && !/\b(designer|illustrator|creative|graphic)\b/i.test(role)) {
    return true;
  }
  if (findLongestDictionaryTerm(company, CLIENT_TERMS) && !lineLooksLikeRole(role)) return true;
  return false;
}

/**
 * Section-only cleanup for spatial bridge SSOT — no flat OCR repair or identity rewrite.
 * @param {import('../resume-data.js').ResumeData} resumeData
 */
export function sanitizeBridgeStructuredSections(resumeData) {
  if (!resumeData || typeof resumeData !== 'object') return resumeData;
  let rd = applyUniversalSafetyGate(resumeData, { silent: true });
  const rejectedEducation = [];
  rd.education = dedupeEducationStrings(
    (rd.education || [])
      .map((e) => String(e || '').trim())
      .filter((e) => {
        if (isValidEducationItem(e)) return true;
        if (e) rejectedEducation.push(e);
        return false;
      }),
    { identity: rd.identity }
  );
  for (const line of rejectedEducation) {
    if (!rd.unsorted.includes(line)) rd.unsorted.push(line);
  }
  rd.skills = (rd.skills || []).filter((s) => {
    const t = String(s || '').trim();
    return (
      t &&
      !isSkillsSectionPollution(t, { isSkillsSection: true }) &&
      !isOcrGarbageText(t)
    );
  });
  rd.tools = (rd.tools || []).filter((s) => {
    const t = String(s || '').trim();
    return (
      t &&
      !isSkillsSectionPollution(t, { isSkillsSection: false }) &&
      !isOcrGarbageText(t)
    );
  });
  const summary = String(rd.summary || '').trim();
  if (summary && !isValidSummaryField(summary)) {
    rd.unsorted = [...(rd.unsorted || []), summary];
    rd.summary = '';
  }
  rd.experiences = dedupeExperienceEntries(rd.experiences || []);
  rd.meta = {
    ...(rd.meta || {}),
    bridgeSectionSanitized: true,
  };
  return lockResumeDataShape(rd);
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 * @param {object} [opts]
 * @returns {import('../resume-data.js').ResumeData}
 */
export function sanitizeResumeForDisplay(resumeData, opts = {}) {
  if (
    resumeData?.meta?.blockParserBridgeApplied === true ||
    resumeData?.meta?.spatialParseInput === true
  ) {
    return sanitizeBridgeStructuredSections(resumeData);
  }
  const stats = { rejected: 0 };
  const eduYearHints = buildEducationYearHints(resumeData?.education);
  let rd = polishResumeOutput(applyUniversalSafetyGate(resumeData, { silent: true }));

  const headerSource = [opts.rawText, rd.meta?.rawText, opts.cleanedText, rd.meta?.cleanedText]
    .filter(Boolean)
    .join('\n');
  const identityHeaderBlob = extractIdentityHeaderLines(headerSource.split(/\r?\n/), 28).join('\n');
  rd.identity = repairIdentityFromOcrSignals(rd.identity, identityHeaderBlob);
  let recoveredName = recoverDisplayIdentityName(
    rd.identity,
    identityHeaderBlob,
    rd.meta,
    rd.experiences || []
  );
  if (recoveredName) rd.identity = { ...rd.identity, name: recoveredName };

  const id = { ...(rd.identity || {}) };

  const headerContactLines = identityHeaderBlob.split(/\r?\n/).map((l) => String(l || '').trim()).filter(Boolean);
  if (!id.phone) {
    for (const line of headerContactLines) {
      const recovered = extractIdentityPhone(line);
      if (recovered) {
        id.phone = recovered;
        break;
      }
    }
  }
  const validatedPhone =
    id.phone && assessIdentityPhoneStrict(id.phone).accept ? id.phone : '';
  if (!validatedPhone) {
    for (const line of headerContactLines) {
      if (!CONTACT_PHONE_SIGNAL_RE.test(line) || !phoneHasYearOrDatePollution(line)) continue;
      const pollutedPhone = assessIdentityPhoneStrict(line);
      if (!pollutedPhone.accept) {
        id.phone = '';
        const pollutedItem = buildPhoneReviewItem(
          line,
          pollutedPhone.normalized || '',
          pollutedPhone.confidence
        );
        if (pollutedItem) {
          rd.meta = {
            ...(rd.meta || {}),
            contactReviewItems: [...(rd.meta?.contactReviewItems || []), pollutedItem],
          };
        }
      }
    }
  } else {
    id.phone = validatedPhone;
  }

  const headerNameCandidates = headerContactLines.filter(
    (line) => line.length <= 55 && isValidIdentityName(line)
  );
  if (isValidIdentityName(id.name)) headerNameCandidates.unshift(id.name);
  rd.experiences = stripPersonNameEmployerArtifacts(rd.experiences, headerNameCandidates);
  if (!isValidIdentityName(id.name) || id.name === NAME_UNCERTAIN_LABEL) {
    const repaired = recoverDisplayIdentityName(id, identityHeaderBlob, rd.meta, rd.experiences);
    if (repaired) id.name = repaired;
  }

  const strictContact = enforceIdentityContactStrictness(id, {
    experiences: rd.experiences || [],
    existingReviewItems: rd.meta?.contactReviewItems || [],
    sourceText: headerSource,
    rawText: rd.meta?.rawText,
    cleanedText: rd.meta?.cleanedText,
  });
  if (strictContact.stripped.name) {
    rd.unsorted = pushUnsorted(rd.unsorted, strictContact.stripped.name, stats);
  }
  if (strictContact.stripped.phone) {
    rd.unsorted = pushUnsorted(rd.unsorted, strictContact.stripped.phone, stats);
  }
  if (strictContact.stripped.email) {
    rd.unsorted = pushUnsorted(rd.unsorted, strictContact.stripped.email, stats);
  }
  if (strictContact.reviewItems.length) {
    rd.meta = {
      ...(rd.meta || {}),
      contactReviewItems: strictContact.reviewItems,
    };
  }
  Object.assign(id, strictContact.identity);

  const entityGuard = applyPersonCompanyDisambiguation(
    { ...rd, identity: id },
    {
      experiences: rd.experiences || [],
      existingReviewItems: rd.meta?.contactReviewItems || [],
    }
  );
  if (entityGuard.stripped.name) {
    rd.unsorted = pushUnsorted(rd.unsorted, entityGuard.stripped.name, stats);
  }
  if (entityGuard.stripped.title) {
    rd.unsorted = pushUnsorted(rd.unsorted, entityGuard.stripped.title, stats);
  }
  if (entityGuard.stripped.email) {
    rd.unsorted = pushUnsorted(rd.unsorted, entityGuard.stripped.email, stats);
  }
  if (entityGuard.stripped.phone) {
    rd.unsorted = pushUnsorted(rd.unsorted, entityGuard.stripped.phone, stats);
  }
  if (entityGuard.reviewItems.length) {
    rd.meta = {
      ...(rd.meta || {}),
      contactReviewItems: entityGuard.reviewItems,
    };
  }
  Object.assign(id, entityGuard.resumeData.identity || {});

  const rawTitle = String(id.title || '').trim();
  if (!isAllowedDisplayTitle(rawTitle)) {
    if (rawTitle && rawTitle !== TITLE_UNCERTAIN_LABEL) {
      rd.unsorted = pushUnsorted(rd.unsorted, rawTitle, stats);
    }
    id.title = TITLE_UNCERTAIN_LABEL;
  }

  const rawEmail = String(id.email || '').trim();
  if (rawEmail && !EMAIL_RE.test(rawEmail)) {
    rd.unsorted = pushUnsorted(rd.unsorted, rawEmail, stats);
    id.email = '';
  }

  rd.identity = id;

  const routeLines = (list, ok) => {
    const kept = [];
    for (const item of list || []) {
      const s = String(item || '').trim();
      if (!s || OCR_CORRUPT_RE.test(s)) {
        if (s) rd.unsorted = pushUnsorted(rd.unsorted, s, stats);
        continue;
      }
      if (ok(s)) kept.push(s);
      else rd.unsorted = pushUnsorted(rd.unsorted, s, stats);
    }
    return kept;
  };

  const languageDrain = [];
  const toolsPre = [];
  for (const item of rd.tools || []) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (
      /^(english|french|spanish|german|native|fluent|bilingual)$/i.test(s) ||
      (LANGUAGE_OK_RE.test(s) && !TOOL_OK_RE.test(s)) ||
      /\b(native|fluent|bilingual)\b/i.test(s)
    ) {
      languageDrain.push(normalizeLanguageDisplayLine(s));
      continue;
    }
    const canon = canonicalDisplayTool(s);
    if (canon) {
      toolsPre.push(canon);
      continue;
    }
    rd.unsorted = pushUnsorted(rd.unsorted, s, stats);
  }
  rd.tools = toolsPre;

  const langBest = new Map();
  for (const item of [...(rd.languages || []), ...languageDrain]) {
    const strict = extractStrictLanguageLine(item);
    if (!strict.ok || !strict.display) {
      const raw = String(item || '').trim();
      if (raw && !isForbiddenLanguageLine(raw)) rd.unsorted = pushUnsorted(rd.unsorted, raw, stats);
      continue;
    }
    const norm = strict.display;
    if (!LANGUAGE_OK_RE.test(norm) || INVALID_LANGUAGE_RE.test(norm) || EDUCATION_SIGNAL_RE.test(norm)) {
      rd.unsorted = pushUnsorted(rd.unsorted, norm, stats);
      continue;
    }
    const key = languageBaseKey(norm);
    const rank = languageProficiencyRank(norm);
    const prev = langBest.get(key);
    if (!prev || rank > prev.rank) langBest.set(key, { norm, rank });
  }
  rd.languages = [...langBest.values()].map((v) => v.norm);

  const toolsDeduped = [];
  const toolsSeen = new Set();
  for (const item of rd.tools || []) {
    const canon = canonicalDisplayTool(item) || String(item || '').trim();
    if (!canon || !isDisplayToolLine(canon)) {
      if (item) rd.unsorted = pushUnsorted(rd.unsorted, item, stats);
      continue;
    }
    const key = canon.toLowerCase();
    if (toolsSeen.has(key)) continue;
    toolsSeen.add(key);
    toolsDeduped.push(canon);
  }
  rd.tools = finalizeDisplayTools(toolsDeduped);
  rd.clients = stripEmployerClients(
    extractCleanClientBrands(rd.clients, clientHarvestLines(rd.unsorted, rd.experiences)),
    rd.experiences
  );
  rd.skills = routeLines(rd.skills, isDisplaySkillLine);
  let eduFormatted = (rd.education || [])
    .map((item) => fixEducationOcrWording(cleanEducationDateArtifacts(String(item || '').trim())))
    .filter((s) => s && !EDU_DATE_GARBAGE_RE.test(s));
  eduFormatted = eduFormatted.flatMap((line) => {
    const recovered = tryRecoverSchoolEducation(line) || formatSafeEducationEntry(line, { minConfidence: 0 })?.education;
    return [fixEducationOcrWording(recovered || line)];
  });
  eduFormatted = normalizeAllEducation(eduFormatted, { identity: rd.identity });
  eduFormatted = dedupeEducationStrings(eduFormatted, { identity: rd.identity });

  const eduKept = [];
  for (const line of eduFormatted) {
    const cleanedLine = line;
    if (!cleanedLine || EDU_DATE_GARBAGE_RE.test(cleanedLine)) {
      rd.unsorted = pushUnsorted(rd.unsorted, line, stats);
      continue;
    }
    const conf = scoreEducationLine(cleanedLine);
    if (
      isCorruptEducationLine(cleanedLine) ||
      /\b(observation|maquette)\b/i.test(cleanedLine) ||
      (conf < SAFE_EDUCATION_CONFIDENCE_MIN && /observation|maquette|@\s*man|\)\s*$/i.test(cleanedLine))
    ) {
      rd.unsorted = pushUnsorted(rd.unsorted, line, stats);
      continue;
    }
    if (conf < SAFE_EDUCATION_CONFIDENCE_MIN && !DEGREE_MARKERS_RE.test(cleanedLine)) {
      rd.unsorted = pushUnsorted(rd.unsorted, line, stats);
      continue;
    }
    const hasDegreeMarker = DEGREE_MARKERS_RE.test(cleanedLine);
    const hasYear = /\b(19|20)\d{2}\b/.test(cleanedLine);
    const looksLikeExperience =
      EXPERIENCE_ROLE_MARKERS_RE.test(cleanedLine) &&
      /\b(freelance|independent|present|présent|current)\b/i.test(cleanedLine);
    if (
      (EDUCATION_SIGNAL_RE.test(cleanedLine) || (hasDegreeMarker && hasYear)) &&
      !looksLikeExperience &&
      !PHONE_EDU_MIX_RE.test(cleanedLine) &&
      !OCR_CORRUPT_RE.test(cleanedLine) &&
      (!isCorruptEducationLine(cleanedLine) || hasDegreeMarker)
    ) {
      eduKept.push(cleanedLine);
    } else {
      rd.unsorted = pushUnsorted(rd.unsorted, cleanedLine, stats);
    }
  }
  rd.education = pickTopDisplayEducation(eduKept, stats);
  rd.projects = routeLines(rd.projects, (s) => s.length >= 6 && !INVALID_LANGUAGE_RE.test(s) && !OCR_CORRUPT_RE.test(s));

  rd.experiences = (rd.experiences || []).map((exp) => {
    const merged = parseUrlMergedExperienceLine(String(exp?.role || '').trim());
    if (!merged) return exp;
    return {
      ...exp,
      role: merged.role,
      company: merged.company,
      startDate: merged.startDate,
      endDate: merged.endDate,
      dates: merged.dates,
      bullets: merged.bullets?.length ? merged.bullets : exp.bullets || [],
    };
  });

  const experienceIntel = experienceNormalizer({
    experiences: rd.experiences || [],
    cleanText: [
      rd.meta?.cleanedText,
      rd.meta?.rawText,
      ...(rd.unsorted || []),
      ...(rd.experiences || []).flatMap((e) =>
        [e.role, e.company, e.dates, e.startDate, ...(e.bullets || [])].filter(Boolean)
      ),
    ]
      .filter(Boolean)
      .join('\n'),
  });
  rd.experiences = experienceIntel.experiences;
  rd.metadata = {
    ...(rd.metadata || {}),
    experienceIntelligence: experienceIntel.metadata,
  };

  const expByKey = new Map();
  for (const exp of rd.experiences || []) {
    const roleBlob = String(exp?.role || '').trim();
    const mergedFromRole = parseUrlMergedExperienceLine(roleBlob);
    if (mergedFromRole) {
      exp.role = mergedFromRole.role;
      exp.company = mergedFromRole.company;
      exp.startDate = mergedFromRole.startDate;
      exp.endDate = mergedFromRole.endDate;
      exp.dates = mergedFromRole.dates;
      exp.bullets = mergedFromRole.bullets || [];
    }
    if (isGarbledExperienceEntry(exp)) {
      const line = [exp.role, exp.company, exp.dates].filter(Boolean).join(' — ');
      rd.unsorted = pushUnsorted(rd.unsorted, line, stats);
      continue;
    }
    if (isCorruptExperience(exp)) {
      const invented = auditInventedExperience(exp);
      if (invented.clientBrand) {
        rd.clients = [...new Set([...(rd.clients || []), invented.clientBrand])];
      } else {
        const parts = [exp?.role, exp?.company, exp?.dates, ...(exp?.bullets || [])].filter(Boolean);
        for (const p of parts) rd.unsorted = pushUnsorted(rd.unsorted, p, stats);
      }
      continue;
    }
    const normalized = normalizeDisplayExperience(exp);
    const dk = experienceLineKey(normalized);
    const hasKey = dk.replace(/\|/g, '').length > 0;
    if (hasKey && expByKey.has(dk)) {
      const existing = expByKey.get(dk);
      if (!mustNeverMergeExperiences(existing, normalized)) {
        expByKey.set(dk, mergeDisplayExperiences(existing, normalized));
      } else {
        expByKey.set(`${dk}-${expByKey.size}`, normalized);
      }
      continue;
    }
    if (hasKey) expByKey.set(dk, normalized);
    else expByKey.set(`row-${expByKey.size}`, normalized);
  }
  const stripped = stripInventedExperiences(
    dedupeExperienceEntries(
      collapseRecruiterReadyExperiences([...expByKey.values()], stats).map(syncExperienceTextFromBullets)
    )
  );
  rd.experiences = stripped.kept;
  if (stripped.clients.length) {
    rd.clients = [...new Set([...(rd.clients || []), ...stripped.clients])];
  }
  const sectionSkills = [...(rd.skills || [])];
  rd.skills = harvestSkillsFromDescriptions(rd, {
    min: SKILL_RECOVERY_MIN,
    max: SKILL_RECOVERY_MAX,
  });
  for (const skill of sectionSkills) {
    const k = String(skill || '').trim().toLowerCase();
    if (!k) continue;
    if (!rd.skills.some((s) => String(s).trim().toLowerCase() === k)) {
      rd.skills.unshift(String(skill).trim());
    }
  }
  rd.skills = rd.skills.slice(0, SKILL_RECOVERY_MAX);
  for (const exp of rd.experiences) {
    if (exp?.specialties?.length) exp.specialties = [];
  }

  for (const line of [...(rd.unsorted || [])]) {
    const merged = parseUrlMergedExperienceLine(line);
    if (merged) {
      const key = `${merged.role}|${merged.company}|${merged.startDate}`.toLowerCase();
      const exists = (rd.experiences || []).some(
        (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
      );
      if (!exists) {
        rd.experiences.push({
          ...merged,
          clients: [],
          location: '',
          bullets: merged.bullets || [],
        });
      }
      rd.unsorted = rd.unsorted.filter((x) => String(x).trim() !== String(line).trim());
      continue;
    }
    const freelance = parseFreelanceCareerLine(line);
    if (freelance) {
      const key = `${freelance.role}|${freelance.company}|${freelance.startDate}`.toLowerCase();
      const exists = (rd.experiences || []).some(
        (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
      );
      if (!exists) {
        rd.experiences.push({
          ...freelance,
          clients: [],
          location: '',
          bullets: freelance.bullets || [],
        });
      }
      rd.unsorted = rd.unsorted.filter((x) => String(x).trim() !== String(line).trim());
      continue;
    }
    const recovered = tryRecoverSchoolEducation(fixEducationOcrWording(line));
    if (recovered) {
      const cleaned = normalizeEducationEntry(recovered, { identity: rd.identity })?.display;
      if (
        !cleaned ||
        /\b(observation|maquette)\b/i.test(cleaned) ||
        scoreEducationLine(cleaned) < SAFE_EDUCATION_CONFIDENCE_MIN
      ) {
        continue;
      }
      const schoolKey = String(cleaned).split(/[—–-]/)[0].trim().toLowerCase();
      const exists = rd.education.some((e) =>
        String(e).toLowerCase().startsWith(schoolKey)
      );
      if (!exists) {
        const normalized = normalizeEducationEntry(cleaned, { identity: rd.identity });
        rd.education.push(normalized?.display || cleaned);
      }
    }
  }

  rd.education = dedupeEducationStrings(
    normalizeAllEducation(rd.education, { identity: rd.identity }),
    { identity: rd.identity }
  );

  const recoveredSummary = recoverDisplaySummary(rd, headerSource || identityHeaderBlob);
  if (recoveredSummary) rd.summary = recoveredSummary;

  if (rd.summary && isWeakDisplaySummary(rd.summary)) {
    rd.unsorted = pushUnsorted(rd.unsorted, rd.summary, stats);
    rd.summary = '';
  }

  rd.unsorted = capMeaningfulSuggestions(rd.unsorted, DISPLAY_SUGGESTIONS_MAX, rd);

  rd.meta = {
    ...(rd.meta || {}),
    displaySanitize: SANITIZE_RESUME_DISPLAY,
    displaySanitizeAt: new Date().toISOString(),
    displayRejectedCount: stats.rejected,
    sanitizedResumeSize: 0,
  };

  let locked = lockResumeDataShape(rd);

  const biasGuard = applyYoazBiasGuard(locked, {
    sourceText: headerSource,
    rawText: locked.meta?.rawText || opts.rawText,
    cleanedText: locked.meta?.cleanedText || opts.cleanedText,
  });
  locked = biasGuard.resumeData;

  try {
    locked.meta.sanitizedResumeSize = JSON.stringify(locked).length;
  } catch {
    locked.meta.sanitizedResumeSize = 0;
  }
  logRenderPipelineCounts('SANITIZED_COUNTS', locked);
  return locked;
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 */
export function sanitizedResumeSize(resumeData) {
  try {
    return JSON.stringify(sanitizeResumeForDisplay(resumeData)).length;
  } catch {
    return 0;
  }
}
