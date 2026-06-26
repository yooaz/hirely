/**
 * Infer sections from semantic blocks — no dependency on section titles.
 */

import { SECTION_IDS } from './section-types-v2.js';
import { SEMANTIC_LINE, SEMANTIC_PARSE_MODE } from './semantic-line-types.js';
import { classifySemanticLines, semanticToSectionTarget } from './semantic-line-classifier.js';
import { detectSectionHeaderId } from './section-detect-v2.js';
import { recordFlattenIfActive } from '../blocks/flat-text-guard.js';

const TARGET_TO_SECTION_ID = {
  PROFILE: SECTION_IDS.PROFILE,
  CONTACT: SECTION_IDS.CONTACT,
  SUMMARY: SECTION_IDS.SUMMARY,
  EXPERIENCE: SECTION_IDS.EXPERIENCE,
  EDUCATION: SECTION_IDS.EDUCATION,
  SKILLS: SECTION_IDS.SKILLS,
  TOOLS: SECTION_IDS.TOOLS,
  LANGUAGES: SECTION_IDS.LANGUAGES,
  CLIENTS: SECTION_IDS.CLIENTS,
  PROJECTS: SECTION_IDS.PROJECTS,
  AWARDS: SECTION_IDS.AWARDS,
  PUBLICATIONS: SECTION_IDS.PUBLICATIONS,
  EXHIBITIONS: SECTION_IDS.EXHIBITIONS,
  PORTFOLIO: SECTION_IDS.PORTFOLIO,
  UNKNOWN: SECTION_IDS.UNKNOWN,
  HEADER: SECTION_IDS.UNKNOWN,
};

/**
 * Map semantic target → SECTION_IDS (header hints optional).
 * @param {object} hit
 * @param {string|null} headerId
 */
function resolveSectionId(hit, headerId) {
  if (headerId) return headerId;
  const target = hit.sectionTarget || semanticToSectionTarget(hit.semantic);
  return TARGET_TO_SECTION_ID[target] || SECTION_IDS.UNKNOWN;
}

/**
 * Ordered line texts from structure-first inputs (no string join).
 * @param {object} opts
 * @returns {string[]}
 */
