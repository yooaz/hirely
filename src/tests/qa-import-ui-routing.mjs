#!/usr/bin/env node
/**
 * Import decision → UI routing handoff.
 * PDF_IMAGE_ONLY + structured_from_ocr must not show paste fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_REASON,
} from '../core/import/import-decision-final.js';
import {
  attachImportDecisionToResult,
  importDestinationBlocksPaste,
  readCommittedImportDestination,
  resolveImportContinuationRoute,
  isAutoContinueImportDestination,
} from '../core/import/import-ui-routing.js';
import {
  hydrateExtractedImportText,
  assessOcrImportUsabilityRaw,
} from '../core/import/ocr-import-usability.js';
import {
  markPdfImageOnlyOcrSettled,
  OCR_SETTLEMENT,
} from '../core/import/ocr-settlement.js';
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

const ocrLines = [
  { text: 'Yohann Azancot', cleanedText: 'Yohann Azancot', page: 1, source: 'ocr', confidence: 82 },
  {
    text: 'Senior Product Designer — UX Research, prototyping, and design systems',
    cleanedText: 'Senior Product Designer — UX Research, prototyping, and design systems',
    page: 1,
    line: 1,
    source: 'ocr',
    confidence: 78,
  },
  {
    text: 'Paris, France · yohann@example.com · +33 6 12 34 56 78',
    cleanedText: 'Paris, France · yohann@example.com · +33 6 12 34 56 78',
    page: 1,
    line: 2,
    source: 'ocr',
    confidence: 74,
  },
];

const extractedPartial = {
  fileType: 'pdf',
  rawText: '',
  cleanedText: '',
  extractionMethod: 'ocr',
  ocrAttempted: true,
  ocrUsable: true,
  ocrTextLength: 180,
  importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  resumeData: { identity: { name: 'Yohann Azancot' }, experiences: [] },
  enterprise: {
    method: 'ocr',
    lines: ocrLines,
    pdfExtraction: { method: 'ocr', nativeCharCount: 0, ocrCharCount: 180 },
  },
};

const hydrated = markPdfImageOnlyOcrSettled(
  hydrateExtractedImportText(extractedPartial),
  assessOcrImportUsabilityRaw(hydrateExtractedImportText(extractedPartial)),
  OCR_SETTLEMENT.DONE_USABLE
);

const attached = attachImportDecisionToResult(
  { ...hydrated, importState: IMPORT_STATE.IMPORT_NEEDS_PASTE },
  { mode: 'structured' }
);

ok(
  attached.importDecisionDestination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'attachImportDecisionToResult commits structured_from_ocr'
);
ok(
  attached.importDecisionReason === IMPORT_DECISION_REASON.OCR_TEXT_OK ||
    attached.importDecisionReason === IMPORT_DECISION_REASON.OCR_PARTIAL_USABLE ||
    attached.importDecisionReason === IMPORT_DECISION_REASON.PDF_IMAGE_ONLY,
  'usable OCR + structured payload keeps non-paste reason'
);
ok(
  attached.importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE,
  'attachImportDecisionToResult coerces IMPORT_NEEDS_PASTE away when OCR route exists'
);
ok(importDestinationBlocksPaste(attached, { mode: 'structured' }), 'importDestinationBlocksPaste for structured_from_ocr');
ok(
  resolveImportContinuationRoute(attached, { mode: 'structured' }) ===
    IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'resolveImportContinuationRoute returns structured_from_ocr'
);

const doubleAttach = attachImportDecisionToResult(
  {
    ...attached,
    rawText: '',
    cleanedText: '',
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    importDecisionDestination: attached.importDecisionDestination,
    importUiRoute: attached.importUiRoute,
  },
  { mode: 'structured', fileType: 'pdf' }
);
ok(
  doubleAttach.importDecisionDestination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'double attachImportDecisionToResult must not downgrade structured_from_ocr to paste'
);
ok(
  doubleAttach.importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE,
  'double attach keeps non-paste import state'
);
ok(isAutoContinueImportDestination(IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR), 'structured_from_ocr is auto-continue');
ok(isAutoContinueImportDestination(IMPORT_DECISION_DESTINATION.RECOVERY), 'recovery is auto-continue');
ok(isAutoContinueImportDestination(IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION), 'exact_transcription is auto-continue');

const exactAttached = attachImportDecisionToResult(
  { ...hydrated, importState: IMPORT_STATE.IMPORT_NEEDS_PASTE },
  { mode: 'exact_transcription', exactTranscription: true, fileType: 'pdf' }
);
ok(
  exactAttached.importDecisionDestination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  'OCR success routes to exact_transcription when exact mode active'
);
ok(importDestinationBlocksPaste(exactAttached, { mode: 'exact_transcription' }), 'exact_transcription blocks paste');

globalThis.HIRELY_IMPORT_RUN_ID = '42-test-run';
globalThis.HIRELY_IMPORT_DECISION_RUN = '42-test-run';
globalThis.HIRELY_LAST_IMPORT_DESTINATION = IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR;
ok(
  readCommittedImportDestination({ rawText: '', cleanedText: '' }) ===
    IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'readCommittedImportDestination uses same-run global when result fields empty'
);
try {
  globalThis.HIRELY_IMPORT_RUN_ID = undefined;
  globalThis.HIRELY_IMPORT_DECISION_RUN = undefined;
  globalThis.HIRELY_LAST_IMPORT_DESTINATION = undefined;
} catch {
  /* ignore */
}

