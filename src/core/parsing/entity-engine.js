/**
 * Entity engine — dictionary recognition + scoring before section classification.
 * Sources: schools, degrees, clients, software, socials, languages (+ roles).
 */

import {
  ENTITY_REGISTRY,
  ENTITY_TYPE_TO_BUCKET,
  SCHOOL_RECOGNIZER,
  DEGREE_RECOGNIZER,
  CLIENT_RECOGNIZER,
  SOFTWARE_RECOGNIZER,
  LANGUAGE_RECOGNIZER,
  SOCIAL_RECOGNIZER,
  ROLE_RECOGNIZER,
  matchEntityInLine,
  schoolsData,
  clientsData,
  softwareData,
  languagesData,
  socialsData,
  degreesData,
} from '../../data/dictionaries/entity-catalog.js';
import {
  recognizeEntitiesInText,
  findBestEntity,
} from '../../data/dictionaries/entity-recognizer.js';
import {
  blocksExperienceClassification,
  lineIsCreativeRoleHeadline,
} from '../../data/dictionaries/json-dictionary-match.js';
import { passesExperienceGate } from './section-sanity.js';
import { isCareerSentence, isLikelyFreelanceCareerLine } from './classification-fixes.js';

export const ENTITY_DICTIONARIES = {
  schools: schoolsData,
  degrees: degreesData,
  clients: clientsData,
  software: softwareData,
  socials: socialsData,
  languages: languagesData,
};

/** Default boosts per entity type (from JSON or fallback). */
export const ENTITY_TYPE_BOOST = {
  school: schoolsData.boost ?? 40,
  degree: degreesData.boost ?? 30,
  client: clientsData.boost ?? 30,
  software: softwareData.boost ?? 30,
  language: languagesData.boost ?? 20,
  social: socialsData.boost ?? 18,
  role: 25,
};

export const ENTITY_SCORE_BASE = 40;
export const ENTITY_CLASSIFY_THRESHOLD = 68;

const RECOGNIZER_BY_TYPE = {
  school: SCHOOL_RECOGNIZER,
  degree: DEGREE_RECOGNIZER,
  client: CLIENT_RECOGNIZER,
  software: SOFTWARE_RECOGNIZER,
  language: LANGUAGE_RECOGNIZER,
  social: SOCIAL_RECOGNIZER,
  role: ROLE_RECOGNIZER,
};

const BUCKET_TO_BLOCK_TYPE = {
  education: 'education',
  clients: 'clients',
  tools: 'tools',
  languages: 'languages',
  contact: 'contact',
  identity: 'identity',
  unknown: 'unknown',
};

/**
 * @param {object} hit
 * @param {string} line
 */
export function scoreEntityHit(hit, line = '') {
  if (!hit) return 0;
  const l = String(line || '').trim();
  const boost = Number(hit.boost) || ENTITY_TYPE_BOOST[hit.entity] || 20;
  let score = ENTITY_SCORE_BASE + boost;

  const matched = String(hit.matched || hit.term || '').trim();
  const canonical = String(hit.term || hit.canonical || '').trim();
  if (matched.length >= 6) score += 4;
  if (canonical && l.toLowerCase() === canonical.toLowerCase()) score += 8;
  if (matched && l.toLowerCase() === matched.toLowerCase()) score += 6;

  if (hit.entity === 'school' && /\b(école|school|university|college|institut|academy|lisaa|ensad|gobelins)\b/i.test(l)) {
    score += 4;
  }
  if (hit.entity === 'client' && !passesExperienceGate(l)) score += 3;
  if (hit.entity === 'software' && /\b(adobe|cc|suite|creative cloud)\b/i.test(l)) score += 4;

  return Math.min(100, Math.round(score));
}

/**
 * Collect hits from all dictionaries for one line.
 * @param {string} line
 * @param {object} [opts]
 */
export function collectEntityHits(line, opts = {}) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return [];

  const recognizers = opts.creativeRoleHeadline
    ? [ROLE_RECOGNIZER, SCHOOL_RECOGNIZER, DEGREE_RECOGNIZER, LANGUAGE_RECOGNIZER, SOCIAL_RECOGNIZER]
    : [
        SCHOOL_RECOGNIZER,
        DEGREE_RECOGNIZER,
        CLIENT_RECOGNIZER,
        SOFTWARE_RECOGNIZER,
        LANGUAGE_RECOGNIZER,
        SOCIAL_RECOGNIZER,
        ROLE_RECOGNIZER,
      ];

  const hits = [];
  for (const rec of recognizers) {
    const raw = matchEntityInLine(l, rec);
    if (!raw) continue;
    const all = recognizeEntitiesInText(l, rec);
    hits.push({
      ...raw,
      score: scoreEntityHit(raw, l),
      allMatches: all,
    });
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.boost - a.boost ||
      (b.matched?.length || 0) - (a.matched?.length || 0)
  );

  return hits;
}

/**
 * Tie-break: school beats degree on same line; software beats role unless job headline.
 * @param {object[]} hits
 * @param {string} line
 */
