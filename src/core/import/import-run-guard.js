/**
 * Single active import run — events and UI updates must match the latest run only.
 */

import { resetImportRunState } from './import-state.js';

/** @type {string|null} */
let activeImportRunId = null;

/**
 * @returns {string}
 */
export function createImportRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Start a new import run — supersedes any in-flight run.
 * @returns {string}
 */
export function beginImportRun() {
  activeImportRunId = createImportRunId();
  resetImportRunState(activeImportRunId);
  try {
    globalThis.HIRELY_IMPORT_RUN_ID = activeImportRunId;
    globalThis.HIRELY_IMPORT_DECISION_RUN = undefined;
    globalThis.HIRELY_LAST_IMPORT_DECISION = undefined;
    globalThis.HIRELY_LAST_IMPORT_DESTINATION = undefined;
    globalThis.__HIRELY_LAST_IMPORT_DECISION__ = undefined;
  } catch {
    /* ignore */
  }
  return activeImportRunId;
}

/**
 * @returns {string|null}
 */
export function peekImportRunId() {
  try {
    const g = globalThis.HIRELY_IMPORT_RUN_ID;
    if (g != null && String(g).length) return String(g);
  } catch {
    /* ignore */
  }
  return activeImportRunId;
}

/**
 * @param {string|number|null|undefined} [runId]
 */
export function isImportRunCurrent(runId) {
  if (runId == null) return true;
  const active = peekImportRunId();
  if (active == null) return false;
  return String(runId) === String(active);
}

/**
 * @param {string} name
 * @param {object} [detail]
 */
export function dispatchImportRunEvent(name, detail = {}) {
  const importRunId = detail.importRunId ?? peekImportRunId();
  if (!isImportRunCurrent(importRunId)) return false;
  try {
    globalThis.dispatchEvent?.(
      new CustomEvent(name, { detail: { ...detail, importRunId } })
    );
    return true;
  } catch {
    return false;
  }
}
