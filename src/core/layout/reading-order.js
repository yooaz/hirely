/**
 * Reading order — after layout, columns, and blocks. Never raw PDF line index.
 */

import { LAYOUT_TYPES, detectLayout } from './detect-layout.js';
import { detectColumns, orderBlocksByColumns, COLUMN_IDS } from './detect-columns.js';
import {
  extractGeometricBlocks,
  geometricBlocksToLayoutBlocks,
} from './block-extractor.js';
import {
  reconstructColumnBlocks,
  geometricBlocksToSectionBlocks,
} from './column-reconstruction.js';
import { fuzzySectionKey } from '../parsing/section-fuzzy.js';
import { isSectionHeaderLine } from '../parsing/rich-parser.js';
import {
  PAGE_LAYOUT_TYPES,
  zoneOrderedLines,
  classifyDocumentPageLayouts,
} from './page-layout.js';

export { COLUMN_IDS };
export const ORDERED_BLOCK_KINDS = ['section_header', 'content', 'region'];

export function compareLinesReadingOrder(a, b) {
  const ya = Number.isFinite(a.y) ? a.y : null;
  const yb = Number.isFinite(b.y) ? b.y : null;
  if (ya !== null && yb !== null && ya !== yb) return yb - ya;
  const xa = Number.isFinite(a.x) ? a.x : 0;
  const xb = Number.isFinite(b.x) ? b.x : 0;
  if (xa !== xb) return xa - xb;
  return (a.readingOrder ?? a.line ?? 0) - (b.readingOrder ?? b.line ?? 0);
}

function hasPositionedLines(lines) {
  const usable = (lines || []).filter(
    (l) => Number.isFinite(l.x) && Number.isFinite(l.y) && String(l.text || '').trim().length > 0
  );
  if (!usable.length) return false;
  const ys = usable.map((l) => Number(l.y));
  const xs = usable.map((l) => Number(l.x));
  const ySpread = Math.max(...ys) - Math.min(...ys);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  return ySpread >= 4 && xSpread >= 40;
}

function isMultiColumnLayout(layoutType) {
  return (
    layoutType === LAYOUT_TYPES.TWO_COLUMN ||
    layoutType === LAYOUT_TYPES.DOUBLE_COLUMN ||
    layoutType === LAYOUT_TYPES.LEFT_SIDEBAR ||
    layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR
  );
}

function plainTextToLines(text, source = 'native') {
  const conf = source === 'ocr' ? 75 : 88;
  return String(text || '')
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t, i) => ({
      text: t,
      rawExtraction: t,
      cleanedText: t,
      confidence: conf,
      source,
      page: 1,
      line: i,
      pdfIndex: i,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));
}

export function orderLinesForReading(lines) {
  const positioned = (lines || []).filter((l) => String(l.cleanedText ?? l.text ?? '').trim());
  if (!positioned.length) return [];
  return [...positioned].sort(compareLinesReadingOrder).map((ln, i) => ({ ...ln, readingOrder: i }));
}

export function groupOrderedLinesIntoBlocks(orderedLines, layoutType = LAYOUT_TYPES.SINGLE_COLUMN) {
  const blocks = [];
  let current = null;
  let order = 0;

  const flush = () => {
    if (!current) return;
    current.text = (current.lines || [])
      .map((l) => String(l.cleanedText ?? l.text ?? '').trim())
      .filter(Boolean)
      .join('\n');
    current.lineCount = current.lines.length;
    current.readingOrder = order++;
    blocks.push(current);
    current = null;
  };

  for (const ln of orderedLines) {
    const text = String(ln.cleanedText ?? ln.text ?? '').trim();
    if (!text) continue;

    if (isSectionHeaderLine(text)) {
      flush();
      const sectionKey = fuzzySectionKey(text) || 'header';
      blocks.push({
        id: `hdr-${blocks.length}`,
        kind: 'section_header',
        sectionKey,
        column: ln._readingColumn || null,
        region: ln._readingRegion || 'full',
        layoutType,
        sourcePage: ln.page || 1,
        readingOrder: order++,
        lines: [ln],
        text,
        lineCount: 1,
      });
      current = {
        id: `blk-${blocks.length}`,
        kind: 'content',
        sectionHint: sectionKey,
        column: ln._readingColumn || null,
        region: ln._readingRegion || 'main',
        layoutType,
        sourcePage: ln.page || 1,
        lines: [],
        text: '',
        lineCount: 0,
      };
      continue;
    }

    if (!current) {
      current = {
        id: `blk-${blocks.length}`,
        kind: 'content',
        sectionHint: ln.section || 'header',
        column: ln._readingColumn || null,
        region: ln._readingRegion || 'main',
        layoutType,
        sourcePage: ln.page || 1,
        lines: [],
        text: '',
        lineCount: 0,
      };
    }
    current.lines.push(ln);
    current.lineCount = current.lines.length;
  }
  flush();
  return blocks;
}

/**
 * Reading order from prior stages (layout + columns + geometric blocks).
 * @param {object} ctx — { lines, layout, columns, blocks }
 */
