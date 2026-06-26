/**
 * HIRELY Import Decision — one automatic ingestion policy (no user engine choice).
 *
 * resolveAutomaticImportRoute(input) is the single policy function.
 * Scanned PDFs: nativeTextLength === 0 is normal — never paste on native absence alone.
 */
import { hirelyProductLog } from '../runtime/hirely-debug.js';
import { importMustNotPasteAfterUsableOcr } from './ocr-import-usability.js';

export const IMPORT_DECISION_VERSION = 'IMPORT_DECISION_AUTOMATIC_V3';

/** Native / OCR text sufficient for automatic structured continue. */
export const AUTOMATIC_IMPORT_TEXT_MIN = 80;

/** Legacy thresholds — used only inside OCR usability heuristics. */
export const IMPORT_DECISION_NATIVE_MIN = 300;
export const IMPORT_DECISION_REVIEW_MIN = 100;

export const IMPORT_DECISION_REASON = Object.freeze({
  NATIVE_TEXT_OK: 'NATIVE_TEXT_OK',
  OCR_TEXT_OK: 'OCR_TEXT_OK',
  OCR_PARTIAL_USABLE: 'OCR_PARTIAL_USABLE',
  OCR_TEXT_TOO_SHORT: 'OCR_TEXT_TOO_SHORT',
  PDF_IMAGE_ONLY: 'PDF_IMAGE_ONLY',
  RAW_TEXT_TOO_SHORT: 'RAW_TEXT_TOO_SHORT',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  NON_PDF_TEXTUAL: 'NON_PDF_TEXTUAL',
  PDF_NATIVE_TEXT_OK: 'PDF_NATIVE_TEXT_OK',
  OCR_UNUSABLE: 'OCR_UNUSABLE',
  OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD: 'OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD',
});

export const IMPORT_DECISION_DESTINATION = Object.freeze({
  REVIEW: 'review',
  PASTE: 'paste',
  EXACT_TRANSCRIPTION: 'exact_transcription',
  STRUCTURED_FROM_OCR: 'structured_from_ocr',
  STRUCTURED_NATIVE: 'structured_native',
  RECOVERY: 'recovery',
});

const UNSUPPORTED_KINDS = new Set(['image', 'unknown', 'rtf']);
const TEXTUAL_FILE_TYPES = new Set(['docx', 'doc', 'txt', 'paste']);

/**
 * @param {object} input
 */
function isUnsupportedAutomaticInput(input = {}) {
  const fileType = String(input.fileType || 'unknown').toLowerCase();
  return (
    input.unsupported === true ||
    UNSUPPORTED_KINDS.has(fileType) ||
    fileType === 'v1-unsupported' ||
    input.extractionMethod === 'v1-unsupported'
  );
}

/**
 * @param {object} input
 */
function ocrContentUsable(input = {}) {
  // Strict policy gate: OCR is usable only after the OCR lifecycle says so.
  // Never infer OCR readiness from parser/native textLength, line count, or word count.
  // Those heuristics created false structured_from_ocr routes and failing QA.
  return input.ocrAttempted === true && input.ocrUsable === true;
}

/**
 * @param {object} input
 */
function effectiveOcrTextLength(input = {}) {
  return Math.max(
    0,
    Number(input.ocrTextLength) || 0,
    Number(input.textLength) || 0
  );
}

/**
 * OCR text length for automatic policy only — never merge parser/native textLength.
 * @param {object} input
 */
function policyOcrTextLength(input = {}) {
  return Math.max(0, Number(input.ocrTextLength) || 0);
}

/**
 * Strict OCR readiness for structured_from_ocr — both attempted and usable flags required.
 * @param {object} input
 */
export function hasUsableOcrForPolicy(input = {}) {
  return input.ocrAttempted === true && input.ocrUsable === true;
}

/**
 * OCR ready for structured_from_ocr / recovery — reads enriched settlement flags only.
 * @param {object} input
 */
export function isOcrReadyForPolicyRoute(input = {}) {
  return input.ocrAttempted === true && input.ocrUsable === true;
}

/**
 * UI guard — downgrade impossible structured_from_ocr before mounting screens.
 * @param {string} destination
 * @param {object} [payload]
 * @returns {string}
 */
export function coerceImpossibleStructuredFromOcrRoute(destination = '', payload = {}) {
  const dest = String(destination || '').trim().toLowerCase();
  if (dest !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR) {
    return dest || IMPORT_DECISION_DESTINATION.PASTE;
  }
  if (!isOcrReadyForPolicyRoute(payload)) {
    return IMPORT_DECISION_DESTINATION.PASTE;
  }
  if (!isStructuredPayloadReady(payload)) {
    return IMPORT_DECISION_DESTINATION.RECOVERY;
  }
  return IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR;
}

/**
 * @param {object} input
 */
