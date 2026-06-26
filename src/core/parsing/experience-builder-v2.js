/**
 * EXPERIENCE_BUILDER_V2 — build experience entries from classified EXPERIENCE blocks only.
 *
 * Never parses raw text, unknown blocks, or skills/tools/education/contact blocks.
 * Valid shapes: date+role | date+company | role+company (latter only inside experience section).
 */

import { SECTION_IDS } from './section-types-v2.js';
import {
  buildExperienceEntryFromLineGroup,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  lineIsEducationData,
  lineIsSkillOrTagOnly,
} from './experience-parser.js';
import { mustNeverBeExperience, isAcademicEmploymentContext } from './education-confidence.js';
import { splitLinesIntoDateAnchoredGroups } from './block-reconstruction.js';
import { mergeUnsortedLines } from './no-data-loss.js';
import { titleCaseProfessional } from './parser-recovery.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const EXPERIENCE_BUILDER_V2 = 'EXPERIENCE_BUILDER_V2';
export const EXPERIENCE_BUILDER_MIN_CONFIDENCE = 80;
export const EXPERIENCE_BUILDER_SECTION_MIN_CONFIDENCE = 72;

/** @deprecated alias */
export const EXPERIENCE_PARSER_V2 = EXPERIENCE_BUILDER_V2;
/** @deprecated alias */
export const EXPERIENCE_V2_CONFIDENCE_MIN = EXPERIENCE_BUILDER_MIN_CONFIDENCE;

const FORBIDDEN_SECTIONS = new Set([
  SECTION_IDS.SKILLS,
  SECTION_IDS.TOOLS,
  SECTION_IDS.CLIENTS,
  SECTION_IDS.EDUCATION,
  SECTION_IDS.CONTACT,
  SECTION_IDS.SUMMARY,
  SECTION_IDS.UNKNOWN,
  SECTION_IDS.LANGUAGES,
  SECTION_IDS.PROJECTS,
  SECTION_IDS.PROFILE,
  SECTION_IDS.PREAMBLE,
]);

const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i;
const DATE_ONLY_RE =
  /^\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|actuel)\s*$/i;

const AGE_AS_ROLE_RE = /\b\d{1,2}[-\s]?year\s*old\b|\byear\s*old\b/i;
const INVALID_ROLE_RE = /^(music|product design|adobe|créapole|creapole|graphic design)$/i;

function lineHasDate(line) {
  const l = String(line || '');
  return DATE_RANGE_RE.test(l) || DATE_ONLY_RE.test(l.trim()) || /\b(19|20)\d{2}\b/.test(l);
}

function blockLines(block) {
  return (block?.lines || [])
    .map((l) => (typeof l === 'string' ? l : l?.text || ''))
    .map((l) => String(l).trim())
    .filter(Boolean);
}

function blockHasDate(block, lines) {
  if (block?.signals?.hasDate) return true;
  return (lines || []).some(lineHasDate);
}

function inExperienceSection(block) {
  if (block?.type !== SECTION_IDS.EXPERIENCE) return false;
  return (
    block.sectionHint === 'experience' ||
    /experience|date_anchor|role_with_date|role_company|company_with_date/i.test(
      block.classifyReason || ''
    ) ||
    block.anchor === 'date'
  );
}

function isDateOnlyLines(lines) {
  return lines.length >= 1 && lines.every((l) => DATE_ONLY_RE.test(l) || (lineHasDate(l) && l.length < 16));
}

/**
 * @param {import('./section-types-v2.js').SectionBlockV2[]} classifiedBlocks
 */
export function filterExperienceBlocksOnly(classifiedBlocks) {
  return (classifiedBlocks || []).filter((b) => {
    if (!b?.type) return false;
    if (FORBIDDEN_SECTIONS.has(b.type)) return false;
    return b.type === SECTION_IDS.EXPERIENCE;
  });
}

