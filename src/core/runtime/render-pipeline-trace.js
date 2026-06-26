/**
 * Render pipeline stage counts — resumeData → sanitize → cvData → template.
 * Logs each stage at most once per import session (no render-loop spam).
 */

import { isHirelyDebug } from './hirely-debug.js';

let _importSession = 0;
const _loggedStages = new Set();

/**
 * Start a new import session — call once per import commit.
 * @param {number|string} [sessionId]
 */
export function resetRenderPipelineTrace(sessionId) {
  _importSession = sessionId != null ? Number(sessionId) || Date.now() : Date.now();
  _loggedStages.clear();
}

/**
 * @param {object|null|undefined} data
 * @returns {object}
 */
export function sectionCounts(data) {
  const d = data || {};
  return {
    experiences:
      (d.experiences || d.experience || []).filter(Boolean).length,
    education: (d.education || []).filter(Boolean).length,
    skills: (d.skills || []).filter(Boolean).length,
    tools: (d.tools || []).filter(Boolean).length,
    languages: (d.languages || []).filter(Boolean).length,
    clients: (d.clients || []).filter(Boolean).length,
    unsorted: (d.unsorted || []).filter(Boolean).length,
  };
}

/**
 * @param {string} stage RESUMEDATA_COUNTS | SANITIZED_COUNTS | CVDATA_COUNTS | TEMPLATE_COUNTS
 * @param {object|null|undefined} data
 */
export function logRenderPipelineCounts(stage, data) {
  const key = `${_importSession}:${stage}`;
  const counts = sectionCounts(data);
  if (_loggedStages.has(key)) return counts;
  _loggedStages.add(key);
  if (isHirelyDebug()) {
    console.log(stage, counts);
  }
  return counts;
}

/** @param {string} [stage] */
export function getRenderPipelineLogCount(stage) {
  if (!stage) return _loggedStages.size;
  const suffix = `:${stage}`;
  let n = 0;
  for (const key of _loggedStages) {
    if (key.endsWith(suffix)) n += 1;
  }
  return n;
}
