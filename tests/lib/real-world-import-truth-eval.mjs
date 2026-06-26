/**
 * Real-world import truth — status + PASS rules (no fake pass policy).
 */
import { IMPORT_STATE, mapLegacyStatusToImportState } from '../../src/core/import/import-status.js';
import {
  evaluateImportProductPass,
  hasMeaningfulExtractedText,
  MEANINGFUL_TEXT_MIN,
  previewHasMeaningfulContent,
} from './no-fake-pass-import-policy.mjs';

const FORBIDDEN = new Set(['IMPORT_CRASH', 'IMPORT_STUCK']);

/**
 * @param {object} row
 */
export function deriveTruthImportState(row) {
  const raw = String(row.importState || row.importStatus || '').trim();
  if (Object.values(IMPORT_STATE).includes(raw)) return raw;
  const mapped = mapLegacyStatusToImportState(raw);
  if (mapped !== IMPORT_STATE.IMPORT_FAILED) return mapped;
  if (row.fallback || row.needsPaste || row.needsPasteUi) return IMPORT_STATE.IMPORT_NEEDS_PASTE;
  if (row.live && hasMeaningfulExtractedText(row)) return IMPORT_STATE.IMPORT_READY;
  if (row.live && (row.selectedTextLength ?? 0) >= 20) return IMPORT_STATE.IMPORT_PARTIAL;
  return raw || IMPORT_STATE.IMPORT_FAILED;
}

/**
 * @param {object} row
 */
export function classifyTruthStatus(row) {
  if (row.crashed || row.threw) return 'IMPORT_CRASH';
  if (row.stuck || row.timedOut) return 'IMPORT_STUCK';
  if (row.unsupported) return 'IMPORT_UNSUPPORTED';

  const state = deriveTruthImportState(row);
  if (state === IMPORT_STATE.IMPORT_READY) return 'IMPORT_READY';
  if (state === IMPORT_STATE.IMPORT_PARTIAL) return 'IMPORT_PARTIAL';
  if (state === IMPORT_STATE.IMPORT_NEEDS_PASTE) return 'IMPORT_NEEDS_PASTE';
  if (state === IMPORT_STATE.IMPORT_FAILED) return 'IMPORT_FAILED';
  return 'IMPORT_FAILED';
}

/**
 * @param {object} row
 */
export function isFakeSuccess(row) {
  const status = row.status || classifyTruthStatus(row);
  if (!['IMPORT_READY', 'IMPORT_PARTIAL'].includes(status)) return false;
  if ((row.selectedTextLength ?? 0) < MEANINGFUL_TEXT_MIN) return true;
  if (row.live && !row.hasResume) return true;
  if (!previewHasMeaningfulContent(row) && hasMeaningfulExtractedText(row)) return true;
  return false;
}

/** @deprecated use previewHasMeaningfulContent from policy */
export function readyHasStructuredContent(row) {
  return previewHasMeaningfulContent(row);
}

/**
 * @param {object} row
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function evaluateTruthPass(row) {
  row.status = row.status || classifyTruthStatus(row);
  row.fakeSuccess = isFakeSuccess(row);

  const verdict = evaluateImportProductPass(row);

  if (FORBIDDEN.has(row.status) && !verdict.reasons.includes(row.status)) {
    verdict.reasons.push(row.status);
    verdict.pass = false;
  }

  const thin = (row.selectedTextLength ?? 0) < MEANINGFUL_TEXT_MIN;
  if (
    thin &&
    !['IMPORT_NEEDS_PASTE', 'IMPORT_UNSUPPORTED', 'IMPORT_FAILED'].includes(row.status)
  ) {
    if (!verdict.reasons.includes('thin_text_wrong_status')) {
      verdict.reasons.push('thin_text_wrong_status');
      verdict.pass = false;
    }
  }

  return { pass: verdict.pass, reasons: verdict.reasons };
}
