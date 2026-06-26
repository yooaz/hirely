/**
 * V1 flow gate — one rule for Review / Style / Export:
 * previewText (or raw/clean) length > 100 → allow (warnings only, no blocks)
 * otherwise → paste fallback
 */
import { SIMPLE_IMPORT_MIN_CHARS, isV1ImportMode } from './v1-import-constants.js';
import { isUnblockEverythingActive, buildUnblockFlowValidation } from './unblock-everything.js';

export const V1_FLOW_GATE_VERSION = 'V1_FLOW_GATE_V1';

/**
 * @param {{ previewText?: string, rawText?: string, cleanText?: string }} [input]
 */
export function getPreviewTextLength(input = {}) {
  const parts = [
    String(input.previewText || '').replace(/\s+/g, ' ').trim(),
    String(input.rawText || '').trim(),
    String(input.cleanText || '').trim(),
  ];
  return Math.max(0, ...parts.map((s) => s.length));
}

/**
 * @param {{ previewText?: string, rawText?: string, cleanText?: string }} [input]
 */
export function isV1PreviewSufficient(input = {}) {
  return getPreviewTextLength(input) > SIMPLE_IMPORT_MIN_CHARS;
}

export function isV1FlowGateActive() {
  return isV1ImportMode();
}

/**
 * @param {{ previewText?: string, rawText?: string, cleanText?: string }} [input]
 */
export function buildV1FlowGateValidation(input = {}) {
  if (isUnblockEverythingActive()) {
    return buildUnblockFlowValidation(input);
  }
  const sufficient = isV1PreviewSufficient(input);
  if (!sufficient) {
    return {
      version: V1_FLOW_GATE_VERSION,
      status: 'INVALID',
      reasons: ['preview_insufficient'],
      blockReview: true,
      blockStyle: true,
      blockExport: true,
      showRecovery: true,
      needsPaste: true,
      v1FlowUnlocked: false,
    };
  }
  return {
    version: V1_FLOW_GATE_VERSION,
    status: 'VALID',
    reasons: [],
    blockReview: false,
    blockStyle: false,
    blockExport: false,
    showRecovery: true,
    needsPaste: false,
    v1FlowUnlocked: true,
  };
}

/**
 * @param {{ previewText?: string, rawText?: string, cleanText?: string }} [input]
 */
export function v1FlowUnlocked(input = {}) {
  if (isUnblockEverythingActive() && isV1PreviewSufficient(input)) return true;
  if (!isV1FlowGateActive()) return false;
  return isV1PreviewSufficient(input);
}
