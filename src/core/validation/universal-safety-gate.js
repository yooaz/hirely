/**
 * UNIVERSAL_SAFETY_GATE — validate resumeData before render/export.
 * Never invent fields; invalid content → placeholders or unsorted (À classer).
 */

import { validatePhone } from '../parsing/rich-parser.js';
import { isStrictLanguageEntry } from '../parsing/strict-language-extraction.js';
import { isValidIdentityName, isValidIdentityTitle } from '../parsing/identity-extraction.js';
import {
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
} from '../parsing/parser-recovery.js';
import {
  lineIsEducationData,
  lineIsSkillOrTagOnly,
  qualifiesStrictExperience,
} from '../parsing/experience-parser.js';
import {
  mustNeverBeExperience,
  hasEducationSchool,
  isAcademicEmploymentContext,
} from '../parsing/education-confidence.js';
import { isValidEducationItem } from '../parsing/field-sanitize.js';
import { extractDateRangeFromText } from '../parsing/parser-recovery.js';
import { parseUrlMergedExperienceLine } from '../parsing/classification-fixes.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { CLIENT_ANCHOR_TARGETS } from '../parsing/client-detection-engine.js';

export const UNIVERSAL_SAFETY_GATE = 'UNIVERSAL_SAFETY_GATE';

const AGE_AS_ROLE_RE = /\b\d{1,2}[-\s]?year\s*old\b|\byear\s*old\b/i;
const INVALID_TAG_RE =
  /^(ben|music|reading|typography|branding|illustration|vector|print|logo|product design|video game|créapole|creapole|graphic design|illustrator)$/i;
const GARBAGE_FRAGMENT_RE =
  /\b(graphic designer\s*\d+\s*illustrator|product design,?\s*video game|print\s*logo|vector\s*art|nature\s*music|reading\s*nature)\b/i;
const FAKE_PHONE_DATE_RE =
  /^\s*(?:\d{4}\s+\d{4}|\d{4}\s*[-–—]\s*\d{4}|\b(?:19|20)\d{2}\s*[-–—]\s*(?:\d{4}|present|présent|current|now|actuel))\s*$/i;
const EDUCATION_SIGNAL_RE =
  /\b(university|école|ecole|school|bachelor|master|mba|diploma|licence|lisaa|créapole|creapole|degree|b\.?sc|m\.?sc|phd|doctorat)\b/i;

const LANGUAGE_RE =
  /\b(french|english|spanish|german|dutch|italian|portuguese|arabic|français|anglais|espagnol|allemand|néerlandais|italien|portugais|arabe|native|fluent|bilingual|courant|bilingue|natif|maternelle)\b/i;

const TOOL_RE =
  /\b(photoshop|illustrator|indesign|figma|after effects|procreate|blender|premiere|lightroom|sketch|xd|affinity|cinema\s*4d)\b/i;

const CLIENT_RE =
  /\b(nike|adobe|marvel|cadillac|pantone|arte|converse|louis vuitton|fortune|playstation|lvmh|chanel|hermès|gucci|apple|google|netflix|spotify)\b/i;

const SKILL_DOMAIN_RE =
  /\b(illustration|graphic design|branding|packaging|typography|visual identity|identité visuelle|web design|art direction|direction artistique|design)\b/i;

const OCR_GARBAGE_LINE_RE =
  /\b(incision|wustrator|snoutors|illusthatch|graphic designer\s*\d+\s*illustrator|video game technologie marketing)\b/i;

const INVALID_LANGUAGE_CONTENT_RE =
  /\b(video\s*game|game\s*design|marketing\s*stud(?:y|ies)|technologie\s*marketing|product\s*design\s*,?\s*video)\b/i;

const PHONE_EDU_MIX_RE =
  /\+\d{1,3}[\d\s().-]{6,}.*\b(?:(?:19|20)\d{2}|lisaa|créapole|creapole|school|university|bachelor|master|diploma|école|ecole)\b/i;

const PROJECT_NOISE_RE =
  /\b(side\s*project|personal\s*project|class\s*project|student\s*work|school\s*project|demo\s*reel|exercise)\b/i;

const COMPANY_LIKE_RE =
  /\b(arte|mccann|ogilvy|publicis|wpp|ddb|bbdo|havas|saatchi)\b/i;

const KEYWORD_NAME_RE =
  /print\s*logo|vector\s*art|illusthatch|nature\s*music|reading\s*nature|art\s*reading/i;

