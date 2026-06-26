/**
 * 2-stage fact pipeline orchestrator.
 *
 * Stage 1: extract facts { type, value, confidence }
 * Stage 2: build CV from facts above threshold; unknown → review queue
 */

import { extractFactsFromSectionBlocks } from './fact-extraction.js';
import { buildCvFromFacts } from './cv-from-facts.js';
import { FACT_PIPELINE_VERSION } from './fact-types.js';

export { FACT_PIPELINE_VERSION };

/**
 * @param {import('./section-types-v2.js').SectionBlockV2[]} classifiedBlocks
 * @param {object} [opts]
 */
export function runFactPipeline(classifiedBlocks, opts = {}) {
  const facts = extractFactsFromSectionBlocks(classifiedBlocks, {
    rawText: opts.rawText,
    creativeMode: opts.creativeMode,
  });

  const stage2 = buildCvFromFacts(facts, {
    threshold: opts.threshold,
    rawText: opts.rawText,
    classifiedBlocks,
    creativeMode: opts.creativeMode,
    factStage: opts.factStage,
  });

  stage2.structured.metadata = {
    ...(stage2.structured.metadata || {}),
    factPipelineVersion: FACT_PIPELINE_VERSION,
    facts: facts.map((f) => ({
      type: f.type,
      value: f.value,
      confidence: Math.round(f.confidence * 1000) / 1000,
      sourceLine: f.sourceLine || f.value,
    })),
  };

  return {
    facts,
    ...stage2,
    pipeline: FACT_PIPELINE_VERSION,
  };
}
