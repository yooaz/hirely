/**
 * Spatial blocks — layout-aware intermediate model kept through the parse pipeline.
 *
 * Plain text is derived only via spatialBlocksToPlainText() (last-resort / legacy).
 */

import { COLUMN_IDS } from './detect-columns.js';
import { LAYOUT_ZONE } from './layout-memory.js';
import { lineReadingZone } from './page-layout.js';

export const SPATIAL_BLOCK_VERSION = '1';

/** @enum {string} */
export const SPATIAL_ZONE_ID = {
  HEADER: 'header',
  FOOTER: 'footer',
  MAIN: 'main',
  SIDEBAR: 'sidebar',
  LEFT_COLUMN: 'left_column',
  RIGHT_COLUMN: 'right_column',
  FULL: 'full',
};

/**
 * @typedef {object} SpatialBlockBbox
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} [x2]
 * @property {number} [y2]
 */

/**
 * @typedef {object} SpatialBlock
 * @property {string} block_id
 * @property {number} page_number
 * @property {SpatialBlockBbox} bbox
 * @property {string} source
 * @property {number} reading_order
 * @property {string} zone_id
 * @property {string} column_id
 * @property {string} text
 * @property {string} normalized_text
 * @property {string} [kind] — line | block | section_header
 */

/**
 * @param {string} text
 */
export function normalizeSpatialText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .trim();
}

/**
 * @param {object} entry — LayoutMemoryEntry or compatible
 * @param {object} [pageLayout]
 */
function resolveZoneId(entry, pageLayout) {
  const zone = entry.zone;
  if (zone === LAYOUT_ZONE.HEADER) return SPATIAL_ZONE_ID.HEADER;
  if (zone === LAYOUT_ZONE.FOOTER) return SPATIAL_ZONE_ID.FOOTER;

  if (pageLayout && Number.isFinite(entry.x)) {
    const fromPage = lineReadingZone(
      { x: entry.x, y: entry.y, text: entry.text, cleanedText: entry.text },
      pageLayout
    );
    if (fromPage === 'sidebar') return SPATIAL_ZONE_ID.SIDEBAR;
    if (fromPage === 'main') return SPATIAL_ZONE_ID.MAIN;
    if (fromPage === 'left_column') return SPATIAL_ZONE_ID.LEFT_COLUMN;
    if (fromPage === 'right_column') return SPATIAL_ZONE_ID.RIGHT_COLUMN;
  }

  const col = entry.columnId || entry.region;
  if (col === COLUMN_IDS.LEFT || col === 'left') return SPATIAL_ZONE_ID.LEFT_COLUMN;
  if (col === COLUMN_IDS.RIGHT || col === 'right') return SPATIAL_ZONE_ID.RIGHT_COLUMN;
  if (entry.region === 'main') return SPATIAL_ZONE_ID.MAIN;
  return SPATIAL_ZONE_ID.FULL;
}

/**
 * @param {object} entry
 * @param {import('../extraction/extracted-line.js').ExtractedLine} [line]
 */
function entryToBbox(entry, line) {
  const x = Number.isFinite(entry.x) ? entry.x : Number(line?.x) || 0;
  const y = Number.isFinite(entry.y) ? entry.y : Number(line?.y) || 0;
  const textLen = String(entry.text || '').length;
  const width =
    Number(line?.width) > 0
      ? Number(line.width)
      : Math.max(24, Math.min(520, Math.round(textLen * 6.5)));
  const height = Number(line?.height) > 0 ? Number(line.height) : 14;
  return { x, y, width, height, x2: x + width, y2: y - height };
}

/**
 * @param {import('./layout-memory.js').LayoutMemoryEntry} entry
 * @param {object} [opts]
 * @returns {SpatialBlock}
 */
