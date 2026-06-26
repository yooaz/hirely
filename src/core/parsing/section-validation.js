/**
 * P0 section validation — block-level rules after classification.
 * Never deletes content; low-confidence or violations → review queue.
 */

import { matchEntitiesInLine } from './entity-dictionaries.js';
import { mustNeverBeExperience } from './education-confidence.js';
import { hasExperienceDate, passesExperienceGate } from './section-sanity.js';
import {
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import { CLASSIFICATION_CONFIDENCE_THRESHOLD } from './block-classifier.js';
import {
  isAwardsLine,
  isExhibitionsLine,
  isPublicationsLine,
  isCreativeClientEntityLine,
} from './creative-parsing-mode.js';
import { GENERIC_EDUCATION_HINT_RE } from './generic-career-signals.js';

/**
 * @param {object} block — classified block
 * @returns {{ block: object, violations: object[] }}
 */
export function validateClassifiedBlock(block) {
  const violations = [];
  let type = block.type || 'unknown';
  const text = String(block.text || '').trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const signals = [...(block.signals || [])];
  let confidence = Number(block.confidence) || 0;
  const entityMatch = block.entityMatch || matchEntitiesInLine(text);

  const schoolHit =
    entityMatch?.entity === 'school' ||
    lines.some((l) => mustNeverBeExperience(l) && GENERIC_EDUCATION_HINT_RE.test(l));

  if (type === 'experience' && schoolHit) {
    violations.push({
      rule: 'school_not_experience',
      from: 'experience',
      to: 'education',
      text: text.slice(0, 120),
    });
    type = 'education';
    confidence = Math.max(confidence, 82);
    signals.push('validation:school→education');
  }

  const clientOnly =
    entityMatch?.entity === 'client' ||
    (lines.length === 1 && findLongestDictionaryTerm(text, CLIENT_TERMS) && !hasExperienceDate(text));

  if (type === 'experience' && clientOnly && !passesExperienceGate(text)) {
    violations.push({
      rule: 'client_not_experience',
      from: 'experience',
      to: 'clients',
      text: text.slice(0, 120),
    });
    type = 'clients';
    confidence = Math.max(confidence, 78);
    signals.push('validation:client→clients');
  }

  const clientInEducation =
    type === 'education' &&
    (entityMatch?.entity === 'client' ||
      (lines.length <= 2 && findLongestDictionaryTerm(text, CLIENT_TERMS) && !schoolHit));

  if (clientInEducation) {
    violations.push({
      rule: 'client_not_education',
      from: 'education',
      to: 'clients',
      text: text.slice(0, 120),
    });
    type = 'clients';
    confidence = Math.max(confidence, 78);
    signals.push('validation:client→clients');
  }

  const toolInExperience =
    type === 'experience' &&
    (entityMatch?.entity === 'software' ||
      lines.some((ln) => findLongestDictionaryTerm(ln, TOOL_TERMS) && !passesExperienceGate(ln)));

  if (toolInExperience) {
    violations.push({
      rule: 'tool_not_experience',
      from: 'experience',
      to: 'tools',
      text: text.slice(0, 120),
    });
    type = 'tools';
    confidence = Math.max(confidence, 78);
    signals.push('validation:tool→tools');
  }

  if (type === 'experience' && isAwardsLine(text)) {
    violations.push({ rule: 'award_not_experience', from: 'experience', to: 'projects', text: text.slice(0, 120) });
    type = 'projects';
    confidence = Math.max(confidence, 84);
    signals.push('validation:award→projects');
  } else if (type === 'experience' && isExhibitionsLine(text)) {
    violations.push({
      rule: 'exhibition_not_experience',
      from: 'experience',
      to: 'projects',
      text: text.slice(0, 120),
    });
    type = 'projects';
    confidence = Math.max(confidence, 84);
    signals.push('validation:exhibition→projects');
  } else if (type === 'experience' && isPublicationsLine(text)) {
    violations.push({
      rule: 'publication_not_experience',
      from: 'experience',
      to: 'projects',
      text: text.slice(0, 120),
    });
    type = 'projects';
    confidence = Math.max(confidence, 84);
    signals.push('validation:publication→projects');
  } else if (
    type === 'experience' &&
    lines.length === 1 &&
    isCreativeClientEntityLine(text) &&
    !passesExperienceGate(text)
  ) {
    violations.push({
      rule: 'creative_client_not_experience',
      from: 'experience',
      to: 'clients',
      text: text.slice(0, 120),
    });
    type = 'clients';
    confidence = Math.max(confidence, 80);
    signals.push('validation:creative_client→clients');
  }

  const softwareInSkills =
    type === 'skills' &&
    (entityMatch?.entity === 'software' ||
      lines.every((l) => findLongestDictionaryTerm(l, TOOL_TERMS) && !/,/.test(l)));

  if (softwareInSkills) {
    violations.push({
      rule: 'software_not_skills',
      from: 'skills',
      to: 'tools',
      text: text.slice(0, 120),
    });
    type = 'tools';
    confidence = Math.max(confidence, 80);
    signals.push('validation:software→tools');
  }

  if (type === 'unknown' && text.length > 2) {
    violations.push({
      rule: 'unknown_section',
      from: type,
      to: 'review',
      text: text.slice(0, 120),
    });
    signals.push('validation:unknown→review');
  }

  const needsReview =
    confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD ||
    type === 'unknown' ||
    violations.some((v) => v.rule === 'unknown_section');

  const classificationReason =
    block.classificationReason ||
    signals.filter((s) => s.startsWith('entity:') || s.startsWith('validation:')).join(' · ') ||
    (entityMatch ? `entity:${entityMatch.entityId || entityMatch.term}` : 'heuristic');

  return {
    block: {
      ...block,
      type,
      bucket: type,
      confidence,
      signals,
      entityMatch,
      needsReview,
      accepted: !needsReview,
      validationViolations: violations,
      classificationReason,
      dictionaryMatch: entityMatch
        ? {
            entity: entityMatch.entity,
            term: entityMatch.term,
            entityId: entityMatch.entityId,
            boost: entityMatch.boost,
          }
        : null,
    },
    violations,
  };
}

/**
 * @param {object[]} blocks
 */
export function validateSectionBlocks(blocks = []) {
  const allViolations = [];
  const validated = [];

  for (const block of blocks) {
    const { block: next, violations } = validateClassifiedBlock(block);
    validated.push(next);
    allViolations.push(...violations);
  }

  return {
    stage: 'section_validation',
    blocks: validated,
    violations: allViolations,
    violationCount: allViolations.length,
    at: new Date().toISOString(),
  };
}