function isStructuredPayloadReady(input = {}) {
  return (
    input.resumeData != null ||
    input.structuredInput != null ||
    input.ocrStructuredInput != null
  );
}

/**
 * One automatic policy — no user engine choice.
 *
 * Policy:
 * - Non-PDF textual file => structured_native (paste if empty/too short)
 * - PDF with good native text => structured_native
 * - PDF image/scanned: structured_from_ocr when ocrAttempted && ocrUsable && structured payload (enriched settlement)
 * - PDF with OCR usable but no structured payload => recovery
 * - exact_transcription only when forceExactTranscription (debug / forced route)
 * - paste only when OCR truly failed or file unsupported
 *
 * @param {object} input
 * @param {string} [input.fileType]
 * @param {number} [input.nativeTextLength]
 * @param {number} [input.ocrTextLength]
 * @param {number} [input.textLength]
 * @param {boolean} [input.ocrAttempted]
 * @param {boolean} [input.ocrUsable]
 * @param {number} [input.ocrLineCount]
 * @param {number} [input.ocrWordCount]
 * @param {number} [input.ocrPageCount]
 * @param {boolean} [input.unsupported]
 * @param {boolean} [input.forceExactTranscription]
 * @returns {{ destination: string, reason: string }}
 */
export function resolveAutomaticImportRoute(input = {}) {
  const fileType = String(input.fileType || 'unknown').toLowerCase();
  const isPdf = fileType === 'pdf';
  const nativeTextLength = Number(input.nativeTextLength) || 0;
  const ocrTextLength = Number(input.ocrTextLength) || 0;
  const ocrAttempted = input.ocrAttempted === true;
  const ocrUsable = ocrAttempted && input.ocrUsable === true;
  const hasStructuredPayload = isStructuredPayloadReady(input);
  const forceExact = input.forceExactTranscription === true;

  if (isUnsupportedAutomaticInput(input)) {
    return {
      destination: IMPORT_DECISION_DESTINATION.PASTE,
      reason: IMPORT_DECISION_REASON.UNSUPPORTED_FILE,
    };
  }

  if (forceExact) {
    const ocrUsableExact = ocrUsable;
    if (!isPdf) {
      const textLen = Math.max(ocrTextLength, nativeTextLength);
      if (textLen > 0 && textLen < AUTOMATIC_IMPORT_TEXT_MIN) {
        return {
          destination: IMPORT_DECISION_DESTINATION.PASTE,
          reason: IMPORT_DECISION_REASON.RAW_TEXT_TOO_SHORT,
        };
      }
      return {
        destination: IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
        reason: IMPORT_DECISION_REASON.NON_PDF_TEXTUAL,
      };
    }
    if (ocrUsableExact) {
      const reason =
        ocrTextLength >= AUTOMATIC_IMPORT_TEXT_MIN
          ? IMPORT_DECISION_REASON.OCR_TEXT_OK
          : IMPORT_DECISION_REASON.OCR_PARTIAL_USABLE;
      return {
        destination: IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
        reason,
      };
    }
    if (!ocrAttempted) {
      return {
        destination: IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
        reason: IMPORT_DECISION_REASON.PDF_IMAGE_ONLY,
      };
    }
    return {
      destination: IMPORT_DECISION_DESTINATION.PASTE,
      reason: IMPORT_DECISION_REASON.OCR_UNUSABLE,
    };
  }

  if (!isPdf) {
    const textLen = Math.max(ocrTextLength, nativeTextLength);
    if (textLen > 0 && textLen < AUTOMATIC_IMPORT_TEXT_MIN) {
      return {
        destination: IMPORT_DECISION_DESTINATION.PASTE,
        reason: IMPORT_DECISION_REASON.RAW_TEXT_TOO_SHORT,
      };
    }
    return {
      destination: IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
      reason: TEXTUAL_FILE_TYPES.has(fileType)
        ? IMPORT_DECISION_REASON.NON_PDF_TEXTUAL
        : IMPORT_DECISION_REASON.NATIVE_TEXT_OK,
    };
  }

  if (nativeTextLength >= AUTOMATIC_IMPORT_TEXT_MIN) {
    return {
      destination: IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
      reason: IMPORT_DECISION_REASON.PDF_NATIVE_TEXT_OK,
    };
  }

  if (ocrAttempted && ocrUsable && hasStructuredPayload) {
    return {
      destination: IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
      reason: IMPORT_DECISION_REASON.PDF_IMAGE_ONLY,
    };
  }

  if (ocrAttempted && ocrUsable) {
    return {
      destination: IMPORT_DECISION_DESTINATION.RECOVERY,
      reason: IMPORT_DECISION_REASON.OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD,
    };
  }

  return {
    destination: IMPORT_DECISION_DESTINATION.PASTE,
    reason: IMPORT_DECISION_REASON.OCR_UNUSABLE,
  };
}

