#!/usr/bin/env node
/**
 * OCR settlement barrier — import must wait for OCR before paste commit.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  OCR_SETTLEMENT,
  ocrSettlementIsPending,
  importMustNotCommitPasteWhileOcrPending,
  attachOcrSettlementMeta,
  applyPdfImageOnlyOcrFlagGate,
  isPdfImageOnlyRoute,
  markPdfImageOnlyOcrSettled,
} from '../core/import/ocr-settlement.js';
import {
  guardPasteImportResult,
  importMustNotPasteAfterUsableOcr,
  assessOcrImportUsability,
  assessOcrImportUsabilityRaw,
  recoverLateUsableOcrImport,
} from '../core/import/ocr-import-usability.js';
import {
  resolveImportDecision,
  IMPORT_DECISION_DESTINATION,
} from '../core/import/import-decision-trace.js';
import {
  IMPORT_STATE,
  finishImport,
} from '../core/import/import-state.js';
import { beginImportRun } from '../core/import/import-run-guard.js';
import { pdfImportBarrierTimeoutMs } from '../core/extraction/pdf-extraction-timeout.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ocrRunSrc = readFileSync(join(__dir, '../core/extraction/pdf-ocr-run.js'), 'utf8');
const indexHtml = readFileSync(join(__dir, '../../index.html'), 'utf8');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(ocrSettlementIsPending(OCR_SETTLEMENT.PENDING), 'pending is pending');
ok(
  ocrSettlementIsPending(OCR_SETTLEMENT.TIMED_OUT_PENDING),
  'timed_out_pending is pending'
);
ok(
  importMustNotCommitPasteWhileOcrPending({ ocrSettlement: OCR_SETTLEMENT.PENDING }),
  'paste blocked while OCR pending'
);
ok(
  importMustNotCommitPasteWhileOcrPending({ ocrInFlight: true }),
  'paste blocked while OCR in flight'
);
ok(
  !importMustNotCommitPasteWhileOcrPending({
    ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
    ocrSettled: true,
  }),
  'paste allowed after done_usable'
);

const blocked = guardPasteImportResult(
  {
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    rawText: '',
    warnings: [],
  },
  { ocrSettlement: OCR_SETTLEMENT.TIMED_OUT_PENDING, ocrInFlight: true }
);
ok(blocked.importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE, 'guard blocks paste while pending');
ok(blocked.ocrInFlight === true, 'guard marks ocrInFlight');

const lateUsable = guardPasteImportResult(
  {
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    rawText: '',
    warnings: [],
  },
  {
    rawText: 'x'.repeat(420),
    cleanedText: 'x'.repeat(420),
    ocrAttempted: true,
    ocrSettled: true,
    ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
    fileType: 'pdf',
    nativeTextLength: 0,
    enterprise: {
      method: 'ocr',
      rawExtraction: 'x'.repeat(420),
      lines: [
        { text: 'John Doe', page: 1, confidence: 80 },
        { text: 'Experience at Acme', page: 1, confidence: 75 },
        { text: 'Skills: JavaScript', page: 1, confidence: 70 },
      ],
    },
  }
);
ok(lateUsable.importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE, 'late OCR usable cancels paste');
ok(lateUsable.ocrUsable === true, 'late OCR marks ocrUsable');

const earlyDecision = resolveImportDecision({
  fileType: 'pdf',
  nativeTextLength: 0,
  textLength: 0,
  ocrAttempted: false,
  ocrUsable: false,
  importMode: 'exact_transcription',
});
ok(
  earlyDecision.destination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  'pre-OCR decision routes to exact_transcription not paste'
);
ok(
  earlyDecision.destination !== IMPORT_DECISION_DESTINATION.PASTE,
  'IMPORT_DECISION does not paste before OCR on scanned PDF'
);

const barrierMs = pdfImportBarrierTimeoutMs(2);
ok(barrierMs >= 30000, `import barrier timeout covers OCR budget (${barrierMs}ms)`);
ok(
  !/if\(docType==='pdf'\|\|docType==='image'\)return 15000/.test(indexHtml),
  'index.html no longer uses 15s PDF import race'
);
ok(
  /pdfImportBarrierTimeoutMs/.test(indexHtml),
  'index.html uses pdfImportBarrierTimeoutMs'
);
ok(
  /OCR_SETTLEMENT_PENDING|settled-after-advisory-timeout/.test(ocrRunSrc),
  'pdf-ocr-run awaits work after advisory timeout'
);
ok(
  /terminal:\s*false/.test(ocrRunSrc) && /timed_out_but_pending_result_not_committed/.test(ocrRunSrc),
  'advisory OCR timeout is non-terminal'
);

const meta = attachOcrSettlementMeta({ rawText: 'hi' }, OCR_SETTLEMENT.DONE_USABLE, {
  settledBeforeCommit: true,
});
ok(meta.ocrSettled === true, 'settlement meta records ocrSettled');
ok(meta.ocrSettledBeforeCommit === true, 'settlement meta records commit barrier');

ok(
  importMustNotPasteAfterUsableOcr({
    fileType: 'pdf',
    nativeTextLength: 0,
    ocrInFlight: true,
    ocrSettled: false,
    rawText: 'x'.repeat(200),
    enterprise: {
      method: 'ocr',
      lines: [
        { text: 'Line one here', page: 1 },
        { text: 'Line two here', page: 1 },
        { text: 'Line three here', page: 1 },
      ],
    },
  }) === false,
  'pre-settlement usable OCR does not block paste via flags'
);

ok(
  importMustNotPasteAfterUsableOcr({
    ocrAttempted: true,
    ocrSettled: true,
    ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
    rawText: 'x'.repeat(200),
    fileType: 'pdf',
    nativeTextLength: 0,
    enterprise: {
      method: 'ocr',
      lines: [
        { text: 'Line one here', page: 1 },
        { text: 'Line two here', page: 1 },
        { text: 'Line three here', page: 1 },
      ],
    },
  }),
  'usable OCR still blocks paste after settlement'
);

const preFlags = applyPdfImageOnlyOcrFlagGate(
  { fileType: 'pdf', nativeTextLength: 0, ocrInFlight: true },
  { ocrAttempted: true, ocrUsable: true, usable: true }
);
ok(preFlags.ocrAttempted === false && preFlags.ocrUsable === false, 'gate defers flags pre-settlement');

const postFlags = applyPdfImageOnlyOcrFlagGate(
  {
    fileType: 'pdf',
    nativeTextLength: 0,
    ocrSettled: true,
    ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
  },
  { ocrAttempted: true, ocrUsable: true, usable: true }
);
ok(postFlags.ocrAttempted === true && postFlags.ocrUsable === true, 'gate exposes flags post-settlement');

const lateLines = [
  { text: 'John Doe', page: 1, confidence: 80 },
  { text: 'Experience at Acme Corp', page: 1, confidence: 75 },
  { text: 'Skills: JavaScript TypeScript', page: 1, confidence: 70 },
];
const lateText = 'x'.repeat(420);
const lateUsability = assessOcrImportUsabilityRaw({
  fileType: 'pdf',
  nativeTextLength: 0,
  rawText: lateText,
  enterprise: { method: 'ocr', lines: lateLines, rawExtraction: lateText },
});
const lateExtracted = markPdfImageOnlyOcrSettled(
  {
    fileType: 'pdf',
    nativeTextLength: 0,
    rawText: lateText,
    cleanedText: lateText,
    enterprise: { method: 'ocr', lines: lateLines, rawExtraction: lateText },
  },
  lateUsability,
  OCR_SETTLEMENT.DONE_USABLE
);
const latePack = await recoverLateUsableOcrImport(null, {
  settlement: {
    state: OCR_SETTLEMENT.DONE_USABLE,
    usable: true,
    text: lateText,
    lines: lateLines,
    extracted: lateExtracted,
  },
});
ok(latePack.recovered === true, 'recoverLateUsableOcrImport accepts settled OCR');
ok(latePack.extracted?.ocrUsable === true, 'late recovery marks ocrUsable');
ok(latePack.extracted?.ocrSettled === true, 'late recovery marks ocrSettled');

const runLate = beginImportRun();
finishImport(runLate, IMPORT_STATE.IMPORT_NEEDS_PASTE, {});
const upgraded = finishImport(runLate, IMPORT_STATE.IMPORT_READY, {
  acceptLateOcr: true,
  lateOcrRecovery: true,
});
ok(upgraded.applied && upgraded.upgraded, 'IMPORT_FINAL upgrades paste → ready after late OCR');

ok(/hirely:ocr-settled/.test(ocrRunSrc), 'pdf-ocr-run dispatches hirely:ocr-settled');
ok(/recoverLateOcrAfterPasteCommit/.test(indexHtml), 'index.html recovers late OCR after paste commit');
ok(/acceptLateOcr/.test(indexHtml), 'index.html endImport allows acceptLateOcr upgrade');

console.log(failed ? `\n${failed} failed` : '\nOCR SETTLEMENT BARRIER QA OK');
process.exit(failed ? 1 : 0);
