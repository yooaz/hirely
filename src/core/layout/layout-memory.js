/**
 * Layout memory — preserves spatial structure for every extraction line.
 * Parser receives text + line order + positions (not text-only).
 */

import { detectLayout, LAYOUT_TYPES, isMultiColumnLayoutType } from './detect-layout.js';
import { detectColumns, COLUMN_IDS, findColumnSplitX } from './detect-columns.js';
import { orderLinesForReading, compareLinesReadingOrder, applyReadingOrder } from './reading-order.js';
import {
  spatialBlocksFromLayoutEntries,
  spatialBlocksToPlainText,
} from './spatial-block.js';

export const LAYOUT_MEMORY_VERSION = '1';

export const LAYOUT_ZONE = {
  HEADER: 'header',
  BODY: 'body',
  FOOTER: 'footer',
};

/**
 * @typedef {object} LayoutMemoryEntry
 * @property {number} lineIndex — global 0-based order after reading-order sort
 * @property {string} text — cleaned line text
 * @property {number} page — 1-based page
 * @property {number} pageLine — 0-based index within page (pdf stream / OCR line id)
 * @property {number} y — vertical position (PDF coords: higher = top)
 * @property {number} x — horizontal position
 * @property {string} columnId — LEFT_COLUMN | RIGHT_COLUMN | FULL
 * @property {string} region — left | right | full | main
 * @property {string} zone — header | body | footer
 * @property {number} readingOrder — same as lineIndex when built from layout memory
 * @property {number} [confidence]
 * @property {'native'|'ocr'} [source]
 */

/**
 * @typedef {object} LayoutMemory
 * @property {string} version
 * @property {number} lineCount
 * @property {number} pageCount
 * @property {string} layoutType
 * @property {number|null} columnSplit
 * @property {object[]} pages — per-page bounds
 * @property {LayoutMemoryEntry[]} entries
 * @property {import('./spatial-block.js').SpatialBlock[]} spatialBlocks — layout-aware parse input (primary)
 * @property {string} parserText — derived reading-order text (legacy / last-resort)
 * @property {import('../extraction/extracted-line.js').ExtractedLine[]} lines — enriched lines
 */

function hasPositionedLines(lines) {
  const usable = (lines || []).filter(
    (l) => Number.isFinite(l.y) && String(l.cleanedText ?? l.text ?? '').trim().length > 0
  );
  if (usable.length < 2) return false;
  const ys = usable.map((l) => Number(l.y));
  return Math.max(...ys) - Math.min(...ys) >= 4;
}

/**
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 */
function computePageStats(lines) {
  /** @type {Map<number, { minY: number, maxY: number, minX: number, maxX: number, count: number }>} */
  const stats = new Map();
  for (const ln of lines || []) {
    const page = ln.page || 1;
    const y = Number.isFinite(ln.y) ? ln.y : null;
    const x = Number.isFinite(ln.x) ? ln.x : null;
    if (y === null) continue;
    if (!stats.has(page)) {
      stats.set(page, { minY: y, maxY: y, minX: x ?? 0, maxX: x ?? 0, count: 0 });
    }
    const s = stats.get(page);
    s.minY = Math.min(s.minY, y);
    s.maxY = Math.max(s.maxY, y);
    if (x !== null) {
      s.minX = Math.min(s.minX, x);
      s.maxX = Math.max(s.maxX, x);
    }
    s.count++;
  }
  return stats;
}

/**
 * @param {number} y
 * @param {{ minY: number, maxY: number }|undefined} stats
 */
function classifyZone(y, stats) {
  if (!stats || !Number.isFinite(y)) return LAYOUT_ZONE.BODY;
  const span = Math.max(stats.maxY - stats.minY, 24);
  const topBand = stats.maxY - span * 0.14;
  const bottomBand = stats.minY + span * 0.12;
  if (y >= topBand) return LAYOUT_ZONE.HEADER;
  if (y <= bottomBand) return LAYOUT_ZONE.FOOTER;
  return LAYOUT_ZONE.BODY;
}

