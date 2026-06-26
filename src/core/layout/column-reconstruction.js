/**
 * Multi-column document reconstruction — logical reading order with section integrity.
 *
 * Rules:
 * - Education blocks stay grouped under education.
 * - Experience blocks stay grouped under experience.
 * - Sidebar skills / languages / tools never attach to experience.
 */

import { fuzzySectionKey } from '../parsing/section-fuzzy.js';
import { isSectionHeaderLine } from '../parsing/rich-parser.js';
import { LAYOUT_TYPES } from './detect-layout.js';
import { COLUMN_IDS, orderBlocksByColumns } from './detect-columns.js';
import { geometricBlocksToLayoutBlocks } from './block-extractor.js';

export const SIDEBAR_SECTION_KEYS = new Set([
  'profile',
  'summary',
  'languages',
  'skills',
  'tools',
  'contact',
  'interests',
  'portfolioLinks',
]);

const EXPERIENCE_SIGNAL_RE =
  /\b(freelance|internship|engineer|developer|designer|manager|director|recruiter|consultant|present|20\d{2}\s*[-–—])\b/i;
const EDUCATION_SIGNAL_RE =
  /\b(university|école|ecole|school|bachelor|master|mba|diploma|degree|b\.s\.|b\.a\.|m\.s\.|ph\.?d|lisaa|mit|nyu|hec)\b/i;
const LANGUAGE_SIGNAL_RE =
  /\b(english|french|spanish|german|mandarin|native|fluent|bilingual|conversational)\b/i;
const SKILL_SIGNAL_RE =
  /\b(illustration|typescript|python|kubernetes|recruiting|sourcing|figma|photoshop|sql|agile|system design)\b/i;

/**
 * @param {string} columnId
 * @param {string} layoutType
 */
export function isSidebarColumn(columnId, layoutType) {
  if (columnId === COLUMN_IDS.FULL) return false;
  if (layoutType === LAYOUT_TYPES.LEFT_SIDEBAR && columnId === COLUMN_IDS.LEFT) return true;
  if (layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR && columnId === COLUMN_IDS.RIGHT) return true;
  return false;
}

/**
 * @param {string} text
 */
function inferSectionFromContent(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const headerKey = fuzzySectionKey(t);
  if (headerKey && isSectionHeaderLine(t)) return headerKey;
  if (LANGUAGE_SIGNAL_RE.test(t) && !EXPERIENCE_SIGNAL_RE.test(t)) return 'languages';
  if (SKILL_SIGNAL_RE.test(t) && !EXPERIENCE_SIGNAL_RE.test(t) && !EDUCATION_SIGNAL_RE.test(t)) {
    return 'skills';
  }
  if (EDUCATION_SIGNAL_RE.test(t) && !EXPERIENCE_SIGNAL_RE.test(t)) return 'education';
  if (EXPERIENCE_SIGNAL_RE.test(t)) return 'experience';
  return null;
}

/**
 * @param {object} block
 * @param {object} layout
 */
function blockConfidence(block, layout) {
  const lines = block.lines || [];
  const vals = lines
    .map((l) => Number(l.confidence))
    .filter((n) => Number.isFinite(n) && n > 0);
  let base = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 78;
  if (block.kind === 'section_header') base += 8;
  if (block.section || block.sectionKey || block.sectionHint) base += 4;
  if (isSidebarColumn(block.column, layout?.layoutType) && SIDEBAR_SECTION_KEYS.has(block.section)) {
    base += 3;
  }
  return Math.min(99, Math.round(base));
}

/**
 * Prevent sidebar skills/languages from being labeled as experience.
 * @param {object[]} blocks
 * @param {object} layout
 */
export function enforceSectionIntegrity(blocks = [], layout = {}) {
  const layoutType = layout.layoutType || LAYOUT_TYPES.SINGLE_COLUMN;
  const out = [];

  for (const block of blocks) {
    const copy = { ...block };
    let section =
      copy.section ||
      copy.sectionKey ||
      copy.sectionHint ||
      inferSectionFromContent(copy.text) ||
      'body';

    const sidebar = isSidebarColumn(copy.column, layoutType);
    if (sidebar && section === 'experience') {
      section = inferSectionFromContent(copy.text) || 'profile';
      if (section === 'experience') section = 'skills';
    }
    if (sidebar && SIDEBAR_SECTION_KEYS.has(section) === false && section !== 'education') {
      const inferred = inferSectionFromContent(copy.text);
      if (inferred && SIDEBAR_SECTION_KEYS.has(inferred)) section = inferred;
    }
    if (!sidebar && section === 'languages' && EXPERIENCE_SIGNAL_RE.test(copy.text || '')) {
      section = 'experience';
    }
    if (!sidebar && section === 'skills' && EXPERIENCE_SIGNAL_RE.test(copy.text || '')) {
      section = 'experience';
    }

    copy.section = section;
    copy.sectionKey = copy.sectionKey || section;
    copy.sectionHint = section;
    out.push(copy);
  }

  return out;
}