/**
 * Merge date-only block with the following role/company block.
 * @param {object[]} blocks
 */
export function mergeAdjacentExperienceBlocks(blocks) {
  const merged = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = blockLines(block);
    if (isDateOnlyLines(lines) && i + 1 < blocks.length) {
      const next = blocks[i + 1];
      const nextLines = blockLines(next);
      if (nextLines.length && !isDateOnlyLines(nextLines)) {
        merged.push({
          ...next,
          id: `${block.id || i}+${next.id || i + 1}`,
          lines: [...lines, ...nextLines],
          signals: { ...(next.signals || {}), hasDate: true },
          classifyReason: next.classifyReason || block.classifyReason,
          sectionHint: next.sectionHint || block.sectionHint || 'experience',
          mergedFrom: [block.id, next.id].filter(Boolean),
        });
        i++;
        continue;
      }
    }
    merged.push(block);
  }
  return merged;
}

/**
 * @param {object} entry
 */
export function normalizeExperienceFields(entry) {
  if (!entry) return entry;
  let role = String(entry.role || '').trim();
  let company = String(entry.company || '').trim();

  if (
    /^independent\s*\/\s*freelance$/i.test(role) &&
    (/\bfreelanc/i.test(company) || /illustrator|designer|director/i.test(company))
  ) {
    role = company;
    company = 'Independent / Freelance';
  }

  const embeddedFreelance = role.match(/^(.+?)\s+Independent\s*\/\s*Freelance\s*$/i);
  if (embeddedFreelance) {
    role = embeddedFreelance[1].trim();
    company = 'Independent / Freelance';
  }

  if (/\bfreelancer\b/i.test(role)) {
    role = role.replace(/\bfreelancer\b/gi, 'Freelance').replace(/\s+/g, ' ').trim();
  }
  if (/\bfreelanc/i.test(role) && (!company || /^independent\b/i.test(company))) {
    company = 'Independent / Freelance';
  }

  if (/\binternship\b/i.test(company) && !/\bintern\b/i.test(role)) {
    company = company.replace(/\s+internship\s*$/i, '').trim();
    role = role || 'Intern';
  }
  if (!role && /\binternship\b/i.test(company)) {
    company = company.replace(/\s+internship\s*$/i, '').trim();
    role = 'Intern';
  }
  if (/^(.+?)\s+internship\s*$/i.test(role)) {
    const m = role.match(/^(.+?)\s+internship\s*$/i);
    if (m && !company) company = m[1].trim();
    role = 'Intern';
  }

  entry.role = role ? titleCaseProfessional(role) : '';
  entry.company = company;
  return entry;
}

/**
 * @param {object} entry
 * @param {object} ctx
 */
