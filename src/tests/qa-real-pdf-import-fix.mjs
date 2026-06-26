#!/usr/bin/env node
/**
 * H16 — Real PDF import fix: native routing, 8s paste hint, 20s hard fallback.
 */
import { classifyPdfForExtraction } from '../core/extraction/file-type-detect.js';
import { planPdfExtraction } from '../core/extraction/pdf-router.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_HARD_FALLBACK_MS,
  OCR_ANALYZING_MSG,
  OCR_PARTIAL_REVIEW_MSG,
  OCR_TIMEOUT_USER_MSG,
  OCR_UX_EARLY_PASTE_MS,
} from '../core/extraction/pdf-extraction-timeout.js';
import { OCR_ABSOLUTE_MAX_MS, OCR_UI_SOFT_TIMEOUT_MS } from '../core/extraction/pdf-ocr-run.js';
import {
  IMPORT_FALLBACK_TITLE,
  pasteFallbackMessage,
  IMPORT_STATUS,
  resolveImportStatus,
} from '../core/import/import-status.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const docSrc = readFileSync(join(__dir, '../core/extraction/document-extract.js'), 'utf8');

let failed = 0;
function ok(cond, id, detail = '') {
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

ok(OCR_UX_EARLY_PASTE_MS === 8000, 'ocr_early_paste_8s', String(OCR_UX_EARLY_PASTE_MS));
ok(OCR_UI_SOFT_TIMEOUT_MS === OCR_UX_EARLY_PASTE_MS, 'ui_soft_matches_early_paste');
ok(PDF_EXTRACTION_MAX_MS === 20000, 'pdf_extraction_max_20s', String(PDF_EXTRACTION_MAX_MS));
ok(OCR_HARD_FALLBACK_MS === PDF_EXTRACTION_MAX_MS, 'ocr_hard_fallback_20s', String(OCR_HARD_FALLBACK_MS));
ok(OCR_ABSOLUTE_MAX_MS === PDF_EXTRACTION_MAX_MS, 'ocr_absolute_max_20s', String(OCR_ABSOLUTE_MAX_MS));
ok(OCR_ABSOLUTE_MAX_MS > OCR_UX_EARLY_PASTE_MS, 'absolute_gt_early_paste');
ok(OCR_TIMEOUT_USER_MSG === OCR_PARTIAL_REVIEW_MSG, 'timeout_user_msg_soft');
ok(!OCR_TIMEOUT_USER_MSG.includes('Lecture automatique impossible'), 'no_terminal_phrase');
ok(OCR_ANALYZING_MSG === 'Analyse en cours...', 'analyzing_msg');
ok(
  IMPORT_FALLBACK_TITLE.includes('Certaines sections'),
  'fallback_title_soft',
  IMPORT_FALLBACK_TITLE
);
ok(
  pasteFallbackMessage(IMPORT_STATUS.PDF_OCR_TIMEOUT).includes('Certaines sections'),
  'paste_fallback_soft'
);
const pdfFn = docSrc.match(/export async function extractPdfDocument\([\s\S]*?\n\}/);
ok(!!(pdfFn && !/ensureTesseract/.test(pdfFn[0])), 'no_tesseract_preload_before_native');

const nativePages = [
  {
    page: 1,
    charCount: 420,
    usable: true,
    lines: [{ text: 'Alex Martin\nSenior Designer\nalex@example.com' }],
  },
];
const nativeText = nativePages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');
const nativeClass = classifyPdfForExtraction(nativePages, nativeText);
ok(nativeClass.hasSelectableText === true, 'selectable_text_detected');
const nativePlan = planPdfExtraction(nativePages, nativeText);
ok(nativePlan.plan.ocrAllowed === false, 'native_never_ocr', nativePlan.plan.reason);
ok(nativePlan.plan.useFullDocumentOcr === false, 'native_no_full_ocr');

const partialStatus = resolveImportStatus('x'.repeat(40), {
  errors: ['OCR_TIMEOUT PDF_EXTRACTION_TIMEOUT'],
});
ok(
  partialStatus === IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
  'timeout_with_text_partial',
  partialStatus
);

console.log(failed ? `\n${failed} failed` : '\nH16 real PDF import fix checks passed');
process.exit(failed ? 1 : 0);
