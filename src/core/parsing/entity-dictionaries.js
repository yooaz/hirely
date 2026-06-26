/**
 * Entity dictionaries — schools, clients, software, languages, degrees.
 * Entity recognition (not regex-only classification).
 */

import {
  schoolsData,
  clientsData,
  softwareData,
  languagesData,
  socialsData,
  degreesData,
  creativeRolesData,
  SCHOOL_TERMS,
  CLIENT_TERMS,
  TOOL_TERMS,
  LANGUAGE_TERMS,
  SOCIAL_TERMS,
  DEGREE_TERMS,
  ROLE_TERMS,
  ENTITY_TYPE_TO_BUCKET,
  matchEntityInLine,
  findBestEntity,
} from '../../data/dictionaries/entity-catalog.js';
import { termRegex } from '../../data/dictionaries/match-utils.js';
export const ENTITY_BOOST = {
  school: schoolsData.boost ?? 40,
  degree: degreesData.boost ?? 30,
  client: clientsData.boost ?? 30,
  software: softwareData.boost ?? 30,
  language: languagesData.boost ?? 20,
  social: socialsData.boost ?? 18,
  role: creativeRolesData.boost ?? 25,
};

export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 70;

function sortLongest(terms) {
  return [...terms].sort((a, b) => b.length - a.length);
}

export const ENTITY_CATALOG = {
  schools: sortLongest(SCHOOL_TERMS),
  clients: sortLongest(CLIENT_TERMS),
  software: sortLongest(TOOL_TERMS),
  languages: sortLongest(LANGUAGE_TERMS),
  social: sortLongest(SOCIAL_TERMS),
  degrees: sortLongest(DEGREE_TERMS),
  roles: sortLongest(ROLE_TERMS),
};

export function findLongestEntityTerm(hay, terms) {
  const text = String(hay || '');
  let best = null;
  for (const term of terms) {
    if (!term || !termRegex(term).test(text)) continue;
    if (!best || term.length > best.length) best = term;
  }
  return best;
}

import { matchEntitiesInLine, scoreBlockWithEntities } from './entity-engine.js';

export { matchEntitiesInLine, scoreBlockWithEntities };

/** Production block buckets — see block-classifier.js rules. */
export const BLOCK_TYPES = [
  'identity',
  'contact',
  'summary',
  'experience',
  'education',
  'clients',
  'projects',
  'skills',
  'tools',
  'languages',
  'interests',
  'unknown',
];

const HINT_TO_TYPE = {
  experience: 'experience',
  education: 'education',
  clients: 'clients',
  skills: 'skills',
  tools: 'tools',
  languages: 'languages',
  summary: 'summary',
  profile: 'summary',
  contact: 'contact',
  projects: 'projects',
  portfolioLinks: 'contact',
  portfolio: 'contact',
  header: 'identity',
  body: 'identity',
  interests: 'interests',
  awards: 'projects',
  award: 'projects',
  exhibitions: 'projects',
  exhibition: 'projects',
  publications: 'projects',
  publication: 'projects',
};

export function normalizeBlockType(bucket) {
  const map = {
    profile: 'summary',
    portfolioLinks: 'contact',
    portfolio: 'contact',
    header: 'identity',
    award: 'projects',
    awards: 'projects',
    publication: 'projects',
    publications: 'projects',
    exhibition: 'projects',
    exhibitions: 'projects',
  };
  const b = map[bucket] || bucket;
  return BLOCK_TYPES.includes(b) ? b : 'unknown';
}

export function resolveBlock(block) {
  const sectionHint = block.sectionHint || block.sectionKey || '';
  const entityScore = scoreBlockWithEntities(block.text || '', sectionHint);

  let type = block.type || entityScore.bucket || 'unknown';
  let confidence = Math.max(block.confidence ?? 0, entityScore.confidence);
  const signals = [...(block.signals || []), ...entityScore.signals];
  let parserDebug = block.parserDebug || null;
  let dictionaryMatch = block.dictionaryMatch || null;

  const hinted = HINT_TO_TYPE[sectionHint];
  const locked = [
    'experience',
    'education',
    'skills',
    'tools',
    'languages',
    'summary',
    'clients',
    'projects',
    'contact',
    'interests',
    'identity',
  ];
  const normalizedHint = hinted || sectionHint;
  if (
    sectionHint &&
    locked.includes(sectionHint) &&
    type !== 'unknown' &&
    (type === normalizedHint || entityScore.bucket === normalizedHint)
  ) {
    type = normalizedHint;
    confidence = Math.max(confidence, 85);
    signals.push(`locked_section:${sectionHint}`);
  } else if (entityScore.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD) {
    type = normalizeBlockType(entityScore.bucket);
    confidence = entityScore.confidence;
  }

  const em = entityScore.entityMatch;
  if (em) {
    dictionaryMatch = {
      entity: em.entity,
      entityId: em.entityId,
      term: em.term,
      matched: em.matched,
      boost: em.boost,
      dictionaryId: em.dictionaryId,
    };
    parserDebug = {
      classificationReason: `${em.entity}_entity_match`,
      matchedDictionary: em.dictionaryId || em.entity,
      matchedTerm: em.matched || em.term,
      matchedEntityId: em.entityId,
      dictionaryBoost: em.boost,
      confidenceScore: Math.max(confidence, em.confidence ?? 0),
      entityType: em.entity,
    };
    if (entityScore.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD - 4) {
      type = normalizeBlockType(entityScore.bucket);
      confidence = Math.max(confidence, entityScore.confidence);
      signals.push(`entity:${em.entity}`, `dict:${em.dictionaryId}`, `boost:+${em.boost}`);
    }
  }

  if (parserDebug?.dictionaryBoost) {
    confidence = Math.min(
      100,
      Math.max(confidence, (parserDebug.confidenceScore || confidence) + Math.round(parserDebug.dictionaryBoost * 0.08))
    );
  }

  type = normalizeBlockType(type);
  const needsReview = confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD;
  const classificationReason =
    parserDebug?.classificationReason ||
    block.classificationReason ||
    (em ? `${em.entity}_entity_match` : signals.find((s) => s.startsWith('locked_section:')) || 'heuristic');

  return {
    ...block,
    type,
    bucket: type,
    confidence,
    signals,
    needsReview,
    accepted: !needsReview,
    entityMatch: em,
    lineVotes: entityScore.lineVotes,
    dictionaryMatch,
    parserDebug,
    classificationReason,
  };
}

export function resolveBlocks(blocks = []) {
  return blocks.map((b) => resolveBlock(b));
}

export {
  schoolsData,
  clientsData,
  softwareData,
  languagesData,
  socialsData,
  findBestEntity,
  matchEntityInLine,
};
