/**
 * Strict experience parser — no isolated-line hallucination.
 * Valid only: role+company+date | role+date | company+date (confidence ≥ 70%).
 * Otherwise → unclassified.
 */

import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import {
  stripAgePhrase,
  collapseWhitespace,
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseDashSeparatedExperienceLine,
} from './classification-fixes.js';
import {
  getEducationLineSignals,
  isSchoolEmploymentLine,
  isAcademicEmploymentContext,
} from './education-confidence.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { mergeUnsortedLines } from './no-data-loss.js';
import {
  runParserGuarded,
  UNKNOWN_EDUCATION_SIGNALS,
  MAX_PARSER_DEPTH,
} from './parser-cycle-guard.js';

export const EXPERIENCE_PARSER_CONFIDENCE_MIN = 70;
export const EXPERIENCE_LOW_CONFIDENCE_MIN = 65;
export const EXPERIENCE_NEARBY_LINE_RADIUS = 3;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\.|\b(behance|dribbble|instagram|linkedin)\b/i;

const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i;

const EMPLOYER_MARKER_RE =
  /\b(agency|agence|inc\.?|ltd\.?|gmbh|llc|corp|corporation|studio|studios|group|mccann|publicis|havas|betc|ddb|akqa)\b/i;

const ROLE_MARKER_RE =
  /\b(internship|intern|stagiaire|freelance|illustrator|designer|director|graphiste|illustrateur|consultant|manager|lead|senior|junior|engineer|developer|analyst|executive|recruiter|specialist|coordinator|architect|officer|professor|researcher|assistant|account\s+executive|sales)\b/i;

const JOB_TITLE_LINE_RE =
  /\b(chief|vice\s+president|\bvp\b|director|officer|head\s+of|president|manager|lead|senior|junior|engineer|designer|developer|analyst|consultant|intern|assistant|professor|researcher|account\s+executive|teaching\s+assistant|postdoctoral)\b/i;

const SECTION_HEADER_EXP_RE =
  /^(profile(\s+work)?\s+experience|work\s+experience|professional\s+experience|employment|expérience|experience|career)\b/i;

function isSectionHeaderLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  return !!fuzzySectionKey(t) || SECTION_HEADER_EXP_RE.test(t);
}

function lineHasDate(line) {
  const l = String(line || '');
  return DATE_RANGE_RE.test(l) || /\b(19|20)\d{2}\b/.test(l);
}

/** Single-line skill / interest / tool tags — never employment rows. */
const TAG_BLOCKLIST = new Set(
  [
    'music',
    'movies',
    'nature',
    'reading',
    'portfolio',
    'packaging',
    'product design',
    'architecture',
    'graphic design',
    'art direction',
    'adobe',
    'photoshop',
    'illustration',
    'branding',
    'typography',
    'drawing',
    'sketching',
    'lea',
    'profile',
    'skills',
    'tools',
    'languages',
    'clients',
    'interests',
    'education',
    'contact',
  ].map((s) => s.toLowerCase())
);

const BULLET_RE = /^[-•*]\s+/;

const DEGREE_LEAD_RE =
  /^(b\.?s\.?|b\.?a\.?|b\.?f\.?a\.?|m\.?s\.?|m\.?a\.?|mba|ph\.?d\.?|bachelor|master|doctorat|diploma|licence|license|baccalauréat|baccalaureat)\b/i;

const educationDataCache = new Map();
const EDUCATION_DATA_CACHE_MAX = 800;

function cachedEducationLineCheckInner(line) {
  const l = String(line || '').trim();
  if (!l) return { isEducation: false, signals: UNKNOWN_EDUCATION_SIGNALS };
  if (educationDataCache.has(l)) return educationDataCache.get(l);
  if (educationDataCache.size >= EDUCATION_DATA_CACHE_MAX) educationDataCache.clear();

  /** One education-confidence pass per line — never re-enter via mustNeverBeExperience. */
  const signals = getEducationLineSignals(l);
  if (signals.unknown) {
    const hit = { isEducation: false, signals, unknown: true };
    educationDataCache.set(l, hit);
    return hit;
  }

  if (
    /\b(teaching\s+assistant|research\s+assistant|graduate\s+assistant|postdoctoral|adjunct|lecturer|tutor|instructor|professor)\b/i.test(
      l
    ) &&
    lineHasDate(l)
  ) {
    const hit = { isEducation: false, signals };
    educationDataCache.set(l, hit);
    return hit;
  }

  let isEducation = signals.isEducationLine;

  if (DEGREE_LEAD_RE.test(l) && lineHasDate(l) && !isSchoolEmploymentLine(l)) {
    isEducation = true;
  } else if (signals.degreeMatch && signals.schoolMatch && !isSchoolEmploymentLine(l)) {
    isEducation = true;
  } else if (signals.schoolMatch || signals.forceEducation) {
    isEducation = true;
  }

  const hit = { isEducation, signals };
  educationDataCache.set(l, hit);
  return hit;
}

