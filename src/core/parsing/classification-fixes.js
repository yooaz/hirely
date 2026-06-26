/**
 * Classification fixes — career/skills/tools/education/contact routing (parser only).
 */

import { extractDateRangeFromText } from './parser-recovery.js';
import { isValidIdentityName } from './identity-extraction.js';
import { validateCvSectionItem } from './cv-section-contract.js';
import { extractPhoneCandidate, normalizeContactPhone, PHONE_DISPLAY_CONFIDENCE_MIN } from './phone-normalize.js';
import { normalizeEmail } from './line-cleaner.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { findBestEntity, SCHOOL_RECOGNIZER } from '../../data/dictionaries/entity-catalog.js';
import {
  qualifiesUrlMergedExperienceLine,
  hasCareerRoleCompanySignal,
  PERSON_NAME_SEGMENT_RE,
} from './ocr-classification-rules.js';
import {
  isSchoolEmploymentLine,
  isAcademicEmploymentContext,
  getEducationLineSignals,
} from './education-confidence.js';

const DEGREE_INLINE_RE =
  /\b(bachelor|master|mba|phd|b\.?a\.?|b\.?s\.?|licence|license|diploma|degree|baccalauréat|baccalaureat|doctorat|dnsep|bsc|ba|msc)\b/i;
const LOCATION_TOKEN_RE =
  /^(paris|london|berlin|new york|san francisco|los angeles|chicago|toronto|montreal|lyon|marseille|brussels|amsterdam|zurich|geneva|singapore|sydney|melbourne|tokyo|dubai|mumbai|bangalore|remote)$/i;

export const STRICT_SOFTWARE_RE =
  /\b(photoshop|illustrator|indesign|after\s+effects|procreate|figma|sketch|blender|premiere(?:\s+pro)?|adobe\s+creative\s+suite)\b/i;

export const CREATIVE_SKILL_RE =
  /\b(graphic\s+design|illustration|packaging|poster|logo|visual\s+identity|web\s+design|typography|art\s+direction|branding|vector|print\s+production)\b/i;

const AGE_PHRASE_RE = /\b\d{1,2}[-\s]?year\s*old\b/gi;
const AGE_PHRASE_NEEDLES = [' years old', ' year old', ' years-old', ' year-old'];
const YEAR_RANGE_RE = /\b(19|20)\d{2}\s*[-–—:]\s*((?:19|20)\d{2}|present|présent|current|now)\b/i;
const CAREER_ROLE_RE =
  /\b(freelanc(?:er|e)?|independent|self[- ]?employed|designer|illustrator|art\s+director|graphic)\b/i;
const PHONE_INLINE_RE =
  /(?:\+?(?:33|31|32|1|41|49|34|39|44|352|353|351|358|45|46|47|48|39)[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}|\+\d{1,3}[\s.-]?\d[\d\s().-]{6,16}\d/;

/**
 * @param {string} text
 * @returns {{ startDate: string, endDate: string }}
 */
function extractEducationDates(text) {
  const ranged = extractDateRangeFromText(text);
  if (ranged.startDate && ranged.endDate) return ranged;
  const twin = String(text || '').match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  if (twin) return { startDate: twin[1], endDate: twin[2] };
  if (ranged.startDate) return ranged;
  return { startDate: '', endDate: '' };
}

/**
 * @param {string} text
 * @returns {string}
 */
export function extractInlinePhone(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const direct = extractPhoneCandidate(raw);
  if (direct) {
    const norm = normalizeContactPhone(raw);
    if (norm.phone && norm.confidence >= PHONE_DISPLAY_CONFIDENCE_MIN && !/\b(19|20)\d{2}\b/.test(raw)) return norm.phone;
    if (direct && !isDateRangeLike(raw)) return direct;
  }
  return '';
}

function isDateRangeLike(text) {
  const t = String(text || '').trim();
  return (
    /^\d{4}\s+\d{4}$/.test(t) ||
    /^\d{1,4}\s+(?:19|20)\d{2}\s+(?:19|20)\d{2}$/.test(t) ||
    /\b(19|20)\d{2}\s*[-–—]\s*(\d{4}|present|présent|current|now)\b/i.test(t)
  );
}
const EMAIL_INLINE_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SCHOOL_MARKERS_RE =
  /\b(lisaa|créapole|creapole|école|ecole|school|university|université|college|institute|academy|bachelor|master|mba|degree|formation|diploma|gobelins|ensad|ecv|penninghen|b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|ph\.?\s*d\.?)\b/i;

const DEGREE_MARKERS_RE =
  /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|m\.?\s*b\.?\s*a\.?|mba|ph\.?\s*d\.?|bachelor|master|diploma|licence|license)\b/i;

