/**
 * Block extraction — merge lines into geometric blocks (bbox). No raw PDF order.
 */

import { fuzzySectionKey } from '../parsing/section-fuzzy.js';
import { isSectionHeaderLine } from '../parsing/rich-parser.js';
import { COLUMN_IDS } from './detect-columns.js';
import { classifyDocumentPageLayouts, splitXByPage } from './page-layout.js';
import { blocksShareReadingZone, splitXByPageFromLayout } from './resume-layout-engine.js';

const BLOCK_MERGE_Y_GAP = 28;
const COLUMN_MERGE_X_GAP = 72;

export function lineBoundingBox(ln) {
  const text = String(ln.cleanedText ?? ln.text ?? '').trim();
  const x = Number(ln.x) || 0;
  const y = Number(ln.y) || 0;
  const width =
    Number(ln.width) > 0
      ? Number(ln.width)
      : Math.max(24, Math.min(520, Math.round(text.length * 6.5)));
  const height = Number(ln.height) > 0 ? Number(ln.height) : 14;
  return {
    x,
    y,
    width,
    height,
    x2: x + width,
    y2: y - height,
    cx: x + width / 2,
    cy: y - height / 2,
  };
}

/**
 * STEP: one geometric block per line (with bbox).
 */
export function extractLineBlocks(lines) {
  const blocks = [];
  let id = 0;
  for (const ln of lines || []) {
    const text = String(ln.cleanedText ?? ln.text ?? '').trim();
    if (!text) continue;
    const box = lineBoundingBox(ln);
    blocks.push({
      id: `lb-${id++}`,
      text,
      lines: [ln],
      page: ln.page || 1,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      x2: box.x2,
      y2: box.y2,
      cx: box.cx,
      cy: box.cy,
      isHeader: isSectionHeaderLine(text),
      sectionKey: isSectionHeaderLine(text) ? fuzzySectionKey(text) : null,
      column: null,
    });
  }
  return blocks;
}

function linesLackVerticalLayout(blocks) {
  const ys = (blocks || []).map((b) => Number(b.y)).filter((y) => Number.isFinite(y));
  if (!ys.length) return true;
  return Math.max(...ys) - Math.min(...ys) < 4;
}

function blocksCrossColumnSplit(a, b, splitX) {
  if (!Number.isFinite(splitX)) return false;
  const acx = a.cx ?? ((a.x || 0) + (a.x2 || a.x || 0)) / 2;
  const bcx = b.cx ?? ((b.x || 0) + (b.x2 || b.x || 0)) / 2;
  return (acx <= splitX && bcx > splitX) || (acx > splitX && bcx <= splitX);
}

export function mergeAdjacentLineBlocks(blocks, opts = {}) {
  if (!blocks.length) return [];
  const pageLayoutsByPage = new Map();
  if (opts.resumeLayoutStage?.pages) {
    for (const p of opts.resumeLayoutStage.pages) pageLayoutsByPage.set(p.page, p);
  }
  const pageSplits =
    opts.splitXByPage ||
    (opts.resumeLayoutStage ? splitXByPageFromLayout(opts.resumeLayoutStage) : null) ||
    (opts.pageLayouts ? splitXByPage(opts.pageLayouts) : null) ||
    (opts.lines ? splitXByPage(classifyDocumentPageLayouts(opts.lines)) : new Map());
  if (linesLackVerticalLayout(blocks)) {
    return blocks.map((b) => ({ ...b, lines: [...(b.lines || [])] }));
  }
  const byPage = new Map();
  for (const b of blocks) {
    const p = b.page || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(b);
  }
  const merged = [];
  for (const [, pageBlocks] of byPage) {
    const sorted = [...pageBlocks].sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = null;
    const flushCur = () => {
      if (cur) {
        merged.push(cur);
        cur = null;
      }
    };
    for (const b of sorted) {
      if (b.isHeader) {
        flushCur();
        merged.push({ ...b, lines: [...b.lines] });
        continue;
      }
      if (!cur) {
        cur = { ...b, lines: [...b.lines] };
        continue;
      }
      if (cur.isHeader) {
        flushCur();
        cur = { ...b, lines: [...b.lines] };
        continue;
      }
      const yGap = Math.abs(cur.y2 - b.y);
      const xGap = Math.abs((cur.cx ?? cur.x) - (b.cx ?? b.x));
      const pageSplit = pageSplits.get(b.page || cur.page || 1);
      const pageLayout = pageLayoutsByPage.get(b.page || cur.page || 1) || null;
      if (blocksCrossColumnSplit(cur, b, pageSplit)) {
        flushCur();
        cur = { ...b, lines: [...b.lines] };
        continue;
      }
      if (pageLayout && !blocksShareReadingZone(cur, b, pageLayout)) {
        flushCur();
        cur = { ...b, lines: [...b.lines] };
        continue;
      }
      if (xGap > COLUMN_MERGE_X_GAP) {
        flushCur();
        cur = { ...b, lines: [...b.lines] };
        continue;
      }
      const xOverlap =
        Math.min(cur.x2, b.x2) - Math.max(cur.x, b.x) >
        Math.min(cur.width, b.width) * 0.25;
      if (yGap <= BLOCK_MERGE_Y_GAP && xOverlap) {
        cur.lines.push(...b.lines);
        cur.text = cur.lines.map((l) => String(l.cleanedText ?? l.text ?? '').trim()).join('\n');
        cur.x = Math.min(cur.x, b.x);
        cur.y = Math.max(cur.y, b.y);
        cur.x2 = Math.max(cur.x2, b.x2);
        cur.y2 = Math.min(cur.y2, b.y2);
        cur.width = cur.x2 - cur.x;
        cur.height = cur.y - cur.y2;
        cur.cx = (cur.x + cur.x2) / 2;
        cur.cy = (cur.y + cur.y2) / 2;
      } else {
        flushCur();
        cur = { ...b, lines: [...b.lines] };
      }
    }
    flushCur();
  }
  return merged;
}