function pushUnsorted(list, line) {
  const t = String(line || '').trim();
  if (!t || t.length < 2) return list;
  const k = t.toLowerCase();
  if (list.some((x) => String(x).trim().toLowerCase() === k)) return list;
  return [...list, t];
}

function experienceHasDate(exp) {
  const start = String(exp?.startDate || '').trim();
  if (start.length >= 4) return true;
  const dates = String(exp?.dates || '').trim();
  if (extractDateRangeFromText(dates).startDate) return true;
  const role = String(exp?.role || '').trim();
  return /\b(19|20)\d{2}\b/.test(`${start} ${dates} ${role}`);
}

function isValidSafetyExperience(exp) {
  const role = String(exp?.role || '').trim();
  const company = String(exp?.company || '').trim();
  const contextLine = [role, company, exp?.dates, exp?.startDate, exp?.endDate]
    .filter(Boolean)
    .join(' — ');
  const academicEmployment = isAcademicEmploymentContext(contextLine, { role, company });
  if (!experienceHasDate(exp)) return false;
  if (!role && !company) return false;

  if (role) {
    if (AGE_AS_ROLE_RE.test(role)) return false;
    if (INVALID_TAG_RE.test(role.toLowerCase()) && !(company && experienceHasDate(exp))) return false;
    if (lineIsSkillOrTagOnly(role)) return false;
    if (!academicEmployment && (lineIsEducationData(role) || mustNeverBeExperience(role))) return false;
  }
  if (company) {
    if (INVALID_TAG_RE.test(company.toLowerCase())) return false;
    if (lineIsSkillOrTagOnly(company)) return false;
    if (
      !academicEmployment &&
      (lineIsEducationData(company) || mustNeverBeExperience(company) || hasEducationSchool(company))
    ) {
      return false;
    }
  }

  const startDate =
    String(exp?.startDate || '').trim() || extractDateRangeFromText(String(exp?.dates || '')).startDate || '';
  return qualifiesStrictExperience(
    { role, company, startDate, endDate: exp?.endDate || '' },
    contextLine
  );
}

function isValidSafetyEducation(item) {
  const s = String(item || '').trim();
  if (!s || !isValidEducationItem(s)) return false;
  if (lineIsSkillOrTagOnly(s) && !EDUCATION_SIGNAL_RE.test(s)) return false;
  if (lineIsEducationData(s) || hasEducationSchool(s) || EDUCATION_SIGNAL_RE.test(s)) return true;
  if (/\s*[—–-]\s*/.test(s) && (hasEducationSchool(s) || EDUCATION_SIGNAL_RE.test(s))) return true;
  return false;
}

function isFakePhone(phone) {
  const p = String(phone || '').trim();
  if (!p) return false;
  if (FAKE_PHONE_DATE_RE.test(p)) return true;
  if (PHONE_EDU_MIX_RE.test(p)) return true;
  if (/\+\d/.test(p) && EDUCATION_SIGNAL_RE.test(p)) return true;
  if (/^\s*\d{4}\s+\d{4}\s*$/.test(p)) return true;
  if (!validatePhone(p)) return true;
  const digits = p.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return true;
  if (/^(19|20)\d{2}(19|20)?\d{2}$/.test(digits)) return true;
  return false;
}

