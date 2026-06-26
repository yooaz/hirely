/**
 * OCR settlement barrier — final import must wait for OCR to settle.
 */
import { logExtractionStep } from '../extraction/file-buffer.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';
import { IMPORT_STATE } from './import-state.js';

export const OCR_SETTLEMENT_VERSION = 'OCR_SETTLEMENT_V1';

/** @readonly */
export const OCR_SETTLEMENT = Object.freeze({
  PENDING: 'pending',
  PARTIAL: 'partial',
  DONE_USABLE: 'done_usable',
  DONE_UNUSABLE: 'done_unusable',
  FAILED: 'failed',
  TIMED_OUT_PENDING: 'timed_out_but_pending_result_not_committed',
  TIMED_OUT_FINAL: 'timed_out_final',
});

/**
 * @param {object} ctx
 */
export function isPdfImageOnlyRoute(ctx = {}) {
  const fileType = String(ctx.fileType || ctx.docType || 'pdf').toLowerCase();
  if (fileType !== 'pdf') return false;
  const native = Math.max(
    0,
    Number(ctx.nativeTextLength ?? ctx.nativeCharCount ?? ctx.pdfJsTotalLength ?? 0) || 0
  );
  return native === 0;
}

/**
 * @param {object} ctx
 */
export function ocrSettlementIsComplete(ctx = {}) {
  if (ctx.ocrSettled === true) return true;
  const settlement = String(ctx.ocrSettlement || ctx.ocr_settlement || '').trim();
  if (!settlement) return false;
  return !ocrSettlementIsPending(settlement);
}

/**
 * PDF_IMAGE_ONLY hard rule: ocrAttempted / ocrUsable only after OCR settlement.
 * @param {object} ctx
 * @param {{ ocrAttempted?: boolean, ocrUsable?: boolean, usable?: boolean }} flags
 */
export function applyPdfImageOnlyOcrFlagGate(ctx = {}, flags = {}) {
  if (!isPdfImageOnlyRoute(ctx)) {
    return {
      ocrAttempted: flags.ocrAttempted === true,
      ocrUsable: flags.ocrUsable === true || flags.usable === true,
      ocrFlagsDeferred: false,
    };
  }
  if (ocrSettlementIsComplete(ctx)) {
    return {
      ocrAttempted: flags.ocrAttempted === true,
      ocrUsable: flags.ocrUsable === true || flags.usable === true,
      ocrFlagsDeferred: false,
      ocrFlagsSettled: true,
    };
  }
  return {
    ocrAttempted: false,
    ocrUsable: false,
    ocrFlagsDeferred: true,
    ocrPendingSettlement: true,
  };
}

/**
 * Mark scanned PDF OCR settled and attach post-settlement flags.
 * @param {object} extracted
 * @param {{ ocrAttempted?: boolean, usable?: boolean }} usability
 * @param {string} [settlementOverride]
 */
export function markPdfImageOnlyOcrSettled(extracted, usability, settlementOverride) {
  const settlement =
    settlementOverride ||
    resolveOcrSettlementState(usability, { inFlight: false });
  const gated = applyPdfImageOnlyOcrFlagGate(
    { ...extracted, ocrSettlement: settlement, ocrSettled: true },
    {
      ocrAttempted: usability?.ocrAttempted === true,
      ocrUsable: usability?.usable === true,
      usable: usability?.usable === true,
    }
  );
  return {
    ...extracted,
    ...gated,
    ocrSettlement: settlement,
    ocr_settlement: settlement,
    ocrSettled: true,
    ocrSettledBeforeCommit: true,
    ocrInFlight: false,
  };
}

/**
 * @param {string} state
 */
export function ocrSettlementIsPending(state) {
  return (
    state === OCR_SETTLEMENT.PENDING || state === OCR_SETTLEMENT.TIMED_OUT_PENDING
  );
}

/**
 * @param {string} state
 */
export function ocrSettlementAllowsPaste(state) {
  return (
    state === OCR_SETTLEMENT.DONE_UNUSABLE ||
    state === OCR_SETTLEMENT.TIMED_OUT_FINAL ||
    state === OCR_SETTLEMENT.FAILED
  );
}

