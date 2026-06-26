#!/usr/bin/env node
/**
 * Deterministic import state — one finish per runId.
 */
import { beginImportRun } from '../core/import/import-run-guard.js';
import {
  IMPORT_STATE,
  finishImport,
  setImportPhase,
  isImportRunFinished,
} from '../core/import/import-state.js';
import {
  resolveImportState,
  importStateAllowsParser,
  importStateNeedsPaste,
} from '../core/import/import-status.js';
import { canonicalImportFromFile } from '../core/import/canonical-import.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const r1 = beginImportRun();
ok(setImportPhase(r1, IMPORT_STATE.IMPORT_READING).applied, 'phase reading');
const f1 = finishImport(r1, IMPORT_STATE.IMPORT_READY, {});
ok(f1.applied, 'first finish');
const f1dup = finishImport(r1, IMPORT_STATE.IMPORT_NEEDS_PASTE, {});
ok(!f1dup.applied && f1dup.reason === 'already_finished', 'duplicate finish blocked');

const r2 = beginImportRun();
finishImport(r2, IMPORT_STATE.IMPORT_NEEDS_PASTE, {});
const f2late = finishImport(r2, IMPORT_STATE.IMPORT_READY, {});
ok(!f2late.applied && f2late.reason === 'already_finished', 'paste then second finish blocked');

const r3 = beginImportRun();
finishImport(r3, IMPORT_STATE.IMPORT_READY, {});
const f3back = finishImport(r3, IMPORT_STATE.IMPORT_NEEDS_PASTE, {});
ok(!f3back.applied && f3back.reason === 'already_finished', 'ready then second finish blocked');

const r3b = beginImportRun();
finishImport(r3b, IMPORT_STATE.IMPORT_NEEDS_PASTE, {});
const f3accept = finishImport(r3b, IMPORT_STATE.IMPORT_READY, { acceptLateOcr: true });
ok(f3accept.applied, 'late OCR accept allows success after paste hint');

const r4 = beginImportRun();
finishImport(r4, IMPORT_STATE.IMPORT_READY, {});
beginImportRun();
const f4stale = finishImport(r4, IMPORT_STATE.IMPORT_NEEDS_PASTE, {});
ok(!f4stale.applied && f4stale.reason === 'stale', 'stale run ignored');

ok(
  resolveImportState('') === IMPORT_STATE.IMPORT_NEEDS_PASTE,
  'empty text → NEEDS_PASTE'
);
ok(
  resolveImportState('x'.repeat(30)) === IMPORT_STATE.IMPORT_PARTIAL,
  'thin text (30) → PARTIAL'
);
ok(
  resolveImportState('x'.repeat(300)) === IMPORT_STATE.IMPORT_READY,
  'meaningful text (300+) → READY'
);
ok(!importStateAllowsParser(IMPORT_STATE.IMPORT_NEEDS_PASTE), 'parser blocked when needs paste');
ok(importStateAllowsParser(IMPORT_STATE.IMPORT_READY), 'parser allowed when ready');

const emptyPdf = await canonicalImportFromFile(
  new File(['%PDF'], 'empty.pdf', { type: 'application/pdf' })
);
ok(emptyPdf.rawText.length === 0, 'canonical empty rawText');
ok(
  emptyPdf.importState === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
    importStateNeedsPaste(emptyPdf.importState),
  'canonical empty → NEEDS_PASTE state'
);
ok(!emptyPdf.resumeData, 'no resumeData when empty');

console.log(failed ? `\n${failed} failed` : '\nImport state OK');
process.exit(failed ? 1 : 0);
