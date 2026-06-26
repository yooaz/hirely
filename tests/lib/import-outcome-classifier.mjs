/**
 * Shared import outcome classification for QA scripts.
 */
import path from 'path';
import {
  IMPORT_STATE,
  importStateNeedsPaste,
  mapLegacyStatusToImportState,
} from '../../src/core/import/import-status.js';
import { H7_TERMINAL_STATES } from './h7-import-catalog.mjs';

export function isUnsupportedBlob(errors = [], warnings = [], fileName = '') {
  const blob = [...errors, ...warnings].join(' ');
  const ext = path.extname(fileName || '').toLowerCase();
  return (
    /\.bin$|\.exe$|\.zip$/i.test(fileName || '') ||
    /unsupported|not supported|format inconnu|invalid file|unknown format/i.test(blob) ||
    (ext === '.doc' && /invalid|corrupt|not a valid|unsupported/i.test(blob))
  );
}

/**
 * @param {object} row
 */
export function classifyImportOutcome(row) {
  if (row.crashed || row.threw) return 'IMPORT_CRASH';
  if (row.stuck || row.timedOut) return 'IMPORT_STUCK';
  if (row.unsupported) return 'IMPORT_UNSUPPORTED';

  const legacy = row.importStatus || '';
  const state =
    row.importState ||
    (legacy ? mapLegacyStatusToImportState(legacy) : '') ||
    '';

  if (state === IMPORT_STATE.IMPORT_READY) return 'IMPORT_READY';
  if (state === IMPORT_STATE.IMPORT_PARTIAL) return 'IMPORT_PARTIAL';
  if (
    importStateNeedsPaste(state) ||
    state === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
    ['PDF_OCR_TIMEOUT', 'PDF_TEXT_EMPTY', 'PASTE_FALLBACK_REQUIRED'].includes(legacy)
  ) {
    return 'IMPORT_NEEDS_PASTE';
  }
  if (state === IMPORT_STATE.IMPORT_FAILED) {
    if (isUnsupportedBlob(row.errors, row.warnings, row.fileName)) {
      return 'IMPORT_UNSUPPORTED';
    }
    return 'IMPORT_NEEDS_PASTE';
  }

  if (state && !H7_TERMINAL_STATES.has(state) && !Object.values(IMPORT_STATE).includes(state)) {
    return 'IMPORT_STUCK';
  }
  if (!state && !legacy) return 'IMPORT_STUCK';
  return 'IMPORT_NEEDS_PASTE';
}
