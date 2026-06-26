/**
 * Visual feature detection on positioned lines/blocks (PDF layout reconstruction).
 */

import { isSectionHeaderLine } from '../parsing/rich-parser.js';
import { LAYOUT_TYPES } from './detect-layout.js';
import { COLUMN_IDS } from './detect-columns.js';

export const VISUAL_ROLES = {
  HEADING: 'heading',
  SIDEBAR: 'sidebar',
  DATE: 'date',
  LIST: 'list',
  BODY: 'body',
};

const DATE_LINE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}\b|\b(19|20)\d{2}\b/i;

const LIST_LINE_RE = /^[\s]*(?:[-•*●▪◦‣]|\d{1,2}[.)]\s+|[a-z][.)]\s+)/i;

const SECTION_HEADER_ONLY =
  /^(experience|work experience|employment|education|formation|skills?|competences?|projects?|clients?|awards?|exhibitions?|publications?|portfolio|languages?|tools?|summary|profile|contact)\s*$/i;

/**
 * @param {string} text
 */
export function isDateLine(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 160) return false;
  return DATE_LINE_RE.test(t);
}

/**
 * @param {string} text
 */
export function isListLine(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return LIST_LINE_RE.test(t);
}

/**
 * @param {string} text
 */
export function isHeadingLine(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 80) return false;
  if (isSectionHeaderLine(t)) return true;
  if (SECTION_HEADER_ONLY.test(t)) return true;
  if (t.length < 48 && t === t.toUpperCase() && /[A-Z]/.test(t) && !DATE_LINE_RE.test(t)) return true;
  return false;
}

/**
 * @param {object} block
 * @param {object} layout
 */
export function detectBlockVisualRoles(block, layout) {
  const roles = new Set();
  const text = String(block.text || '').trim();
  const lines = block.lines || [];

  if (block.isHeader || block.sectionKey) roles.add(VISUAL_ROLES.HEADING);

  for (const ln of lines) {
    const lt = String(ln.cleanedText ?? ln.text ?? '').trim();
    if (!lt) continue;
    if (isHeadingLine(lt)) roles.add(VISUAL_ROLES.HEADING);
    if (isDateLine(lt)) roles.add(VISUAL_ROLES.DATE);
    if (isListLine(lt)) roles.add(VISUAL_ROLES.LIST);
  }

  const layoutType = layout?.layoutType;
  const col = block.column;
  if (layoutType === LAYOUT_TYPES.LEFT_SIDEBAR && col === COLUMN_IDS.LEFT) {
    roles.add(VISUAL_ROLES.SIDEBAR);
  }
  if (layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR && col === COLUMN_IDS.RIGHT) {
    roles.add(VISUAL_ROLES.SIDEBAR);
  }

  if (!roles.size) roles.add(VISUAL_ROLES.BODY);
  if (roles.has(VISUAL_ROLES.HEADING)) block.isHeader = true;

  return [...roles];
}

/**
 * @param {object[]} blocks
 * @param {object} layout
 * @param {object} [columns]
 */
export function annotateVisualStructure(blocks = [], layout = {}, columns = null) {
  const colBlocks = columns?.blocks || blocks;
  const byId = new Map(colBlocks.map((b) => [b.id, b]));

  return (blocks || []).map((block) => {
    const merged = { ...block, ...(byId.get(block.id) || {}) };
    const visualRoles = detectBlockVisualRoles(merged, layout);
    const lineTags = (merged.lines || []).map((ln) => {
      const lt = String(ln.cleanedText ?? ln.text ?? '').trim();
      const tags = [];
      if (isHeadingLine(lt)) tags.push(VISUAL_ROLES.HEADING);
      if (isDateLine(lt)) tags.push(VISUAL_ROLES.DATE);
      if (isListLine(lt)) tags.push(VISUAL_ROLES.LIST);
      return { ...ln, visualTags: tags.length ? tags : [VISUAL_ROLES.BODY] };
    });
    return {
      ...merged,
      visualRoles,
      lines: lineTags,
      hasDate: visualRoles.includes(VISUAL_ROLES.DATE),
      hasList: visualRoles.includes(VISUAL_ROLES.LIST),
      isSidebar: visualRoles.includes(VISUAL_ROLES.SIDEBAR),
    };
  });
}

/**
 * @param {object} ctx
 */
export function summarizeVisualStructure(ctx = {}) {
  const blocks = ctx.blocks || [];
  let headingBlocks = 0;
  let sidebarBlocks = 0;
  let dateBlocks = 0;
  let listBlocks = 0;

  for (const b of blocks) {
    const roles = b.visualRoles || [];
    if (roles.includes(VISUAL_ROLES.HEADING)) headingBlocks += 1;
    if (roles.includes(VISUAL_ROLES.SIDEBAR)) sidebarBlocks += 1;
    if (roles.includes(VISUAL_ROLES.DATE)) dateBlocks += 1;
    if (roles.includes(VISUAL_ROLES.LIST)) listBlocks += 1;
  }

  return {
    layoutType: ctx.layout?.layoutType || 'unknown',
    columnCount: ctx.columns?.multiColumn ? 2 : 1,
    sidebarDetected:
      ctx.layout?.layoutType === LAYOUT_TYPES.LEFT_SIDEBAR ||
      ctx.layout?.layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR,
    blockCount: blocks.length,
    headingBlocks,
    sidebarBlocks,
    dateBlocks,
    listBlocks,
    signals: ctx.layout?.signals || [],
  };
}
