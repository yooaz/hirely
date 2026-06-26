#!/usr/bin/env node
/**
 * PDF_IMAGE_ONLY + OCR usability — must not default to paste after OCR success.
 */
import {
  resolveImportDecision,
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_REASON,
} from '../core/import/import-decision-final.js';
import {
  assessOcrImportUsability,
  assessOcrImportUsabilityRaw,
  hydrateExtractedImportText,
  buildImportDecisionFromExtracted,
  enrichImportDecisionContext,
} from '../core/import/ocr-import-usability.js';
import {
  markPdfImageOnlyOcrSettled,
  OCR_SETTLEMENT,
} from '../core/import/ocr-settlement.js';
import { traceImportDecision } from '../core/import/import-decision-trace.js';
import { setLastEnterpriseExtraction } from '../core/extraction/extraction-session.js';
import { resolveImportState, resolveImportStatus, IMPORT_STATE } from '../core/import/import-status.js';
import { normalizeFinalImportTerminal } from '../core/import/final-import-lock.js';
import { exactTranscriptionFromExtracted } from '../core/import/exact-transcription-import.js';
import {
  resolveUniversalImportDecision,
  collectUniversalImportMetrics,
} from '../core/import/universal-import-pipeline.js';
import { resolveImportNeedsPasteReason } from '../core/extraction/pdf-extraction-debug.js';
import {
  isScannedPdfWithoutNativeText,
  importMustNotStopOnNativeEmpty,
  importMustNotPasteAfterUsableOcr,
  coerceImportStateForUsableOcr,
  resolveFinalImportState,
  guardPasteImportResult,
} from '../core/import/ocr-import-usability.js';
import { buildEmptyExtractPasteResult } from '../core/import/real-cv-import-root.js';
import { resolveHonestImportState } from '../core/validation/extraction-reliability.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const ocrLines = [
  { text: 'Yohann Azancot', cleanedText: 'Yohann Azancot', page: 1, line: 0, source: 'ocr', confidence: 82 },
  {
    text: 'Senior Product Designer — UX Research, prototyping, and design systems',
    cleanedText: 'Senior Product Designer — UX Research, prototyping, and design systems',
    page: 1,
    line: 1,
    source: 'ocr',
    confidence: 78,
  },
  { text: 'Paris France', cleanedText: 'Paris France', page: 1, line: 2, source: 'ocr', confidence: 74 },
  { text: 'yohann@example.com', cleanedText: 'yohann@example.com', page: 1, line: 3, source: 'ocr', confidence: 80 },
];

const extractedPartial = {
  fileType: 'pdf',
  rawText: '',
  cleanedText: '',
  extractionMethod: 'ocr',
  ocrAttempted: true,
  enterprise: {
    method: 'ocr',
    lines: ocrLines,
    rawExtraction: '',
    cleanedText: '',
    pdfExtraction: { method: 'ocr', nativeCharCount: 0, ocrCharCount: 180 },
  },
};

const hydrated = hydrateExtractedImportText(extractedPartial);
ok(hydrated.rawText.length >= 40, 'hydrate fills OCR text from lines');

const preSettlement = assessOcrImportUsability({
  ...hydrated,
  fileType: 'pdf',
  ocrInFlight: true,
  ocrSettled: false,
});
ok(preSettlement.ocrAttempted === false, 'pre-settlement PDF_IMAGE_ONLY ocrAttempted false');
ok(preSettlement.usable === false, 'pre-settlement PDF_IMAGE_ONLY ocrUsable false');

const settledHydrated = markPdfImageOnlyOcrSettled(
  { ...hydrated, fileType: 'pdf' },
  assessOcrImportUsabilityRaw(hydrated),
  OCR_SETTLEMENT.DONE_USABLE
);
ok(settledHydrated.ocrAttempted === true, 'post-settlement hydrate marks ocrAttempted');

const usability = assessOcrImportUsability(settledHydrated);
ok(usability.usable === true, 'OCR lines + text are usable');
ok(usability.nativeTextLength === 0, 'nativeTextLength 0 is expected for scans');