/** Repair common OCR year corruption (20M, 20N). */
export function repairEducationOcrDates(line) {
  return String(line || '')
    .replace(/\b20M\b/gi, '2010')
    .replace(/\b20N\b/gi, '2010')
    .trim();
}

/** @param {string} line */
export function repairOcrYearTokens(line) {
  return repairEducationOcrDates(line);
}

/** Collapse whitespace without RegExp — safe in browser shallow stacks. */
export function collapseWhitespace(text, maxLen = 520) {
  let out = '';
  let prevWs = false;
  const s = String(text || '');
  for (let i = 0; i < s.length && out.length < maxLen; i++) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (!prevWs && out.length) {
        out += ' ';
        prevWs = true;
      }
    } else {
      out += ch;
      prevWs = false;
    }
  }
  return out.trim();
}

/** @param {string} text */
export function stripAgePhrase(text) {
  let s = String(text || '').slice(0, 480);
  if (!s) return '';

  /** Index scan — avoids V8 global-regex replace stack blow-up in browser. */
  let low = s.toLowerCase();
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const needle of AGE_PHRASE_NEEDLES) {
      let idx = low.indexOf(needle);
      while (idx !== -1) {
        let start = idx;
        let scan = 0;
        while (start > 0 && scan < 4 && /[\d\s-]/.test(s[start - 1])) {
          start--;
          scan++;
        }
        s = `${s.slice(0, start)} ${s.slice(idx + needle.length)}`;
        low = s.toLowerCase();
        changed = true;
        idx = low.indexOf(needle, start);
      }
    }
    if (!changed) break;
  }

  return collapseWhitespace(s);
}

/** @param {string} line */
export function isCareerSentence(line) {
  const l = String(line || '').trim();
  if (l.length < 36) return false;
  if (!YEAR_RANGE_RE.test(l) && !/\b(19|20)\d{2}\b/.test(l)) return false;
  return CAREER_ROLE_RE.test(l);
}

/** @param {string} line */
export function isLikelyFreelanceCareerLine(line) {
  const l = stripAgePhrase(String(line || '').trim());
  if (!YEAR_RANGE_RE.test(l) && !/\b(19|20)\d{2}\b/.test(l)) return false;
  return /\b(freelanc|independent|self[- ]?employed)\b/i.test(l);
}

/**
 * Parse Role — Company — Location — Dates (em-dash / pipe separated).
 * @param {string} line
 * @param {object} [opts]
 */