function isKeywordClusterName(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (INVALID_TAG_RE.test(s)) return true;
  if (GARBAGE_FRAGMENT_RE.test(s)) return true;
  if (KEYWORD_NAME_RE.test(s)) return true;
  if (lineIsSkillOrTagOnly(s)) return true;
  if (s.includes(',') && s.split(/\s+/).length >= 3) return true;
  if (/^\bBen\b$/i.test(s)) return true;
  return !isValidIdentityName(s);
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 * @param {object} [opts]
 * @returns {import('../resume-data.js').ResumeData}
 */
export function applyUniversalSafetyGate(resumeData, opts = {}) {
  const silent = opts.silent === true;
  const rd = {
    ...(resumeData || {}),
    identity: { ...(resumeData?.identity || {}) },
    experiences: Array.isArray(resumeData?.experiences) ? [...resumeData.experiences] : [],
    education: Array.isArray(resumeData?.education) ? [...resumeData.education] : [],
    skills: Array.isArray(resumeData?.skills) ? [...resumeData.skills] : [],
    tools: Array.isArray(resumeData?.tools) ? [...resumeData.tools] : [],
    languages: Array.isArray(resumeData?.languages) ? [...resumeData.languages] : [],
    clients: Array.isArray(resumeData?.clients) ? [...resumeData.clients] : [],
    projects: Array.isArray(resumeData?.projects) ? [...resumeData.projects] : [],
    unsorted: Array.isArray(resumeData?.unsorted) ? [...resumeData.unsorted] : [],
    meta: { ...(resumeData?.meta || {}) },
  };

  const log = (event, detail) => {
    if (!silent) hirelyDebugLog(event, detail);
  };

  const originalName = String(rd.identity.name || '').trim();
  const bridgeApplied = rd.meta?.blockParserBridgeApplied === true;
  if (
    !bridgeApplied &&
    (!originalName || isKeywordClusterName(originalName))
  ) {
    if (originalName && originalName !== NAME_UNCERTAIN_LABEL) {
      log('SAFETY_GATE_FIXED_NAME', { from: originalName.slice(0, 80), to: NAME_UNCERTAIN_LABEL });
      rd.unsorted = pushUnsorted(rd.unsorted, originalName);
    }
    rd.identity.name = NAME_UNCERTAIN_LABEL;
  } else if (bridgeApplied && originalName && isKeywordClusterName(originalName)) {
    log('SAFETY_GATE_FIXED_NAME', { from: originalName.slice(0, 80), to: NAME_UNCERTAIN_LABEL });
    rd.unsorted = pushUnsorted(rd.unsorted, originalName);
    rd.identity.name = NAME_UNCERTAIN_LABEL;
  }

  const originalTitle = String(rd.identity.title || '').trim();
  if (
    !bridgeApplied &&
    (!originalTitle || !isValidIdentityTitle(originalTitle))
  ) {
    if (originalTitle && originalTitle !== TITLE_UNCERTAIN_LABEL) {
      log('SAFETY_GATE_FIXED_TITLE', { from: originalTitle.slice(0, 80), to: TITLE_UNCERTAIN_LABEL });
      rd.unsorted = pushUnsorted(rd.unsorted, originalTitle);
    }
    rd.identity.title = TITLE_UNCERTAIN_LABEL;
  } else if (bridgeApplied && originalTitle && !isValidIdentityTitle(originalTitle)) {
    log('SAFETY_GATE_FIXED_TITLE', { from: originalTitle.slice(0, 80), to: TITLE_UNCERTAIN_LABEL });
    rd.unsorted = pushUnsorted(rd.unsorted, originalTitle);
    rd.identity.title = TITLE_UNCERTAIN_LABEL;
  }

  const originalPhone = String(rd.identity.phone || '').trim();
  if (originalPhone && isFakePhone(originalPhone)) {
    log('SAFETY_GATE_REMOVED_FAKE_PHONE', { from: originalPhone.slice(0, 40) });
    rd.unsorted = pushUnsorted(rd.unsorted, originalPhone);
    rd.identity.phone = '';
  }

  const keptExperiences = [];
  for (const exp of rd.experiences) {
    const merged = parseUrlMergedExperienceLine(String(exp?.role || '').trim());
    const candidate = merged
      ? {
          ...exp,
          role: merged.role,
          company: merged.company,
          startDate: merged.startDate,
          endDate: merged.endDate,
          dates: merged.dates,
          bullets: exp?.bullets?.length ? exp.bullets : merged.bullets || [],
        }
      : exp;
    if (isValidSafetyExperience(candidate)) {
      keptExperiences.push(candidate);
      continue;
    }
    const parts = [
      exp?.role,
      exp?.company,
      exp?.dates,
      exp?.startDate && exp?.endDate ? `${exp.startDate}–${exp.endDate}` : exp?.startDate,
      ...(exp?.bullets || []),
    ].filter(Boolean);
    log('SAFETY_GATE_MOVED_EXPERIENCE_TO_UNSORTED', {
      reason: !experienceHasDate(exp)
        ? 'missing_date'
        : lineIsSkillOrTagOnly(exp?.role)
          ? 'skill_as_role'
          : lineIsEducationData(exp?.company)
            ? 'school_as_company'
            : 'invalid_experience',
      preview: parts.join(' | ').slice(0, 96),
    });
    for (const part of parts) rd.unsorted = pushUnsorted(rd.unsorted, part);
  }
  rd.experiences = keptExperiences;

  const keptEducation = [];
  for (const item of rd.education) {
    if (isValidSafetyEducation(item)) {
      keptEducation.push(item);
      continue;
    }
    rd.unsorted = pushUnsorted(rd.unsorted, item);
  }
  rd.education = keptEducation;

  const routeList = (list, validator) => {
    const kept = [];
    for (const item of list) {
      const s = String(item || '').trim();
      if (!s || OCR_GARBAGE_LINE_RE.test(s)) {
        if (s) rd.unsorted = pushUnsorted(rd.unsorted, s);
        continue;
      }
      if (validator(s)) kept.push(s);
      else rd.unsorted = pushUnsorted(rd.unsorted, s);
    }
    return kept;
  };

  const isValidLanguage = (s) => {
    if (INVALID_LANGUAGE_CONTENT_RE.test(s)) return false;
    if (EDUCATION_SIGNAL_RE.test(s) && !LANGUAGE_RE.test(s)) return false;
    if (!LANGUAGE_RE.test(s) || SKILL_DOMAIN_RE.test(s) || TOOL_RE.test(s)) return false;
    return isStrictLanguageEntry(s);
  };
  const isValidTool = (s) => TOOL_RE.test(s) || /\b(software|suite|cc|creative cloud|adobe)\b/i.test(s);
  const isValidClient = (s) => {
    if (CLIENT_ANCHOR_TARGETS.some((a) => a.toLowerCase() === s.toLowerCase())) return true;
    if (OCR_GARBAGE_LINE_RE.test(s) || GARBAGE_FRAGMENT_RE.test(s)) return false;
    if (lineIsSkillOrTagOnly(s) || INVALID_TAG_RE.test(s)) return false;
    if (SKILL_DOMAIN_RE.test(s) && !CLIENT_RE.test(s) && !COMPANY_LIKE_RE.test(s)) return false;
    if (LANGUAGE_RE.test(s) && !CLIENT_RE.test(s)) return false;
    if (CLIENT_RE.test(s) || COMPANY_LIKE_RE.test(s)) return true;
    if (/\b(inc|ltd|llc|gmbh|s\.?a\.?|agency|studio|group)\b/i.test(s) && s.length >= 4) return true;
    return false;
  };
  const isValidProject = (s) => {
    if (OCR_GARBAGE_LINE_RE.test(s) || PROJECT_NOISE_RE.test(s)) return false;
    if (EDUCATION_SIGNAL_RE.test(s) || lineIsSkillOrTagOnly(s)) return false;
    return s.length >= 6 && (CLIENT_RE.test(s) || COMPANY_LIKE_RE.test(s) || /\b(project|campaign|brand)\b/i.test(s));
  };
  rd.languages = routeList(rd.languages, isValidLanguage);
  rd.tools = routeList(rd.tools, isValidTool);
  rd.clients = routeList(rd.clients, isValidClient);
  rd.projects = routeList(rd.projects || [], isValidProject);
  rd.skills = routeList(rd.skills, (s) => {
    if (LANGUAGE_RE.test(s) && !SKILL_DOMAIN_RE.test(s)) return false;
    if (TOOL_RE.test(s) && !SKILL_DOMAIN_RE.test(s)) return false;
    if (CLIENT_RE.test(s) && !SKILL_DOMAIN_RE.test(s)) return false;
    if (GARBAGE_FRAGMENT_RE.test(s) || OCR_GARBAGE_LINE_RE.test(s)) return false;
    return SKILL_DOMAIN_RE.test(s) || (!lineIsSkillOrTagOnly(s) && s.length >= 4);
  });

  rd.meta.safetyGate = UNIVERSAL_SAFETY_GATE;
  rd.meta.safetyGateAt = new Date().toISOString();
  return rd;
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 */
export function assertUniversalSafetyGate(resumeData) {
  const rd = resumeData || {};
  const id = rd.identity || {};
  const failures = [];

  if (id.name && id.name !== NAME_UNCERTAIN_LABEL && isKeywordClusterName(id.name)) {
    failures.push('fake_name');
  }
  if (id.phone && isFakePhone(id.phone)) failures.push('date_as_phone');
  for (const exp of rd.experiences || []) {
    if (!isValidSafetyExperience(exp)) failures.push('invalid_experience');
    if (lineIsSkillOrTagOnly(exp?.role)) failures.push('skill_as_experience');
    const ctx = [exp?.role, exp?.company, exp?.dates].filter(Boolean).join(' — ');
    if (
      !isAcademicEmploymentContext(ctx, exp) &&
      (lineIsEducationData(exp?.company) || hasEducationSchool(exp?.company))
    ) {
      failures.push('school_as_company');
    }
  }

  return { ok: failures.length === 0, failures };
}
