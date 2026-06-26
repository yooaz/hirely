/**
 * P0 — Person vs company (and related entity) disambiguation.
 * Company / school / client / skill must never populate candidate identity fields.
 */

import {
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  SCHOOL_TERMS,
  TOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { isLikelyTool } from './line-cleaner.js';
import { isStandaloneSkillDiscipline } from './suggestion-classification-fix.js';
import { resolveLineEntities } from './entity-engine.js';
import { EMAIL_RE, PHONE_RE, isValidTitleField } from './field-sanitize.js';
import { validatePhoneStrict } from './phone-normalize.js';
import { NAME_CONFIRM_LABEL } from '../display/identity-labels.js';
import { hasEducationSchool, hasEducationDegree } from './education-confidence.js';

export const PERSON_COMPANY_DISAMBIG_V1 = 'PERSON_COMPANY_DISAMBIGUATION_V1';

/** Canonical entity types detected before render. */
export const ENTITY_TYPE = Object.freeze({
  PERSON: 'person',
  COMPANY: 'company',
  SCHOOL: 'school',
  CLIENT: 'client',
  SKILL: 'skill',
  UNKNOWN: 'unknown',
});

const AGENCY_SUFFIX_RE =
  /\b(agency|agence|studios?|company|companies|group|inc|ltd|llc|gmbh|sarl|sas|holding|partners?|impressions?)\b/i;

const NAME_REJECT_BUSINESS_RE =
  /\b(agency|agencies|studio|studios|company|companies|group|groups|inc|ltd|llc|impressions?|creative|design|marketing|media|portfolio|freelance|freelancing|agence|groupe|sarl|sas|gmbh|holding|partners?)\b/i;

const COMPANY_CONFIDENCE_MIN = 68;
const NON_PERSON_NAME_CONFIDENCE_MIN = 68;

const PERSON_NAME_RE =
  /^[A-ZÀ-Ÿ][a-zà-ÿ'`-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ'`-]+){1,3}$/;

const IDENTITY_FIELD_ALIASES = Object.freeze({
  name: 'fullName',
  title: 'headline',
  email: 'email',
  phone: 'phone',
});

/**
 * @param {string} text
 */
export function looksLikeCompanyEntity(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (NAME_REJECT_BUSINESS_RE.test(s)) return true;
  if (AGENCY_SUFFIX_RE.test(s)) return true;
  if (/^jb\s+impressions?$/i.test(s)) return true;
  if (/^market\s+reviews?\)?$/i.test(s)) return true;
  const clientHit = findLongestDictionaryTerm(s, CLIENT_TERMS);
  if (clientHit && (AGENCY_SUFFIX_RE.test(s) || /\bimpressions?\b/i.test(s))) return true;
  return false;
}

/**
 * @param {string} text
 */
export function isCompanyEntity(text) {
  return looksLikeCompanyEntity(text);
}

/**
 * @param {string} text
 */
export function isClientEntity(text) {
  const s = String(text || '').trim();
  if (!s || isCompanyEntity(s)) return false;
  const hit = findLongestDictionaryTerm(s, CLIENT_TERMS);
  if (!hit) return false;
  const norm = s.toLowerCase();
  const term = hit.toLowerCase();
  return norm === term || norm.includes(term) || term.includes(norm);
}

/**
 * @param {string} text
 */
export function isSchoolEntity(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (findLongestDictionaryTerm(s, SCHOOL_TERMS)) return true;
  if (hasEducationSchool(s) || hasEducationDegree(s)) return true;
  if (/\b(école|ecole|school|university|college|institut|academy|lisaa|créapole|creapole|ensad|gobelins)\b/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * @param {string} text
 */
export function isSkillEntity(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (isLikelyTool(s)) return true;
  if (findLongestDictionaryTerm(s, TOOL_TERMS)) return true;
  if (isStandaloneSkillDiscipline(s)) return true;
  const resolved = resolveLineEntities(s);
  if (resolved?.entity === 'software' && resolved.confidence >= NON_PERSON_NAME_CONFIDENCE_MIN) {
    return true;
  }
  return false;
}

function looksLikePersonName(text) {
  const s = String(text || '').trim();
  if (!s || looksLikeCompanyEntity(s)) return false;
  if (EMAIL_RE.test(s) || PHONE_RE.test(s) || /\d/.test(s) || /@/.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return PERSON_NAME_RE.test(s);
}

function looksLikeJobTitle(text) {
  const s = String(text || '').trim();
  if (!s || looksLikeCompanyEntity(s)) return false;
  return lineLooksLikeRole(s) && isValidTitleField(s);
}

/**
 * Classify a text fragment before identity render.
 * @param {string} text
 * @param {{ experiences?: object[] }} [opts]
 * @returns {{ type: string, confidence: number, signals: string[] }}
 */
export function classifyEntityType(text, opts = {}) {
  const s = String(text || '').trim();
  if (!s) {
    return { type: ENTITY_TYPE.UNKNOWN, confidence: 0, signals: [] };
  }

  if (isCompanyEntity(s)) {
    return { type: ENTITY_TYPE.COMPANY, confidence: 92, signals: ['company_like', 'agency_or_org'] };
  }

  if (isSchoolEntity(s)) {
    return { type: ENTITY_TYPE.SCHOOL, confidence: 88, signals: ['school_match'] };
  }

  if (isClientEntity(s)) {
    return { type: ENTITY_TYPE.CLIENT, confidence: 86, signals: ['client_dict'] };
  }

  if (isSkillEntity(s)) {
    return { type: ENTITY_TYPE.SKILL, confidence: 84, signals: ['skill_or_tool'] };
  }

  if (looksLikePersonName(s) && !employerCollision(s, opts.experiences)) {
    return { type: ENTITY_TYPE.PERSON, confidence: 90, signals: ['person_name_pattern'] };
  }

  if (looksLikeJobTitle(s)) {
    return { type: ENTITY_TYPE.PERSON, confidence: 82, signals: ['job_title'] };
  }

  const resolved = resolveLineEntities(s);
  if (resolved?.entity && resolved.confidence >= NON_PERSON_NAME_CONFIDENCE_MIN) {
    const map = {
      school: ENTITY_TYPE.SCHOOL,
      degree: ENTITY_TYPE.SCHOOL,
      client: ENTITY_TYPE.CLIENT,
      software: ENTITY_TYPE.SKILL,
      language: ENTITY_TYPE.SKILL,
      role: ENTITY_TYPE.PERSON,
    };
    const mapped = map[resolved.entity] || ENTITY_TYPE.UNKNOWN;
    if (mapped !== ENTITY_TYPE.UNKNOWN) {
      return {
        type: mapped,
        confidence: resolved.confidence,
        signals: [`entity_engine:${resolved.entity}`],
      };
    }
  }

  return { type: ENTITY_TYPE.UNKNOWN, confidence: 35, signals: [] };
}

function employerCollision(name, experiences = []) {
  const n = String(name || '').trim().toLowerCase();
  if (!n || n.length < 3) return false;
  for (const exp of experiences || []) {
    const company = String(exp?.company || '').trim().toLowerCase();
    if (!company || company.length < 3) continue;
    if (company === n || n.includes(company) || company.includes(n)) return true;
  }
  return false;
}

/**
 * Company entities must never populate identity contact fields.
 * @param {string} entityType
 * @param {'name'|'title'|'email'|'phone'} field
 */
export function companyBlocksIdentityField(entityType, field) {
  if (entityType !== ENTITY_TYPE.COMPANY) return false;
  return field === 'name' || field === 'title' || field === 'email' || field === 'phone';
}

/**
 * Only person names may populate fullName.
 * @param {string} entityType
 */
export function nonPersonBlocksFullName(entityType) {
  return (
    entityType === ENTITY_TYPE.COMPANY ||
    entityType === ENTITY_TYPE.SCHOOL ||
    entityType === ENTITY_TYPE.CLIENT ||
    entityType === ENTITY_TYPE.SKILL
  );
}

/**
 * @param {string} value
 * @param {'name'|'title'|'email'|'phone'} field
 * @param {object} [opts]
 */
export function valueMayPopulateIdentityField(value, field, opts = {}) {
  const s = String(value || '').trim();
  if (!s) return true;

  if (field === 'email') {
    if (!EMAIL_RE.test(s)) {
      const classified = classifyEntityType(s, opts);
      return !companyBlocksIdentityField(classified.type, field);
    }
    return true;
  }

  if (field === 'phone') {
    const digits = s.replace(/\D/g, '');
    if (digits.length >= 8 && validatePhoneStrict(s)) return true;
    const classified = classifyEntityType(s, opts);
    return !companyBlocksIdentityField(classified.type, field);
  }

  const classified = classifyEntityType(s, opts);

  if (field === 'name') {
    if (nonPersonBlocksFullName(classified.type) && classified.confidence >= NON_PERSON_NAME_CONFIDENCE_MIN) {
      return false;
    }
    if (classified.type === ENTITY_TYPE.PERSON) return true;
    if (classified.type === ENTITY_TYPE.UNKNOWN && looksLikePersonName(s)) return true;
    return false;
  }

  if (field === 'title') {
    if (companyBlocksIdentityField(classified.type, field)) return false;
    if (nonPersonBlocksFullName(classified.type) && classified.confidence >= NON_PERSON_NAME_CONFIDENCE_MIN) {
      return false;
    }
    return looksLikeJobTitle(s);
  }

  return !companyBlocksIdentityField(classified.type, field);
}

/**
 * Strip company / org entities from identity before render.
 * @param {import('../resume-data.js').ResumeData} resumeData
 * @param {{ experiences?: object[], existingReviewItems?: object[] }} [opts]
 */
export function applyPersonCompanyDisambiguation(resumeData, opts = {}) {
  if (!resumeData || typeof resumeData !== 'object') {
    return { resumeData, stripped: {}, reviewItems: [], violations: [] };
  }

  const rd = { ...resumeData };
  const id = { ...(rd.identity || {}) };
  const experiences = rd.experiences || opts.experiences || [];
  const stripped = {};
  const violations = [];
  const reviewItems = [...(opts.existingReviewItems || rd.meta?.contactReviewItems || [])];

  const guardField = (field, confirmLabel = '') => {
    const val = String(id[field] || '').trim();
    if (!val) return;
    if (valueMayPopulateIdentityField(val, field, { experiences })) return;

    const classified = classifyEntityType(val, { experiences });
    stripped[field] = val;
    id[field] = confirmLabel || '';
    violations.push(`entity_${classified.type}_blocked:${IDENTITY_FIELD_ALIASES[field] || field}`);
    reviewItems.push({
      field: `identity.${field}`,
      detected: val,
      suggestion: field === 'name' ? 'Confirm your full name' : `Confirm ${field}`,
      reason: `${classified.type} cannot populate ${IDENTITY_FIELD_ALIASES[field] || field}`,
      action: 'edit',
      entityType: classified.type,
      confidence: classified.confidence,
    });
  };

  guardField('name', NAME_CONFIRM_LABEL);
  guardField('title');
  guardField('email');
  guardField('phone');

  rd.identity = id;
  if (violations.length) {
    rd.meta = {
      ...(rd.meta || {}),
      personCompanyDisambig: {
        version: PERSON_COMPANY_DISAMBIG_V1,
        strippedCount: violations.length,
        at: new Date().toISOString(),
      },
      contactReviewItems: reviewItems,
    };
  }

  return { resumeData: rd, stripped, reviewItems, violations };
}

/**
 * Quick check — reject as person name candidate.
 * @param {string} text
 * @param {object} [opts]
 */
export function rejectAsNonPersonEntity(text, opts = {}) {
  const classified = classifyEntityType(text, opts);
  if (classified.type === ENTITY_TYPE.COMPANY && classified.confidence >= COMPANY_CONFIDENCE_MIN) {
    return true;
  }
  if (nonPersonBlocksFullName(classified.type) && classified.confidence >= NON_PERSON_NAME_CONFIDENCE_MIN) {
    return true;
  }
  return false;
}