function cachedEducationLineCheck(line) {
  const l = String(line || '').trim();
  if (!l) return { isEducation: false, signals: UNKNOWN_EDUCATION_SIGNALS };
  return runParserGuarded(
    'exp_edu_check',
    l,
    () => cachedEducationLineCheckInner(l),
    () => ({ isEducation: false, signals: UNKNOWN_EDUCATION_SIGNALS, unknown: true })
  );
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} line
 */
export function lineIsContactData(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (DATE_RANGE_RE.test(l) || /^\d{4}\s*[-–—]\s*\d{4}\s*$/.test(l)) return false;
  if (EMAIL_RE.test(l)) return true;
  if (PHONE_RE.test(l) && l.replace(/\D/g, '').length >= 8 && !/^\d{4}[-–—\d\s]+$/.test(l)) {
    return true;
  }
  if (URL_RE.test(l)) return true;
  if (/^(portfolio|linkedin|behance|instagram|website|site web)\b/i.test(l) && !lineHasDate(l)) {
    return true;
  }
  return false;
}

/**
 * @param {string} line
 */
export function lineIsEducationData(line) {
  return cachedEducationLineCheck(line).isEducation;
}

/**
 * @param {string} line
 */
export function lineIsSkillOrTagOnly(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 80) return false;
  if (lineHasDate(l)) return false;
  const low = norm(l);
  if (TAG_BLOCKLIST.has(low)) return true;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && TAG_BLOCKLIST.has(words.map((w) => w.toLowerCase()).join(' '))) {
    return true;
  }
  if (words.length === 1 && TAG_BLOCKLIST.has(words[0].toLowerCase())) return true;
  if (
    l.includes(',') &&
    words.length >= 3 &&
    words.length <= 12 &&
    !EMPLOYER_MARKER_RE.test(l) &&
    !ROLE_MARKER_RE.test(l)
  ) {
    return true;
  }
  return false;
}

function isExperienceSectionHeader(line) {
  const l = String(line || '').trim();
  if (!l || lineHasDate(l)) return false;
  return SECTION_HEADER_EXP_RE.test(l) || isSectionHeaderLine(l);
}

const AGE_AS_ROLE_RE = /\b\d{1,2}[-\s]?(?:years?\s+)?old\b|\b\d{1,2}\s*year[-\s]?old\b|\byear\s*old\b/i;

const EXPERIENCE_ROLE_NORM_RE =
  /\b(freelanc\w*|associate\s+professor|assistant\s+professor|teaching\s+assistant|postdoctoral\s+researcher|postdoctoral|illustrator|graphic\s+designer|art\s+director|motion\s+designer|creative\s+director|designer|software\s+engineer|product\s+manager|marketing\s+(?:manager|executive)|digital\s+marketing\s+manager|business\s+analyst|data\s+scientist|engineer|developer|consultant|manager|recruiter|analyst|executive|chief\s+operating\s+officer|vice\s+president|account\s+executive|professor|officer|internship|intern|stagiaire)\b/i;

const ROLE_RANK_PREFIX_RE =
  /^(senior|lead|principal|staff|junior|associate|digital|creative|visual|freelance|chief|head|global|regional)\s+/i;

/**
 * Normalize OCR role noise (age prefix, garbage before a clear title).
 * @param {string} role
 * @param {string} [contextLine]
 */
const ROLE_NORM_NEEDLES = [
  'associate professor',
  'assistant professor',
  'teaching assistant',
  'postdoctoral researcher',
  'postdoctoral',
  'graphic designer',
  'art director',
  'motion designer',
  'creative director',
  'product designer',
  'software engineer',
  'product manager',
  'marketing manager',
  'marketing executive',
  'digital marketing manager',
  'business analyst',
  'full stack developer',
  'full stack engineer',
  'data scientist',
  'account executive',
  'chief operating officer',
  'vice president',
  'freelancer',
  'freelance',
  'illustrator',
  'designer',
  'engineer',
  'developer',
  'consultant',
  'manager',
  'recruiter',
  'analyst',
  'executive',
  'professor',
  'officer',
  'internship',
  'intern',
  'stagiaire',
];

