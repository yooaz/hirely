/**
 * Dedicated CV skills block parser — skills section only, with pollution filtering.
 *
 * See SKILLS_BLOCK_PARSER_ASSUMPTIONS.md for classification rules.
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { splitListItems } from './rich-parser.js';
import { isStrictSoftwareLine, CREATIVE_SKILL_RE } from './classification-fixes.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { CV_SECTION } from './section-heading-dictionary.js';
import { normalizeCompareString } from './dedupe-engine.js';
import { SKILLS } from '../../data/dictionaries/skills.js';
import { textContainsAny, lineContainsAny } from '../../data/dictionaries/match-utils.js';
import {
  findBestEntity,
  SOFTWARE_RECOGNIZER,
  LANGUAGE_RECOGNIZER,
} from '../../data/dictionaries/entity-catalog.js';
import {
  findLongestDictionaryTerm,
  TOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import {
  isSkillsSectionPollution,
  isSoftSkillTerm,
  isOcrSkillFragment,
  pollutionReason,
  SKILLS_POLLUTION_FILTER,
} from './skills-section-pollution-filter.js';
import { lineIsClientList } from './field-sanitize.js';

export const SKILLS_BLOCK_PARSER = 'SKILLS_BLOCK_PARSER_V2';

/** Items below this confidence are rejected (not emitted). */
export const MIN_SKILLS_EMIT_CONFIDENCE = 0.55;

/** Cross-section harvest requires dictionary-backed tool + this floor. */
const CROSS_SECTION_TOOL_MIN_CONFIDENCE = 0.88;
export const SKILL_CATEGORY = Object.freeze({
  TECHNICAL: 'technical',
  TOOLS: 'tools',
  LANGUAGES: 'languages',
  SOFT: 'soft',
});

const BULLET_RE = /^[-•*]\s+/;

const TOOL_OCR_ALIASES = [
  { pattern: /^indesign$/i, label: 'InDesign' },
  { pattern: /^after\s+effects?$/i, label: 'After Effects' },
  { pattern: /^affinity\s+designer$/i, label: 'Affinity Designer' },
  { pattern: /^photoshop$/i, label: 'Photoshop' },
  { pattern: /^illustrator$/i, label: 'Illustrator' },
  { pattern: /^procreate$/i, label: 'Procreate' },
];

/**
 * @typedef {object} ParsedSkillItem
 * @property {string} name
 * @property {'technical'|'tools'|'languages'|'soft'} category
 * @property {string[]} source_block_ids
 * @property {number} confidence
 * @property {string} [parser]
 * @property {string} [source_section]
 * @property {boolean} [from_dictionary]
 */

/**
 * @typedef {object} SkillRejectionEvent
 * @property {'rejected'} action
 * @property {string} reason
 * @property {string} token
 * @property {string} [source_block_id]
 * @property {string} [source_line]
 * @property {number} [confidence]
 */

function isSkillsSectionTag(section) {
  return section === CV_SECTION.SKILLS || section === 'skills' || section === 'SKILLS';
}

/**
 * @param {string} token
 */
function isDictionaryBackedSkill(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  if (findBestEntity(t, SOFTWARE_RECOGNIZER)) return true;
  if (findBestEntity(t, LANGUAGE_RECOGNIZER)) return true;
  if (findLongestDictionaryTerm(t, TOOL_TERMS)) return true;
  if (lineContainsAny(t, SKILLS)) return true;
  for (const { pattern } of TOOL_OCR_ALIASES) {
    if (pattern.test(t)) return true;
  }
  if (isSoftSkillTerm(t)) return true;
  return false;
}

/**
 * @param {string} token
 * @param {object} meta
 */