export function layoutMemoryEntryToSpatialBlock(entry, opts = {}) {
  const text = String(entry.text || '').trim();
  const pageLayouts = opts.pageLayouts || null;
  const pageLayout =
    pageLayouts?.find?.((p) => p.page === entry.page) ||
    (Array.isArray(pageLayouts) ? pageLayouts[entry.page - 1] : null) ||
    null;

  return {
    block_id: `sb-p${entry.page ?? 1}-l${entry.pageLine ?? entry.lineIndex ?? 0}`,
    page_number: entry.page || 1,
    bbox: entryToBbox(entry, opts.line),
    source: entry.source || opts.source || 'layout_memory',
    reading_order: entry.readingOrder ?? entry.lineIndex ?? 0,
    zone_id: resolveZoneId(entry, pageLayout),
    column_id: entry.columnId || COLUMN_IDS.FULL,
    text,
    normalized_text: normalizeSpatialText(text),
    kind: 'line',
  };
}

/**
 * @param {import('./layout-memory.js').LayoutMemoryEntry[]} entries
 * @param {object} [opts]
 * @returns {SpatialBlock[]}
 */
export function spatialBlocksFromLayoutEntries(entries, opts = {}) {
  const lines = opts.lines || [];
  return (entries || [])
    .map((entry) => {
      const line =
        lines.find(
          (l) =>
            l.readingOrder === entry.readingOrder ||
            l.lineIndex === entry.lineIndex ||
            l.line === entry.pageLine
        ) || null;
      return layoutMemoryEntryToSpatialBlock(entry, { ...opts, line });
    })
    .filter((b) => b.text.length > 0);
}

/**
 * @param {import('./layout-memory.js').LayoutMemory|null|undefined} layoutMemory
 * @param {object} [opts]
 * @returns {SpatialBlock[]}
 */
export function spatialBlocksFromLayoutMemory(layoutMemory, opts = {}) {
  if (layoutMemory?.spatialBlocks?.length) return layoutMemory.spatialBlocks;
  if (!layoutMemory?.entries?.length) return [];
  return spatialBlocksFromLayoutEntries(layoutMemory.entries, {
    ...opts,
    lines: layoutMemory.lines,
    pageLayouts: opts.pageLayouts,
  });
}

/**
 * @param {object[]} blocks — geometric / ordered layout blocks
 * @param {object} [opts]
 * @returns {SpatialBlock[]}
 */
export function spatialBlocksFromGeometricBlocks(blocks, opts = {}) {
  const source = opts.source || 'geometric';
  const pageLayouts = opts.pageLayouts || null;

  return (blocks || [])
    .map((b, i) => {
      const lines = b.lines || [];
      const text = String(
        b.text ||
          lines
            .map((l) => String(l.cleanedText ?? l.text ?? '').trim())
            .filter(Boolean)
            .join(' ')
      ).trim();
      if (!text) return null;

      const page = b.page || lines[0]?.page || 1;
      const x = Number(b.x) || Number(lines[0]?.x) || 0;
      const y = Number(b.y) || Number(lines[0]?.y) || 0;
      const width = Number(b.width) || 80;
      const height = Number(b.height) || 14;
      const columnId = b.column || b.columnId || COLUMN_IDS.FULL;

      const pseudoEntry = {
        text,
        page,
        x,
        y,
        columnId,
        region: columnId === COLUMN_IDS.LEFT ? 'left' : columnId === COLUMN_IDS.RIGHT ? 'right' : 'full',
        zone: LAYOUT_ZONE.BODY,
        lineIndex: i,
        readingOrder: b.readingOrder ?? i,
        pageLine: i,
      };

      const pageLayout =
        pageLayouts?.find?.((p) => p.page === page) ||
        (Array.isArray(pageLayouts) ? pageLayouts[page - 1] : null);

      return {
        block_id: String(b.id || `geo-p${page}-${i}`),
        page_number: page,
        bbox: {
          x,
          y,
          width,
          height,
          x2: b.x2 ?? x + width,
          y2: b.y2 ?? y - height,
        },
        source,
        reading_order: b.readingOrder ?? i,
        zone_id: b._readingZone || resolveZoneId(pseudoEntry, pageLayout),
        column_id: columnId,
        text,
        normalized_text: normalizeSpatialText(text),
        kind: b.isHeader ? 'section_header' : lines.length > 1 ? 'block' : 'line',
      };
    })
    .filter(Boolean);
}