/**
 * @param {object} usability
 * @param {{ timedOut?: boolean, inFlight?: boolean, error?: string }} [meta]
 */
export function resolveOcrSettlementState(usability, meta = {}) {
  if (meta.inFlight === true) {
    return meta.timedOut === true
      ? OCR_SETTLEMENT.TIMED_OUT_PENDING
      : OCR_SETTLEMENT.PENDING;
  }
  if (meta.error) return OCR_SETTLEMENT.FAILED;
  if (usability?.usable) return OCR_SETTLEMENT.DONE_USABLE;
  if (usability?.ocrAttempted && usability?.textLength > 0) {
    return OCR_SETTLEMENT.PARTIAL;
  }
  if (meta.timedOut === true) return OCR_SETTLEMENT.TIMED_OUT_FINAL;
  if (usability?.ocrAttempted) return OCR_SETTLEMENT.DONE_UNUSABLE;
  return OCR_SETTLEMENT.PENDING;
}

/**
 * Hard guard: paste is illegal while OCR is still pending settlement.
 * @param {object} ctx
 */
export function importMustNotCommitPasteWhileOcrPending(ctx = {}) {
  const settlement = String(ctx.ocrSettlement || ctx.ocr_settlement || '').trim();
  if (settlement && ocrSettlementIsPending(settlement)) return true;
  if (ctx.ocrSettled === false) return true;
  if (ctx.ocrInFlight === true) return true;
  return false;
}

/**
 * @param {object} extracted
 * @param {string} settlement
 * @param {{ settledBeforeCommit?: boolean }} [meta]
 */
export function attachOcrSettlementMeta(extracted, settlement, meta = {}) {
  const settledBeforeCommit = meta.settledBeforeCommit !== false;
  const settled = settledBeforeCommit && !ocrSettlementIsPending(settlement);
  const base = {
    ...extracted,
    ocrSettlement: settlement,
    ocr_settlement: settlement,
    ocrSettled: settled,
    ocrSettledBeforeCommit: settledBeforeCommit,
    ocrInFlight: ocrSettlementIsPending(settlement),
  };
  const gated = applyPdfImageOnlyOcrFlagGate(base, {
    ocrAttempted: meta.ocrAttempted ?? extracted.ocrAttempted,
    ocrUsable: meta.ocrUsable ?? extracted.ocrUsable,
    usable: meta.ocrUsable ?? extracted.ocrUsable,
  });
  return {
    ...base,
    ocrAttempted: gated.ocrAttempted,
    ocrUsable: gated.ocrUsable,
    ocrFlagsDeferred: gated.ocrFlagsDeferred === true,
    ocrPendingSettlement: gated.ocrPendingSettlement === true,
  };
}

/**
 * @param {string} proposedState
 * @param {object} ctx
 */
export function blockPasteUntilOcrSettled(proposedState, ctx = {}) {
  if (
    proposedState === IMPORT_STATE.IMPORT_NEEDS_PASTE &&
    importMustNotCommitPasteWhileOcrPending(ctx)
  ) {
    hirelyProductLog('IMPORT_PASTE_BLOCKED_OCR_PENDING', {
      settlement: ctx.ocrSettlement || ctx.ocr_settlement,
    });
    logExtractionStep(
      'IMPORT_PASTE_BLOCKED_OCR_PENDING',
      String(ctx.ocrSettlement || 'pending')
    );
    return IMPORT_STATE.IMPORT_PARTIAL;
  }
  return proposedState;
}

/**
 * @param {string} proposedState
 * @param {object} ctx
 */
export function logImportFinalWithSettlement(proposedState, ctx = {}) {
  const settlement = ctx.ocrSettlement || ctx.ocr_settlement || 'unknown';
  const settled = ctx.ocrSettledBeforeCommit === true || ctx.ocrSettled === true;
  hirelyProductLog('IMPORT_FINAL', {
    state: proposedState,
    ocrSettlement: settlement,
    ocrSettledBeforeCommit: settled,
  });
  logExtractionStep(
    'IMPORT_FINAL_SETTLEMENT',
    `${proposedState} settlement=${settlement} settled=${settled}`
  );
  return proposedState;
}