function classifyRejectionReason(token, meta = {}) {
  const pollution = pollutionReason(token, meta.ctx || {});
  if (pollution) return pollution;
  if (isOcrSkillFragment(token) && !isDictionaryBackedSkill(token)) return 'ocr_fragment';
  if (!meta.classified) return 'not_in_allowlist';
  if (!meta.fromDictionary && meta.classified.category === SKILL_CATEGORY.TECHNICAL) {
    return 'technical_not_in_allowlist';
  }
  if (!meta.isSkillsSection && meta.classified.category !== SKILL_CATEGORY.TOOLS) {
    return 'cross_section_non_tool';
  }
  if (!meta.isSkillsSection && !meta.fromDictionary) return 'cross_section_no_dictionary';
  if ((meta.confidence || 0) < MIN_SKILLS_EMIT_CONFIDENCE) return 'low_confidence';
  if (!meta.isSkillsSection && (meta.confidence || 0) < CROSS_SECTION_TOOL_MIN_CONFIDENCE) {
    return 'cross_section_low_confidence';
  }
  return null;
}

/**
 * @param {string} line
 */
function isSectionHeaderLine(line) {
  const t = String(line || '').trim();
  return !!fuzzySectionKey(t) || /^(skills?|compétences|competences|tools?|outils)\b/i.test(t);
}

/**
 * @param {string} token
 */
function resolveToolDisplayName(token) {
  const t = String(token || '').trim();
  if (!t) return '';

  const hit = findBestEntity(t, SOFTWARE_RECOGNIZER);
  if (hit?.canonical) return hit.canonical;

  const term = findLongestDictionaryTerm(t, TOOL_TERMS);
  if (term) return term.trim();

  for (const { pattern, label } of TOOL_OCR_ALIASES) {
    if (pattern.test(t)) return label;
  }

  if (isStrictSoftwareLine(t)) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  return '';
}

/**
 * @param {string} token
 */
function resolveLanguageDisplayName(token) {
  const t = String(token || '').trim();
  const hit = findBestEntity(t, LANGUAGE_RECOGNIZER);
  if (hit?.canonical) return hit.canonical;
  return '';
}

/**
 * @param {string} token
 */
function isTechnicalSkillToken(token) {
  const t = String(token || '').trim();
  if (!t || t.length < 3) return false;
  if (resolveToolDisplayName(t)) return false;
  if (lineContainsAny(t, SKILLS)) return true;
  if (CREATIVE_SKILL_RE.test(t) && t.length <= 48) return true;
  return false;
}

/**
 * Comma-separated skills in a tagged skills section — accept when pollution-free.
 * Applies to business, academic, and sales resume families without dictionary hits.
 * @param {string} token
 * @param {object} ctx
 */