export function parseDashSeparatedExperienceLine(line, opts = {}) {
  const l = stripAgePhrase(String(line || '').trim());
  if (!l || l.length < 12) return null;

  const dates = extractDateRangeFromText(l);
  if (!dates.startDate) return null;

  if (!isSchoolEmploymentLine(l)) {
    const edu = getEducationLineSignals(l);
    if (edu.isEducationLine && DEGREE_INLINE_RE.test(l) && !isAcademicEmploymentContext(l)) {
      return null;
    }
    if (SCHOOL_MARKERS_RE.test(l) && DEGREE_INLINE_RE.test(l) && !isAcademicEmploymentContext(l)) {
      return null;
    }
  }

  let rest = l
    .replace(YEAR_RANGE_RE, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = rest
    .split(/\s*[-–—|·]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  if (parts.length < 2) return null;

  let role = parts[0];
  let company = parts[1];
  let location = '';

  if (parts.length >= 3) {
    const third = parts[2];
    if (LOCATION_TOKEN_RE.test(third) || (third.length <= 32 && !ORG_HINT_RE.test(third))) {
      location = third;
    } else if (!company || company.length < 3) {
      company = third;
    }
  }

  if (/^(19|20)\d{2}$/.test(role) || /^internship$/i.test(role)) return null;

  if (/\b(independent|freelance|self[- ]?employed)\b/i.test(company)) {
    company = 'Independent';
  }
  if (/\bfreelanc/i.test(l) && /\bindependent\b/i.test(rest)) {
    company = 'Independent';
  }

  const dateLabel = dates.endDate
    ? `${dates.startDate}–${dates.endDate}`
    : /\bpresent|présent|current|now\b/i.test(l)
      ? `${dates.startDate}–Present`
      : dates.startDate;

  const confidence =
    70 +
    (role.length > 4 ? 10 : 0) +
    (company.length > 2 ? 10 : 0) +
    (dates.endDate ? 4 : 0);

  return {
    role: role.slice(0, 120),
    company: company.slice(0, 80),
    location: location.slice(0, 48),
    startDate: dates.startDate,
    endDate: dates.endDate || (/\bpresent|présent|current|now\b/i.test(l) ? 'Present' : ''),
    dates: dateLabel,
    bullets: [],
    confidence: Math.min(96, confidence),
  };
}

const ORG_HINT_RE =
  /\b(inc|ltd|llc|gmbh|corp|corporation|university|college|école|ecole|school|agency|studio|group)\b/i;

/** @param {string} line */
export function isStrictSoftwareLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 3) return false;
  if (isCareerSentence(l)) return false;
  if (isClientListLine(l)) return false;
  if (SCHOOL_MARKERS_RE.test(l)) return false;
  if (AGE_PHRASE_RE.test(l)) return false;
  if (l.length > 72 && !STRICT_SOFTWARE_RE.test(l)) return false;
  return STRICT_SOFTWARE_RE.test(l);
}

/** @param {string} line */
export function isClientListLine(line) {
  const l = String(line || '').trim();
  if (!l.includes(',')) return false;
  const parts = l.split(/[,;]/).map((p) => p.trim()).filter((p) => p.length > 2);
  return parts.length >= 2 && l.length < 160;
}

/** @param {string} line */
export function isCreativeSkillPhrase(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 120) return false;
  if (isCareerSentence(l) || isClientListLine(l)) return false;
  if (SCHOOL_MARKERS_RE.test(l) && /\b(19|20)\d{2}\b/.test(l)) return false;
  return CREATIVE_SKILL_RE.test(l);
}

/**
 * @param {string} line
 * @returns {{ role: string, company: string, startDate: string, endDate: string, dates: string, bullets: string[] }|null}
 */
/**
 * Repair OCR-merged URL + name + dates lines (generic: URL/domain + separators + year range).
 * @param {string} line
 * @returns {{ role: string, company: string, startDate: string, endDate: string, dates: string, bullets: string[], recoveredName?: string }|null}
 */
export function parseUrlMergedExperienceLine(line) {
  const raw = String(line || '').trim();
  if (!qualifiesUrlMergedExperienceLine(raw)) return null;

  const dates = extractDateRangeFromText(raw);
  if (!dates.startDate) return null;

  let recoveredName = '';
  const parts = raw.replace(/^[\s+]+/, '').split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const cleaned = part.replace(/[.+]+/g, ' ').replace(/\s+/g, ' ').trim();
    const caps = cleaned.match(PERSON_NAME_SEGMENT_RE);
    if (caps) {
      const candidate = `${caps[1]} ${caps[2].charAt(0)}${caps[2].slice(1).toLowerCase()}`;
      if (isValidIdentityName(candidate)) {
        recoveredName = candidate;
        break;
      }
    }
    if (isValidIdentityName(cleaned)) {
      recoveredName = cleaned;
      break;
    }
  }

  let role = 'Freelance Professional';
  if (/\bgraphic\b/i.test(raw) && /\billustrator\b/i.test(raw)) {
    role = 'Freelance Illustrator / Graphic Designer';
  } else if (/\bgraphic\b/i.test(raw)) {
    role = 'Freelance Graphic Designer';
  } else if (/\billustrator\b/i.test(raw)) {
    role = 'Freelance Illustrator';
  } else if (/\bdesigner\b/i.test(raw)) {
    role = 'Freelance Designer';
  } else if (!hasCareerRoleCompanySignal(raw)) {
    role = 'Freelance Creative Professional';
  }

  const dateLabel = dates.endDate
    ? `${dates.startDate}–${dates.endDate}`
    : `${dates.startDate}–Present`;

  return {
    role,
    company: 'Independent / Freelance',
    startDate: dates.startDate,
    endDate: dates.endDate || 'Present',
    dates: dateLabel,
    bullets: [],
    recoveredName,
  };
}

