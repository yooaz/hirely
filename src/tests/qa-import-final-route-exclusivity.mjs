#!/usr/bin/env node
/**
 * Final import route — policy coercion, run guard, paste/recovery exclusivity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveAutomaticImportRoute,
  coerceImpossibleStructuredFromOcrRoute,
  isOcrReadyForPolicyRoute,
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_REASON,
  AUTOMATIC_IMPORT_TEXT_MIN,
} from '../core/import/import-decision-final.js';
import { attachImportDecisionToResult } from '../core/import/import-ui-routing.js';
import { enrichImportResultWithOcrSettlement, finalizePdfImportWithOcr } from '../core/import/enrich-import-result-ocr-settlement.js';
import { IMPORT_STATE } from '../core/import/import-state.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

// 1. Impossible structured_from_ocr decision is rejected
const impossible = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: false,
  ocrTextLength: 0,
  ocrUsable: false,
  resumeData: { identity: { name: 'Early' }, experiences: [] },
});
ok(
  impossible.destination !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'impossible structured_from_ocr (ocrAttempted=false) is rejected by policy'
);
ok(
  impossible.destination === IMPORT_DECISION_DESTINATION.PASTE,
  'impossible structured_from_ocr falls through to paste'
);

ok(
  coerceImpossibleStructuredFromOcrRoute(IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR, {
    ocrAttempted: false,
    ocrUsable: false,
    ocrTextLength: 0,
    resumeData: { identity: { name: 'X' } },
  }) === IMPORT_DECISION_DESTINATION.PASTE,
  'coerceImpossibleStructuredFromOcrRoute rejects early structured_from_ocr'
);

// 4. OCR_UNUSABLE routes to paste only
const failedOcr = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: true,
  ocrTextLength: 0,
  ocrUsable: false,
});
ok(failedOcr.destination === IMPORT_DECISION_DESTINATION.PASTE, 'OCR_UNUSABLE routes to paste');
ok(failedOcr.reason === IMPORT_DECISION_REASON.OCR_UNUSABLE, 'OCR_UNUSABLE reason');

// 5. OCR usable + structured payload => structured_from_ocr
const structuredOcr = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: true,
  ocrUsable: true,
  ocrTextLength: 180,
  resumeData: { identity: { name: 'User' }, experiences: [] },
});
ok(
  structuredOcr.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'OCR usable + structured payload => structured_from_ocr'
);

const lengthOnlyStructured = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: true,
  ocrUsable: true,
  ocrTextLength: AUTOMATIC_IMPORT_TEXT_MIN + 20,
  resumeData: { identity: { name: 'Len' }, experiences: [] },
});
ok(
  lengthOnlyStructured.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'enriched ocrUsable + structured payload => structured_from_ocr'
);
ok(
  isOcrReadyForPolicyRoute({
    ocrAttempted: true,
    ocrUsable: true,
  }),
  'isOcrReadyForPolicyRoute requires ocrAttempted && ocrUsable'
);
ok(
  !isOcrReadyForPolicyRoute({
    ocrAttempted: true,
    ocrUsable: false,
    ocrTextLength: AUTOMATIC_IMPORT_TEXT_MIN,
  }),
  'policy does not infer ocrUsable from ocrTextLength alone'
);

// 6. OCR usable + no structured payload => recovery
const recoveryOnly = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: true,
  ocrUsable: true,
  ocrTextLength: 180,
});
ok(recoveryOnly.destination === IMPORT_DECISION_DESTINATION.RECOVERY, 'OCR ready + no structured => recovery');
ok(
  recoveryOnly.reason === IMPORT_DECISION_REASON.OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD,
  'recovery reason OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD'
);

// skipDecisionLog — attach without polluting global early destination
const prevRun = globalThis.HIRELY_IMPORT_RUN_ID;
const prevDest = globalThis.HIRELY_LAST_IMPORT_DESTINATION;
globalThis.HIRELY_IMPORT_RUN_ID = 'attach-skip-test';
const attachedSilent = attachImportDecisionToResult(
  {
    fileType: 'pdf',
    rawText: '',
    cleanedText: '',
    ocrAttempted: false,
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  },
  { mode: 'structured', skipDecisionLog: true }
);
ok(
  attachedSilent.importDecisionDestination === IMPORT_DECISION_DESTINATION.PASTE,
  'attach with skipDecisionLog still attaches fields'
);
ok(
  globalThis.HIRELY_LAST_IMPORT_DESTINATION === prevDest,
  'skipDecisionLog does not write HIRELY_LAST_IMPORT_DESTINATION'
);
globalThis.HIRELY_IMPORT_RUN_ID = prevRun;

// finalizePdfImportWithOcr — non-PDF passthrough + strips premature route
const docxPassthrough = await finalizePdfImportWithOcr(
  { name: 'cv.docx' },
  {
    fileType: 'docx',
    importDecisionDestination: 'structured_native',
    ocrAttempted: false,
  }
);
ok(
  docxPassthrough.importDecisionDestination === 'structured_native',
  'finalizePdfImportWithOcr skips non-PDF files'
);

// 2. Only latest runId may commit UI (index.html guards)
ok(indexHtml.includes('if(runId!==state.importRunId)return'), 'commitFinalImportRoute rejects stale runId');
ok(indexHtml.includes('IMPORT_STALE_RUN_IGNORED'), 'pipeline logs stale run ignored');
ok(indexHtml.includes('enrichImportResultWithOcrSettlement')||indexHtml.includes('finalizePdfImportWithOcr'), 'index.html awaits OCR settlement before final route');
ok(indexHtml.includes('OCR_SETTLEMENT_FINALIZED'), 'index.html logs OCR settlement finalized');
ok(indexHtml.includes('function logFinalImportRoute'), 'logFinalImportRoute logs run truth once');
ok(indexHtml.includes('function finalizeImportRoute'), 'index.html finalizeImportRoute orchestrates settlement→policy→log→commit');
ok(indexHtml.includes('function resolveFinalImportDecision'), 'index.html resolveFinalImportDecision reads enriched result');
ok(indexHtml.includes('finalizeImportRoute(runId,file,result'), 'pipeline calls finalizeImportRoute after canonical import');
ok(
  !/function commitFinalImportRoute[\s\S]{0,400}logFinalImportRoute/.test(indexHtml),
  'commitFinalImportRoute does not log — logFinalImportRoute runs before commit'
);

// 3. Paste and recovery cannot be visible together
ok(indexHtml.includes('function shouldShowPaste'), 'shouldShowPaste helper');
ok(indexHtml.includes('function shouldShowRecovery'), 'shouldShowRecovery helper');
ok(
  /function renderPasteFallback[\s\S]{0,200}hideRecoveryPanel/.test(indexHtml),
  'renderPasteFallback hides recovery panel'
);
ok(
  /function renderRecovery[\s\S]{0,200}hideImportPasteFallback/.test(indexHtml),
  'renderRecovery hides paste fallback'
);
ok(
  /function scheduleRecoveryPanelRender[\s\S]{0,120}!shouldShowRecovery/.test(indexHtml),
  'scheduleRecoveryPanelRender gated by shouldShowRecovery'
);
ok(
  /function showImportPasteFallback[\s\S]{0,80}!shouldShowPaste/.test(indexHtml),
  'showImportPasteFallback gated by shouldShowPaste'
);
ok(
  !/shouldShowPaste\(\)[\s\S]{0,40}shouldShowRecovery\(\)/.test(
    indexHtml.match(/function shouldShowPaste[\s\S]{0,80}/)?.[0] || ''
  ),
  'shouldShowPaste and shouldShowRecovery are mutually exclusive route checks'
);

if (failed) {
  console.error(`\nIMPORT FINAL ROUTE EXCLUSIVITY QA FAILED (${failed})`);
  process.exit(1);
}
console.log('\nIMPORT FINAL ROUTE EXCLUSIVITY QA OK');
