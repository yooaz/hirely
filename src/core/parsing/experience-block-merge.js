/**
 * mergeFragmentedExperienceBlocks — merge OCR-split document blocks into experience rows.
 *
 * Handles patterns like:
 *   Designer / McCann G Agency / 2011-2014
 *   Freelance Illustrator / Graphic Designer / Independent / 2011-2022
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import {
  mergeFragmentedOcrLines,
  groupOcrExperienceBlocks,
  recoverExperiencesFromOcrMergedText,
} from './ocr-experience-merge.js';
import {
  buildExperienceEntryFromLineGroup,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
import { DATE_RANGE_RE, GENERIC_ROLE_WORDS_RE, FREELANCE_RE } from './generic-career-signals.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const EXPERIENCE_BLOCK_MERGE = 'EXPERIENCE_BLOCK_MERGE';

const BULLET_RE = /^[-•*]\s+/;
const YEAR_PAIR_RE =
  /^\s*((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|actuel)\s*$/i;
const ROLE_ONLY_RE =
  /^(?:(?:lead|senior|art|visual|creative|freelance)\s+)?(?:illustrator|designer|director|manager|engineer|developer|analyst|consultant)(?:\s*\/\s*(?:designer|illustrator))?$/i;
const COMPANY_ONLY_RE =
  /^[A-ZÀ-Ö][\w&.'-]+(?:\s+(?:Paris|London|G\.?\s*Agency|Agency|Conseil|Inc\.?|LLC|[A-ZÀ-Ö][\w&.'-]+)){0,5}$/i;

const FORBIDDEN_ZONE_KEYS = new Set([
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'interests',
  'contact',
  'summary',
  'profile',
]);

function blockLines(block) {
  if (block?.lines?.length) {
    return block.lines
      .map((l) => String(l.cleanedText ?? l.text ?? '').trim())
      .filter(Boolean);
  }
  return String(block?.text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function lineHasCareerSignal(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  return (
    DATE_RANGE_RE.test(l) ||
    YEAR_PAIR_RE.test(l) ||
    GENERIC_ROLE_WORDS_RE.test(l) ||
    FREELANCE_RE.test(l) ||
    lineLooksLikeRole(l) ||
    (COMPANY_ONLY_RE.test(l) && !ROLE_ONLY_RE.test(l))
  );
}

function isExperienceZoneHeader(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  const key = fuzzySectionKey(l);
  if (key === 'experience') return true;
  return /^(profile(\s+work)?\s+experience|work\s+experience|professional\s+experience|expérience|experience|career|emploi)\b/i.test(
    l
  );
}

function isHardZoneBoundary(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  const key = fuzzySectionKey(l);
  if (key && FORBIDDEN_ZONE_KEYS.has(key)) return true;
  if (isSectionHeaderLine(l) && key) return true;
  return false;
}

function shouldHarvestBlock(block) {
  const type = String(block?.type || block?.bucket || '').toLowerCase();
  if (type === 'experience') return true;
  if (['education', 'skills', 'tools', 'languages', 'clients', 'contact', 'summary', 'interests'].includes(type)) {
    return false;
  }
  const text = blockLines(block).join(' ');
  return lineHasCareerSignal(text);
}

function reclassifyCareerIdentityBlock(block) {
  const lines = blockLines(block);
  const blob = lines.join(' ');
  if (!lineHasCareerSignal(blob)) return block;
  if (/\b(engineer|developer|designer|illustrator|director|manager|recruiter|consultant|analyst)\b/i.test(blob) &&
      /\b(19|20)\d{2}\b/.test(blob)) {
    return {
      ...block,
      type: 'experience',
      bucket: 'experience',
      classificationReason: 'experience_block_merge:career_identity',
      accepted: true,
      needsReview: false,
      confidence: Math.max(block.confidence ?? 0, 78),
    };
  }
  return block;
}

function buildSyntheticExperienceBlock(entry, index, sourceIds = []) {
  const lines = [
    entry.role,
    entry.company,
    entry.dates || [entry.startDate, entry.endDate].filter(Boolean).join('–'),
    ...(entry.bullets || []).map((b) => (BULLET_RE.test(b) ? b : `- ${b}`)),
  ].filter(Boolean);
  const text = lines.join('\n');
  return {
    id: `exp-merged-${index}`,
    type: 'experience',
    bucket: 'experience',
    text,
    lines: lines.map((t, i) => ({ text: t, cleanedText: t, line: i })),
    confidence: Math.max(entry.confidence ?? 0, 82),
    accepted: true,
    needsReview: false,
    classificationReason: 'experience_block_merge:synthetic',
    sectionHint: 'experience',
    sourceBlockIds: sourceIds,
    mergedExperience: entry,
  };
}

/**
 * @param {object[]} blocks
 * @param {object} [opts]
 */