/**
 * @param {object} recon — document reconstruction result
 * @returns {SpatialBlock[]}
 */
export function spatialBlocksFromReconstruction(recon) {
  if (!recon?.ok) return [];
  const geo = recon.geometricBlocks?.blocks;
  if (geo?.length) {
    return spatialBlocksFromGeometricBlocks(geo, {
      source: 'document_reconstruction',
      pageLayouts: recon.pageLayouts,
      layout: recon.layout,
    });
  }
  if (recon.lines?.length) {
    return spatialBlocksFromGeometricBlocks(
      recon.lines.map((ln, i) => ({
        id: `recon-l-${i}`,
        text: String(ln.cleanedText ?? ln.text ?? '').trim(),
        lines: [ln],
        page: ln.page || 1,
        x: ln.x,
        y: ln.y,
        width: ln.width,
        height: ln.height,
        readingOrder: ln.readingOrder ?? i,
        column: ln.columnId || ln._readingColumn,
      })),
      { source: 'document_reconstruction', pageLayouts: recon.pageLayouts }
    );
  }
  return [];
}

/**
 * Controlled plain-text fallback — only call when a consumer requires a string blob.
 * @param {SpatialBlock[]} blocks
 * @param {object} [opts]
 * @returns {string}
 */
export function spatialBlocksToPlainText(blocks, opts = {}) {
  const field = opts.useNormalized ? 'normalized_text' : 'text';
  const sorted = [...(blocks || [])].sort(
    (a, b) => (a.reading_order ?? 0) - (b.reading_order ?? 0)
  );
  return sorted
    .map((b) => String(b[field] || b.text || '').trim())
    .filter(Boolean)
    .join('\n');
}

/** @deprecated use spatialBlocksToPlainText — legacy alias */
export const lazyParserText = spatialBlocksToPlainText;

/**
 * @param {SpatialBlock[]} blocks
 * @returns {import('../parsing/block-builder-v1.js').BlockBuilderLine[]}
 */
export function spatialBlocksToOcrLineInput(blocks) {
  return (blocks || [])
    .map((b, i) => ({
      text: b.text,
      page: b.page_number,
      lineIndex: b.reading_order ?? i,
      columnId: b.column_id,
      zone_id: b.zone_id,
      x: b.bbox?.x,
      y: b.bbox?.y,
    }))
    .filter((l) => String(l.text || '').trim().length > 0);
}

/**
 * @param {SpatialBlock[]} blocks
 * @param {(text: string, block: SpatialBlock) => string} updateFn
 * @returns {SpatialBlock[]}
 */
export function updateSpatialBlockTexts(blocks, updateFn) {
  return (blocks || []).map((b) => {
    const text = String(updateFn(b.text, b) ?? b.text).trim();
    return { ...b, text, normalized_text: normalizeSpatialText(text) };
  });
}

/**
 * @param {import('./layout-memory.js').LayoutMemory} layoutMemory
 * @param {SpatialBlock[]} spatialBlocks
 */
export function attachSpatialBlocksToLayoutMemory(layoutMemory, spatialBlocks) {
  if (!layoutMemory) return layoutMemory;
  const blocks = spatialBlocks?.length ? spatialBlocks : layoutMemory.spatialBlocks || [];
  return {
    ...layoutMemory,
    spatialBlocks: blocks,
    parserText: spatialBlocksToPlainText(blocks),
  };
}

/**
 * @param {SpatialBlock[]} blocks
 */
export function isSpatialBlockArray(blocks) {
  return (
    Array.isArray(blocks) &&
    blocks.length > 0 &&
    blocks[0] != null &&
    typeof blocks[0] === 'object' &&
    'block_id' in blocks[0] &&
    'page_number' in blocks[0]
  );
}
