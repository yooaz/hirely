/**
 * Post-import UI routing — single source of truth from IMPORT_DECISION destination.
 * Paste fallback must never override structured_from_ocr / exact_transcription / review.
 */
import {
  logImportDecision,
  logImportUiRoute,
  resolveAutomaticImportRoute,
  IMPORT_DECISION_DESTINATION,
} from './import-decision-final.js';
import { buildEnrichedImportRouteInput } from './enriched-import-route-input.js';
import { IMPORT_STATE } from './import-state.js';

export const IMPORT_UI_ROUTE = Object.freeze({
  PASTE: IMPORT_DECISION_DESTINATION.PASTE,
  REVIEW: IMPORT_DECISION_DESTINATION.REVIEW,
  STRUCTURED_NATIVE: IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
  STRUCTURED_FROM_OCR: IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  EXACT_TRANSCRIPTION: IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  RECOVERY: IMPORT_DECISION_DESTINATION.RECOVERY,
});

const AUTO_CONTINUE_DESTINATIONS = new Set([
  IMPORT_DECISION_DESTINATION.REVIEW,
  IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
  IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  IMPORT_DECISION_DESTINATION.RECOVERY,
]);

/**
 * @param {string} destination
 */
export function isAutoContinueImportDestination(destination = '') {
  return AUTO_CONTINUE_DESTINATIONS.has(String(destination || '').trim().toLowerCase());
}

/**
 * Committed destination from result or same import run — never recompute over this.
 * @param {object} result
 */
export function readCommittedImportDestination(result = {}) {
  const fromResult = String(result.importDecisionDestination || result.importUiRoute || '')
    .trim()
    .toLowerCase();
  if (fromResult) return fromResult;
  try {
    const runId = globalThis.HIRELY_IMPORT_RUN_ID;
    const globalDest = String(globalThis.HIRELY_LAST_IMPORT_DESTINATION || '').trim().toLowerCase();
    if (globalDest && runId != null && globalThis.HIRELY_IMPORT_DECISION_RUN === runId) {
      return globalDest;
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * @param {object} result
 * @param {object} [opts]
 * @returns {string}
 */
export function readImportDecisionDestination(result = {}, opts = {}) {
  const committed = readCommittedImportDestination(result);
  if (committed) return committed;
  try {
    const runId = globalThis.HIRELY_IMPORT_RUN_ID;
    const globalDest = String(globalThis.HIRELY_LAST_IMPORT_DESTINATION || '').trim().toLowerCase();
    if (globalDest && runId != null && globalThis.HIRELY_IMPORT_DECISION_RUN === runId) {
      return globalDest;
    }
  } catch {
    /* ignore */
  }
  const policyInput = buildEnrichedImportRouteInput(result, opts);
  const decision = resolveAutomaticImportRoute(policyInput);
  return String(decision.destination || IMPORT_DECISION_DESTINATION.PASTE).toLowerCase();
}

/**
 * @param {object} result
 * @param {object} [opts]
 * @returns {string}
 */
export function resolveImportContinuationRoute(result = {}, opts = {}) {
  const destination = readImportDecisionDestination(result, opts);
  if (AUTO_CONTINUE_DESTINATIONS.has(destination)) return destination;
  return IMPORT_DECISION_DESTINATION.PASTE;
}

/**
 * @param {object} result
 * @param {object} [opts]
 */
export function importDestinationBlocksPaste(result = {}, opts = {}) {
  return resolveImportContinuationRoute(result, opts) !== IMPORT_DECISION_DESTINATION.PASTE;
}

/**
 * @param {object} value
 */
function isPrecomputedImportDecision(value = {}) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.destination === 'string' &&
    typeof value.reason === 'string' &&
    !('mode' in value) &&
    !('importMode' in value) &&
    !('exactTranscription' in value) &&
    !('source' in value)
  );
}

/**
 * Final route decision reads enriched settlement fields on the result object.
 * @param {object} result
 * @param {object} [importOpts]
 */
function resolveTruthfulImportDecision(result = {}, importOpts = {}) {
  const policyInput = buildEnrichedImportRouteInput(result, importOpts);
  const decision = resolveAutomaticImportRoute(policyInput);
  return { decision, policyInput };
}

/**
 * Commit IMPORT_DECISION onto the import result before UI reads it.
 * @param {object} result
 * @param {object} [optsOrDecision] — import opts, or a precomputed `{ destination, reason }`
 * @param {object} [opts] — opts when second arg is a precomputed decision
 */
export function attachImportDecisionToResult(result = {}, optsOrDecision = {}, opts = {}) {
  if (!result || typeof result !== 'object') return result;

  const precomputed = isPrecomputedImportDecision(optsOrDecision) ? optsOrDecision : null;
  const importOpts = precomputed ? opts : optsOrDecision;
  const skipDecisionLog = importOpts.skipDecisionLog === true;

  const { decision, policyInput } = resolveTruthfulImportDecision(result, importOpts);
  if (
    precomputed &&
    String(precomputed.destination || '').toLowerCase() !== String(decision.destination || '').toLowerCase()
  ) {
    console.warn('IMPORT_DECISION_COERCED', {
      requested: precomputed.destination,
      requestedReason: precomputed.reason,
      truthful: decision.destination,
      truthfulReason: decision.reason,
      ocrAttempted: policyInput.ocrAttempted,
      ocrUsable: policyInput.ocrUsable,
      ocrTextLength: policyInput.ocrTextLength,
    });
  }
  if (!skipDecisionLog) {
    logImportDecision(decision, policyInput);
  }

  const destination = String(decision.destination || '').toLowerCase();
  const blocksPaste = destination !== IMPORT_DECISION_DESTINATION.PASTE;
  let importState = result.importState;
  if (blocksPaste && importState === IMPORT_STATE.IMPORT_NEEDS_PASTE) {
    importState =
      result.exactTranscription === true || destination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION
        ? IMPORT_STATE.IMPORT_READY
        : IMPORT_STATE.IMPORT_PARTIAL;
  }
  if (!skipDecisionLog) {
    logImportUiRoute(destination, { reason: decision.reason, source: importOpts.source || 'attach' });
  }
  return {
    ...result,
    nativeTextLength: policyInput.nativeTextLength,
    ocrTextLength: policyInput.ocrTextLength,
    ocrAttempted: policyInput.ocrAttempted,
    ocrUsable: policyInput.ocrUsable === true,
    importState,
    importDecisionReason: decision.reason,
    importDecisionDestination: destination,
    importUiRoute: destination,
  };
}

export { logImportUiRoute };
