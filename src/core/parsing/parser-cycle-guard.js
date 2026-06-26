/**
 * Parser cycle protection — max depth, visited nodes, UNKNOWN fallback.
 * Prevents RangeError stacks across education ↔ experience classifiers.
 */

export const MAX_PARSER_DEPTH = 10;

export const PARSER_UNKNOWN_BUCKET = 'unknown';

/** Returned when education confidence re-enters while already visiting the same line. */
export const UNKNOWN_EDUCATION_SIGNALS = Object.freeze({
  score: 0,
  forceEducation: false,
  schoolMatch: false,
  degreeMatch: false,
  yearMatch: false,
  confidence: 0,
  signals: ['unknown_cycle'],
  isEducationLine: false,
  unknown: true,
});

/** Classification payload when cycle guard trips. */
export const UNKNOWN_CLASSIFICATION = Object.freeze({
  bucket: PARSER_UNKNOWN_BUCKET,
  confidence: 0,
  signals: ['unknown_cycle'],
  parserDebug: {
    classificationReason: 'cycle_guard_unknown',
    confidenceScore: 0,
  },
});

const depthByKey = new Map();
const activeVisits = new Set();

/**
 * @param {string} key — guard namespace (e.g. edu_signals, exp_gate)
 * @param {string} nodeId — line hash / id
 */
export function parserGuardEnter(key, nodeId = '') {
  const id = `${key}::${String(nodeId || '').slice(0, 240)}`;
  if (activeVisits.has(id)) {
    return { blocked: true, reason: 'visited', id, depth: depthByKey.get(key) || 0 };
  }
  const nextDepth = (depthByKey.get(key) || 0) + 1;
  if (nextDepth > MAX_PARSER_DEPTH) {
    return { blocked: true, reason: 'depth', id, depth: nextDepth };
  }
  depthByKey.set(key, nextDepth);
  activeVisits.add(id);
  return { blocked: false, id, depth: nextDepth };
}

/**
 * @param {string} key
 * @param {string} [id]
 */
export function parserGuardExit(key, id) {
  const depth = depthByKey.get(key) || 0;
  if (depth > 0) depthByKey.set(key, depth - 1);
  else depthByKey.delete(key);
  if (id) activeVisits.delete(id);
}

/**
 * @template T
 * @param {string} key
 * @param {string} nodeId
 * @param {() => T} fn
 * @param {() => T} fallback
 */
export function runParserGuarded(key, nodeId, fn, fallback) {
  const enter = parserGuardEnter(key, nodeId);
  if (enter.blocked) return fallback();
  try {
    return fn();
  } finally {
    parserGuardExit(key, enter.id);
  }
}

export function resetParserCycleGuard() {
  depthByKey.clear();
  activeVisits.clear();
}

/** True while passesExperienceGate is on the stack — blocks mutual recursion via isLikelyTool. */
let experienceGateActive = false;

export function isExperienceGateActive() {
  return experienceGateActive;
}

export function withExperienceGateActive(fn) {
  if (experienceGateActive) return false;
  experienceGateActive = true;
  try {
    return fn();
  } finally {
    experienceGateActive = false;
  }
}