/**
 * Collapse sequential blocks into section ranges with start/end positions.
 * @param {object[]} blocks
 * @param {object} layout
 */
export function groupBlocksIntoSectionRanges(blocks = [], layout = {}) {
  const guarded = enforceSectionIntegrity(blocks, layout);
  /** @type {object[]} */
  const orderedBlocks = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    current.endPosition = current._lastPos;
    current.confidence = blockConfidence(current, layout);
    delete current._lastPos;
    delete current._parts;
    orderedBlocks.push(current);
    current = null;
  };

  guarded.forEach((block, index) => {
    const section =
      block.section ||
      block.sectionKey ||
      block.sectionHint ||
      (block.kind === 'section_header' ? fuzzySectionKey(block.text) : null) ||
      'body';
    const pos = block.readingOrder ?? index;

    if (block.kind === 'section_header') {
      flush();
      current = {
        id: `sec-${orderedBlocks.length}`,
        kind: 'section',
        section,
        sectionKey: section,
        column: block.column || COLUMN_IDS.FULL,
        region: block.region || 'main',
        layoutType: layout.layoutType || LAYOUT_TYPES.SINGLE_COLUMN,
        startPosition: pos,
        endPosition: pos,
        readingOrder: orderedBlocks.length,
        text: String(block.text || '').trim(),
        lineCount: block.lineCount || 1,
        lines: [...(block.lines || [])],
        blocks: [block],
        _lastPos: pos,
      };
      return;
    }

    if (!current || current.section !== section) {
      flush();
      current = {
        id: `sec-${orderedBlocks.length}`,
        kind: 'section',
        section,
        sectionKey: section,
        column: block.column || COLUMN_IDS.FULL,
        region: block.region || 'main',
        layoutType: layout.layoutType || LAYOUT_TYPES.SINGLE_COLUMN,
        startPosition: pos,
        endPosition: pos,
        readingOrder: orderedBlocks.length,
        text: '',
        lineCount: 0,
        lines: [],
        blocks: [],
        _lastPos: pos,
      };
    }

    const partText = String(block.text || '').trim();
    if (partText) {
      current.text = current.text ? `${current.text}\n${partText}` : partText;
    }
    current.lineCount += block.lineCount || block.lines?.length || 0;
    current.lines.push(...(block.lines || []));
    current.blocks.push(block);
    current._lastPos = pos;
  });

  flush();

  return orderedBlocks.map((b, i) => ({
    ...b,
    readingOrder: i,
    confidence: blockConfidence(b, layout),
  }));
}

/**
 * Build layout blocks with per-column section context (no cross-column bleed).
 * @param {object[]} geometricBlocks
 * @param {string} layoutType
 */
export function geometricBlocksToSectionBlocks(geometricBlocks, layoutType) {
  const sectionByColumn = new Map();
  const out = [];
  let order = 0;

  for (const gb of geometricBlocks) {
    const text = String(gb.text || '').trim();
    if (!text) continue;
    const col = gb.column || COLUMN_IDS.FULL;

    if (gb.isHeader || isSectionHeaderLine(text)) {
      const section = gb.sectionKey || fuzzySectionKey(text) || 'header';
      sectionByColumn.set(col, section);
      out.push({
        id: gb.id || `hdr-${out.length}`,
        kind: 'section_header',
        section,
        sectionKey: section,
        sectionHint: section,
        column: col,
        region:
          col === COLUMN_IDS.LEFT ? 'left' : col === COLUMN_IDS.RIGHT ? 'right' : 'full',
        layoutType,
        sourcePage: gb.page || 1,
        readingOrder: order++,
        lines: gb.lines,
        text,
        lineCount: gb.lines?.length || 1,
        x: gb.x,
        y: gb.y,
        width: gb.width,
        height: gb.height,
        isSidebar: isSidebarColumn(col, layoutType),
      });
      continue;
    }

    let section = sectionByColumn.get(col) || inferSectionFromContent(text) || 'body';
    if (isSidebarColumn(col, layoutType)) {
      if (section === 'experience') {
        section = inferSectionFromContent(text) || 'profile';
        if (section === 'experience') section = 'skills';
      }
      if (!SIDEBAR_SECTION_KEYS.has(section) && section !== 'education') {
        const inferred = inferSectionFromContent(text);
        if (inferred && (SIDEBAR_SECTION_KEYS.has(inferred) || inferred === 'education')) {
          section = inferred;
        }
      }
      sectionByColumn.set(col, section);
    }

    out.push({
      id: gb.id || `blk-${out.length}`,
      kind: 'content',
      section,
      sectionHint: section,
      sectionKey: section,
      column: col,
      region:
        col === COLUMN_IDS.LEFT ? 'left' : col === COLUMN_IDS.RIGHT ? 'right' : 'main',
      layoutType,
      sourcePage: gb.page || 1,
      readingOrder: order++,
      lines: gb.lines,
      text,
      lineCount: gb.lines?.length || 0,
      x: gb.x,
      y: gb.y,
      width: gb.width,
      height: gb.height,
      isSidebar: isSidebarColumn(col, layoutType),
    });
  }

  return out;
}

