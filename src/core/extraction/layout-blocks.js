/** @deprecated Use src/core/layout/detect-columns.js + block-extractor.js */
export {
  COLUMN_IDS,
  findColumnSplitX,
  detectColumns,
  orderBlocksByColumns,
} from '../layout/detect-columns.js';

/** @deprecated */
export { detectColumns as clusterBlocksIntoColumns } from '../layout/detect-columns.js';
/** @deprecated */
export { orderBlocksByColumns as orderBlocksByColumnReading } from '../layout/detect-columns.js';

export {
  lineBoundingBox,
  extractLineBlocks,
  mergeAdjacentLineBlocks,
  extractGeometricBlocks,
  geometricBlocksToLayoutBlocks,
  layoutBlocksToExtracted,
} from '../layout/block-extractor.js';

export { buildReadingBlocksStage as reconstructTwoColumnLayout } from '../layout/reading-order.js';