const exactDecision = resolveImportDecision(
  buildImportDecisionFromExtracted(settledHydrated, { mode: 'exact_transcription' })
);
ok(
  exactDecision.destination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  'PDF_IMAGE_ONLY path → exact_transcription after OCR'
);
ok(
  exactDecision.destination !== IMPORT_DECISION_DESTINATION.PASTE,
  'PDF_IMAGE_ONLY + OCR success is not IMPORT_NEEDS_PASTE (exact)'
);
ok(
  exactDecision.reason !== IMPORT_DECISION_REASON.PDF_IMAGE_ONLY ||
    exactDecision.destination !== IMPORT_DECISION_DESTINATION.PASTE,
  'PDF_IMAGE_ONLY alone does not force paste when OCR ran'
);

const structuredDecision = resolveImportDecision(
  buildImportDecisionFromExtracted(
    {
      ...settledHydrated,
      resumeData: { identity: { name: 'Yohann Azancot' }, experiences: [] },
    },
    { mode: 'structured' }
  )
);
ok(
  structuredDecision.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'structured mode → structured_from_ocr after OCR'
);

const importState = resolveImportState(hydrated.rawText, {
  method: 'ocr',
  extractionMethod: 'ocr',
  ocrUsable: true,
});
ok(
  importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE,
  'resolveImportState does not paste for usable OCR partial text'
);

const exactResult = exactTranscriptionFromExtracted(
  { name: 'scan.pdf', type: 'application/pdf', size: 12000 },
  settledHydrated,
  { fileType: 'pdf', mode: 'exact_transcription' }
);
ok(exactResult.exactTranscription === true, 'exact_transcription auto-opens payload');
ok(exactResult.importState === IMPORT_STATE.IMPORT_READY, 'exact import state is IMPORT_READY');
ok((exactResult.transcription?.line_count || 0) > 0, 'exact transcription has lines');

const pasteOnly = resolveImportDecision({
  fileType: 'pdf',
  nativeTextLength: 0,
  textLength: 0,
  ocrAttempted: true,
  ocrTextLength: 0,
  ocrLineCount: 0,
  ocrWordCount: 0,
  ocrSettled: true,
  ocrSettlement: OCR_SETTLEMENT.DONE_UNUSABLE,
  importMode: 'exact_transcription',
});
ok(pasteOnly.destination === IMPORT_DECISION_DESTINATION.PASTE, 'paste only when OCR truly empty');
ok(
  pasteOnly.reason === IMPORT_DECISION_REASON.OCR_UNUSABLE ||
    pasteOnly.reason === IMPORT_DECISION_REASON.OCR_TEXT_TOO_SHORT,
  'empty OCR → unusable paste reason'
);

const imageOnlyNoOcr = resolveImportDecision({
  fileType: 'pdf',
  nativeTextLength: 0,
  textLength: 0,
  ocrAttempted: false,
  ocrDisabled: false,
  importMode: 'exact_transcription',
});
ok(
  imageOnlyNoOcr.destination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  'image-only PDF without OCR yet continues (not paste) when OCR enabled'
);

ok(isScannedPdfWithoutNativeText({ fileType: 'pdf', nativeTextLength: 0, extractionMethod: 'ocr' }), 'detects scanned PDF without native text');
ok(importMustNotStopOnNativeEmpty(settledHydrated), 'import must not stop on native empty when OCR usable');

const uniMetrics = collectUniversalImportMetrics({
  fileType: 'pdf_scanned',
  rawText: settledHydrated.rawText,
  cleanedText: settledHydrated.cleanedText,
  extractionMethod: 'ocr',
  ocrAttempted: true,
  ocrUsable: true,
  ocrSettled: true,
  enterprise: settledHydrated.enterprise,
});
ok(uniMetrics.nativeTextLength === 0 || uniMetrics.isScannedWithoutNativeText, 'universal metrics track scanned/no-native');
const uniDecision = resolveUniversalImportDecision(uniMetrics, IMPORT_STATE.IMPORT_NEEDS_PASTE);
ok(uniDecision.status !== IMPORT_STATE.IMPORT_NEEDS_PASTE, 'universal pipeline does not paste on native 0 + OCR usable');
ok(uniDecision.ocrUsable === true, 'universal pipeline marks ocrUsable');

const pasteReason = resolveImportNeedsPasteReason(0, 0, {
  ocrAttempted: true,
  ocrAvailable: true,
  ocrResultLength: 180,
  simpleImportMode: false,
});
ok(pasteReason !== 'PDF_IMAGE_OCR_NOT_ATTEMPTED', 'debug paste reason not native-empty stop after OCR');
ok(pasteReason === 'OCR_PARTIAL_USABLE' || pasteReason === 'EXTRACTION_OK', 'debug uses OCR usability not native length');

