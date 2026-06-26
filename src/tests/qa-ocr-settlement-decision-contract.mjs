#!/usr/bin/env node
/**
 * OCR settlement → final import decision contract.
 * Ensures enrichImportResultWithOcrSettlement populates truthful OCR flags before policy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  enrichImportResultWithOcrSettlement,
} from '../core/import/enrich-import-result-ocr-settlement.js';
import {
  resolveAutomaticImportRoute,
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_REASON,
  AUTOMATIC_IMPORT_TEXT_MIN,
} from '../core/import/import-decision-final.js';
import { buildEnrichedImportRouteInput } from '../core/import/enriched-import-route-input.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scannedFixture = path.join(root, 'tests/fixtures/scanned-pdf/fixture.txt');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function makeOcrEnterprise(lines) {
  return {
    lines: lines.map((text, i) => ({
      text,
      cleanedText: text,
      source: 'ocr',
      page: 1,
      confidence: 85,
    })),
    method: 'ocr',
    pdfExtraction: { method: 'ocr', ocrCharCount: lines.join(' ').length },
  };
}

const fakePdf = { name: 'scanned-cv.pdf', size: 1024 };

// 1. Sync enterprise OCR (no in-flight settlement) → ocrAttempted true
const syncLines = [
  'Jane Doe',
  'Creative Director',
  'Experience',
  'McCann Paris Lead Illustrator 2011 2014',
  'Publicis Art Director 2015 2018',
  'Skills Adobe Illustrator Figma',
];
const syncBase = {
  fileType: 'pdf',
  nativeTextLength: 0,
  rawText: syncLines.join('\n'),
  cleanedText: syncLines.join('\n'),
  enterprise: makeOcrEnterprise(syncLines),
  extractionMethod: 'ocr',
  ocrAttempted: false,
  ocrUsable: false,
  ocrTextLength: 0,
};
const syncEnriched = await enrichImportResultWithOcrSettlement(fakePdf, { ...syncBase });
ok(syncEnriched.ocrAttempted === true, 'OCR settlement enrichment sets ocrAttempted after sync OCR run');
ok(syncEnriched.ocrTextLength > 0, 'OCR settlement enrichment sets ocrTextLength from enterprise lines');
ok(syncEnriched.ocrUsable === true, 'OCR settlement enrichment sets ocrUsable from assessOcrImportUsabilityRaw');
ok(!syncEnriched.importDecisionDestination, 'enrichment strips premature importDecisionDestination');

// 2. Usable OCR + structured payload => structured_from_ocr
const structuredEnriched = {
  ...syncEnriched,
  resumeData: { identity: { name: 'Jane Doe' }, experiences: [{ company: 'McCann', role: 'Illustrator' }] },
};
const structuredDecision = resolveAutomaticImportRoute(
  buildEnrichedImportRouteInput(structuredEnriched)
);
ok(
  structuredDecision.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'usable OCR + structured payload => structured_from_ocr'
);

// 3. Usable OCR + no structured payload => recovery (never paste)
const recoveryDecision = resolveAutomaticImportRoute(buildEnrichedImportRouteInput(syncEnriched));
ok(
  recoveryDecision.destination === IMPORT_DECISION_DESTINATION.RECOVERY,
  'usable OCR + no structured payload => recovery'
);
ok(
  recoveryDecision.reason === IMPORT_DECISION_REASON.OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD,
  'recovery reason is OCR_TEXT_ONLY_NO_STRUCTURED_PAYLOAD'
);

// 4. True OCR failure => paste only
const failedOcr = resolveAutomaticImportRoute(
  buildEnrichedImportRouteInput({
    fileType: 'pdf',
    nativeTextLength: 0,
    ocrAttempted: true,
    ocrUsable: false,
    ocrTextLength: 0,
  })
);
ok(failedOcr.destination === IMPORT_DECISION_DESTINATION.PASTE, 'true OCR failure => paste');
ok(failedOcr.reason === IMPORT_DECISION_REASON.OCR_UNUSABLE, 'paste reason OCR_UNUSABLE');

const neverAttempted = resolveAutomaticImportRoute(
  buildEnrichedImportRouteInput({
    fileType: 'pdf',
    nativeTextLength: 0,
    ocrAttempted: false,
    ocrUsable: false,
    ocrTextLength: 0,
  })
);
ok(neverAttempted.destination === IMPORT_DECISION_DESTINATION.PASTE, 'no OCR attempted => paste');

// Native text bypass
const nativeOk = resolveAutomaticImportRoute(
  buildEnrichedImportRouteInput({
    fileType: 'pdf',
    nativeTextLength: AUTOMATIC_IMPORT_TEXT_MIN + 50,
    ocrAttempted: false,
    ocrUsable: false,
  })
);
ok(nativeOk.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE, 'nativeTextLength >= 80 => structured_native');

// 5. Regression — scanned CV fixture text must not route to paste when OCR lines present
let scannedText = '';
if (fs.existsSync(scannedFixture)) {
  scannedText = fs.readFileSync(scannedFixture, 'utf8').trim();
}
const scannedLines = scannedText
  ? scannedText.split(/\n/).map((l) => l.trim()).filter(Boolean)
  : syncLines;
const scannedEnriched = await enrichImportResultWithOcrSettlement(fakePdf, {
  fileType: 'pdf',
  nativeTextLength: 0,
  rawText: scannedLines.join('\n'),
  cleanedText: scannedLines.join('\n'),
  enterprise: makeOcrEnterprise(scannedLines.slice(0, Math.min(scannedLines.length, 40))),
  extractionMethod: 'ocr',
});
ok(scannedEnriched.ocrAttempted === true, 'scanned CV regression: ocrAttempted true');
ok(scannedEnriched.ocrUsable === true, 'scanned CV regression: ocrUsable true');
const scannedRoute = resolveAutomaticImportRoute(buildEnrichedImportRouteInput(scannedEnriched));
ok(
  scannedRoute.destination !== IMPORT_DECISION_DESTINATION.PASTE,
  'scanned CV regression: usable OCR must not route to paste'
);
ok(
  scannedRoute.destination === IMPORT_DECISION_DESTINATION.RECOVERY ||
    scannedRoute.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'scanned CV regression: routes to recovery or structured_from_ocr'
);

// Non-PDF passthrough
const docx = await enrichImportResultWithOcrSettlement(
  { name: 'cv.docx' },
  { fileType: 'docx', nativeTextLength: 200, ocrAttempted: false }
);
ok(docx.fileType === 'docx', 'non-PDF enrichment passthrough preserves fileType');
ok(docx.ocrAttempted === false, 'non-PDF enrichment does not force ocrAttempted');

if (failed) {
  console.error(`\nOCR SETTLEMENT DECISION CONTRACT QA FAILED (${failed})`);
  process.exit(1);
}
console.log('\nOCR SETTLEMENT DECISION CONTRACT QA OK');
