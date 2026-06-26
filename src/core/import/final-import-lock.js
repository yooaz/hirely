/**
 * FINAL_IMPORT_LOCK — terminal import outcomes: Review with content OR calm paste panel.
 * No IMPORT_PARTIAL trap, no dead ends, one IMPORT_DECISION reason per import.
 */
import { IMPORT_STATE } from './import-state.js';
import { SIMPLE_IMPORT_MIN_CHARS } from './v1-import-constants.js';
import {
  hydrateExtractedImportText,
  importMustNotPasteAfterUsableOcr,
  effectiveImportTextLength,
} from './ocr-import-usability.js';
import { peekLastEnterpriseExtraction } from '../extraction/extraction-session.js';
import { REAL_CV_IMPORT_MIN_CHARS } from './real-cv-import-constants.js';

export const FINAL_IMPORT_LOCK_VERSION = 'FINAL_IMPORT_LOCK_V1';

export const FINAL_IMPORT_MIN_TEXT = SIMPLE_IMPORT_MIN_CHARS;

export const FINAL_IMPORT_OUTCOME = Object.freeze({
  REVIEW: 'review',
  PASTE: 'paste',
  LOADING: 'loading',
  DEAD_END: 'dead_end',
});

const PARTIAL_STATUSES = new Set([
  IMPORT_STATE.IMPORT_PARTIAL,
  'IMPORT_PARTIAL',
  'PARTIAL_TEXT_RECOVERED',
]);

/**
 * Map ambiguous terminals to READY or NEEDS_PASTE — never leave IMPORT_PARTIAL as a blocker.
 * Scanned PDFs: decision uses effective OCR text length, not nativeTextLength === 0.
 * @param {string} status
 * @param {string} [rawText]
 * @param {object} [ctx] enterprise / ocrUsable for post-OCR terminal normalization
 */
export function normalizeFinalImportTerminal(status, rawText, ctx = {}) {
  const hydrated = hydrateExtractedImportText({
    rawText,
    cleanedText: ctx.cleanedText,
    enterprise: ctx.enterprise || peekLastEnterpriseExtraction(),
    ocrAttempted: ctx.ocrAttempted,
    ocrUsable: ctx.ocrUsable,
    fileType: ctx.fileType || 'pdf',
    extractionMethod: ctx.extractionMethod,
    ocrSettled: ctx.ocrSettled,
    ocrSettlement: ctx.ocrSettlement || ctx.ocr_settlement,
    ocrInFlight: ctx.ocrInFlight,
    pdfExtraction: ctx.pdfExtraction,
    nativeTextLength: ctx.nativeTextLength,
  });
  const text = String(hydrated.rawText || hydrated.cleanedText || rawText || '').trim();
  const effectiveLen = Math.max(text.length, effectiveImportTextLength(hydrated));
  const ocrContinue = importMustNotPasteAfterUsableOcr({ ...hydrated, ...ctx });
  const st = String(status || '').trim();

  if (PARTIAL_STATUSES.has(st)) {
    if (ocrContinue) {
      return effectiveLen >= REAL_CV_IMPORT_MIN_CHARS
        ? IMPORT_STATE.IMPORT_READY
        : IMPORT_STATE.IMPORT_PARTIAL;
    }
    return effectiveLen > FINAL_IMPORT_MIN_TEXT
      ? IMPORT_STATE.IMPORT_READY
      : IMPORT_STATE.IMPORT_NEEDS_PASTE;
  }

  if (st === IMPORT_STATE.IMPORT_READY && effectiveLen <= FINAL_IMPORT_MIN_TEXT && !ocrContinue) {
    return IMPORT_STATE.IMPORT_NEEDS_PASTE;
  }

  if (st === IMPORT_STATE.IMPORT_NEEDS_PASTE && ocrContinue) {
    return effectiveLen >= REAL_CV_IMPORT_MIN_CHARS
      ? IMPORT_STATE.IMPORT_READY
      : IMPORT_STATE.IMPORT_PARTIAL;
  }

  return st || IMPORT_STATE.IMPORT_NEEDS_PASTE;
}

/**
 * @param {{ pasteVisible?: boolean, cvLen?: number, docStep?: string, loading?: boolean, styleDisabled?: boolean, exportDisabled?: boolean }} snap
 */
export function classifyFinalImportOutcome(snap = {}) {
  const pasteVisible = snap.pasteVisible === true;
  const cvLen = Math.max(0, Number(snap.cvLen) || 0);
  const docStep = String(snap.docStep || '');
  const loading = snap.loading === true;

  if (pasteVisible && !loading && (docStep === 'import' || docStep === '')) {
    return { outcome: FINAL_IMPORT_OUTCOME.PASTE, deadEnd: false };
  }

  if (cvLen > FINAL_IMPORT_MIN_TEXT && docStep === 'edit' && !loading) {
    const styleOk = snap.styleDisabled === false;
    const exportOk = snap.exportDisabled === false;
    return {
      outcome: FINAL_IMPORT_OUTCOME.REVIEW,
      deadEnd: false,
      styleUnlocked: styleOk,
      exportUnlocked: exportOk,
    };
  }

  if (loading && !pasteVisible && cvLen <= FINAL_IMPORT_MIN_TEXT) {
    return { outcome: FINAL_IMPORT_OUTCOME.LOADING, deadEnd: false };
  }

  return { outcome: FINAL_IMPORT_OUTCOME.DEAD_END, deadEnd: true };
}

/**
 * Preview has text → export must not be hard-blocked by strict validation alone.
 * @param {{ cvLen?: number, exportDisabled?: boolean, v1FlowUnlocked?: boolean }} snap
 */
export function previewTextAllowsExport(snap = {}) {
  const cvLen = Math.max(0, Number(snap.cvLen) || 0);
  if (cvLen <= FINAL_IMPORT_MIN_TEXT) return false;
  if (snap.v1FlowUnlocked === true) return true;
  return snap.exportDisabled === false;
}

/**
 * @param {string[]} consoleLines
 */
export function countImportDecisionLogs(consoleLines) {
  let groups = 0;
  for (const line of consoleLines || []) {
    const s = String(line || '').trim();
    if (s === 'IMPORT_DECISION') groups += 1;
  }
  if (groups > 0) return groups;
  const reasonHits = (consoleLines || []).filter((line) =>
    /^reason\b/i.test(String(line || ''))
  ).length;
  return reasonHits > 0 ? 1 : 0;
}
