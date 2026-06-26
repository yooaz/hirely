/**
 * Stage 5 — Section validator (education / experience / clients / tools rules).
 */

import { lineMatchesSchool } from '../../../data/dictionaries/schools.js';
import { INSTITUTION_HINT_RE, EDUCATION_KEYWORDS } from '../../../data/dictionaries/educationKeywords.js';
import { ROLE_TITLE_RE } from '../../../data/dictionaries/roleKeywords.js';
import {
  blocksExperienceClassification,
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
} from '../../../data/dictionaries/json-dictionary-match.js';
import { scoreEducationConfidence, mustNeverBeExperience } from '../education-confidence.js';
import { passesExperienceGate, hasExperienceDate } from '../section-sanity.js';
import { textContainsAny } from '../../../data/dictionaries/match-utils.js';
import { SKILLS } from '../../../data/dictionaries/skills.js';

const DEGREE_RE =
  /\b(bachelor|master|mba|phd|b\.?a\.?|b\.?s\.?|m\.?a\.?|m\.?s\.?|licence|diploma|degree|baccalauréat|doctorat)\b/i;

/**
 * @param {string} line
 */
export function validatesEducationLine(line) {
  const l = String(line || '').trim();
  if (!l) return { ok: false, reason: 'empty' };
  if (lineMatchesSchool(l)) return { ok: true, reason: 'school' };
  if (DEGREE_RE.test(l)) return { ok: true, reason: 'degree' };
  if (/\b(19|20)\d{2}\b/.test(l) && (INSTITUTION_HINT_RE.test(l) || textContainsAny(l, EDUCATION_KEYWORDS))) {
    return { ok: true, reason: 'years' };
  }
  if (textContainsAny(l, EDUCATION_KEYWORDS) && l.length < 140) return { ok: true, reason: 'education_kw' };
  return { ok: false, reason: 'missing_school_degree_years' };
}

/**
 * @param {string} line
 */
export function validatesExperienceLine(line) {
  const l = String(line || '').trim();
  if (!l) return { ok: false, reason: 'empty' };
  if (mustNeverBeExperience(l)) {
    return { ok: false, reason: 'education_not_experience' };
  }
  if (blocksExperienceClassification(l) && !passesExperienceGate(l)) {
    return { ok: false, reason: 'dictionary_blocks_experience' };
  }
  const hasRole = ROLE_TITLE_RE.test(l) || /\b(designer|director|manager|lead|senior|freelance|engineer|consultant)\b/i.test(l);
  const hasCompany =
    findLongestDictionaryTerm(l, CLIENT_TERMS) ||
    /\s[-–—@|]\s/.test(l) ||
    /\bat\s+[A-Z]/i.test(l);
  if (passesExperienceGate(l) && (hasRole || hasCompany || hasExperienceDate(l))) {
    return { ok: true, reason: 'job_or_company' };
  }
  return { ok: false, reason: 'missing_title_company' };
}

/**
 * @param {string} line
 * @param {string} targetBucket
 */
function validateLineForBucket(line, targetBucket) {
  if (targetBucket === 'education') return validatesEducationLine(line);
  if (targetBucket === 'experience') return validatesExperienceLine(line);
  if (targetBucket === 'clients') {
    const client = findLongestDictionaryTerm(line, CLIENT_TERMS);
    if (client && !passesExperienceGate(line)) return { ok: true, reason: 'client_dict' };
    return { ok: !!client, reason: client ? 'client' : 'not_client' };
  }
  if (targetBucket === 'tools') {
    const tool = findLongestDictionaryTerm(line, TOOL_TERMS);
    if (tool) return { ok: true, reason: 'software_dict' };
    return { ok: false, reason: 'not_tool' };
  }
  if (targetBucket === 'skills') {
    if (findLongestDictionaryTerm(line, TOOL_TERMS)) return { ok: false, reason: 'tools_not_skills' };
    return { ok: textContainsAny(line, SKILLS) || line.includes(','), reason: 'skills' };
  }
  return { ok: true, reason: 'pass' };
}

/**
 * @param {object} opts
 * @param {object[]} opts.blocks
 */
export function runSectionValidatorStage(opts = {}) {
  const violations = [];
  const lockedHints = [
    'experience',
    'education',
    'skills',
    'tools',
    'languages',
    'summary',
    'clients',
    'contact',
    'portfolio',
    'portfolioLinks',
  ];

  const validatedBlocks = (opts.blocks || []).map((block) => {
    if (block.kind === 'section_header') return { ...block, valid: true };

    const lines = (block.lines || []).map((ln) => String(ln.cleanedText ?? ln.text ?? '').trim()).filter(Boolean);
    const sectionLocked = lockedHints.includes(block.sectionHint);
    let bucket = block.bucket || 'unknown';
    if (sectionLocked) {
      bucket =
        block.sectionHint === 'portfolioLinks' || block.sectionHint === 'projects'
          ? 'portfolio'
          : block.sectionHint;
    }
    const lineResults = lines.map((line) => {
      let check = validateLineForBucket(line, bucket);
      if (bucket === 'experience' && mustNeverBeExperience(line)) {
        bucket = 'education';
        check = validateLineForBucket(line, 'education');
        violations.push({
          line: line.slice(0, 100),
          from: 'experience',
          to: 'education',
          reason: 'education_confidence_forced',
        });
      } else if (
        !sectionLocked &&
        bucket === 'experience' &&
        !check.ok &&
        findLongestDictionaryTerm(line, CLIENT_TERMS)
      ) {
        bucket = 'clients';
        check = validateLineForBucket(line, 'clients');
        violations.push({ line: line.slice(0, 100), from: 'experience', to: 'clients', reason: 'client_not_experience' });
      }
      if (bucket === 'skills' && findLongestDictionaryTerm(line, TOOL_TERMS)) {
        bucket = 'tools';
        check = validateLineForBucket(line, 'tools');
        violations.push({ line: line.slice(0, 100), from: 'skills', to: 'tools', reason: 'tools_not_skills' });
      }
      if (bucket === 'education' && !check.ok && validatesEducationLine(line).ok) {
        check = validatesEducationLine(line);
      }
      return { line, ...check };
    });

    const allOk =
      sectionLocked || lineResults.every((r) => r.ok) || lineResults.length === 0;
    if (sectionLocked) {
      bucket =
        block.sectionHint === 'portfolioLinks' || block.sectionHint === 'projects'
          ? 'portfolio'
          : block.sectionHint;
    }
    return {
      ...block,
      bucket,
      valid: allOk,
      lineResults,
      validationReason: allOk ? 'ok' : lineResults.find((r) => !r.ok)?.reason || 'invalid',
    };
  });

  return {
    stage: 5,
    blocks: validatedBlocks,
    violations,
    violationCount: violations.length,
    at: new Date().toISOString(),
  };
}