export function parseFreelanceCareerLine(line) {
  const l = stripAgePhrase(String(line || '').trim());
  if (!isLikelyFreelanceCareerLine(l)) return null;

  const dash = parseDashSeparatedExperienceLine(l);
  if (dash) {
    return {
      ...dash,
      company: dash.company || 'Independent',
      bullets: dash.bullets || [],
    };
  }

  const dates = extractDateRangeFromText(l);
  if (!dates.startDate) return null;

  const afterDates = l.replace(
    /\b(19|20)\d{2}\s*[-–—:]\s*((?:19|20)\d{2}|present|présent|current|now)\b/gi,
    ' '
  );
  const parts = afterDates.split(':').map((p) => p.trim()).filter(Boolean);

  let role = '';
  let description = '';

  if (parts.length >= 1) {
    const roleChunk = parts.find((p) => CAREER_ROLE_RE.test(p)) || parts[0];
    const descChunk = parts[parts.length - 1];
    if (roleChunk) {
      role = roleChunk.replace(/\s+/g, ' ').trim();
      if (/\bfreelanc/i.test(l) && role && !/\bfreelanc/i.test(role)) {
        role = `Freelance ${role.replace(/^freelance\s+/i, '')}`.trim();
      }
    }
    if (descChunk && descChunk !== roleChunk && descChunk.length > 3) {
      description = descChunk.replace(/^[,.\s]+/, '').slice(0, 240);
    }
  }

  if (!role || role.length < 3) {
    role = afterDates.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  if (!role) role = 'Freelance';

  const dateLabel = dates.endDate
    ? `${dates.startDate}–${dates.endDate}`
    : `${dates.startDate}–Present`;

  return {
    role: role.slice(0, 120),
    company: 'Independent / Freelance',
    startDate: dates.startDate,
    endDate: dates.endDate || 'Present',
    dates: dateLabel,
    bullets: description ? [description] : [],
  };
}

/**
 * @param {string} line
 * @returns {{ phone?: string, email?: string, education?: string }|null}
 */
export function parseEducationLineWithContact(line) {
  const raw = repairEducationOcrDates(String(line || '').trim());
  if (!raw || !SCHOOL_MARKERS_RE.test(raw)) return null;

  let phone = '';
  let email = '';
  let rest = raw;

  phone = extractInlinePhone(rest);
  if (phone) {
    rest = rest.replace(phone, ' ').replace(/\+\d{2,3}[\d\s().-]{8,}/, ' ').trim();
  }

  const emailMatch = rest.match(EMAIL_INLINE_RE);
  if (emailMatch) {
    email = normalizeEmail(emailMatch[0]);
    rest = rest.replace(emailMatch[0], ' ').trim();
  }

  const dates = extractEducationDates(rest);
  let school =
    findBestEntity(rest, SCHOOL_RECOGNIZER)?.canonical ||
    findLongestDictionaryTerm(rest, SCHOOL_TERMS) ||
    '';
  if (!school) {
    const lead = rest.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean)[0] || '';
    if (
      lead &&
      lead.length >= 2 &&
      lead.length <= 56 &&
      /\b(19|20)\d{2}\b/.test(rest) &&
      (DEGREE_MARKERS_RE.test(rest) || SCHOOL_MARKERS_RE.test(rest))
    ) {
      school = lead;
    }
  }

  let program = rest
    .replace(PHONE_INLINE_RE, '')
    .replace(EMAIL_INLINE_RE, '')
    .replace(/\(\s*(?:19|20)\d{2}\s*[–—-]\s*(?:19|20)\d{2}\s*\)/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ');
  if (school) {
    program = program.replace(new RegExp(school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  program = program
    .replace(/^[\s:,\-–—()]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (program.startsWith(',')) program = program.slice(1).trim();
  if (program.length > 4) {
    program = program.charAt(0).toUpperCase() + program.slice(1);
  } else {
    program = '';
  }

  const dateLabel =
    dates.startDate && dates.endDate
      ? `${dates.startDate}–${dates.endDate}`
      : dates.startDate || '';

  let education = '';
  if (school && program) education = `${school} — ${program}`;
  else if (school) education = school;
  else if (program) education = program;
  if (dateLabel && education) education = `${education} — ${dateLabel}`;
  else if (dateLabel) education = dateLabel;

  if (!education || education.length < 4) return phone || email ? { phone, email } : null;

  return { phone, email, education: education.slice(0, 200) };
}

/**
 * @param {string} line
 * @returns {{ role: string, company: string, startDate: string, endDate: string, dates: string, bullets: string[] }|null}
 */
export function parseInternshipLine(line, opts = {}) {
  const l = String(line || '').trim();
  const hasIntern = /\b(internship|intern|stage|stagiaire)\b/i.test(l);
  if (!hasIntern) return null;
  if (/\b(seeking|looking for|searching for|student|interest in|passionate|motivated|final[- ]year)\b/i.test(l)) {
    return null;
  }
  if (l.length > 96 && !/\s[-–—|]\s/.test(l)) return null;
  if (/^(profil!?|profile|résumé|resume|summary)\b/i.test(l)) return null;

  const nearby = (opts.nearbyLines || []).join(' ');
  const repaired = repairEducationOcrDates(l);
  if (!repaired) return null;

  const dash = parseDashSeparatedExperienceLine(repaired);
  if (dash) {
    if (!dash.company || /^internship$/i.test(dash.company) || /^internship$/i.test(dash.role)) return null;
    return {
      ...dash,
      confidence: Math.max(dash.confidence || 74, 74),
      bullets: dash.bullets || [],
    };
  }

  let dates = extractDateRangeFromText(repaired);
  const yearLead = repaired.match(/^\s*((?:19|20)\d{2})\s*[:—-]/);
  if (yearLead && !dates.startDate) {
    dates = { startDate: yearLead[1], endDate: yearLead[1], hasPresent: false };
  }
  if (dates.startDate && !dates.endDate) {
    dates = { ...dates, endDate: dates.startDate };
  }
  if (!dates.startDate) return null;

  const colon = repaired.indexOf(':');
  const tail = colon >= 0 ? repaired.slice(colon + 1).trim() : repaired;
  const company = tail.replace(/\s*\((internship|intern|stage)\)\s*$/i, '').trim().slice(0, 80);
  if (!company || company.length < 3) return null;
  if (/^internship$/i.test(company)) return null;
  if (company.length > 48 && /\b(student|seeking|interest)\b/i.test(company)) return null;

  const roleMatch = repaired.match(/\b(lead\s+)?(illustrator|graphic\s+designer|visual\s+designer|designer)\b/i);
  const role = roleMatch ? roleMatch[0].replace(/\s+/g, ' ').trim() : 'Internship';
  if (/^internship$/i.test(role) && !/mccann|agency|agenc|publicis|havas|betc|ddb/i.test(company)) return null;

  const dateLabel = dates.endDate && dates.endDate !== dates.startDate
    ? `${dates.startDate}–${dates.endDate}`
    : String(dates.startDate);

  return {
    role,
    company,
    startDate: dates.startDate,
    endDate: dates.endDate || dates.startDate,
    dates: dateLabel,
    bullets: [],
    confidence: 74,
  };
}

export const AUTO_ACCEPT_MIN_CONFIDENCE = 85;

const SAFE_AUTO_TARGETS = new Set([
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'contact',
]);

/**
 * @param {string} target
 * @param {string} value
 */
export function isSafeAutoAccept(target, value) {
  if (!SAFE_AUTO_TARGETS.has(target)) return false;
  const factType =
    target === 'clients' ? 'client' : target === 'tools' ? 'tool' : target === 'skills' ? 'skill' : target;
  if (target === 'contact') return true;
  if (target === 'experience') return !!parseFreelanceCareerLine(value) || !!parseInternshipLine(value);
  const check = validateCvSectionItem(factType, value);
  return check.valid;
}
