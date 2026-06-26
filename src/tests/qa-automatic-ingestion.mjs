#!/usr/bin/env node
/**
 * Automatic ingestion — no user-facing parser/OCR choice; engine routes internally.
 * node src/tests/qa-automatic-ingestion.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  isExactTranscriptionMode,
  isStructuredImportMode,
} from '../core/import/exact-transcription-import.js';
import {
  routePdfExtraction,
  PDF_ROUTES,
} from '../core/extraction/pdf-router.js';
import {
  resolveImportDecision,
  resolveAutomaticImportRoute,
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_REASON,
} from '../core/import/import-decision-final.js';
import { buildImportDecisionFromExtracted } from '../core/import/ocr-import-usability.js';

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

const htmlWithoutScripts = indexHtml.replace(/<script[\s\S]*?<\/script>/gi, '');

ok(
  indexHtml.includes('removeImportEngineSelectorFromDom') &&
    indexHtml.includes("document.getElementById('importModeDebugHost')?.remove()"),
  'production init removes import engine selector nodes from DOM'
);
ok(
  indexHtml.includes('function isImportEngineDebugUi'),
  'import engine debug UI gated by ?debug=true'
);
ok(
  /html:not\(\.debug-mode\)\s+#importModeFieldset/.test(indexHtml) &&
    /html:not\(\.debug-mode\)\s+#importModeDebugHost/.test(indexHtml) &&
    /html:not\(\.debug-mode\)\s+#exactTranscriptionToggle/.test(indexHtml),
  'import mode debug host hidden in normal product UI (CSS fallback)'
);
ok(
  /html:not\(\.debug-mode\)\s+#exactTranscriptionView\{display:none!important\}/.test(indexHtml),
  'exact transcription view hidden in normal product UI (CSS)'
);
ok(
  !htmlWithoutScripts.includes('CV structuré (parser)'),
  'parser/OCR choice labels not in static HTML markup'
);
ok(
  !htmlWithoutScripts.includes('name="importMode"'),
  'import mode radios not in static HTML markup'
);
ok(
  !htmlWithoutScripts.includes('Transcription exacte (OCR fidèle)'),
  'OCR/transcription mode label not in static HTML markup'
);
ok(indexHtml.includes('function initUploadUi'), 'index.html initializes upload UI without exposing engine mode');
ok(
  indexHtml.includes('isImportEngineDebugUi') && indexHtml.includes('importModeFieldset'),
  'initUploadUi mounts import mode fieldset only under ?debug=true'
);
ok(
  indexHtml.includes('buildCanonicalImportOptions'),
  'index.html uses buildCanonicalImportOptions for automatic import'
);
ok(
  !/checked\s*\/>\s*Transcription exacte/.test(indexHtml),
  'exact transcription radio is not default-checked in HTML'
);
ok(
  /importMode:'structured'/.test(indexHtml),
  'default state.importMode is structured'
);

ok(!isExactTranscriptionMode({}), 'default upload does not use exact transcription mode');
ok(isExactTranscriptionMode({ exactTranscription: true }), 'exact mode only when explicitly requested');
ok(isExactTranscriptionMode({ mode: 'exact_transcription' }), 'exact mode via mode flag');
ok(isStructuredImportMode({}), 'empty opts default to structured (automatic product path)');

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
const autoOcrText = ocrLines.map((l) => l.cleanedText).join('\n');
ok(autoOcrText.length >= 80, 'automatic OCR fixture meets 80-char policy');
const autoOcrDecision = resolveImportDecision(
  buildImportDecisionFromExtracted(
    {
      fileType: 'pdf',
      rawText: autoOcrText,
      cleanedText: autoOcrText,
      extractionMethod: 'ocr',
      ocrAttempted: true,
      ocrUsable: true,
      resumeData: { identity: { name: 'Yohann Azancot' }, experiences: [] },
      enterprise: { method: 'ocr', lines: ocrLines },
    },
    {}
  )
);
ok(
  autoOcrDecision.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR,
  'OCR without explicit mode routes to structured parser (not user-facing exact)'
);
ok(
  autoOcrDecision.reason === IMPORT_DECISION_REASON.PDF_IMAGE_ONLY ||
    autoOcrDecision.reason === IMPORT_DECISION_REASON.OCR_TEXT_OK ||
    autoOcrDecision.reason === IMPORT_DECISION_REASON.OCR_PARTIAL_USABLE,
  'scanned PDF OCR routes with structured OCR reason'
);

const nativeDocx = resolveAutomaticImportRoute({
  fileType: 'docx',
  nativeTextLength: 0,
  ocrTextLength: 0,
});
ok(
  nativeDocx.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_NATIVE,
  'non-PDF always routes structured_native'
);

import { canonicalImportFromExtracted } from '../core/import/canonical-import.js';

const nativePlan = routePdfExtraction({
  hasSelectableText: true,
  extractionRoute: 'native',
  fileType: 'pdf_text',
  textLayerFound: true,
  nativeCharCount: 1200,
  quality: { usable: true, reason: 'selectable' },
});
ok(nativePlan.route === PDF_ROUTES.NATIVE, 'native PDF → automatic native extraction route');

const ocrPlan = routePdfExtraction({
  hasSelectableText: false,
  extractionRoute: 'ocr',
  fileType: 'pdf_scanned',
  textLayerFound: false,
  nativeCharCount: 12,
  quality: { usable: false, reason: 'scanned' },
});
ok(ocrPlan.route === PDF_ROUTES.OCR, 'scanned PDF → automatic OCR route');
ok(ocrPlan.useFullDocumentOcr === true, 'scanned PDF triggers full-document OCR');

const mockNative = {
  fileType: 'pdf',
  rawText: 'Yohann Azancot\nProduct Designer\nyohann@example.com\nParis',
  cleanedText: 'Yohann Azancot\nProduct Designer\nyohann@example.com\nParis',
  extractionMethod: 'native_pdf',
  enterprise: {
    method: 'native_pdf',
    lines: [
      { text: 'Yohann Azancot', cleanedText: 'Yohann Azancot', source: 'native', page: 1 },
      { text: 'Product Designer', cleanedText: 'Product Designer', source: 'native', page: 1 },
    ],
    pdfExtraction: { fileType: 'pdf_text', route: 'native' },
  },
};
const structuredResult = await canonicalImportFromExtracted(
  { name: 'cv.pdf', type: 'application/pdf', size: 1000 },
  mockNative,
  { mode: 'structured', trusted: true }
);
ok(!structuredResult.parserSkipped, 'automatic structured path runs parser on native PDF');
ok(structuredResult.resumeData != null || structuredResult.importState, 'structured import produces result');

let coreMod;
try {
  coreMod = await import(pathToFileURL(path.join(root, 'src/core/index.js')).href);
} catch (err) {
  console.error('FAIL core boot', err?.message || err);
  failed++;
  coreMod = null;
}
ok(!!coreMod, 'core/index.js boots without missing export errors');
ok(typeof coreMod?.canonicalImportFromFile === 'function', 'canonicalImportFromFile available after boot');

console.log(failed ? `\n${failed} failed` : '\nAUTOMATIC INGESTION QA OK');
process.exit(failed ? 1 : 0);