/**
 * @param {number} x
 * @param {number|null} splitX
 * @param {string} [readingColumn]
 */
function classifyColumn(x, splitX, readingColumn) {
  if (readingColumn === COLUMN_IDS.LEFT) return COLUMN_IDS.LEFT;
  if (readingColumn === COLUMN_IDS.RIGHT) return COLUMN_IDS.RIGHT;
  if (readingColumn === COLUMN_IDS.FULL) return COLUMN_IDS.FULL;
  if (!Number.isFinite(splitX) || !Number.isFinite(x)) return COLUMN_IDS.FULL;
  return x < splitX ? COLUMN_IDS.LEFT : COLUMN_IDS.RIGHT;
}

function resolveColumnSplit(lines, layout) {
  if (Number.isFinite(layout?.columnSplit)) return layout.columnSplit;
  const xs = (lines || [])
    .map((l) => Number(l.x))
    .filter((x) => Number.isFinite(x));
  if (xs.length >= 4) return findColumnSplitX(xs);
  return null;
}

function syntheticY(page, lineIndex) {
  return 1000 - (page - 1) * 2000 - lineIndex * 14;
}

/**
 * Build layout memory from positioned OCR/native lines.
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 * @param {object} [opts]
 * @returns {LayoutMemory}
 */
export function buildLayoutMemory(lines, opts = {}) {
  const input = (lines || []).filter((l) => String(l.cleanedText ?? l.text ?? '').trim());
  const pageIds = [...new Set(input.map((l) => l.page || l.page_number || 1))].sort((a, b) => a - b);

  if (pageIds.length > 1 && !opts._singlePageBuild) {
    const combinedLines = [];
    const combinedEntries = [];
    const combinedSpatial = [];
    const combinedPages = [];
    let layoutType = LAYOUT_TYPES.SINGLE_COLUMN;
    let columnSplit = null;

    for (const page of pageIds) {
      const slice = input.filter((l) => (l.page || l.page_number || 1) === page);
      const pageMem = buildLayoutMemory(slice, { ...opts, _singlePageBuild: true });
      combinedLines.push(...(pageMem.lines || slice));
      combinedEntries.push(...(pageMem.entries || []));
      combinedSpatial.push(...(pageMem.spatialBlocks || []));
      combinedPages.push(...(pageMem.pages || []));
      if (page === pageIds[0]) {
        layoutType = pageMem.layoutType;
        columnSplit = pageMem.columnSplit;
      }
    }

    combinedEntries.forEach((entry, lineIndex) => {
      entry.lineIndex = lineIndex;
      entry.readingOrder = lineIndex;
    });

    return {
      version: LAYOUT_MEMORY_VERSION,
      lineCount: combinedEntries.length,
      pageCount: pageIds.length,
      layoutType,
      columnSplit,
      pages: combinedPages,
      entries: combinedEntries,
      spatialBlocks: combinedSpatial,
      parserText: spatialBlocksToPlainText(combinedSpatial),
      lines: combinedLines,
    };
  }

  const layout =
    opts.layout ||
    detectLayout({
      lines: input,
      rawText: opts.rawText,
      cleanedText: opts.cleanedText,
      ocrLayout: opts.ocrLayout,
    });

  let ordered = opts.orderedLines?.length ? [...opts.orderedLines] : null;
  const positioned = hasPositionedLines(input);

  if (!ordered?.length && positioned) {
    const reading = applyReadingOrder({
      lines: input,
      layout,
      layoutType: layout?.layoutType,
    });
    if (reading.usedColumnReconstruction || isMultiColumnLayoutType(layout?.layoutType)) {
      ordered = reading.orderedLines?.length ? reading.orderedLines : null;
    }
  }

  if (!ordered?.length) {
    ordered = orderLinesForReading(input);
  }
  if (!ordered.length && input.length) {
    ordered = [...input].sort(compareLinesReadingOrder);
  }
  let columnSplit = resolveColumnSplit(ordered, layout);
  let layoutType = layout?.layoutType || LAYOUT_TYPES.SINGLE_COLUMN;

  if (positioned && ordered.length >= 4) {
    const centers = ordered
      .map((l) => ({ x: Number(l.x) + (Number(l.width) || 0) / 2, y: Number(l.y) }))
      .filter((c) => Number.isFinite(c.x));
    if (centers.length >= 4) {
      const geomBlocks = centers.map((c, i) => ({
        id: `lm-${i}`,
        x: c.x - 40,
        y: c.y,
        width: 80,
        height: 14,
        lines: [ordered[i]],
      }));
      const cols = detectColumns(geomBlocks, layout);
      columnSplit = cols.splitX ?? columnSplit;
      layoutType = cols.layoutType || layoutType;
    }
  }

  const pageStats = computePageStats(ordered);
  const pages = [...pageStats.entries()].map(([page, s]) => ({
    page,
    minY: s.minY,
    maxY: s.maxY,
    minX: s.minX,
    maxX: s.maxX,
    lineCount: s.count,
  }));

  /** @type {LayoutMemoryEntry[]} */
  const entries = [];
  /** @type {import('../extraction/extracted-line.js').ExtractedLine[]} */
  const enriched = [];

  ordered.forEach((ln, lineIndex) => {
    const page = ln.page || 1;
    const text = String(ln.cleanedText ?? ln.text ?? '').trim();
    if (!text) return;

    const y = Number.isFinite(ln.y) ? ln.y : syntheticY(page, lineIndex);
    const x = Number.isFinite(ln.x) ? ln.x : 0;
    const stats = pageStats.get(page);
    const zone = classifyZone(y, stats);
    const columnId = classifyColumn(x, columnSplit, ln._readingColumn);
    const region =
      ln._readingRegion ||
      (columnId === COLUMN_IDS.LEFT
        ? 'left'
        : columnId === COLUMN_IDS.RIGHT
          ? 'right'
          : 'full');

    const entry = {
      lineIndex,
      text,
      page,
      pageLine: Number.isFinite(ln.line) ? ln.line : lineIndex,
      y,
      x,
      columnId,
      region,
      zone,
      readingOrder: lineIndex,
      confidence: ln.confidence,
      source: ln.source,
    };
    entries.push(entry);
    enriched.push({
      ...ln,
      text,
      cleanedText: text,
      lineIndex,
      page,
      line: entry.pageLine,
      y,
      x,
      columnId,
      region,
      zone,
      readingOrder: lineIndex,
    });
  });

  const spatialBlocks = spatialBlocksFromLayoutEntries(entries, {
    lines: enriched,
    pageLayouts: opts.pageLayouts,
    source: input[0]?.source || opts.source || 'layout_memory',
  });
  const parserText = spatialBlocksToPlainText(spatialBlocks);
  const pageCount = entries.length ? Math.max(...entries.map((e) => e.page)) : 0;

  return {
    version: LAYOUT_MEMORY_VERSION,
    lineCount: entries.length,
    pageCount,
    layoutType,
    columnSplit,
    pages,
    entries,
    spatialBlocks,
    parserText,
    lines: enriched,
  };
}

/**
 * Fallback when only plain text exists (paste) — synthetic positions preserve order.
 * @param {string} text
 * @param {object} [opts]
 */
export function buildLayoutMemoryFromPlainText(text, opts = {}) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => ({
      text: t,
      cleanedText: t,
      rawExtraction: t,
      confidence: opts.confidence ?? 88,
      source: opts.source || 'paste',
      page: 1,
      line: i,
      x: 0,
      y: syntheticY(1, i),
      width: 0,
      height: 14,
    }));
  return buildLayoutMemory(lines, {
    layout: { layoutType: LAYOUT_TYPES.SINGLE_COLUMN, confidence: 55, signals: ['plain_text'] },
  });
}

/**
 * @param {LayoutMemory|null|undefined} memory
 * @param {number} lineIndex
 */
export function layoutEntryAt(memory, lineIndex) {
  if (!memory?.entries?.length) return null;
  return memory.entries.find((e) => e.lineIndex === lineIndex) ?? null;
}
