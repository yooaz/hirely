/**
 * Column detection — cluster geometric blocks into LEFT / RIGHT / FULL.
 */

import { LAYOUT_TYPES } from './detect-layout.js';
import { splitXByPage } from './page-layout.js';

export const COLUMN_IDS = {
  LEFT: 'LEFT_COLUMN',
  RIGHT: 'RIGHT_COLUMN',
  FULL: 'FULL',
};

export function findColumnSplitX(centers) {
  if (!centers.length) return null;
  const sorted = [...centers].sort((a, b) => a - b);
  if (sorted.length < 4) {
    return (sorted[0] + sorted[sorted.length - 1]) / 2;
  }

  let bestGap = 0;
  let split = (sorted[0] + sorted[sorted.length - 1]) / 2;
  const minX = sorted[0];
  const maxX = sorted[sorted.length - 1];
  const span = maxX - minX || 1;

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1] - sorted[i];
    const mid = (sorted[i] + sorted[i + 1]) / 2;
    const rel = (mid - minX) / span;
    if (gap > bestGap && rel > 0.28 && rel < 0.72) {
      bestGap = gap;
      split = mid;
    }
  }

  if (bestGap < span * 0.08) {
    const left = sorted.filter((c) => c < split);
    const right = sorted.filter((c) => c >= split);
    if (left.length && right.length) return split;
    return minX + span * 0.38;
  }
  return split;
}

/**
 * Assign column ids to geometric blocks.
 * @param {object[]} blocks
 * @param {object} layout — from detectLayout
 * @param {object} [opts]
 * @param {Map<number, number>} [opts.splitXByPage]
 */
export function detectColumns(blocks, layout = {}, opts = {}) {
  const layoutType = layout.layoutType || LAYOUT_TYPES.SINGLE_COLUMN;
  const positioned = (blocks || []).filter((b) => Number.isFinite(b.cx));
  const pageSplits = opts.splitXByPage || splitXByPage(layout.pageLayouts);

  if (!positioned.length) {
    for (const b of blocks || []) {
      b.column = COLUMN_IDS.FULL;
    }
    return {
      stage: 'columns',
      blocks: blocks || [],
      splitX: null,
      leftCount: 0,
      rightCount: 0,
      layoutType,
      multiColumn: false,
      at: new Date().toISOString(),
    };
  }

  const centers = positioned.map((b) => b.cx);
  const minX = Math.min(...positioned.map((b) => b.x));
  const maxX = Math.max(...positioned.map((b) => b.x2));
  const span = maxX - minX || 1;

  let splitX = layout.columnSplit ?? layout.geometry?.columnSplit;
  if (!Number.isFinite(splitX) && positioned.length) {
    const page = positioned[0].page || 1;
    splitX = pageSplits.get(page);
  }
  if (!Number.isFinite(splitX)) {
    splitX = findColumnSplitX(centers);
  }

  if (layoutType === LAYOUT_TYPES.LEFT_SIDEBAR) {
    const leftBlocks = positioned.filter((b) => b.cx < splitX);
    if (leftBlocks.length) {
      splitX = Math.max(...leftBlocks.map((b) => b.x2)) + Math.max(8, span * 0.02);
    } else {
      splitX = minX + span * 0.36;
    }
  } else if (layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR) {
    const rightBlocks = positioned.filter((b) => b.cx >= splitX);
    if (rightBlocks.length) {
      splitX = Math.min(...rightBlocks.map((b) => b.x)) - Math.max(8, span * 0.02);
    } else {
      splitX = minX + span * 0.64;
    }
  }

  let leftCount = 0;
  let rightCount = 0;
  for (const b of blocks) {
    if (!Number.isFinite(b.cx)) {
      b.column = COLUMN_IDS.FULL;
      continue;
    }
    const pageSplit = pageSplits.get(b.page || 1);
    const effectiveSplit = Number.isFinite(pageSplit) ? pageSplit : splitX;
    if (b.cx <= effectiveSplit) {
      b.column = COLUMN_IDS.LEFT;
      leftCount++;
    } else {
      b.column = COLUMN_IDS.RIGHT;
      rightCount++;
    }
  }

  const multiColumn =
    layoutType === LAYOUT_TYPES.TWO_COLUMN ||
    layoutType === LAYOUT_TYPES.LEFT_SIDEBAR ||
    layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR;

  return {
    stage: 'columns',
    blocks,
    splitX,
    leftCount,
    rightCount,
    layoutType,
    multiColumn,
    pageSpan: { minX, maxX, span },
    at: new Date().toISOString(),
  };
}

function sortBlocksTopToBottom(blocks) {
  return [...blocks].sort((a, b) => b.y - a.y || a.x - b.x);
}

/**
 * Column-aware block sequence (left top→bottom, then right).
 * @param {object[]} blocks — with column assigned
 * @param {string} layoutType
 */
export function orderBlocksByColumns(blocks, layoutType) {
  const left = sortBlocksTopToBottom(blocks.filter((b) => b.column === COLUMN_IDS.LEFT));
  const right = sortBlocksTopToBottom(blocks.filter((b) => b.column === COLUMN_IDS.RIGHT));
  const full = sortBlocksTopToBottom(blocks.filter((b) => b.column === COLUMN_IDS.FULL));

  if (layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR) {
    return [...full, ...right, ...left];
  }
  if (
    layoutType === LAYOUT_TYPES.LEFT_SIDEBAR ||
    layoutType === LAYOUT_TYPES.TWO_COLUMN ||
    layoutType === LAYOUT_TYPES.DOUBLE_COLUMN
  ) {
    return [...full, ...left, ...right];
  }
  return sortBlocksTopToBottom(blocks);
}