let normalizeExperienceRoleDepth = 0;

export function normalizeExperienceRole(role, contextLine = '') {
  if (normalizeExperienceRoleDepth >= MAX_PARSER_DEPTH) {
    return collapseWhitespace(String(role || ''), 120);
  }
  normalizeExperienceRoleDepth++;
  try {
    return normalizeExperienceRoleInner(role, contextLine);
  } finally {
    normalizeExperienceRoleDepth--;
  }
}

function normalizeExperienceRoleInner(role, contextLine = '') {
  let r = collapseWhitespace(stripAgePhrase(String(role || '').trim().slice(0, 200)));

  const rl = r.toLowerCase();
  let bestNeedle = '';
  let bestIdx = -1;
  for (const needle of ROLE_NORM_NEEDLES) {
    const idx = rl.indexOf(needle);
    if (idx === -1) continue;
    if (needle.length > bestNeedle.length) {
      bestNeedle = needle;
      bestIdx = idx;
    }
  }
  if (bestIdx > 0) {
    const prefix = r.slice(0, bestIdx).trim();
    const rankPrefix = prefix.match(ROLE_RANK_PREFIX_RE);
    r = rankPrefix ? `${rankPrefix[0].trim()} ${r.slice(bestIdx)}`.trim() : r.slice(bestIdx);
  }

  if (/:/.test(r)) {
    const chunks = r
      .split(':')
      .map((c) => c.trim())
      .filter((c) => c.length > 2);
    const roleChunk =
      chunks.find((c) => EXPERIENCE_ROLE_NORM_RE.test(c) && !AGE_AS_ROLE_RE.test(stripAgePhrase(c))) ||
      chunks.find((c) => EXPERIENCE_ROLE_NORM_RE.test(c));
    if (roleChunk) r = roleChunk;
  }

  r = collapseWhitespace(stripAgePhrase(r));

  if (/\bfreelanc/i.test(r) && !/\bfreelanc/i.test(r.split(/\s+/)[0])) {
    r = `Freelance ${r.replace(/^freelance\s+/i, '')}`.trim();
  }
  if (/\binternship\b/i.test(r) && !/\b(engineer|engineering|developer|designer|analyst|scientist|assistant)\b/i.test(r)) {
    return 'Internship';
  }
  if (/^\s*intern\s*$/i.test(r)) return 'Internship';

  return r.slice(0, 120);
}

function lineHasCareerRescueSignals(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  return (
    (DATE_RANGE_RE.test(l) || /\b(19|20)\d{2}\b/.test(l)) &&
    (/\b(freelanc|independent|self[- ]?employed)\b/i.test(l) ||
      /\b(illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|motion\s+designer)\b/i.test(l))
  );
}

function normalizeStrictEntry(entry, contextLine = '') {
  const ctx = String(contextLine || '').trim();
  let role = normalizeExperienceRole(entry?.role, ctx || entry?.role);
  let company = stripAgePhrase(String(entry?.company || '').trim());

  if (/\bfreelanc/i.test(ctx) && (!company || company.length < 3)) {
    company = 'Independent / Freelance';
  }
  if (/\b(internship|intern|stage)\b/i.test(ctx) && !role) {
    role = 'Internship';
  }

  return {
    ...entry,
    role,
    company,
  };
}

/**
 * @param {{ role?: string, company?: string, startDate?: string, endDate?: string }} entry
 * @param {string} [contextLine]
 */
function qualifiesStrictExperienceInner(normalized, contextLine = '', rawEntry = null) {
  const role = normalized.role;
  const company = normalized.company;
  const startDate = String(rawEntry?.startDate || normalized.startDate || '').trim();

  if (!startDate) return false;
  if (!role && !company) return false;
  if (/^(19|20)\d{2}$/.test(role) || /^(19|20)\d{2}$/.test(company)) return false;
  if (/^role to confirm$/i.test(role)) return false;
  if (role && AGE_AS_ROLE_RE.test(role) && !lineHasCareerRescueSignals(contextLine || role)) return false;
  if (company && AGE_AS_ROLE_RE.test(company)) return false;
  const schoolEmployment = isAcademicEmploymentContext(contextLine || `${role} — ${company}`, normalized);
  if (role && (lineIsSkillOrTagOnly(role) || lineIsContactData(role))) {
    return false;
  }
  if (role && !schoolEmployment && lineIsEducationData(role)) {
    return false;
  }
  if (company && (lineIsSkillOrTagOnly(company) || lineIsContactData(company))) {
    return false;
  }
  if (company && !schoolEmployment && lineIsEducationData(company)) {
    return false;
  }
  if (/^[-•*]\s/.test(company) || /^[-•*]\s/.test(role)) return false;
  if (company.length > 72 || role.length > 120) return false;
  if (isExperienceSectionHeader(role) || isExperienceSectionHeader(company)) return false;
  if (/^profile\s+work/i.test(role) || /^work\s+experience$/i.test(company)) return false;
  return true;
}