function isStructuredImportMode(ctx = {}) {
  const mode = String(ctx.importMode || ctx.mode || '').toLowerCase();
  if (mode === 'exact_transcription' || ctx.exactTranscription === true) return false;
  if (mode === 'structured') return true;
  if (ctx.exactTranscription === false) return true;
  if (ctx.structuredImport === true) return true;
  return true;
}

/**
 * Build normalized policy input from extraction/decision context.
 * @param {object} ctx
 */
export function buildAutomaticImportRouteInput(ctx = {}) {
  const fileType = String(ctx.fileType || 'unknown').toLowerCase();
  const ocrAttempted = ctx.ocrAttempted === true;
  const textLen = Math.max(0, Number(ctx.textLength) || 0);
  const ocrLen = Math.max(0, Number(ctx.ocrTextLength) || 0);

  return {
    fileType,
    nativeTextLength: Math.max(0, Number(ctx.nativeTextLength) || 0),
    ocrTextLength: ocrLen,
    textLength: textLen,
    ocrAttempted,
    ocrUsable: ctx.ocrUsable === true,
    ocrLineCount: Number(ctx.ocrLineCount) || 0,
    ocrWordCount: Number(ctx.ocrWordCount) || 0,
    ocrPageCount: Number(ctx.ocrPageCount) || 0,
    unsupported:
      ctx.unsupported === true ||
      UNSUPPORTED_KINDS.has(fileType) ||
      fileType === 'v1-unsupported' ||
      ctx.extractionMethod === 'v1-unsupported',
    extractionMethod: ctx.extractionMethod,
    forceExactTranscription: !isStructuredImportMode(ctx),
    ocrSettled: ctx.ocrSettled,
    ocrSettlement: ctx.ocrSettlement,
    ocrInFlight: ctx.ocrInFlight,
    enterprise: ctx.enterprise,
    resumeData: ctx.resumeData ?? null,
    structuredInput: ctx.structuredInput ?? null,
    ocrStructuredInput: ctx.ocrStructuredInput ?? null,
  };
}

/**
 * @param {object} ctx
 * @returns {{ destination: string, reason: string }}
 */
export function resolveImportDecision(ctx = {}) {
  return resolveAutomaticImportRoute(buildAutomaticImportRouteInput(ctx));
}

/**
 * Log exactly one IMPORT_DECISION (console + product log).
 * @param {{ destination: string, reason: string }} decision
 * @param {object} [ctx]
 * @returns {string}
 */
export function logImportDecision(decision, ctx = {}) {
  const reason = String(decision?.reason || '').trim();
  const destination = String(decision?.destination || '').trim();
  try {
    const runId = globalThis.HIRELY_IMPORT_RUN_ID;
    if (
      runId != null &&
      globalThis.HIRELY_IMPORT_DECISION_RUN === runId &&
      globalThis.HIRELY_LAST_IMPORT_DECISION
    ) {
      return String(globalThis.HIRELY_LAST_IMPORT_DECISION);
    }
  } catch {
    /* ignore */
  }
  console.group('IMPORT_DECISION');
  console.log('reason', reason);
  console.log('destination', destination);
  if (ctx.fileType != null) console.log('fileType', ctx.fileType);
  if (ctx.nativeTextLength != null) console.log('nativeTextLength', ctx.nativeTextLength);
  if (ctx.textLength != null) console.log('textLength', ctx.textLength);
  if (ctx.ocrAttempted != null) console.log('ocrAttempted', ctx.ocrAttempted);
  if (ctx.ocrTextLength != null) console.log('ocrTextLength', ctx.ocrTextLength);
  if (ctx.ocrUsable != null) console.log('ocrUsable', ctx.ocrUsable);
  if (ctx.importMode != null) console.log('importMode', ctx.importMode);
  console.groupEnd();
  try {
    globalThis.HIRELY_LAST_IMPORT_DECISION = reason;
    globalThis.HIRELY_LAST_IMPORT_DESTINATION = destination;
    globalThis.__HIRELY_LAST_IMPORT_DECISION__ = { destination, reason };
    globalThis.HIRELY_IMPORT_DECISION_RUN = globalThis.HIRELY_IMPORT_RUN_ID;
  } catch {
    /* ignore */
  }
  hirelyProductLog('IMPORT_DECISION', { reason, destination });
  return reason;
}

/**
 * @param {string} destination
 * @param {object} [meta]
 */
export function logImportUiRoute(destination, meta = {}) {
  const route = String(destination || '').trim().toLowerCase();
  hirelyProductLog('IMPORT_UI_ROUTE', { destination: route, ...meta });
  try {
    if (route) globalThis.HIRELY_LAST_IMPORT_UI_ROUTE = route;
  } catch {
    /* ignore */
  }
  return route;
}

/**
 * @param {object} ctx
 */
export function decideAndLogImport(ctx) {
  const decision = resolveImportDecision(ctx);
  logImportDecision(decision, ctx);
  return decision;
}