/**
 * Blocks stage — lines → merged geometric blocks (pre-column).
 * @param {object[]} lines
 * @param {object} [opts]
 */
export function extractGeometricBlocks(lines = [], opts = {}) {
  const pageLayouts =
    opts.pageLayouts ||
    (lines.some((l) => Number.isFinite(l.x)) ? classifyDocumentPageLayouts(lines) : null);
  const lineBlocks = extractLineBlocks(lines);
  const blocks = mergeAdjacentLineBlocks(lineBlocks, { ...opts, pageLayouts, lines });
  return {
    stage: 'blocks',
    blocks,
    blockCount: blocks.length,
    lineBlockCount: lineBlocks.length,
    pageLayouts,
    at: new Date().toISOString(),
  };
}

export function geometricBlocksToLayoutBlocks(geometricBlocks, layoutType) {
  const out = [];
  let order = 0;
  let activeSection = null;

  for (const gb of geometricBlocks) {
    const text = String(gb.text || '').trim();
    if (!text) continue;

    if (gb.isHeader || gb.sectionKey) {
      activeSection = gb.sectionKey || fuzzySectionKey(text) || 'header';
      out.push({
        id: gb.id || `hdr-${out.length}`,
        kind: 'section_header',
        sectionKey: activeSection,
        column: gb.column,
        region:
          gb.column === COLUMN_IDS.LEFT
            ? 'left'
            : gb.column === COLUMN_IDS.RIGHT
              ? 'right'
              : 'full',
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
      });
      continue;
    }

    out.push({
      id: gb.id || `blk-${out.length}`,
      kind: 'content',
      sectionHint: activeSection || 'body',
      column: gb.column,
      region:
        gb.column === COLUMN_IDS.LEFT
          ? 'left'
          : gb.column === COLUMN_IDS.RIGHT
            ? 'right'
            : 'full',
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
    });
  }
  return out;
}

function avgLineConfidence(lines) {
  const vals = (lines || [])
    .map((l) => Number(l.confidence))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!vals.length) return 75;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function toBbox(lb) {
  return {
    x: Number(lb.x) || 0,
    y: Number(lb.y) || 0,
    width: Number(lb.width) || 0,
    height: Number(lb.height) || 0,
  };
}

export function layoutBlocksToExtracted(layoutBlocks = []) {
  const blocks = [];
  for (const lb of layoutBlocks) {
    const text = String(lb.text || '').trim();
    if (!text) continue;
    const lineSource = (lb.lines || [])[0]?.source;
    blocks.push({
      id: lb.id || `ext-${blocks.length}`,
      text,
      bbox: toBbox(lb),
      page: lb.sourcePage || lb.page || 1,
      x: Number(lb.x) || 0,
      y: Number(lb.y) || 0,
      width: Number(lb.width) || 0,
      height: Number(lb.height) || 0,
      confidence: avgLineConfidence(lb.lines),
      source: lineSource === 'ocr' ? 'pdf_ocr' : lineSource === 'native' ? 'pdf_native' : lineSource || 'unknown',
      type: 'unknown',
      kind: lb.kind || 'content',
      sectionHint: lb.sectionHint || lb.sectionKey || null,
      sectionKey: lb.sectionKey || null,
      column: lb.column || null,
      readingOrder: lb.readingOrder ?? blocks.length,
      lines: lb.lines || [],
    });
  }
  return blocks;
}