export function buildReadingOrder(ctx = {}) {
  const layout = ctx.layout || detectLayout(ctx);
  const layoutType = layout.layoutType || LAYOUT_TYPES.SINGLE_COLUMN;
  let lines = ctx.lines || [];
  const forbidPlain =
    ctx.forbidPlainTextFallback === true || String(ctx.source || '').startsWith('pdf');

  if (!lines.length && ctx.rawText?.length >= 10) {
    if (forbidPlain) {
      return {
        stage: 'reading_order',
        layoutType,
        layout,
        columns: null,
        orderedBlocks: [],
        blocks: [],
        orderedLines: [],
        blockCount: 0,
        orderedLineCount: 0,
        usedRawPdfLineOrder: false,
        usedRawPdfOrder: false,
        usedGeometryReadingOrder: false,
        usedColumnReconstruction: false,
        pdfBlockEngineError: 'READING_ORDER_NO_PDF_FALLBACK',
        at: new Date().toISOString(),
      };
    }
    lines = plainTextToLines(ctx.rawText, 'native');
  }

  const positioned = hasPositionedLines(lines);
  let orderedLines = [];
  let orderedBlocks = [];
  let columnMeta = ctx.columns || null;
  let sectionIntegrity = { ok: true, violations: [], sections: [] };

  if (positioned && isMultiColumnLayout(layoutType)) {
    const geom = ctx.blocks || extractGeometricBlocks(lines, { pageLayouts: layout.pageLayouts });
    const cols = columnMeta || detectColumns(geom.blocks, layout);
    const ordered = orderBlocksByColumns(cols.blocks, layoutType);

    let readingOrder = 0;
    const primaryPageLayout =
      layout.pageLayouts?.pages?.find((p) => p.page === 1) || layout.pageLayouts?.pages?.[0];
    const useZoneOrder =
      primaryPageLayout &&
      (primaryPageLayout.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT ||
        primaryPageLayout.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT);

    if (useZoneOrder) {
      orderedLines = zoneOrderedLines(primaryPageLayout, lines).map((ln, i) => ({
        ...ln,
        readingOrder: i,
        _readingColumn:
          ln._readingZone === 'sidebar'
            ? primaryPageLayout.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT
              ? COLUMN_IDS.RIGHT
              : COLUMN_IDS.LEFT
            : ln._readingZone === 'main'
              ? primaryPageLayout.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT
                ? COLUMN_IDS.LEFT
                : COLUMN_IDS.RIGHT
              : ln._readingZone === 'left_column'
                ? COLUMN_IDS.LEFT
                : COLUMN_IDS.RIGHT,
        _readingRegion: ln._readingZone || 'main',
      }));
      readingOrder = orderedLines.length;
    } else {
      for (const block of ordered) {
        block.readingOrder = readingOrder++;
        for (const ln of block.lines) {
          orderedLines.push({
            ...ln,
            readingOrder: readingOrder - 1,
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
      }
    }
    const layoutBlocks = geometricBlocksToSectionBlocks(ordered, layoutType);
    const reconstructed = reconstructColumnBlocks({
      layout,
      columns: cols,
      blocks: geom,
      layoutBlocks,
      orderedLines,
    });
    orderedBlocks = reconstructed.orderedBlocks;
    sectionIntegrity = reconstructed.sectionIntegrity;
    columnMeta = cols;
  } else {
    orderedLines = orderLinesForReading(lines, layoutType);
    const layoutBlocks = groupOrderedLinesIntoBlocks(orderedLines, layoutType);
    const reconstructed = reconstructColumnBlocks({
      layout,
      columns: columnMeta,
      layoutBlocks,
      orderedLines,
    });
    orderedBlocks = reconstructed.orderedBlocks;
    sectionIntegrity = reconstructed.sectionIntegrity;
  }

  return {
    stage: 'reading_order',
    layoutType,
    layout,
    columns: columnMeta,
    orderedBlocks,
    blocks: orderedBlocks,
    orderedLines,
    blockCount: orderedBlocks.length,
    orderedLineCount: orderedLines.length,
    sectionIntegrity,
    usedRawPdfLineOrder: false,
    usedRawPdfOrder: false,
    usedGeometryReadingOrder: positioned,
    usedColumnReconstruction: Boolean(columnMeta?.multiColumn),
    at: new Date().toISOString(),
  };
}

export function applyReadingOrder(document = {}) {
  const layout = document.layout || detectLayout(document);
  const geom = document.blocks?.blocks
    ? document.blocks
    : extractGeometricBlocks(document.lines || []);
  const columns =
    document.columns ||
    detectColumns([...(geom.blocks || [])], layout);
  return buildReadingOrder({
    ...document,
    layout,
    blocks: geom,
    columns,
  });
}

export function buildOrderedBlocks(opts = {}) {
  return applyReadingOrder(opts);
}

export function orderLinesForLayout(lines, layoutType) {
  return orderLinesForReading(lines, layoutType);
}

export function buildReadingBlocksStage(opts = {}) {
  return applyReadingOrder(opts);
}
