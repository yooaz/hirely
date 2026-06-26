#!/usr/bin/env node
/**
 * Automatic import policy — single resolveAutomaticImportRoute, no user engine choice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveAutomaticImportRoute,
  resolveImportDecision,
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_REASON,
  AUTOMATIC_IMPORT_TEXT_MIN,
} from '../core/import/import-decision-final.js';
import { buildImportDecisionFromExtracted } from '../core/import/ocr-import-usability.js';
import { attachImportDecisionToResult } from '../core/import/import-ui-routing.js';
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

ok(typeof resolveAutomaticImportRoute === 'function', 'resolveAutomaticImportRoute is exported');

const docx = resolveAutomaticImportRoute({ fileType: 'docx', textLength: 500 });
ok(
  docx.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
  'non-PDF textual => structured_native'
);

const nativePdf = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 1200,
  ocrTextLength: 0,
});
ok(
  nativePdf.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
  'PDF with good native text => structured_native'
);

const scannedOcr = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrTextLength: 180,
  ocrAttempted: true,
  ocrUsable: true,
  resumeData: { identity: { name: 'Test User' }, experiences: [] },
});
ok(
  scannedOcr.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'PDF scanned with usable OCR + resumeData => structured_from_ocr'
);

const ocrOnlyRecovery = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrTextLength: 180,
  ocrAttempted: true,
  ocrUsable: true,
});
ok(
  ocrOnlyRecovery.destination === IMPORT_DECISION_DESTINATION.RECOVERY,
  'PDF OCR without structured payload => recovery'
);
ok(
  ocrOnlyRecovery.reason === IMPORT_DECISION_REASON.OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD,
  'OCR-only route labeled OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD'
);

const pendingScan = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: false,
});
ok(
  pendingScan.destination === IMPORT_DECISION_DESTINATION.PASTE,
  'scanned PDF before OCR => paste (OCR_UNUSABLE)'
);
ok(
  pendingScan.reason === IMPORT_DECISION_REASON.OCR_UNUSABLE,
  'pending scan without OCR => OCR_UNUSABLE'
);

const failedOcr = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: true,
  ocrTextLength: 0,
  ocrUsable: false,
});
ok(failedOcr.destination === IMPORT_DECISION_DESTINATION.PASTE, 'paste only when OCR truly failed');
ok(failedOcr.reason === IMPORT_DECISION_REASON.OCR_UNUSABLE, 'failed OCR => OCR_UNUSABLE');

const falseStructuredInflatedText = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: false,
  ocrTextLength: 0,
  ocrUsable: false,
  textLength: 500,
  resumeData: { identity: { name: 'Inflated' }, experiences: [] },
});
ok(
  falseStructuredInflatedText.destination !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'PDF_IMAGE_ONLY + ocrUsable=false + ocrTextLength=0 => not structured_from_ocr (parser textLength ignored)'
);
ok(
  falseStructuredInflatedText.destination === IMPORT_DECISION_DESTINATION.PASTE,
  'no OCR payload with only resumeData => paste'
);

const resumeWithoutOcr = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: false,
  ocrTextLength: 0,
  ocrUsable: false,
  resumeData: { identity: { name: 'No OCR' } },
});
ok(
  resumeWithoutOcr.destination !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'resumeData alone cannot yield structured_from_ocr without OCR'
);

const ocrNoStructure = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: true,
  ocrTextLength: 180,
  ocrUsable: true,
});
ok(ocrNoStructure.destination === IMPORT_DECISION_DESTINATION.RECOVERY, 'OCR usable but no structured payload => recovery');
ok(
  ocrNoStructure.destination !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'OCR without structured payload is never structured_from_ocr'
);

const ocrWithStructure = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: true,
  ocrTextLength: 180,
  ocrUsable: true,
  resumeData: { identity: { name: 'Valid' }, experiences: [] },
});
ok(
  ocrWithStructure.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'OCR usable + structured payload => structured_from_ocr'
);
ok(
  ocrWithStructure.reason === IMPORT_DECISION_REASON.PDF_IMAGE_ONLY,
  'structured_from_ocr reason is PDF_IMAGE_ONLY when OCR ready'
);

const ocrLengthOnlyNotReady = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: false,
  ocrTextLength: 200,
  ocrUsable: false,
  resumeData: { identity: { name: 'Not ready' }, experiences: [] },
});
ok(
  ocrLengthOnlyNotReady.destination !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'never structured_from_ocr when ocrAttempted/ocrUsable not both true'
);
ok(ocrLengthOnlyNotReady.destination === IMPORT_DECISION_DESTINATION.PASTE, 'OCR not ready => paste');

const ocrUsableFlagOnly = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrAttempted: false,
  ocrTextLength: 200,
  ocrUsable: true,
  resumeData: { identity: { name: 'Flag only' } },
});
ok(
  ocrUsableFlagOnly.destination !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'ocrUsable without ocrAttempted does not yield structured_from_ocr'
);

const inflatedExtractedDecision = resolveImportDecision(
  buildImportDecisionFromExtracted(
    {
      fileType: 'pdf',
      rawText: 'a'.repeat(140),
      cleanedText: 'a'.repeat(140),
      ocrAttempted: false,
      ocrUsable: false,
      resumeData: { identity: { name: 'Parser only' }, experiences: [] },
      enterprise: { method: 'native_pdf', lines: [{ text: 'a'.repeat(140), source: 'native', page: 1 }] },
    },
    { mode: 'structured' }
  )
);
ok(
  inflatedExtractedDecision.destination !== IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'buildImportDecisionFromExtracted must not emit false structured_from_ocr from parser text'
);

const debugExact = resolveAutomaticImportRoute({
  fileType: 'pdf',
  nativeTextLength: 0,
  ocrTextLength: 180,
  ocrAttempted: true,
  ocrUsable: true,
  forceExactTranscription: true,
});
ok(
  debugExact.destination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  'exact_transcription only under forceExactTranscription'
);

const structuredDefault = resolveImportDecision(
  buildImportDecisionFromExtracted(
    {
      fileType: 'pdf',
      rawText: 'a'.repeat(140),
      cleanedText: 'a'.repeat(140),
      ocrAttempted: true,
      ocrUsable: true,
      resumeData: { identity: { name: 'Test User' }, experiences: [] },
      enterprise: { method: 'ocr', lines: [{ text: 'a'.repeat(140), source: 'ocr', page: 1 }] },
    },
    { mode: 'structured' }
  )
);
ok(
  structuredDefault.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'resolveImportDecision structured mode uses automatic policy'
);

const ocrLines = [
  { text: 'Yohann Azancot', cleanedText: 'Yohann Azancot', page: 1, source: 'ocr', confidence: 82 },
  {
    text: 'Senior Product Designer — UX Research, prototyping, and design systems',
    cleanedText: 'Senior Product Designer — UX Research, prototyping, and design systems',
    page: 1,
    source: 'ocr',
    confidence: 78,
  },
];
const attached = attachImportDecisionToResult(
  {
    fileType: 'pdf',
    rawText: '',
    cleanedText: '',
    ocrAttempted: true,
    ocrUsable: true,
    ocrTextLength: 85,
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    resumeData: { identity: { name: 'Yohann Azancot' }, experiences: [] },
    enterprise: { method: 'ocr', lines: ocrLines },
  },
  { mode: 'structured' }
);
ok(
  attached.importDecisionDestination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'UI attach commits structured_from_ocr from policy'
);
ok(attached.importUiRoute === attached.importDecisionDestination, 'importUiRoute mirrors committed destination');

ok(indexHtml.includes('readCommittedImportDestinationUi'), 'UI reads committed destination');
ok(indexHtml.includes('importStatusNeedsFallback'), 'UI fallback gate exists');
ok(
  !/importStatusNeedsFallback[\s\S]{0,400}effectiveLen<300/.test(indexHtml),
  'importStatusNeedsFallback no longer uses rawText<300 shortcut'
);
ok(indexHtml.includes('logFinalImportRoute'), 'UI logs IMPORT_FINAL_ROUTE via logFinalImportRoute');
ok(indexHtml.includes('coerceFinalImportDestination'), 'UI coerces impossible structured_from_ocr before render');

const htmlWithoutScripts = indexHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
ok(!htmlWithoutScripts.includes('CV structuré (parser)'), 'no parser choice in static HTML');
ok(AUTOMATIC_IMPORT_TEXT_MIN === 80, 'automatic text threshold is 80 chars');

if (failed) {
  console.error(`\nAUTOMATIC IMPORT POLICY QA FAILED (${failed})`);
  process.exit(1);
}
console.log('\nAUTOMATIC IMPORT POLICY QA OK');
