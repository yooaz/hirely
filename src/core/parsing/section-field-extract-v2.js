/**
 * SECTION_ENGINE_V2 — stage 3: facts → CV (2-stage pipeline).
 * Stage 1: extract facts. Stage 2: build CV from facts above threshold.
 */

import { runFactPipeline } from './fact-pipeline.js';

/**
 * @param {import('./section-types-v2.js').SectionBlockV2[]} classifiedBlocks
 * @param {object} [opts]
 */
export function extractFieldsFromSectionBlocks(classifiedBlocks, opts = {}) {
  const factResult = runFactPipeline(classifiedBlocks, {
    rawText: opts.rawText,
    creativeMode: opts.creativeMode,
    headerLines: opts.headerLines,
  });
  return factResult.structured;
}