export function validateExperienceCandidate(entry, ctx = {}) {
  const role = String(entry?.role || '').trim();
  const company = String(entry?.company || '').trim();
  const startDate = String(entry?.startDate || '').trim();
  const inSection = ctx.inExperienceSection === true;
  const contextLine = String(ctx.sourceLine || ctx.lines?.join('\n') || `${role} — ${company}`).trim();
  const academicEmployment = isAcademicEmploymentContext(contextLine, entry);

  if (!role && !company) {
    return { ok: false, reason: 'missing_role_and_company' };
  }

  const hasDate = !!startDate;
  const hasRole = role.length > 0;
  const hasCompany = company.length > 0;
  const validShape =
    (hasDate && hasRole) ||
    (hasDate && hasCompany) ||
    (hasRole && hasCompany && inSection);

  if (!validShape) {
    return { ok: false, reason: 'insufficient_signals' };
  }

  if (!hasDate && !inSection) {
    return { ok: false, reason: 'no_date_outside_experience_section' };
  }

  if (role) {
    if (AGE_AS_ROLE_RE.test(role)) return { ok: false, reason: 'age_as_role' };
    if (INVALID_ROLE_RE.test(role.toLowerCase())) return { ok: false, reason: 'invalid_role_tag' };
    if (lineIsSkillOrTagOnly(role)) return { ok: false, reason: 'skill_tag_as_role' };
    if (!academicEmployment && (lineIsEducationData(role) || mustNeverBeExperience(role))) {
      return { ok: false, reason: 'school_as_role' };
    }
  }

  if (company) {
    if (!academicEmployment && (lineIsEducationData(company) || mustNeverBeExperience(company))) {
      return { ok: false, reason: 'school_as_company' };
    }
    if (lineIsSkillOrTagOnly(company)) return { ok: false, reason: 'skill_tag_as_company' };
    if (INVALID_ROLE_RE.test(company.toLowerCase())) return { ok: false, reason: 'invalid_company_tag' };
  }

  if (hasDate && !qualifiesStrictExperience(entry, contextLine)) {
    return { ok: false, reason: 'strict_gate_failed' };
  }

  if (!hasDate && inSection && hasRole && hasCompany) {
    if (role.length > 120 || company.length > 72) return { ok: false, reason: 'oversized_fields' };
    if (AGE_AS_ROLE_RE.test(role)) return { ok: false, reason: 'age_as_role' };
    const confidence = scoreStrictExperienceEntry({ ...entry, startDate: '0000' }) - 28;
    if (confidence < EXPERIENCE_BUILDER_SECTION_MIN_CONFIDENCE) {
      return { ok: false, reason: 'low_confidence', confidence };
    }
    return { ok: true, confidence, noDateSectionEntry: true };
  }

  const confidence = scoreStrictExperienceEntry(entry, contextLine);
  const minConf = ctx.minConfidence ?? EXPERIENCE_BUILDER_MIN_CONFIDENCE;
  if (confidence < minConf) {
    return { ok: false, reason: 'low_confidence', confidence };
  }

  return { ok: true, confidence };
}

function logExperienceBuilderAudit(candidates, accepted, rejected) {
  hirelyDebugLog('EXPERIENCE_CANDIDATES', {
    engine: EXPERIENCE_BUILDER_V2,
    count: candidates.length,
    preview: candidates.slice(0, 8).map((c) => ({
      blockId: c.blockId,
      lines: c.lines.length,
      text: c.lines.join(' | ').slice(0, 96),
    })),
  });
  hirelyDebugLog('EXPERIENCE_ACCEPTED', {
    count: accepted.length,
    roles: accepted.map((a) => a.entry.role).slice(0, 8),
    companies: accepted.map((a) => a.entry.company).slice(0, 8),
  });
  hirelyDebugLog('EXPERIENCE_REJECTED', {
    count: rejected.length,
    reasons: rejected.slice(0, 8).map((r) => r.reason),
  });
  hirelyDebugLog(
    'REJECTION_REASON',
    rejected.slice(0, 12).map((r) => ({
      reason: r.reason,
      confidence: r.confidence ?? null,
      preview: r.preview || r.lines?.join(' | ').slice(0, 72) || null,
    }))
  );
}

/**
 * @param {import('./section-types-v2.js').SectionBlockV2[]} classifiedBlocks
 * @param {object} [opts]
 */