function resolveStructuredLines(cleanedText, opts = {}) {
  if (opts.lines?.length > 0) {
    return opts.lines.map((l) => String(l || '').trim()).filter(Boolean);
  }
  if (opts.spatialBlocks?.length > 0) {
    return opts.spatialBlocks
      .slice()
      .sort((a, b) => (a.reading_order ?? 0) - (b.reading_order ?? 0))
      .map((b) => String(b.text || '').trim())
      .filter(Boolean);
  }
  const layoutMemory = opts.layoutMemory || null;
  if (layoutMemory?.entries?.length > 0) {
    return layoutMemory.entries.map((e) => String(e.text || '').trim()).filter(Boolean);
  }
  if (opts.structureFirst) {
    recordFlattenIfActive('semantic_infer', 'plain-text split fallback');
  }
  return String(cleanedText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * @param {string} cleanedText
 * @param {object} [opts]
 * @param {import('../layout/layout-memory.js').LayoutMemory} [opts.layoutMemory]
 * @param {import('../layout/spatial-block.js').SpatialBlock[]} [opts.spatialBlocks]
 * @param {string[]} [opts.lines]
 * @param {boolean} [opts.structureFirst]
 * @returns {{ lines: string[], blocks: import('./section-types-v2.js').SectionBlockV2[], semanticLines: object[] }}
 */
export function inferSemanticSectionBlocks(cleanedText, opts = {}) {
  const layoutMemory = opts.layoutMemory || null;
  const lines = resolveStructuredLines(cleanedText, opts);

  const semanticLines = classifySemanticLines(cleanedText, {
    layoutMemory,
    lines,
    spatialBlocks: opts.spatialBlocks,
  });
  /** @type {import('./section-types-v2.js').SectionBlockV2[]} */
  const blocks = [];

  let currentId = SECTION_IDS.PREAMBLE;
  let activeSection = SECTION_IDS.PREAMBLE;
  let currentLines = [];
  let currentSemantic = [];
  let headerLine = null;
  let startIdx = 0;

  const flush = (endIdx) => {
    if (!currentLines.length && !headerLine) return;
    const dominant = dominantSemantic(currentSemantic);
    blocks.push({
      id: `sem-${blocks.length}`,
      type: currentId,
      lines: [...currentLines],
      headerLine,
      startLine: startIdx,
      endLine: endIdx,
      detectedConfidence: dominant?.confidence ?? 70,
      semanticDominant: dominant?.semantic ?? null,
      classifyReason: 'semantic_infer',
      parseMode: SEMANTIC_PARSE_MODE,
    });
  };

  for (let i = 0; i < semanticLines.length; i++) {
    const hit = semanticLines[i];
    const line = hit.line;
    const headerId =
      hit.semantic === SEMANTIC_LINE.SECTION_HEADER ? detectSectionHeaderId(line) : null;

    let nextId = resolveSectionId(hit, headerId);

    if (i < 8 && hit.semantic === SEMANTIC_LINE.IDENTITY_ROLE) {
      nextId = SECTION_IDS.PROFILE;
    }
    if (
      hit.semantic === SEMANTIC_LINE.DATE_RANGE ||
      hit.semantic === SEMANTIC_LINE.JOB_ENTRY ||
      hit.semantic === SEMANTIC_LINE.BULLET
    ) {
      nextId = sectionForExperienceLikeLine(activeSection, nextId);
    }
    if (hit.semantic === SEMANTIC_LINE.BULLET && currentId === SECTION_IDS.EXPERIENCE) {
      nextId = SECTION_IDS.EXPERIENCE;
    }
    if (headerId) {
      flush(i);
      currentId = headerId;
      activeSection = headerId;
      headerLine = line;
      currentLines = [];
      currentSemantic = [];
      startIdx = i;
      continue;
    }

    if (nextId !== currentId && currentLines.length) {
      flush(i);
      currentId = nextId;
      activeSection = nextId;
      headerLine = null;
      currentLines = [];
      currentSemantic = [];
      startIdx = i;
    }

    if (hit.semantic !== SEMANTIC_LINE.SECTION_HEADER) {
      currentLines.push(line);
      currentSemantic.push(hit);
    }
  }
  flush(lines.length);

  if (!blocks.length && lines.length) {
    blocks.push({
      id: 'sem-0',
      type: SECTION_IDS.PREAMBLE,
      lines,
      headerLine: null,
      startLine: 0,
      endLine: lines.length,
      detectedConfidence: 55,
      classifyReason: 'semantic_fallback',
      parseMode: SEMANTIC_PARSE_MODE,
    });
  }

  promoteProfileRoles(blocks, semanticLines);

  return { lines, blocks, semanticLines };
}

/**
 * Ensure IDENTITY_ROLE lines (e.g. Graphic Designer) land in PROFILE without Experience header.
 * @param {import('./section-types-v2.js').SectionBlockV2[]} blocks
 * @param {object[]} semanticLines
 */
function promoteProfileRoles(blocks, semanticLines) {
  const roleLines = semanticLines
    .filter((h) => h.semantic === SEMANTIC_LINE.IDENTITY_ROLE)
    .map((h) => h.line);
  if (!roleLines.length) return;

  let profile = blocks.find((b) => b.type === SECTION_IDS.PROFILE);
  const preamble = blocks.find((b) => b.type === SECTION_IDS.PREAMBLE);

  if (!profile && preamble) {
    preamble.type = SECTION_IDS.PROFILE;
    preamble.classifyReason = 'semantic_role_promoted_preamble';
    profile = preamble;
  }

  if (!profile) {
    blocks.unshift({
      id: 'sem-profile-roles',
      type: SECTION_IDS.PROFILE,
      lines: [],
      headerLine: null,
      startLine: 0,
      endLine: 0,
      detectedConfidence: 88,
      semanticDominant: SEMANTIC_LINE.IDENTITY_ROLE,
      classifyReason: 'semantic_role_block',
      parseMode: SEMANTIC_PARSE_MODE,
    });
    profile = blocks[0];
  }

  for (const role of roleLines) {
    if (!(profile.lines || []).includes(role)) {
      profile.lines = profile.lines || [];
      profile.lines.push(role);
    }
  }
}

/**
 * @param {object[]} hits
 */
/**
 * Keep experience-like lines in their column section (education/languages/skills must not become experience).
 * @param {string} activeSection
 * @param {string} fallbackId
 */
function sectionForExperienceLikeLine(activeSection, fallbackId) {
  if (activeSection === SECTION_IDS.EDUCATION) return SECTION_IDS.EDUCATION;
  if (activeSection === SECTION_IDS.LANGUAGES) return SECTION_IDS.LANGUAGES;
  if (activeSection === SECTION_IDS.SKILLS) return SECTION_IDS.SKILLS;
  if (activeSection === SECTION_IDS.TOOLS) return SECTION_IDS.TOOLS;
  if (activeSection === SECTION_IDS.CLIENTS) return SECTION_IDS.CLIENTS;
  if (activeSection === SECTION_IDS.INTERESTS) return SECTION_IDS.INTERESTS;
  if (activeSection === SECTION_IDS.PROFILE || activeSection === SECTION_IDS.SUMMARY) {
    return activeSection;
  }
  return fallbackId === SECTION_IDS.UNKNOWN ? SECTION_IDS.EXPERIENCE : fallbackId;
}

function dominantSemantic(hits) {
  const votes = new Map();
  for (const h of hits || []) {
    if (!h?.semantic || h.semantic === SEMANTIC_LINE.SECTION_HEADER) continue;
    votes.set(h.semantic, (votes.get(h.semantic) || 0) + 1);
  }
  let best = null;
  let max = 0;
  for (const [k, v] of votes) {
    if (v > max) {
      max = v;
      best = hits.find((h) => h.semantic === k);
    }
  }
  return best;
}
