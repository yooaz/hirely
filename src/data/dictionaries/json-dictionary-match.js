/**
 * Dictionary-assisted classification via entity recognition (schools, clients, software, languages, socials).
 */

import {
  schoolsData,
  clientsData,
  creativeClientsData,
  softwareData,
  languagesData,
  socialsData,
  creativeRolesData,
  SCHOOL_TERMS,
  CLIENT_TERMS,
  TOOL_TERMS,
  LANGUAGE_TERMS,
  SOCIAL_TERMS,
  ROLE_TERMS,
  SCHOOL_RECOGNIZER,
  CLIENT_RECOGNIZER,
  SOFTWARE_RECOGNIZER,
  LANGUAGE_RECOGNIZER,
  SOCIAL_RECOGNIZER,
  ROLE_RECOGNIZER,
  matchEntityInLine,
} from './entity-catalog.js';
import { findLongestMatchingTerm } from './match-utils.js';

export const DICTIONARY_CATALOG = [
  { id: 'schools', bucket: 'education', data: schoolsData },
  { id: 'clients', bucket: 'clients', data: clientsData },
  { id: 'software', bucket: 'tools', data: softwareData },
  { id: 'languages', bucket: 'languages', data: languagesData },
  { id: 'socials', bucket: 'contact', data: socialsData },
  { id: 'creative_roles', bucket: 'identity', data: creativeRolesData },
];

export const DICTIONARY_BOOST = {
  schools: schoolsData.boost ?? 40,
  clients: clientsData.boost ?? 30,
  creative_clients: clientsData.boost ?? 30,
  software: softwareData.boost ?? 30,
  creative_tools: softwareData.boost ?? 30,
  languages: languagesData.boost ?? 20,
  socials: socialsData.boost ?? 18,
  social_networks: socialsData.boost ?? 18,
  creative_roles: creativeRolesData.boost ?? 25,
};

const EXPERIENCE_ROLE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|product\s+designer|visual\s+designer|motion\s+designer|senior\s+designer|lead\s+designer|graphiste|directeur\s+artistique|directeur\s+créatif|illustrateur)\b/i;

const DATE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b|\b(19|20)\d{2}\b/i;

const EMPLOYMENT_MARKER_RE =
  /\b(freelance|full[- ]?time|part[- ]?time|internship|intern|stage|stagiaire|contract|permanent|cdd|cdi)\b/i;

const JOB_CONTEXT_RE = /\s[-–—@|]\s|\s+at\s+/i;

/**
 * Pure longest-term match — never calls parser code.
 * @param {unknown} line
 * @param {unknown} terms
 */
export function findLongestDictionaryTerm(line, terms) {
  return findLongestMatchingTerm(line, terms);
}

export function lineIsCreativeRoleHeadline(line) {
  const l = String(line || '').trim();
  if (!l || !EXPERIENCE_ROLE_RE.test(l)) return false;
  if (/,/.test(l)) return false;
  if (l.length > 120) return false;
  return (
    EMPLOYMENT_MARKER_RE.test(l) ||
    /\s\/\s|\s&\s|\s·\s/.test(l) ||
    JOB_CONTEXT_RE.test(l) ||
    DATE_RE.test(l)
  );
}

export function isDictionaryExperienceJobLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (lineIsCreativeRoleHeadline(l)) return true;
  if (!DATE_RE.test(l)) return false;
  if (EXPERIENCE_ROLE_RE.test(l) && (JOB_CONTEXT_RE.test(l) || EMPLOYMENT_MARKER_RE.test(l))) {
    return true;
  }
  if (JOB_CONTEXT_RE.test(l) && EXPERIENCE_ROLE_RE.test(l)) return true;
  if (EMPLOYMENT_MARKER_RE.test(l) && DATE_RE.test(l)) return true;
  return false;
}