function isGenericSkillsSectionPhrase(token, ctx = {}) {
  if (!ctx.isSkillsSection) return false;
  const t = String(token || '').trim();
  if (t.length < 3 || t.length > 56) return false;
  if (isSkillsSectionPollution(t, ctx)) return false;
  if (isSectionHeaderLine(t)) return false;
  if (/\b(19|20)\d{2}\b/.test(t)) return false;
  if (/@/.test(t) || /https?:\/\//i.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 7) return false;
  return /[a-zà-ÿ]/i.test(t);
}

/**
 * @param {string} token
 * @param {object} ctx
 */
function categorizeSkillToken(token, ctx = {}) {
  const lang = resolveLanguageDisplayName(token);
  if (lang) return { category: SKILL_CATEGORY.LANGUAGES, name: lang };

  const tool = resolveToolDisplayName(token);
  if (tool) return { category: SKILL_CATEGORY.TOOLS, name: tool };

  if (isSoftSkillTerm(token)) {
    return { category: SKILL_CATEGORY.SOFT, name: String(token).trim() };
  }

  if (isTechnicalSkillToken(token)) {
    const name = String(token).trim();
    return { category: SKILL_CATEGORY.TECHNICAL, name };
  }

  if (isGenericSkillsSectionPhrase(token, ctx)) {
    const name = String(token).trim();
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    return { category: SKILL_CATEGORY.SOFT, name: label };
  }

  return null;
}

/**
 * @param {string} token
 * @param {object} ctx
 */
function scoreSkillConfidence(token, meta = {}) {
  let score = 0.45;
  if (meta.isSkillsSection) score += 0.28;
  if (meta.category === SKILL_CATEGORY.TOOLS) score += 0.18;
  if (meta.category === SKILL_CATEGORY.TECHNICAL) score += 0.12;
  if (meta.category === SKILL_CATEGORY.LANGUAGES) score += 0.15;
  if (meta.category === SKILL_CATEGORY.SOFT) score += 0.1;
  if (meta.fromDictionary) score += 0.12;
  if (meta.isSkillsSection && !meta.fromDictionary && meta.category === SKILL_CATEGORY.TECHNICAL) {
    score -= 0.15;
  }
  if (!meta.isSkillsSection) score -= 0.35;
  if (lineIsClientList(meta.sourceLine || '')) score -= 0.5;
  return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
}

/**
 * @typedef {object} SkillSourceBlock
 * @property {string} text
 * @property {string} [block_id]
 * @property {number} [reading_order]
 * @property {string} [section]
 */

/**
 * Section purity — how much of the skills-tagged input looks like real skill tokens.
 * @param {SkillSourceBlock[]} blocks
 */
export function assessSkillsSectionPurity(blocks = []) {
  const skillsBlocks = (blocks || []).filter((b) => isSkillsSectionTag(b.section));
  let candidates = 0;
  let polluted = 0;
  let dictionaryBacked = 0;
  /** @type {string[]} */
  const issues = [];

  for (const block of skillsBlocks) {
    const text = String(block.text || '').trim();
    if (!text || isSectionHeaderLine(text)) continue;
    const parts = splitListItems(text.replace(BULLET_RE, ''));
    const tokens = parts.length ? parts : [text];
    for (const raw of tokens) {
      const token = String(raw || '').trim();
      if (!token) continue;
      candidates++;
      const ctx = { sourceLine: text, isSkillsSection: true, section: block.section };
      if (isSkillsSectionPollution(token, ctx)) {
        polluted++;
        continue;
      }
      if (isDictionaryBackedSkill(token) || isTechnicalSkillToken(token)) {
        dictionaryBacked++;
      }
    }
  }

  const purityRatio =
    candidates > 0 ? Math.round(((candidates - polluted) / candidates) * 1000) / 1000 : 1;
  const supportRatio =
    candidates > 0 ? Math.round((dictionaryBacked / candidates) * 1000) / 1000 : 1;

  if (candidates === 0) issues.push('no_skill_candidates');
  if (purityRatio < 0.55) issues.push('high_pollution_ratio');
  if (supportRatio < 0.4 && candidates >= 3) issues.push('low_dictionary_support');

  return {
    skills_blocks: skillsBlocks.length,
    candidates,
    polluted,
    dictionary_backed: dictionaryBacked,
    purity_ratio: purityRatio,
    dictionary_support_ratio: supportRatio,
    strict_pass: purityRatio >= 0.55 && (candidates === 0 || supportRatio >= 0.35),
    issues,
  };
}

/**
 * @param {ParsedSkillItem[]} items
 * @param {SkillRejectionEvent[]} reject_trace
 * @param {object} stats
 * @param {object} sectionPurity
 */
export function buildSkillsParseDebug(items, reject_trace = [], stats = {}, sectionPurity = {}) {
  return {
    version: SKILLS_BLOCK_PARSER,
    strategy: 'skills_section_only_allowlist',
    min_emit_confidence: MIN_SKILLS_EMIT_CONFIDENCE,
    pollution_filter: SKILLS_POLLUTION_FILTER,
    section_purity: sectionPurity,
    stats,
    events: reject_trace,
    items: (items || []).map((item) => ({
      name: item.name,
      category: item.category,
      confidence: item.confidence,
      from_dictionary: item.from_dictionary,
      source_block_ids: item.source_block_ids,
    })),
    generated_at: new Date().toISOString(),
  };
}

/**
 * @param {SkillSourceBlock} block
 * @param {object} [opts]
 * @returns {{ items: ParsedSkillItem[], rejections: SkillRejectionEvent[] }}
 */
function extractSkillsFromBlock(block, opts = {}) {
  const text = String(block.text || '').trim();
  if (!text || isSectionHeaderLine(text)) return { items: [], rejections: [] };

  const isSkillsSection = isSkillsSectionTag(block.section);
  const allowCrossSection = opts.allowCrossSection === true;
  if (!isSkillsSection && !allowCrossSection) return { items: [], rejections: [] };

  const ctx = {
    section: block.section,
    sourceLine: text,
    isSkillsSection,
  };

  const parts = splitListItems(text.replace(BULLET_RE, ''));
  const tokens = parts.length ? parts : [text];
  /** @type {ParsedSkillItem[]} */
  const out = [];
  /** @type {SkillRejectionEvent[]} */
  const rejections = [];

  for (const raw of tokens) {
    const token = String(raw || '').trim();
    if (!token) continue;

    const classified = categorizeSkillToken(token, ctx);
    const fromDictionary =
      !!findBestEntity(token, SOFTWARE_RECOGNIZER) ||
      !!findBestEntity(token, LANGUAGE_RECOGNIZER) ||
      !!findLongestDictionaryTerm(token, TOOL_TERMS) ||
      lineContainsAny(token, SKILLS) ||
      TOOL_OCR_ALIASES.some(({ pattern }) => pattern.test(token));

    const confidence = classified
      ? scoreSkillConfidence(token, {
          isSkillsSection,
          category: classified.category,
          fromDictionary,
          sourceLine: text,
        })
      : 0;

    const rejectReason = classifyRejectionReason(token, {
      ctx,
      classified,
      isSkillsSection,
      fromDictionary,
      confidence,
    });

    if (rejectReason) {
      rejections.push({
        action: 'rejected',
        reason: rejectReason,
        token,
        source_block_id: block.block_id,
        source_line: text,
        confidence,
      });
      continue;
    }

    out.push({
      name: classified.name,
      category: classified.category,
      source_block_ids: block.block_id ? [block.block_id] : [],
      confidence,
      parser: SKILLS_BLOCK_PARSER,
      source_section: block.section || '',
      from_dictionary: fromDictionary,
    });
  }

  return { items: out, rejections };
}

/**
 * @param {ParsedSkillItem[]} items
 */
export function dedupeSkillBlockItems(items = []) {
  const byKey = new Map();

  for (const item of items || []) {
    const key = `${item.category}|${normalizeCompareString(item.name)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
      continue;
    }
    existing.confidence = Math.max(existing.confidence, item.confidence);
    existing.source_block_ids = [
      ...new Set([...(existing.source_block_ids || []), ...(item.source_block_ids || [])]),
    ];
  }

  return [...byKey.values()];
}

/**
 * @param {ParsedSkillItem[]} items
 */
function groupSkillsByCategory(items) {
  /** @type {Record<string, string[]>} */
  const groups = {
    [SKILL_CATEGORY.TECHNICAL]: [],
    [SKILL_CATEGORY.TOOLS]: [],
    [SKILL_CATEGORY.LANGUAGES]: [],
    [SKILL_CATEGORY.SOFT]: [],
  };

  for (const item of items) {
    const cat = item.category || SKILL_CATEGORY.TECHNICAL;
    if (!groups[cat]) groups[cat] = [];
    const low = item.name.toLowerCase();
    if (!groups[cat].some((n) => n.toLowerCase() === low)) {
      groups[cat].push(item.name);
    }
  }

  return groups;
}

/**
 * @param {SkillSourceBlock[]|import('./section-segmenter.js').SegmentedBlock[]} blocks
 * @param {object} [opts]
 * @returns {{ items: ParsedSkillItem[], byCategory: object, stats: object }}
 */
export function parseSkillsSectionBlocks(blocks, opts = {}) {
  const normalized = (blocks || [])
    .map((b, i) => ({
      text: String(b.text || '').trim(),
      block_id: b.block_id || b.id || `skill-b-${i}`,
      reading_order: b.reading_order ?? i,
      section: b.section,
    }))
    .filter((b) => b.text);

  const skillsBlocks = opts.allSections
    ? normalized
    : normalized.filter(
        (b) =>
          b.section === CV_SECTION.SKILLS ||
          b.section === 'skills' ||
          b.section === 'SKILLS'
      );

  const crossSectionBlocks = opts.allowCrossSection
    ? normalized.filter(
        (b) =>
          b.section &&
          b.section !== CV_SECTION.SKILLS &&
          b.section !== 'skills' &&
          b.section !== 'SKILLS'
      )
    : [];

  const sectionPurity = assessSkillsSectionPurity(skillsBlocks);

  /** @type {ParsedSkillItem[]} */
  const rawItems = [];
  /** @type {SkillRejectionEvent[]} */
  const reject_trace = [];

  for (const b of skillsBlocks) {
    const { items, rejections } = extractSkillsFromBlock(b, opts);
    rawItems.push(...items);
    reject_trace.push(...rejections);
  }
  for (const b of crossSectionBlocks) {
    const { items, rejections } = extractSkillsFromBlock(b, { ...opts, allowCrossSection: true });
    rawItems.push(...items);
    reject_trace.push(...rejections);
  }

  const items = dedupeSkillBlockItems(rawItems);
  const byCategory = groupSkillsByCategory(items);

  const stats = {
    inputBlocks: normalized.length,
    skillsBlocks: skillsBlocks.length,
    crossSectionBlocks: crossSectionBlocks.length,
    extracted: rawItems.length,
    deduped: items.length,
    rejected: reject_trace.length,
    tools: byCategory[SKILL_CATEGORY.TOOLS].length,
    technical: byCategory[SKILL_CATEGORY.TECHNICAL].length,
    languages: byCategory[SKILL_CATEGORY.LANGUAGES].length,
    soft: byCategory[SKILL_CATEGORY.SOFT].length,
    pollutionFilter: SKILLS_POLLUTION_FILTER,
    sectionPurity,
    avgConfidence:
      items.length > 0
        ? Math.round((items.reduce((s, e) => s + e.confidence, 0) / items.length) * 1000) / 1000
        : 0,
  };

  const parse_debug = buildSkillsParseDebug(items, reject_trace, stats, sectionPurity);

  if (opts.debug === true || (typeof globalThis !== 'undefined' && globalThis.HIRELY_DEBUG)) {
    hirelyDebugLog('SKILLS_PARSE_DEBUG', parse_debug);
  }

  hirelyDebugLog('SKILLS_BLOCK_PARSER', stats);

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_SKILLS_BLOCK_PARSER = {
      items,
      byCategory,
      stats,
      reject_trace,
      parse_debug,
    };
  }

  return { items, byCategory, stats, reject_trace, parse_debug, section_purity: sectionPurity };
}

/**
 * @param {string[]|string} lines
 * @param {object} [opts]
 */
export function parseSkillsLines(lines, opts = {}) {
  const list = Array.isArray(lines)
    ? lines
    : String(lines || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
  return parseSkillsSectionBlocks(
    list.map((text, i) => ({
      text,
      block_id: `line-${i}`,
      reading_order: i,
      section: CV_SECTION.SKILLS,
    })),
    opts
  );
}

/**
 * @param {import('./section-segmenter.js').SegmentedBlock[]} segments
 * @param {object} [opts]
 */
export function parseSkillsFromSegments(segments, opts = {}) {
  return parseSkillsSectionBlocks(segments || [], opts);
}