export function buildExperiencesFromClassifiedBlocks(classifiedBlocks, opts = {}) {
  const minConfidence = opts.minConfidence ?? EXPERIENCE_BUILDER_MIN_CONFIDENCE;
  const experiences = [];
  const unsorted = [];
  const seen = new Set();

  /** @type {object[]} */
  const candidates = [];
  /** @type {object[]} */
  const accepted = [];
  /** @type {object[]} */
  const rejected = [];

  const experienceBlocks = mergeAdjacentExperienceBlocks(
    filterExperienceBlocksOnly(classifiedBlocks)
  );

  for (const block of experienceBlocks) {
    const blockLinesList = blockLines(block);
    if (!blockLinesList.length) continue;

    const hasDate = blockHasDate(block, blockLinesList);
    const inSection = inExperienceSection(block) || block.sectionHint === 'experience';

    const groups =
      block.anchor === 'date' || hasDate
        ? splitLinesIntoDateAnchoredGroups(blockLinesList)
        : [blockLinesList];

    if (!groups.length) groups.push(blockLinesList);

    for (const group of groups) {
      const filtered = group.filter(
        (line) => !lineIsEducationData(line) && !lineIsSkillOrTagOnly(line)
      );

      if (!filtered.length) {
        group.forEach((line) => unsorted.push(line));
        rejected.push({
          lines: group,
          reason: 'education_or_skill_line',
          confidence: 0,
          blockId: block.id || null,
        });
        continue;
      }

      if (!hasDate && !filtered.some(lineHasDate) && !inSection) {
        filtered.forEach((line) => unsorted.push(line));
        rejected.push({
          lines: filtered,
          reason: 'no_date_outside_experience_section',
          confidence: 0,
          blockId: block.id || null,
        });
        continue;
      }

      candidates.push({ lines: filtered, blockId: block.id || null });

      let entry = buildExperienceEntryFromLineGroup(filtered);
      if (!entry && inSection && filtered.length >= 2) {
        entry = buildExperienceEntryFromLineGroup(filtered);
      }
      if (!entry) {
        filtered.forEach((line) => unsorted.push(line));
        rejected.push({
          lines: filtered,
          reason: 'invalid_candidate',
          confidence: 0,
          blockId: block.id || null,
        });
        continue;
      }

      entry = normalizeExperienceFields(entry);
      const validation = validateExperienceCandidate(entry, {
        inExperienceSection: inSection,
        hasDateInBlock: hasDate || filtered.some(lineHasDate),
        minConfidence,
        sourceLine: filtered.join('\n'),
        lines: filtered,
      });

      if (validation.ok) {
        const key = `${entry.role}|${entry.company}|${entry.startDate}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          const { confidence: _c, ...rest } = entry;
          experiences.push(rest);
          accepted.push({
            entry: rest,
            confidence: validation.confidence,
            lines: filtered,
            blockId: block.id || null,
          });
        } else {
          rejected.push({
            lines: filtered,
            reason: 'duplicate_entry',
            confidence: validation.confidence,
            preview: { role: entry.role, company: entry.company, startDate: entry.startDate },
            blockId: block.id || null,
          });
        }
      } else {
        filtered.forEach((line) => unsorted.push(line));
        rejected.push({
          lines: filtered,
          reason: validation.reason,
          confidence: validation.confidence ?? 0,
          preview: { role: entry.role, company: entry.company, startDate: entry.startDate },
          blockId: block.id || null,
        });
      }
    }
  }

  logExperienceBuilderAudit(candidates, accepted, rejected);

  return {
    engine: EXPERIENCE_BUILDER_V2,
    experiences: experiences.slice(0, 16),
    unsorted: [...new Set(unsorted.map((l) => String(l).trim()).filter(Boolean))],
    audit: { candidates, accepted, rejected },
  };
}

/** @deprecated use buildExperiencesFromClassifiedBlocks */
export function parseExperiencesFromExperienceBlocks(experienceBlocks, opts = {}) {
  return buildExperiencesFromClassifiedBlocks(experienceBlocks, opts);
}

/**
 * @param {object} structured
 * @param {string[]} unsortedLines
 */
export function applyExperienceV2Unsorted(structured, unsortedLines) {
  if (!structured || !unsortedLines?.length) return structured;
  structured.unsorted = mergeUnsortedLines(structured.unsorted, unsortedLines);
  structured.metadata = {
    ...(structured.metadata || {}),
    experienceBuilderV2: EXPERIENCE_BUILDER_V2,
    experienceParserV2: EXPERIENCE_BUILDER_V2,
  };
  return structured;
}
