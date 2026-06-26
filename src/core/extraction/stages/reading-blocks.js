/**
 * Stage 2b — Layout reconstruction: reading order → ordered blocks.
 */

export {
  buildOrderedBlocks,
  buildReadingBlocksStage,
  orderLinesForReading,
  orderLinesForLayout,
  groupOrderedLinesIntoBlocks,
  compareLinesReadingOrder,
  ORDERED_BLOCK_KINDS,
} from '../reading-order.js';
