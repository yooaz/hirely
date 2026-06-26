/**
 * EXPERIENCE_PARSER_V2 — date-anchored splitting + EXPERIENCE_BUILDER_V2 block pipeline.
 */

export {
  EXPERIENCE_BUILDER_V2 as EXPERIENCE_PARSER_V2,
  EXPERIENCE_BUILDER_MIN_CONFIDENCE as EXPERIENCE_V2_CONFIDENCE_MIN,
  EXPERIENCE_BUILDER_V2,
  EXPERIENCE_BUILDER_MIN_CONFIDENCE,
  buildExperiencesFromClassifiedBlocks,
  parseExperiencesFromExperienceBlocks,
  filterExperienceBlocksOnly,
  mergeAdjacentExperienceBlocks,
  normalizeExperienceFields,
  validateExperienceCandidate,
  applyExperienceV2Unsorted,
} from './experience-builder-v2.js';

export {
  EXPERIENCE_SPLIT_PARSER_V2,
  isExperienceEntryStartLine,
  splitExperienceLines,
  splitMergedExperienceByDates,
  extractExperienceDateRange,
  parseExperienceEntryV2,
  parseExperiencesV2,
} from './experience-split-parser.js';