ok(importMustNotPasteAfterUsableOcr(settledHydrated), 'usable OCR must not paste');
const coerced = coerceImportStateForUsableOcr(IMPORT_STATE.IMPORT_NEEDS_PASTE, settledHydrated);
ok(coerced !== IMPORT_STATE.IMPORT_NEEDS_PASTE, 'coerce paste → continue when OCR usable');
const honest = resolveHonestImportState({
  ...settledHydrated,
  rawText: settledHydrated.rawText,
  cleanedText: settledHydrated.cleanedText,
  resumeData: null,
  ocrUsable: true,
  ocrAttempted: true,
  enterprise: settledHydrated.enterprise,
});
ok(honest.state !== IMPORT_STATE.IMPORT_NEEDS_PASTE, 'honest gate does not paste after usable OCR');

const statusFromNativeZero = resolveImportStatus('', {
  method: 'ocr',
  ocrUsable: true,
  enterprise: extractedPartial.enterprise,
  fileType: 'pdf',
});
ok(
  statusFromNativeZero !== 'PASTE_FALLBACK_REQUIRED',
  'resolveImportStatus: native empty + ocrUsable does not paste'
);

const terminalFromPartial = normalizeFinalImportTerminal(IMPORT_STATE.IMPORT_PARTIAL, '', {
  ...settledHydrated,
  enterprise: extractedPartial.enterprise,
  ocrAttempted: true,
  ocrUsable: true,
  ocrSettled: true,
  ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
  fileType: 'pdf',
});
ok(
  terminalFromPartial !== IMPORT_STATE.IMPORT_NEEDS_PASTE,
  'normalizeFinalImportTerminal: partial + usable OCR does not paste'
);

const finalState = resolveFinalImportState(IMPORT_STATE.IMPORT_NEEDS_PASTE, settledHydrated);
ok(
  finalState !== IMPORT_STATE.IMPORT_NEEDS_PASTE,
  'resolveFinalImportState: native 0 + usable OCR never paste'
);
ok(
  finalState === IMPORT_STATE.IMPORT_PARTIAL || finalState === IMPORT_STATE.IMPORT_READY,
  'resolveFinalImportState: continues on OCR usability'
);

const pasteResult = buildEmptyExtractPasteResult(
  {
    ...settledHydrated,
    fileType: 'pdf',
    rawText: '',
    enterprise: extractedPartial.enterprise,
    ocrAttempted: true,
  },
  'pdf',
  'empty_extract'
);
ok(pasteResult.importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE, 'buildEmptyExtractPasteResult never paste when OCR usable');
ok(pasteResult.ocrUsable === true, 'guardPasteImportResult preserves OCR usable');
ok((pasteResult.rawText || '').length > 0, 'guardPasteImportResult keeps OCR text');

// Browser paste-log regression: lengths 0 but session enterprise has OCR lines.
setLastEnterpriseExtraction(extractedPartial.enterprise);
const browserCtx = enrichImportDecisionContext({
  rawTextLength: 0,
  cleanTextLength: 0,
  nativeTextLength: 0,
  fileType: 'pdf',
  docType: 'pdf',
  ocrAttempted: true,
  ocrSettled: true,
  ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
  importMode: 'exact_transcription',
});
ok(browserCtx.textLength > 0, 'enrich hydrates textLength from session OCR lines');
ok(browserCtx.ocrUsable === true, 'enrich marks ocrUsable from session');
const browserDecision = resolveImportDecision(browserCtx);
ok(
  browserDecision.destination !== IMPORT_DECISION_DESTINATION.PASTE,
  'browser-style ctx after OCR_DONE is not paste'
);
ok(
  browserDecision.destination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION,
  'browser-style ctx routes to exact_transcription'
);
const traced = traceImportDecision({
  rawTextLength: 0,
  cleanTextLength: 0,
  nativeTextLength: 0,
  fileType: 'pdf',
  ocrAttempted: true,
  ocrSettled: true,
  ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
  importMode: 'exact_transcription',
});
ok(traced !== IMPORT_DECISION_REASON.OCR_TEXT_TOO_SHORT, 'traceImportDecision does not OCR_TEXT_TOO_SHORT on usable OCR');

console.log('\nPDF IMAGE OCR DECISION QA OK');