/**
 * Full column reconstruction — ordered section blocks + ordered lines.
 * @param {object} ctx
 */
export function reconstructColumnBlocks(ctx = {}) {
  const layout = ctx.layout || {};
  const layoutType = layout.layoutType || LAYOUT_TYPES.SINGLE_COLUMN;
  const columns = ctx.columns || null;
  const geomBlocks = ctx.blocks?.blocks || ctx.geometricBlocks || [];

  let layoutBlocks = [];
  let orderedLines = [];

  if (geomBlocks.length && columns?.multiColumn) {
    const ordered = orderBlocksByColumns(columns.blocks || geomBlocks, layoutType);
    let readingOrder = 0;
    for (const block of ordered) {
      for (const ln of block.lines || []) {
        orderedLines.push({
          ...ln,
          readingOrder: readingOrder,
          _layoutBlockId: block.id,
          _readingColumn: block.column,
          _readingRegion:
            block.column === COLUMN_IDS.LEFT
              ? 'left'
              : block.column === COLUMN_IDS.RIGHT
                ? 'right'
                : 'full',
        });
      }
      readingOrder += 1;
    }
    layoutBlocks = geometricBlocksToSectionBlocks(ordered, layoutType);
  } else if (ctx.orderedLines?.length) {
    orderedLines = ctx.orderedLines;
    layoutBlocks = geometricBlocksToLayoutBlocks(
      (ctx.lineBlocks || []).length
        ? ctx.lineBlocks
        : orderedLines.map((ln, i) => ({
            id: `ln-${i}`,
            text: String(ln.cleanedText ?? ln.text ?? '').trim(),
            lines: [ln],
            page: ln.page || 1,
            isHeader: isSectionHeaderLine(String(ln.cleanedText ?? ln.text ?? '')),
            sectionKey: fuzzySectionKey(String(ln.cleanedText ?? ln.text ?? '')),
            column: ln._readingColumn || COLUMN_IDS.FULL,
            readingOrder: i,
          })),
      layoutType
    );
  } else {
    layoutBlocks = ctx.layoutBlocks || [];
    orderedLines = ctx.orderedLines || [];
  }

  const orderedBlocks = groupBlocksIntoSectionRanges(layoutBlocks, layout);

  return {
    stage: 'column_reconstruction',
    layoutType,
    layout,
    columns,
    layoutBlocks,
    orderedBlocks,
    orderedLines,
    blockCount: orderedBlocks.length,
    usedColumnReconstruction: Boolean(columns?.multiColumn),
    sectionIntegrity: validateSectionIntegrity(orderedBlocks, layout),
    at: new Date().toISOString(),
  };
}

/**
 * @param {object[]} orderedBlocks
 * @param {object} layout
 */
export function validateSectionIntegrity(orderedBlocks = [], layout = {}) {
  const violations = [];
  const layoutType = layout.layoutType || LAYOUT_TYPES.SINGLE_COLUMN;

  for (const block of orderedBlocks) {
    const text = String(block.text || '');
    const section = block.section || block.sectionKey || '';

    if (section === 'experience') {
      if (EDUCATION_SIGNAL_RE.test(text) && !EXPERIENCE_SIGNAL_RE.test(text)) {
        violations.push({ type: 'education_in_experience', section, sample: text.slice(0, 80) });
      }
      if (
        isSidebarColumn(block.column, layoutType) &&
        (LANGUAGE_SIGNAL_RE.test(text) || SKILL_SIGNAL_RE.test(text)) &&
        !EXPERIENCE_SIGNAL_RE.test(text)
      ) {
        violations.push({ type: 'sidebar_in_experience', section, sample: text.slice(0, 80) });
      }
    }

    if (section === 'education' && EXPERIENCE_SIGNAL_RE.test(text) && !EDUCATION_SIGNAL_RE.test(text)) {
      violations.push({ type: 'experience_in_education', section, sample: text.slice(0, 80) });
    }

    if (section === 'skills' && LANGUAGE_SIGNAL_RE.test(text) && !SKILL_SIGNAL_RE.test(text)) {
      violations.push({ type: 'language_in_skills', section, sample: text.slice(0, 80) });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    sectionCount: orderedBlocks.length,
    sections: orderedBlocks.map((b) => b.section),
  };
}
