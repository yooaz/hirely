#!/usr/bin/env node
/**
 * P0 — Real PDF import reliability: native-first, OCR only if empty, 20s paste fallback.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classifyPdfForExtraction } from '../core/extraction/file-type-detect.js';
import { planPdfExtraction } from '../core/extraction/pdf-router.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_UX_EARLY_PASTE_MS,
  OCR_PARTIAL_REVIEW_MSG,
} from '../core/extraction/pdf-extraction-timeout.js';
import {
  OCR_ABSOLUTE_MAX_MS,
  OCR_UI_SOFT_TIMEOUT_MS,
} from '../core/extraction/pdf-ocr-run.js';
import {
  IMPORT_STATUS,
  IMPORT_STATE,
  resolveImportStatus,
} from '../core/import/import-status.js';
import {
  markPdfOcrTimedOut,
  clearPdfOcrTimedOut,
  isPdfOcrTimedOut,
} from '../core/extraction/pdf-ocr-cache-store.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '../..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

let failed = 0;
function ok(cond, id, detail = '') {
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

const docSrc = read('src/core/extraction/document-extract.js');
const entSrc = read('src/core/extraction/enterprise-engine.js');
const extSrc = read('src/core/extraction/extract-file.js');
const cacheSrc = read('src/core/extraction/pdf-ocr-cache-store.js');
const canonSrc = read('src/core/import/canonical-import.js');
const sessionSrc = read('src/core/extraction/extraction-session.js');
const indexSrc = read('index.html');

ok(PDF_EXTRACTION_MAX_MS === 20000, 'budget_20s', String(PDF_EXTRACTION_MAX_MS));
ok(OCR_ABSOLUTE_MAX_MS === PDF_EXTRACTION_MAX_MS, 'ocr_absolute_matches_budget');
ok(OCR_UI_SOFT_TIMEOUT_MS === OCR_UX_EARLY_PASTE_MS, 'early_paste_8s', String(OCR_UX_EARLY_PASTE_MS));

const pdfFn = docSrc.match(/export async function extractPdfDocument\([\s\S]*?\n\}/);
ok(!!(pdfFn && !/ensureTesseract/.test(pdfFn[0])), 'native_first_no_tesseract_preload');

const nativeText = [
  'Alex Martin',
  'Senior Designer',
  'alex@example.com',
  'Experience',
  'Lead Designer — Studio Azur — 2019 – Present',
  'Directed campaigns for global lifestyle brands.',
  'Education',
  'MA Design — ENSAD — 2014',
  'Skills',
  'Figma, Illustrator, InDesign, Photoshop',
  'x'.repeat(140),
].join('\n');
const nativePages = [
  {
    page: 1,
    charCount: nativeText.length,
    usable: true,
    lines: [{ text: nativeText }],
  },
];
ok(classifyPdfForExtraction(nativePages, nativeText).hasSelectableText === true, 'selectable_detected');
const nativePlan = planPdfExtraction(nativePages, nativeText);
ok(nativePlan.plan.ocrAllowed === false, 'strong_native_no_ocr', nativePlan.plan.reason);
ok(nativePlan.plan.useFullDocumentOcr === false, 'selectable_no_full_ocr');

const weakNativeText = 'Alex Martin\nalex@example.com';
const weakNativePages = [
  {
    page: 1,
    charCount: weakNativeText.length,
    usable: true,
    lines: [{ text: weakNativeText }],
  },
];
const weakPlan = planPdfExtraction(weakNativePages, weakNativeText);
ok(weakPlan.plan.ocrAllowed === true, 'weak_native_ocr_supplement', weakPlan.plan.reason);
ok(weakPlan.plan.ocrMode === 'supplement', 'weak_native_supplement_mode');

ok(/setLastNativePdfProbe/.test(entSrc), 'native_probe_stash');
ok(/native_probe_before_ocr/.test(entSrc), 'native_probe_before_ocr');
ok(!/console\.error\('HIRELY PDF OCR failed'/.test(entSrc), 'no_console_error_ocr_fail');
ok(/hirelyProductLog\('OCR_TIMEOUT'/.test(entSrc), 'enterprise_ocr_timeout_product_log');

ok(/peekLastNativePdfProbe/.test(extSrc), 'extract_uses_native_probe');
ok(/markPdfOcrTimedOut/.test(extSrc), 'extract_marks_ocr_timeout');
ok(/OCR_TIMEOUT_PASTE_FALLBACK/.test(extSrc), 'timeout_paste_fallback_path');
ok(
  /importStatus:\s*IMPORT_STATUS\.PDF_OCR_TIMEOUT[\s\S]*errors:\s*\[\]/.test(extSrc),
  'timeout_paste_no_errors_array'
);

ok(/OCR_SKIPPED_AFTER_TIMEOUT/.test(cacheSrc), 'cache_skips_after_timeout');
ok(/clearPdfOcrTimedOut/.test(cacheSrc), 'cache_clears_on_user_retry');
ok(/markPdfOcrTimedOut/.test(cacheSrc), 'cache_marks_timeout');

const fakeFile = { name: 'cv.pdf', size: 1000, lastModified: 1 };
clearPdfOcrTimedOut(fakeFile);
ok(!isPdfOcrTimedOut(fakeFile), 'not_timed_out_initially');
markPdfOcrTimedOut(fakeFile);
ok(isPdfOcrTimedOut(fakeFile), 'timed_out_marked');
clearPdfOcrTimedOut(fakeFile);
ok(!isPdfOcrTimedOut(fakeFile), 'timed_out_cleared');

ok(/setLastNativePdfProbe/.test(sessionSrc), 'session_native_probe_api');

ok(
  !/console\.error\('EXTRACT_TEXT_FAILED'[\s\S]*OCR_TIMEOUT/.test(canonSrc) ||
    /ocrTimedOut/.test(canonSrc),
  'canonical_no_error_log_on_timeout'
);
ok(/ocrTimedOut/.test(canonSrc), 'canonical_timeout_branch');

ok(
  resolveImportStatus('', { errors: ['OCR_TIMEOUT PDF_EXTRACTION_TIMEOUT'] }) ===
    IMPORT_STATUS.PDF_OCR_TIMEOUT,
  'timeout_empty_needs_paste',
  IMPORT_STATUS.PDF_OCR_TIMEOUT
);
ok(
  resolveImportStatus('x'.repeat(40), { errors: ['OCR_TIMEOUT'] }) ===
    IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
  'timeout_with_text_partial'
);

ok(/triggerPdfOcrFullFallback/.test(indexSrc), 'ui_20s_full_fallback');
ok(/showImportPasteFallback[\s\S]*silentLog:true/.test(indexSrc), 'ui_silent_paste_fallback');
ok(OCR_PARTIAL_REVIEW_MSG.includes('Certaines sections'), 'user_friendly_timeout_copy');

console.log(failed ? `\n${failed} failed` : '\nReal PDF import reliability checks passed');
process.exit(failed ? 1 : 0);
