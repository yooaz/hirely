/**
 * Semantic line classifier — entity/dictionary/role signals (not regex → fields).
 */

import { SEMANTIC_LINE } from './semantic-line-types.js';
import { lineLooksLikeRole, lineIsRoleOnly } from '../../data/dictionaries/roleKeywords.js';
import {
  isValidIdentityName,
  isValidIdentityTitle,
} from './identity-extraction.js';
import { resolveLineEntities } from './entity-engine.js';
import { mustNeverBeExperience, hasEducationSchool, hasEducationDegree } from './education-confidence.js';
import {
  hasExperienceDate,
  passesExperienceGate,
  isLikelySkillLine,
  isLikelyPortfolioProject,
} from './section-sanity.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { detectSectionHeaderId } from './section-detect-v2.js';
import {
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
  classifyLineByDictionary,
} from '../../data/dictionaries/json-dictionary-match.js';
import { isLikelyTool, isLikelyLanguage, isLikelyInterest } from './line-cleaner.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|linkedin\.com|behance\.|dribbble\./i;
const BULLET_RE = /^[-•*]\s+/;

/**
 * @param {string} semantic
 */
export function semanticToSectionTarget(semantic) {
  const map = {
    [SEMANTIC_LINE.IDENTITY_NAME]: 'PROFILE',
    [SEMANTIC_LINE.IDENTITY_ROLE]: 'PROFILE',
    [SEMANTIC_LINE.CONTACT]: 'CONTACT',
    [SEMANTIC_LINE.SUMMARY]: 'SUMMARY',
    [SEMANTIC_LINE.DATE_RANGE]: 'EXPERIENCE',
    [SEMANTIC_LINE.JOB_ENTRY]: 'EXPERIENCE',
    [SEMANTIC_LINE.COMPANY]: 'EXPERIENCE',
    [SEMANTIC_LINE.BULLET]: 'EXPERIENCE',
    [SEMANTIC_LINE.EDUCATION]: 'EDUCATION',
    [SEMANTIC_LINE.SKILL]: 'SKILLS',
    [SEMANTIC_LINE.TOOL]: 'TOOLS',
    [SEMANTIC_LINE.CLIENT]: 'CLIENTS',
    [SEMANTIC_LINE.LANGUAGE]: 'LANGUAGES',
    [SEMANTIC_LINE.PROJECT]: 'PROJECTS',
    [SEMANTIC_LINE.AWARD]: 'AWARDS',
    [SEMANTIC_LINE.INTEREST]: 'UNKNOWN',
    [SEMANTIC_LINE.SECTION_HEADER]: 'HEADER',
    [SEMANTIC_LINE.UNKNOWN]: 'UNKNOWN',
  };
  return map[semantic] || 'UNKNOWN';
}

/**
 * Understand role lines (e.g. "Graphic Designer") without an Experience section title.
 * @param {string} line
 */
export function isSemanticRoleLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 72) return false;
  if (mustNeverBeExperience(l)) return false;
  if (hasExperienceDate(l) && extractDateRangeFromText(l).startDate) return false;
  if (isValidIdentityTitle(l)) return true;
  if (lineIsRoleOnly(l)) return true;
  if (lineLooksLikeRole(l) && l.length < 52 && !EMAIL_RE.test(l) && !URL_RE.test(l)) {
    const words = l.split(/\s+/).filter(Boolean);
    return words.length >= 1 && words.length <= 6;
  }
  return false;
}

/**
 * @param {string} line
 * @param {object} [ctx]
 */
