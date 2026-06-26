/**
 * RESUME_GRAPH_ENGINE — structured resume → graph → JSON.
 * Never builds resume JSON directly from OCR or raw text.
 */

import { RESUME_GRAPH_ENGINE } from './resume-graph-types.js';
import { buildResumeGraph, assertGraphStructuredInput } from './build-resume-graph.js';
import { graphToCvData } from './graph-to-cv-data.js';
import { hirelyDebugLog, hirelyDebugWarn } from '../runtime/hirely-debug.js';

/**
 * @param {object} structured — parsed structuredResume (not raw OCR)
 * @param {object} [opts]
 * @returns {{ graph: object, resumeJson: object, structured: object }}
 */
export function runResumeGraphEngine(structured, opts = {}) {
  if (opts.rawText || opts.cleanedText) {
    hirelyDebugWarn('[Hirely] RESUME_GRAPH_ENGINE ignores rawText/cleanedText — structured fields only');
  }

  assertGraphStructuredInput(structured);
  const graph = buildResumeGraph(structured);
  const resumeJson = graphToCvData(graph, { structured });

  structured.metadata = {
    ...(structured.metadata || {}),
    resumeGraphEngine: RESUME_GRAPH_ENGINE,
    resumeGraph: graph,
    neverBuildJsonFromOcr: true,
    jsonFromGraph: true,
  };

  hirelyDebugLog('RESUME_GRAPH_ENGINE', {
    nodes: graph.stats,
    edges: graph.stats?.edges,
    rootId: graph.rootId,
  });

  return { graph, resumeJson, structured };
}