export function qualifiesStrictExperience(entry, contextLine = '') {
  return qualifiesStrictExperienceInner(normalizeStrictEntry(entry, contextLine), contextLine, entry);
}

/**
 * @param {{ role?: string, company?: string, startDate?: string, endDate?: string, bullets?: string[] }} entry
 */
export function scoreStrictExperienceEntry(entry, contextLine = '') {
  const normalized = normalizeStrictEntry(entry, contextLine);
  if (!qualifiesStrictExperienceInner(normalized, contextLine, entry)) return 0;
  let score = 40;
  if (normalized.startDate) score += 28;
  if (normalized.endDate) score += 8;
  if (normalized.role && normalized.role.length > 4) score += 18;
  if (normalized.company && normalized.company.length > 2) score += 16;
  if (normalized.role && normalized.company) score += 8;
  if (normalized.bullets?.length) score += Math.min(8, normalized.bullets.length * 2);
  return Math.min(100, score);
}

function lineLooksLikeEmployer(line) {
  const l = String(line || '').trim();
  if (!l || lineIsSkillOrTagOnly(l)) return false;
  if (ROLE_MARKER_RE.test(l)) return false;
  if (JOB_TITLE_LINE_RE.test(l) && !EMPLOYER_MARKER_RE.test(l)) return false;
  if (EMPLOYER_MARKER_RE.test(l)) return true;
  if (/\bG\.\s*Agency\b/i.test(l)) return true;
  if (/^[A-ZÀ-Ö][\w&.'-]+(?:\s+[A-ZÀ-Ö][\w&.'-]+){0,3}$/.test(l) && l.split(/\s+/).length >= 2) {
    return true;
  }
  return false;
}