export function classifySemanticLine(line, ctx = {}) {
  const l = String(line || '').trim();
  const lineIndex = ctx.lineIndex ?? 0;

  if (!l) {
    return emptySemantic(lineIndex);
  }

  const headerId = detectSectionHeaderId(l);
  if (headerId || isSectionHeaderLine(l)) {
    return pack(SEMANTIC_LINE.SECTION_HEADER, 94, 'section_header_optional', lineIndex, {
      headerId: headerId || null,
    });
  }

  if (isValidIdentityName(l)) {
    return pack(SEMANTIC_LINE.IDENTITY_NAME, 90, 'semantic_name', lineIndex);
  }

  if (isSemanticRoleLine(l)) {
    return pack(SEMANTIC_LINE.IDENTITY_ROLE, lineIsRoleOnly(l) ? 92 : 86, 'semantic_role', lineIndex);
  }

  if (EMAIL_RE.test(l) || PHONE_RE.test(l) || URL_RE.test(l)) {
    return pack(SEMANTIC_LINE.CONTACT, 88, 'semantic_contact', lineIndex);
  }

  if (mustNeverBeExperience(l) || hasEducationSchool(l) || hasEducationDegree(l)) {
    return pack(SEMANTIC_LINE.EDUCATION, 88, 'semantic_education', lineIndex);
  }

  const dates = extractDateRangeFromText(l);
  if (dates.startDate) {
    if (ctx.activeSection === 'education') {
      return pack(SEMANTIC_LINE.EDUCATION, 86, 'semantic_education_dated', lineIndex, { dates });
    }
    if (ctx.activeSection === 'languages' || isLikelyLanguage(l)) {
      return pack(SEMANTIC_LINE.LANGUAGE, 82, 'semantic_language_dated', lineIndex, { dates });
    }
    return pack(SEMANTIC_LINE.DATE_RANGE, 90, 'semantic_date_range', lineIndex, { dates });
  }

  if (BULLET_RE.test(l)) {
    return pack(SEMANTIC_LINE.BULLET, 80, 'semantic_bullet', lineIndex);
  }

  const entityResolved = resolveLineEntities(l, { threshold: 58, activeSection: ctx.activeSection });
  if (entityResolved?.shouldClassify && entityResolved.blockType) {
    const sem = entityBlockToSemantic(entityResolved.blockType);
    if (sem) {
      return pack(sem, entityResolved.confidence, 'entity_semantic', lineIndex, {
        entity: entityResolved.primary?.entity,
      });
    }
  }

  if (findLongestDictionaryTerm(l, TOOL_TERMS) || isLikelyTool(l)) {
    return pack(SEMANTIC_LINE.TOOL, 84, 'semantic_tool', lineIndex);
  }

  if (findLongestDictionaryTerm(l, CLIENT_TERMS) && !passesExperienceGate(l)) {
    return pack(SEMANTIC_LINE.CLIENT, 82, 'semantic_client', lineIndex);
  }

  if (isLikelyLanguage(l)) {
    return pack(SEMANTIC_LINE.LANGUAGE, 82, 'semantic_language', lineIndex);
  }

  if (isLikelyInterest(l)) {
    return pack(SEMANTIC_LINE.INTEREST, 70, 'semantic_interest', lineIndex);
  }

  if (isLikelySkillLine(l) && !isLikelyTool(l)) {
    return pack(SEMANTIC_LINE.SKILL, 78, 'semantic_skill', lineIndex);
  }

  if (isLikelyPortfolioProject(l)) {
    return pack(SEMANTIC_LINE.PROJECT, 76, 'semantic_project', lineIndex);
  }

  if (passesExperienceGate(l)) {
    return pack(SEMANTIC_LINE.JOB_ENTRY, 85, 'semantic_job_entry', lineIndex);
  }

  if (l.length > 48 && /\b(years?|experience|passion|profile|creative)\b/i.test(l)) {
    return pack(SEMANTIC_LINE.SUMMARY, 72, 'semantic_summary', lineIndex);
  }

  const dict = classifyLineByDictionary(l);
  if (dict?.bucket === 'education') {
    return pack(SEMANTIC_LINE.EDUCATION, dict.confidence, 'dict_education', lineIndex);
  }

  if (l.length < 64 && /^[A-ZÀ-Ö][\w&.'-]+(?:\s+[A-ZÀ-Ö][\w&.'-]+){0,3}$/.test(l) && ctx.inExperienceZone) {
    return pack(SEMANTIC_LINE.COMPANY, 68, 'semantic_company_context', lineIndex);
  }

  return pack(SEMANTIC_LINE.UNKNOWN, 45, 'semantic_unknown', lineIndex);
}

function entityBlockToSemantic(blockType) {
  const map = {
    education: SEMANTIC_LINE.EDUCATION,
    clients: SEMANTIC_LINE.CLIENT,
    tools: SEMANTIC_LINE.TOOL,
    languages: SEMANTIC_LINE.LANGUAGE,
    contact: SEMANTIC_LINE.CONTACT,
    experience: SEMANTIC_LINE.JOB_ENTRY,
    skills: SEMANTIC_LINE.SKILL,
  };
  return map[blockType] || null;
}

function emptySemantic(lineIndex) {
  return pack(SEMANTIC_LINE.UNKNOWN, 0, 'empty', lineIndex);
}

function pack(semantic, confidence, reason, lineIndex, extra = {}) {
  return {
    semantic,
    confidence: Math.min(99, Math.round(confidence)),
    reason,
    lineIndex,
    sectionTarget: semanticToSectionTarget(semantic),
    ...extra,
  };
}

/**
 * @param {string} cleanedText
 * @param {object} [opts]
 * @param {import('../layout/layout-memory.js').LayoutMemory} [opts.layoutMemory]
 * @param {string[]} [opts.lines] — structure-first: pass ordered line texts without flattening
 * @param {import('../layout/spatial-block.js').SpatialBlock[]} [opts.spatialBlocks]
 */
export function classifySemanticLines(cleanedText, opts = {}) {
  const layoutMemory = opts.layoutMemory || null;
  const lines =
    opts.lines?.length > 0
      ? opts.lines.map((l) => String(l || '').trim()).filter(Boolean)
      : opts.spatialBlocks?.length > 0
        ? opts.spatialBlocks
            .slice()
            .sort((a, b) => (a.reading_order ?? 0) - (b.reading_order ?? 0))
            .map((b) => String(b.text || '').trim())
            .filter(Boolean)
        : layoutMemory?.entries?.length > 0
          ? layoutMemory.entries.map((e) => String(e.text || '').trim()).filter(Boolean)
          : String(cleanedText || '')
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);

  let activeSection = null;
  return lines.map((line, lineIndex) => {
    const layoutEntry = layoutMemory?.entries?.[lineIndex] || null;
    const headerId =
      detectSectionHeaderId(line) ||
      (isSectionHeaderLine(line) ? detectSectionHeaderId(line) : null);
    if (headerId) {
      activeSection = headerId;
    }

    const hit = classifySemanticLine(line, {
      lineIndex,
      inExperienceZone: activeSection === 'experience',
      activeSection,
      layoutEntry,
      columnId: layoutEntry?.columnId || opts.columnId,
      zone: layoutEntry?.zone,
    });

    if (hit.semantic === SEMANTIC_LINE.SECTION_HEADER && hit.headerId) {
      activeSection = hit.headerId;
    }
    if (hit.semantic === SEMANTIC_LINE.EDUCATION && hit.confidence >= 80) {
      activeSection = 'education';
    }
    return { line, ...hit };
  });
}
