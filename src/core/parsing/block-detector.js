/**
 * Block detection — delegates to layout reconstruction (reading-order.js).
 * Document → layout → ordered blocks (never raw PDF line order).
 */

import {
  buildOrderedBlocks,
  orderLinesForReading,
  groupOrderedLinesIntoBlocks,
} from '../extraction/reading-order.js';
import { LAYOUT_TYPES } from '../extraction/layout-detector.js';

export { LAYOUT_TYPES, orderLinesForReading as orderLinesForLayout };

export const DETECTED_BLOCK_KINDS = ['section_header', 'content', 'region'];

/**
 * @param {object} opts
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} [opts.lines]
 * @param {string} [opts.layoutType]
 * @param {string} [opts.rawText]
 * @param {string} [opts.cleanedText]
 * @param {object} [opts.ocrLayout]
 */
export function detectBlocks(opts = {}) {
  const result = buildOrderedBlocks(opts);
  return {
    stage: 'block_detection',
    layoutType: result.layoutType,
    layout: result.layout,
    blockCount: result.blockCount,
    orderedLineCount: result.orderedLineCount,
    blocks: result.orderedBlocks,
    orderedBlocks: result.orderedBlocks,
    orderedLines: result.orderedLines,
    parseText: result.parseText,
    usedRawPdfLineOrder: false,
    usedGeometryReadingOrder: result.usedGeometryReadingOrder,
    at: result.at,
  };
}

export { groupOrderedLinesIntoBlocks as groupLinesIntoBlocks };

/**
 * Plain-text fallback when no line archive (paste / TXT).
 * @param {string} rawText
 */
export function detectBlocksFromText(rawText) {
  return detectBlocks({ rawText, layoutType: LAYOUT_TYPES.SINGLE_COLUMN });
}

/** Alias for production pipeline */
export function buildBlockDetectionStage(opts = {}) {
  return detectBlocks(opts);
}