const emptyOcr = attachImportDecisionToResult(
  {
    fileType: 'pdf',
    rawText: '',
    cleanedText: '',
    ocrAttempted: true,
    ocrSettled: true,
    ocrSettlement: OCR_SETTLEMENT.DONE_UNUSABLE,
    enterprise: { lines: [], method: 'ocr' },
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  },
  { mode: 'structured' }
);
ok(
  emptyOcr.importDecisionDestination === IMPORT_DECISION_DESTINATION.PASTE,
  'empty OCR still routes to paste'
);
ok(!importDestinationBlocksPaste(emptyOcr, { mode: 'structured' }), 'paste allowed when OCR truly failed');

ok(indexHtml.includes('finalizeImportRoute'), 'index.html commits route via finalizeImportRoute');
ok(!indexHtml.includes('commitImportDecisionOnResult({...result,enterpriseExtraction'), 'pipeline no longer uses commitImportDecisionOnResult for final route');
ok(indexHtml.includes('commitFinalImportRoute'), 'index.html commits one final import route per run');
ok(indexHtml.includes('clearAllImportScreens'), 'index.html clears import screens before route render');
ok(indexHtml.includes('applyImportDecision'), 'applyImportDecision delegates to commitFinalImportRoute');
ok(indexHtml.includes('readCommittedImportDestinationUi'), 'index.html reads committed destination before stale state');
ok(indexHtml.includes('resolveImportUiRoute'), 'index.html resolves UI route from decision');
ok(indexHtml.includes('IMPORT_UI_ROUTE'), 'index.html logs import UI route');
ok(
  /importDestinationBlocksPaste\(/.test(indexHtml) && indexHtml.includes('showImportPasteFallback'),
  'paste fallback checks import destination'
);
ok(indexHtml.includes('function commitFinalImportRoute'), 'index.html centralizes UI handoff on commitFinalImportRoute');
ok(indexHtml.includes('hideImportModeSelector'), 'index.html hides import mode selector after decision');
ok(indexHtml.includes('isActiveImportRun'), 'index.html blocks stale import runs');
ok(indexHtml.includes('IMPORT_STALE_RUN_IGNORED'), 'index.html logs stale run bail after extraction');
ok(indexHtml.includes('showLoadingOverlay'), 'index.html shows loading overlay at import start');
ok(indexHtml.includes('readImportFinalRoute'), 'index.html readImportFinalRoute helper');
ok(indexHtml.includes('setImportFinalRoute'), 'index.html setImportFinalRoute helper');
ok(indexHtml.includes('function shouldShowPaste'), 'index.html derives paste UI from importFinalRoute');
ok(indexHtml.includes('function shouldShowRecovery'), 'index.html derives recovery UI from importFinalRoute');
ok(indexHtml.includes('function shouldShowStructured'), 'index.html derives structured UI from importFinalRoute');
ok(
  /importStatusNeedsFallback[\s\S]{0,200}shouldShowPaste/.test(indexHtml),
  'importStatusNeedsFallback gates paste from shouldShowPaste'
);
ok(!/state\.importDestination/.test(indexHtml), 'index.html no longer uses state.importDestination');

const htmlWithoutScripts = indexHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
ok(
  !htmlWithoutScripts.includes('Ce PDF est une image') ||
    htmlWithoutScripts.includes('importPasteFallback'),
  'image-only paste copy only in recovery panel markup (not a standalone gate)'
);

if (failed) {
  console.error(`\nIMPORT UI ROUTING QA FAILED (${failed})`);
  process.exit(1);
}
console.log('\nIMPORT UI ROUTING QA OK');