export function pickPrimaryEntityHit(hits, line = '') {
  if (!hits?.length) return null;
  const l = String(line || '').trim();
  const sorted = [...hits].sort((a, b) => b.score - a.score);

  if (sorted.length >= 2) {
    const school = sorted.find((h) => h.entity === 'school');
    const degree = sorted.find((h) => h.entity === 'degree');
    if (school && degree && school.score >= degree.score - 5) return school;

    const software = sorted.find((h) => h.entity === 'software');
    const role = sorted.find((h) => h.entity === 'role');
    if (software && role && !lineIsCreativeRoleHeadline(l) && !isCareerSentence(l) && software.score >= role.score) {
      return software;
    }
    if (software && isCareerSentence(l)) {
      const roleHit = sorted.find((h) => h.entity === 'role');
      if (roleHit) return roleHit;
      return null;
    }
    if (role && lineIsCreativeRoleHeadline(l) && role.score >= (software?.score || 0) - 8) {
      return role;
    }

    const client = sorted.find((h) => h.entity === 'client');
    if (client && software && client.score > software.score) return client;
  }

  return sorted[0];
}

/**
 * Resolve best entity for a line — used before section/heuristic classification.
 * @param {string} line
 * @param {object} [opts]
 */
export function resolveLineEntities(line, opts = {}) {
  const l = String(line || '').trim();
  if (!l) return null;
  if (isLikelyFreelanceCareerLine(l) || isCareerSentence(l)) return null;

  const hits = collectEntityHits(l, {
    creativeRoleHeadline: lineIsCreativeRoleHeadline(l),
  });
  const primary = pickPrimaryEntityHit(hits, l);
  if (!primary) return null;

  const bucket = ENTITY_TYPE_TO_BUCKET[primary.entity] || 'unknown';
  const blockType = BUCKET_TO_BLOCK_TYPE[bucket] || 'unknown';
  const confidence = primary.score;

  return {
    primary,
    hits,
    entity: primary.entity,
    entityId: primary.entityId,
    term: primary.term,
    matched: primary.matched,
    bucket,
    blockType,
    confidence,
    boost: primary.boost,
    dictionaryId: primary.dictionaryId,
    signals: [`entity:${primary.entity}`, `entity_score:${confidence}`, `dict:${primary.dictionaryId}`],
    shouldClassify: confidence >= (opts.threshold ?? ENTITY_CLASSIFY_THRESHOLD),
  };
}

/**
 * @param {string} line
 */
export function matchEntitiesInLine(line) {
  const resolved = resolveLineEntities(line);
  return resolved?.primary || null;
}

/**
 * @param {string} text
 * @param {string} [sectionHint]
 */
export function scoreBlockWithEntities(text, sectionHint = '') {
  const lines = String(text || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  const votes = {};
  const signals = [];
  let sum = 0;
  let n = 0;
  let topMatch = null;

  for (const line of lines) {
    if (lineIsCreativeRoleHeadline(line) && !blocksExperienceClassification(line)) {
      votes.experience = (votes.experience || 0) + 2;
      sum += 78;
      n += 1;
      signals.push('role_headline');
      continue;
    }

    const resolved = resolveLineEntities(line);
    if (!resolved?.primary) {
      if (/@/.test(line) || /linkedin\.com/i.test(line)) {
        votes.contact = (votes.contact || 0) + 2;
        sum += 75;
        n += 1;
        signals.push('contact_pattern');
      } else if (/https?:\/\//i.test(line) || /\b(behance|dribbble)\./i.test(line)) {
        votes.portfolio = (votes.portfolio || 0) + 2;
        sum += 72;
        n += 1;
        signals.push('portfolio_url');
      }
      continue;
    }

    const bucket = resolved.bucket;
    votes[bucket] = (votes[bucket] || 0) + resolved.confidence;
    sum += resolved.confidence;
    n += 1;
    signals.push(...resolved.signals);
    if (!topMatch || resolved.confidence > (topMatch.score ?? topMatch.confidence ?? 0)) {
      topMatch = resolved.primary;
    }
  }

  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  let bucket = entries[0]?.[0] || 'unknown';
  const bestVotes = entries[0]?.[1] || 0;

  const hintMap = {
    experience: 'experience',
    education: 'education',
    clients: 'clients',
    skills: 'skills',
    tools: 'tools',
    languages: 'languages',
    contact: 'contact',
    projects: 'portfolio',
  };
  const hinted = hintMap[sectionHint] || null;
  if (hinted && (votes[hinted] || 0) >= bestVotes - 1) bucket = hinted;

  const confidence = n ? Math.round(sum / n) : hinted ? 52 : 0;

  return {
    bucket,
    confidence,
    signals: [...new Set(signals)],
    entityMatch: topMatch,
    lineVotes: votes,
    lineCount: lines.length,
  };
}

export {
  ENTITY_REGISTRY,
  ENTITY_TYPE_TO_BUCKET,
  findBestEntity,
  recognizeEntitiesInText,
  RECOGNIZER_BY_TYPE,
};
