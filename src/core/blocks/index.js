export {
  BLOCK_PIPELINE_VERSION,
  BLOCK_SOURCE,
  STRUCTURE_FIRST_STAGE,
  normalizeBBox,
  blockHasStructure,
} from './block-contract.js';

export {
  createFlatTextGuard,
  setActiveFlatTextGuard,
  getActiveFlatTextGuard,
  recordFlattenIfActive,
  FLATTEN_ALLOWED_SITES,
} from './flat-text-guard.js';

export {
  rawPagesFromExtractionLines,
  rawBlocksFromExtractionLines,
  rawBlocksFromSpatialBlocks,
  normalizeRawBlocks,
  logicalBlocksFromNormalized,
  sectionBlocksFromLogical,
  normalizedBlocksFromSpatial,
} from './block-adapters.js';

export {
  buildStructureFirstDocument,
  runStructureFirstParse,
  attachStructureFirstToEnterprise,
} from './block-pipeline.js';