function lineLooksLikeRole(line) {
  const l = String(line || '').trim();
  if (!l || lineIsSkillOrTagOnly(l)) return false;
  if (ROLE_MARKER_RE.test(l)) return true;
  if (lineLooksLikeEmployer(l)) return false;
  if (isExperienceSectionHeader(l)) return false;
  if (ROLE_MARKER_RE.test(l)) return true;
  if (/\//.test(l) && l.split(/\s+/).length >= 2 && l.length < 90) return true;
  if (l.split(/\s+/).length >= 2 && l.length < 72 && !l.includes(',')) return true;
  return false;
}

/**
 * Build one experience entry from a date-anchored line group (block).
 * @param {string[]} group
 */
export function buildExperienceEntryFromLineGroup(group) {
  const lines = (group || []).map((l) => String(l || '').trim()).filter(Boolean);
  if (!lines.length) return null;
  const guardKey = lines.join('|').slice(0, 240);
  return runParserGuarded('exp_build', guardKey, () => buildExperienceEntryFromLineGroupInner(lines), () => null);
}

function buildExperienceEntryFromLineGroupInner(lines) {
  if (!lines.length) return null;

  for (const line of lines) {
    const dash = parseDashSeparatedExperienceLine(line);
    if (dash) {
      const entry = normalizeStrictEntry({ ...dash, clients: [], location: dash.location || '' }, line);
      if (qualifiesStrictExperience(entry, line)) {
        const confidence = scoreStrictExperienceEntry(entry, line);
        if (confidence >= EXPERIENCE_PARSER_CONFIDENCE_MIN) {
          return { ...entry, confidence };
        }
      }
    }
    const freelance = parseFreelanceCareerLine(line);
    if (freelance) {
      const entry = normalizeStrictEntry(
        { ...freelance, clients: [], location: '' },
        line
      );
      if (qualifiesStrictExperience(entry, line)) {
        const confidence = scoreStrictExperienceEntry(entry, line);
        if (confidence >= EXPERIENCE_PARSER_CONFIDENCE_MIN) {
          return { ...entry, confidence };
        }
      }
    }
  }

  const blob = lines.join('\n');
  const dates = extractDateRangeFromText(blob);
  if (!dates.startDate) {
    const y = blob.match(/\b((?:19|20)\d{2})\b/);
    if (y) dates.startDate = y[1];
  }
  let role = '';
  let company = '';
  const bullets = [];

  for (const line of lines) {
    if (isExperienceSectionHeader(line) || lineIsContactData(line) || lineIsEducationData(line)) {
      continue;
    }
    if (lineIsSkillOrTagOnly(line)) continue;
    if (BULLET_RE.test(line)) {
      if (lines.indexOf(line) > lines.indexOf(lines.find((ln) => DATE_RANGE_RE.test(ln) || /\b(19|20)\d{2}\b/.test(ln)) ?? '')) {
        bullets.push(line.replace(BULLET_RE, '').trim());
      }
      continue;
    }

    const lineDates = extractDateRangeFromText(line);
    const withoutDates = line.replace(DATE_RANGE_RE, '').replace(/\b(19|20)\d{2}\b/g, '').trim();
    if (!withoutDates && lineDates.startDate) continue;

    const parts = withoutDates.split(/\s*[-–—|@·]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const [a, b, ...rest] = parts;
      if (isSchoolEmploymentLine(line) && a && b) {
        if (!role) role = a;
        if (!company) company = b;
      }
      if (!role && lineLooksLikeRole(a)) role = a;
      if (!company && b && (lineLooksLikeEmployer(b) || (!lineLooksLikeRole(b) && !ROLE_MARKER_RE.test(b)))) {
        company = b;
      }
      if (!role && lineLooksLikeRole(b)) role = b;
      if (!company && lineLooksLikeEmployer(a)) company = a;
      if (!role && ROLE_MARKER_RE.test(a)) role = a;
      if (!company && b && !lineLooksLikeRole(b) && b.length >= 2 && b.length <= 48) company = b;
      if (!role && a && !lineLooksLikeEmployer(a)) role = a;
      void rest;
      continue;
    }

    if (lineLooksLikeEmployer(withoutDates) && !company) {
      company = withoutDates;
      continue;
    }
    if (lineLooksLikeRole(withoutDates) && !role) {
      role = withoutDates;
      continue;
    }
    if (/\bfreelanc/i.test(withoutDates) && !role) {
      role = withoutDates;
      if (!company) company = 'Independent / Freelance';
      continue;
    }
    if (withoutDates.length > 18 && !lineLooksLikeRole(withoutDates) && !lineLooksLikeEmployer(withoutDates)) {
      bullets.push(withoutDates);
    }
  }

  if (/\bfreelanc/i.test(blob) && !company) company = 'Independent / Freelance';

  const entry = normalizeStrictEntry(
    {
      role: role
        ? titleCaseProfessional(normalizeExperienceRole(role, blob).replace(/\s*·\s*$/, '').trim())
        : '',
      company: company.trim(),
      location: '',
      startDate: dates.startDate || '',
      endDate: dates.endDate || '',
      dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
      bullets: bullets.filter((b) => b.length > 8).slice(0, 5),
      clients: [],
    },
    blob
  );

  if (!qualifiesStrictExperience(entry, blob)) return null;
  const confidence = scoreStrictExperienceEntry(entry, blob);
  if (confidence < EXPERIENCE_PARSER_CONFIDENCE_MIN) return null;
  return { ...entry, confidence };
}

/**
 * @param {string[]} lines
 * @param {object} [opts]
 * @returns {{ experiences: object[], unclassified: string[] }}
 */
export function parseStrictExperiencesFromLines(lines, opts = {}) {
  const list = (lines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const source =
    opts.experienceSectionLines?.length > 0 ? opts.experienceSectionLines : list;

  const experiences = [];
  const unclassified = [];
  const seen = new Set();
  const used = new Set();

  const pushUnclassified = (line) => {
    const t = String(line || '').trim();
    if (!t || used.has(t)) return;
    if (lineIsContactData(t) || lineIsEducationData(t)) return;
    unclassified.push(t);
  };

  const pushEntry = (entry) => {
    if (!entry) return;
    const key = norm(`${entry.role}|${entry.company}|${entry.startDate}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const { confidence, ...rest } = entry;
    experiences.push(rest);
  };

  const skipLine = (line) =>
    isExperienceSectionHeader(line) ||
    lineIsContactData(line) ||
    lineIsEducationData(line) ||
    lineIsSkillOrTagOnly(line);

  const anchors = [];
  for (let i = 0; i < source.length; i++) {
    const line = source[i];
    if (skipLine(line)) {
      pushUnclassified(line);
      continue;
    }
    if (DATE_RANGE_RE.test(line) || (/\b(19|20)\d{2}\b/.test(line) && line.length < 48)) {
      anchors.push(i);
    }
  }

  const collectGroupForAnchor = (anchorIdx) => {
    const group = [];
    const anchorLine = source[anchorIdx];
    if (!anchorLine) return group;
    group.push(anchorLine);

    for (let i = anchorIdx - 1; i >= Math.max(0, anchorIdx - EXPERIENCE_NEARBY_LINE_RADIUS); i--) {
      const line = source[i];
      if (skipLine(line)) break;
      if (DATE_RANGE_RE.test(line) || (/\b(19|20)\d{2}\b/.test(line) && line.length < 48)) break;
      group.unshift(line);
    }

    for (let i = anchorIdx + 1; i <= Math.min(source.length - 1, anchorIdx + 2); i++) {
      const line = source[i];
      if (skipLine(line)) break;
      if (/\b(19|20)\d{2}\b/.test(line)) break;
      if (lineLooksLikeEmployer(line) && !lineLooksLikeRole(line)) break;
      group.push(line);
    }
    return group;
  };

  for (const idx of anchors) {
    const group = collectGroupForAnchor(idx);
    const entry = buildExperienceEntryFromLineGroup(group);
    if (entry) {
      pushEntry(entry);
      group.forEach((line) => used.add(line));
    } else {
      group.forEach(pushUnclassified);
    }
  }

  for (let i = 0; i < source.length; i++) {
    const line = source[i];
    if (used.has(line)) continue;

    const internship = parseInternshipLine(line, { nearbyLines: source });
    if (internship) {
      const entry = normalizeStrictEntry(
        { ...internship, clients: [], location: '' },
        line
      );
      const confidence = scoreStrictExperienceEntry(entry, line);
      if (
        qualifiesStrictExperience(entry, line) &&
        confidence >= EXPERIENCE_PARSER_CONFIDENCE_MIN
      ) {
        pushEntry({ ...entry, confidence });
        used.add(line);
        continue;
      }
      pushUnclassified(line);
      used.add(line);
      continue;
    }

    pushUnclassified(line);
    used.add(line);
  }

  return {
    experiences: experiences.slice(0, 12),
    unclassified: [...new Set(unclassified)].slice(0, 96),
  };
}

/**
 * Single-line gate aligned with strict parser (date + role or company).
 * @param {string} line
 */
export function passesStrictExperienceGate(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 6) return false;
  if (lineIsContactData(l) || lineIsEducationData(l) || lineIsSkillOrTagOnly(l)) return false;
  if (isExperienceSectionHeader(l)) return false;
  if (!lineHasDate(l)) return false;
  const dates = extractDateRangeFromText(l);
  const rest = l.replace(DATE_RANGE_RE, '').replace(/\b(19|20)\d{2}\b/g, '').trim();
  const entry = {
    role: lineLooksLikeRole(rest) ? rest : '',
    company: lineLooksLikeEmployer(rest) ? rest : '',
    startDate: dates.startDate,
    endDate: dates.endDate,
  };
  if (!entry.role && !entry.company) return false;
  return qualifiesStrictExperience(entry) && scoreStrictExperienceEntry(entry) >= EXPERIENCE_PARSER_CONFIDENCE_MIN;
}

/**
 * Drop non-strict experience rows; preserve text in unsorted (zero loss).
 * @param {object} structured
 */
export function sanitizeStrictExperiences(structured) {
  if (!structured) return structured;
  const kept = [];
  const orphanLines = [];
  for (const exp of structured.experiences || []) {
    const ctx = [exp?.role, exp?.company, exp?.dates, exp?.startDate, exp?.endDate]
      .filter(Boolean)
      .join(' — ');
    if (
      qualifiesStrictExperience(exp, ctx) &&
      scoreStrictExperienceEntry(exp, ctx) >= EXPERIENCE_PARSER_CONFIDENCE_MIN
    ) {
      kept.push(exp);
      continue;
    }
    if (exp?.role) orphanLines.push(String(exp.role));
    if (exp?.company) orphanLines.push(String(exp.company));
    for (const b of exp?.bullets || []) orphanLines.push(String(b));
  }
  structured.experiences = kept;
  if (orphanLines.length) {
    structured.unsorted = mergeUnsortedLines(structured.unsorted, orphanLines);
  }
  return structured;
}
