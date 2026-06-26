/**
 * Loaded entity dictionaries + shared recognition registry.
 */

import schoolsData from './schools.json' with { type: 'json' };
import clientsData from './clients.json' with { type: 'json' };
import creativeClientsData from './creative_clients.json' with { type: 'json' };
import softwareData from './software.json' with { type: 'json' };
import languagesData from './languages.json' with { type: 'json' };
import socialsData from './socials.json' with { type: 'json' };
import degreesData from './degrees.json' with { type: 'json' };
import creativeRolesData from './creative_roles.json' with { type: 'json' };
import {
  buildEntityIndex,
  buildEntityRegistry,
  flattenDictionaryTerms,
  findBestEntity,
  recognizeEntitiesInText,
} from './entity-recognizer.js';

export {
  schoolsData,
  clientsData,
  creativeClientsData,
  softwareData,
  languagesData,
  socialsData,
  degreesData,
  creativeRolesData,
  findBestEntity,
  recognizeEntitiesInText,
};

export const ENTITY_TYPE_TO_BUCKET = {
  school: 'education',
  degree: 'education',
  client: 'clients',
  software: 'tools',
  language: 'languages',
  social: 'contact',
  role: 'identity',
};

export const SCHOOL_RECOGNIZER = buildEntityIndex(schoolsData);
export const CLIENT_RECOGNIZER = buildEntityIndex({
  ...clientsData,
  entities: [
    ...(clientsData.entities || []),
    ...(creativeClientsData.entities || []),
    ...(creativeClientsData.terms || []).map((name) => ({
      id: String(name).toLowerCase().replace(/\s+/g, '-'),
      name: String(name),
      aliases: [],
      type: 'client',
    })),
  ],
});
export const SOFTWARE_RECOGNIZER = buildEntityIndex(softwareData);
export const LANGUAGE_RECOGNIZER = buildEntityIndex(languagesData);
export const SOCIAL_RECOGNIZER = buildEntityIndex(socialsData);
export const DEGREE_RECOGNIZER = buildEntityIndex(degreesData);
export const ROLE_RECOGNIZER = buildEntityIndex(creativeRolesData);

export const ENTITY_REGISTRY = buildEntityRegistry([
  schoolsData,
  clientsData,
  creativeClientsData,
  softwareData,
  languagesData,
  socialsData,
  degreesData,
  creativeRolesData,
]);

export const SCHOOL_TERMS = flattenDictionaryTerms(schoolsData);
export const CLIENT_TERMS = flattenDictionaryTerms({
  ...clientsData,
  entities: [
    ...(clientsData.entities || []),
    ...(creativeClientsData.entities || []),
    ...(creativeClientsData.terms || []).map((name) => ({ id: name, name, type: 'client' })),
  ],
});
export const TOOL_TERMS = flattenDictionaryTerms(softwareData);
export const LANGUAGE_TERMS = flattenDictionaryTerms(languagesData);
export const SOCIAL_TERMS = flattenDictionaryTerms(socialsData);
export const DEGREE_TERMS = flattenDictionaryTerms(degreesData);
export const ROLE_TERMS = flattenDictionaryTerms(creativeRolesData);

/**
 * @param {string} line
 * @param {ReturnType<typeof buildEntityIndex>} recognizer
 */
export function matchEntityInLine(line, recognizer) {
  const hit = findBestEntity(line, recognizer);
  if (!hit) return null;
  const bucket = ENTITY_TYPE_TO_BUCKET[hit.entityType] || 'unknown';
  return {
    entity: hit.entityType,
    entityId: hit.entityId,
    term: hit.canonical,
    matched: hit.matched,
    bucket,
    boost: hit.boost,
    confidence: Math.min(100, 40 + hit.boost),
    dictionaryId: hit.dictionaryId,
    allMatches: recognizeEntitiesInText(line, recognizer),
    line: String(line || '').trim().slice(0, 200),
  };
}
