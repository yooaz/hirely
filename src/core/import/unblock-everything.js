/**
 * UNBLOCK_EVERYTHING — temporary: text > 100 chars → Review / Style / Export (warnings only).
 */
import { SIMPLE_IMPORT_MIN_CHARS } from './v1-import-constants.js';
import { getPreviewTextLength, isV1PreviewSufficient } from './v1-flow-gate.js';

export const UNBLOCK_EVERYTHING_VERSION = 'UNBLOCK_EVERYTHING_V1';

export function isUnblockEverythingActive() {
  if (globalThis.HIRELY_UNBLOCK_EVERYTHING === false) return false;
  return (
    globalThis.HIRELY_UNBLOCK_EVERYTHING === true ||
    globalThis.HIRELY_V1_IMPORT === true ||
    globalThis.HIRELY_SIMPLE_IMPORT_MODE === true
  );
}

export function isTextSufficientForFlow(input = {}) {
  return isV1PreviewSufficient(input);
}

/**
 * @param {{ previewText?: string, rawText?: string, cleanText?: string }} [input]
 */
export function isFlowUnlocked(input = {}) {
  if (!isUnblockEverythingActive()) return false;
  return isTextSufficientForFlow(input);
}

/**
 * @param {{ previewText?: string, rawText?: string, cleanText?: string }} [input]
 */
export function buildUnblockFlowValidation(input = {}) {
  const sufficient = isTextSufficientForFlow(input);
  if (!sufficient) {
    return {
      version: UNBLOCK_EVERYTHING_VERSION,
      status: 'INVALID',
      reasons: ['preview_insufficient'],
      blockReview: true,
      blockStyle: true,
      blockExport: true,
      showRecovery: true,
      needsPaste: true,
      flowUnlocked: false,
      v1FlowUnlocked: false,
    };
  }
  return {
    version: UNBLOCK_EVERYTHING_VERSION,
    status: 'VALID',
    reasons: [],
    blockReview: false,
    blockStyle: false,
    blockExport: false,
    showRecovery: false,
    needsPaste: false,
    flowUnlocked: true,
    v1FlowUnlocked: true,
    unblockEverything: true,
  };
}

export { SIMPLE_IMPORT_MIN_CHARS };