export function mergeFragmentedExperienceBlocks(blocks = [], opts = {}) {
  const list = Array.isArray(blocks) ? [...blocks] : [];
  if (!list.length) {
    return { blocks: list, experiences: [], mergedCount: 0, stats: { harvestedLines: 0 } };
  }

  const reclassified = list.map(reclassifyCareerIdentityBlock);

  let inExperienceZone = false;
  const harvested = [];
  const consumedIds = new Set();

  for (const block of reclassified) {
    const lines = blockLines(block);
    for (const line of lines) {
      if (isExperienceZoneHeader(line)) {
        inExperienceZone = true;
        continue;
      }
      if (isHardZoneBoundary(line)) {
        inExperienceZone = false;
        continue;
      }
    }

    const zoneActive = inExperienceZone || shouldHarvestBlock(block);
    if (!zoneActive) continue;

    const careerLines = lines.filter((l) => !isExperienceZoneHeader(l) && !isHardZoneBoundary(l));
    if (!careerLines.length) continue;

    const hasSignal = careerLines.some(lineHasCareerSignal);
    if (!hasSignal && String(block.type || '').toLowerCase() !== 'experience') continue;

    harvested.push(...careerLines);
    consumedIds.add(block.id);
  }

  const mergedLines = mergeFragmentedOcrLines(harvested);
  const groups = groupOcrExperienceBlocks(mergedLines);
  const experiences = [];
  const syntheticBlocks = [];
  const seen = new Set();

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    let entry = buildExperienceEntryFromLineGroup(group);
    if (!entry) {
      const dates = extractDateRangeFromText(group.join(' '));
      const roleLine = group.find((l) => ROLE_ONLY_RE.test(l) || GENERIC_ROLE_WORDS_RE.test(l));
      const companyLine = group.find((l) => COMPANY_ONLY_RE.test(l) && !ROLE_ONLY_RE.test(l));
      if (roleLine || companyLine || dates.startDate) {
        entry = {
          role: roleLine ? titleCaseProfessional(roleLine) : '',
          company: companyLine || (FREELANCE_RE.test(group.join(' ')) ? 'Independent / Freelance' : ''),
          startDate: dates.startDate || '',
          endDate: dates.endDate || '',
          dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
          bullets: group.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, '').trim()),
          clients: [],
          location: '',
        };
      }
    }
    if (!entry) continue;

    const ctx = group.join('\n');
    const confidence = scoreStrictExperienceEntry(entry, ctx);
    entry.confidence = confidence;
    if (
      !qualifiesStrictExperience(entry, ctx) ||
      confidence < (opts.minConfidence ?? EXPERIENCE_PARSER_CONFIDENCE_MIN)
    ) {
      continue;
    }

    const key = [
      String(entry.role || '').toLowerCase(),
      String(entry.company || '').toLowerCase(),
      String(entry.startDate || '').replace(/\D/g, '').slice(0, 8),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    experiences.push(entry);
    syntheticBlocks.push(buildSyntheticExperienceBlock(entry, i, [...consumedIds]));
  }

  const supplementText = String(opts.cleanedText || '').trim() || harvested.join('\n');
  const minExpected = opts.minExpected ?? 3;
  if (supplementText.length >= 40 && experiences.length < minExpected) {
    const recovered = recoverExperiencesFromOcrMergedText(supplementText, opts);
    for (const exp of recovered.experiences || []) {
      const key = [
        String(exp.role || '').toLowerCase(),
        String(exp.company || '').toLowerCase(),
        String(exp.startDate || '').replace(/\D/g, '').slice(0, 8),
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      experiences.push(exp);
      syntheticBlocks.push(buildSyntheticExperienceBlock(exp, syntheticBlocks.length, [...consumedIds]));
    }
  }

  const kept = reclassified.filter((b) => !consumedIds.has(b.id) || String(b.type).toLowerCase() === 'experience');
  const outBlocks = [...kept, ...syntheticBlocks];

  hirelyDebugLog(EXPERIENCE_BLOCK_MERGE, {
    inputBlocks: list.length,
    harvestedLines: harvested.length,
    mergedExperiences: experiences.length,
    syntheticBlocks: syntheticBlocks.length,
  });

  return {
    blocks: outBlocks,
    experiences,
    mergedCount: experiences.length,
    stats: {
      harvestedLines: harvested.length,
      consumedBlocks: consumedIds.size,
      groupCount: groups.length,
    },
  };
}

/**
 * Push merged experiences into structured resume (deduped).
 * @param {object} structured
 * @param {object[]} experiences
 */
export function applyMergedExperiencesToStructured(structured, experiences = []) {
  if (!structured || !experiences.length) return structured;
  structured.experiences = structured.experiences || [];
  const seen = new Set(
    structured.experiences.map((e) =>
      [e.role, e.company, e.startDate].map((x) => String(x || '').toLowerCase()).join('|')
    )
  );
  for (const exp of experiences) {
    const key = [exp.role, exp.company, exp.startDate]
      .map((x) => String(x || '').toLowerCase())
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    structured.experiences.push({
      ...exp,
      clients: exp.clients || [],
      location: exp.location || '',
      bullets: exp.bullets || [],
    });
  }
  structured.metadata = {
    ...(structured.metadata || {}),
    experienceBlockMerge: {
      engine: EXPERIENCE_BLOCK_MERGE,
      added: experiences.length,
    },
  };
  return structured;
}