export function blocksExperienceClassification(line) {
  const l = String(line || '').trim();
  if (
    /\b(19|20)\d{2}\b/.test(l) &&
    /\b(teaching\s+assistant|research\s+assistant|postdoctoral|postdoc|associate\s+professor|adjunct\s+professor|lecturer|researcher|fellow|instructor|tutor)\b/i.test(
      l
    )
  ) {
    return false;
  }
  if (
    /\b(19|20)\d{2}\b/.test(l) &&
    /\b(chief|vice\s+president|\bvp\b|officer|director|manager|executive|account\s+executive|operations)\b/i.test(
      l
    )
  ) {
    return false;
  }
  const school = matchEntityInLine(line, SCHOOL_RECOGNIZER);
  if (school) return true;
  if (isDictionaryExperienceJobLine(line)) return false;
  const client = matchEntityInLine(line, CLIENT_RECOGNIZER);
  if (client) return true;
  const tool = matchEntityInLine(line, SOFTWARE_RECOGNIZER);
  if (tool && !lineIsCreativeRoleHeadline(line)) return true;
  return false;
}

function buildDictResult(line, dictionary, entityHit, bucket, reason) {
  const boost = entityHit.boost ?? DICTIONARY_BOOST[dictionary] ?? 20;
  const confidence = Math.min(100, 68 + boost);
  const matchedTerm = entityHit.matched || entityHit.term;
  return {
    bucket,
    confidence,
    signals: [`entity:${dictionary}`, `boost:+${boost}`, `term:${matchedTerm}`, `id:${entityHit.entityId}`],
    parserDebug: {
      classificationReason: reason,
      matchedDictionary: dictionary,
      matchedTerm,
      matchedEntityId: entityHit.entityId,
      entityType: entityHit.entity,
      confidenceScore: confidence,
      dictionaryBoost: boost,
      line: String(line || '').trim().slice(0, 200),
    },
  };
}

export function applyDictionaryBoostToClassification(classified) {
  if (!classified) return classified;
  const dbg = classified.parserDebug || {};
  const boost = dbg.dictionaryBoost ?? 0;
  if (!boost) return classified;
  return {
    ...classified,
    confidence: Math.min(100, (classified.confidence || 0) + Math.round(boost * 0.15)),
    parserDebug: {
      ...dbg,
      confidenceScore: Math.min(100, (dbg.confidenceScore || classified.confidence) + 5),
    },
  };
}

export function classifyLineByDictionary(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return null;

  const schoolHit = matchEntityInLine(l, SCHOOL_RECOGNIZER);
  if (schoolHit) {
    return buildDictResult(l, 'schools', schoolHit, 'education', 'school_entity_match');
  }

  if (isDictionaryExperienceJobLine(l)) return null;

  const langHit = matchEntityInLine(l, LANGUAGE_RECOGNIZER);
  if (langHit && (l.length < 80 || /\s[-–—]\s*(native|fluent|courant|bilingual)/i.test(l))) {
    return buildDictResult(l, 'languages', langHit, 'languages', 'language_entity_match');
  }

  const socialHit = matchEntityInLine(l, SOCIAL_RECOGNIZER);
  if (socialHit) {
    return buildDictResult(l, 'socials', socialHit, 'contact', 'social_entity_match');
  }

  const clientHit = matchEntityInLine(l, CLIENT_RECOGNIZER);
  if (clientHit) {
    return buildDictResult(l, 'clients', clientHit, 'clients', 'client_entity_match');
  }

  const toolHit = matchEntityInLine(l, SOFTWARE_RECOGNIZER);
  if (toolHit && !lineIsCreativeRoleHeadline(l)) {
    return buildDictResult(l, 'software', toolHit, 'tools', 'software_entity_match');
  }

  const roleHit = matchEntityInLine(l, ROLE_RECOGNIZER);
  if (roleHit && lineIsCreativeRoleHeadline(l)) {
    return buildDictResult(l, 'creative_roles', roleHit, 'identity', 'creative_role_entity_match');
  }

  return null;
}

export {
  SCHOOL_TERMS,
  CLIENT_TERMS,
  TOOL_TERMS,
  LANGUAGE_TERMS,
  SOCIAL_TERMS,
  ROLE_TERMS,
  schoolsData,
  clientsData,
  creativeClientsData,
  softwareData,
  languagesData,
  socialsData,
  creativeRolesData,
};
