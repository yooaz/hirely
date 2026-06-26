/**
 * Deterministic import lifecycle — one terminal state per importRunId.
 */

import { isImportRunCurrent, peekImportRunId } from './import-run-guard.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';

export const IMPORT_STATE = {
  IMPORT_IDLE: 'IMPORT_IDLE',
  IMPORT_READING: 'IMPORT_READING',
  IMPORT_EXTRACTING: 'IMPORT_EXTRACTING',
  IMPORT_PARSING: 'IMPORT_PARSING',
  IMPORT_READY: 'IMPORT_READY',
  IMPORT_PARTIAL: 'IMPORT_PARTIAL',
  IMPORT_NEEDS_PASTE: 'IMPORT_NEEDS_PASTE',
  IMPORT_FAILED: 'IMPORT_FAILED',
};

const TERMINAL_STATES = new Set([
  IMPORT_STATE.IMPORT_READY,
  IMPORT_STATE.IMPORT_PARTIAL,
  IMPORT_STATE.IMPORT_NEEDS_PASTE,
  IMPORT_STATE.IMPORT_FAILED,
]);

const SUCCESS_TERMINAL = new Set([
  IMPORT_STATE.IMPORT_READY,
  IMPORT_STATE.IMPORT_PARTIAL,
]);

const PASTE_TERMINAL = new Set([
  IMPORT_STATE.IMPORT_NEEDS_PASTE,
  IMPORT_STATE.IMPORT_FAILED,
]);

/** @type {Map<string, { phase: string, finished: boolean, finishedStatus: string|null, payload: object|null }>} */
const runRecords = new Map();

const RUN_RECORD_LIMIT = 24;

/**
 * @param {string|number} runId
 */
export function resetImportRunState(runId) {
  const key = String(runId);
  runRecords.set(key, {
    phase: IMPORT_STATE.IMPORT_IDLE,
    finished: false,
    finishedStatus: null,
    payload: null,
  });
  while (runRecords.size > RUN_RECORD_LIMIT) {
    const oldest = runRecords.keys().next().value;
    if (oldest != null) runRecords.delete(oldest);
  }
}

/**
 * @param {string|number} runId
 */
function getRun(runId) {
  const key = String(runId);
  if (!runRecords.has(key)) {
    resetImportRunState(key);
  }
  return runRecords.get(key);
}

/**
 * @param {string} status
 */
export function isTerminalImportState(status) {
  return TERMINAL_STATES.has(status);
}

/**
 * @param {string} status
 */
export function importStateAllowsParser(status) {
  return (
    status === IMPORT_STATE.IMPORT_READY || status === IMPORT_STATE.IMPORT_PARTIAL
  );
}

/**
 * @param {string} status
 */
export function importStateNeedsPaste(status) {
  return (
    status === IMPORT_STATE.IMPORT_NEEDS_PASTE || status === IMPORT_STATE.IMPORT_FAILED
  );
}

/**
 * Non-terminal phase update (reading / extracting / parsing).
 * @param {string|number} runId
 * @param {string} phase
 */
export function setImportPhase(runId, phase) {
  if (!isImportRunCurrent(runId)) {
    return { applied: false, reason: 'stale' };
  }
  const run = getRun(runId);
  if (run.finished) {
    return { applied: false, reason: 'already_finished', status: run.finishedStatus };
  }
  if (TERMINAL_STATES.has(phase)) {
    return { applied: false, reason: 'use_finishImport' };
  }
  run.phase = phase;
  return { applied: true, phase };
}

/**
 * Terminal finish — at most once per runId.
 * @param {string|number} runId
 * @param {string} status
 * @param {object} [payload]
 */
export function finishImport(runId, status, payload = {}) {
  if (!TERMINAL_STATES.has(status)) {
    return { applied: false, reason: 'not_terminal', status };
  }
  if (!isImportRunCurrent(runId)) {
    return { applied: false, reason: 'stale', status };
  }

  const run = getRun(runId);
  const acceptLateOcr = payload.acceptLateOcr === true;

  if (run.finished) {
    if (
      acceptLateOcr &&
      PASTE_TERMINAL.has(run.finishedStatus) &&
      SUCCESS_TERMINAL.has(status)
    ) {
      const priorStatus = run.finishedStatus;
      run.finishedStatus = status;
      run.phase = status;
      run.payload = { ...payload, acceptLateOcr: true, upgradedAt: Date.now() };
      hirelyProductLog('IMPORT_FINAL_UPGRADED', {
        from: priorStatus,
        to: status,
        lateOcrRecovery: payload.lateOcrRecovery === true,
      });
      try {
        globalThis.dispatchEvent?.(
          new CustomEvent('hirely:import-finished', {
            detail: { importRunId: runId, status, payload: run.payload, upgraded: true },
          })
        );
      } catch {
        /* ignore */
      }
      return { applied: true, status, upgraded: true, payload: run.payload };
    }
    return {
      applied: false,
      reason: 'already_finished',
      status: run.finishedStatus,
    };
  }

  run.finished = true;
  run.finishedStatus = status;
  run.phase = status;
  run.payload = { ...payload, finishedAt: Date.now() };

  try {
    globalThis.dispatchEvent?.(
      new CustomEvent('hirely:import-finished', {
        detail: { importRunId: runId, status, payload: run.payload },
      })
    );
  } catch {
    /* ignore */
  }

  return { applied: true, status, payload: run.payload };
}

/**
 * @param {number} [runId]
 */
export function getImportRunSnapshot(runId = peekImportRunId()) {
  if (runId == null) return null;
  return runRecords.get(String(runId)) || null;
}

/**
 * @param {string|number} [runId]
 */
export function isImportRunFinished(runId = peekImportRunId()) {
  if (runId == null) return false;
  return !!runRecords.get(String(runId))?.finished;
}
