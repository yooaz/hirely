#!/usr/bin/env node
/**
 * OCR timeout race — 20s hard ceiling; progressive UX at 3/5/8s.
 */
import {
  OCR_UI_SOFT_TIMEOUT_MS,
  OCR_HARD_TIMEOUT_MS,
  OCR_TIMEOUT_GRACE_MS,
  OCR_ABSOLUTE_MAX_MS,
  OCR_SLOW_HINT_MS,
} from '../core/extraction/pdf-ocr-run.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_UX_PROGRESS_MS,
  OCR_UX_PATIENCE_MS,
  OCR_UX_EARLY_PASTE_MS,
  OCR_ROTATION_TRIAL_MAX_MS,
  OCR_ROTATION_MAX,
} from '../core/extraction/pdf-extraction-timeout.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beginImportRun, isImportRunCurrent, createImportRunId } from '../core/import/import-run-guard.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ocrRunSrc = readFileSync(
  join(__dir, '../core/extraction/pdf-ocr-run.js'),
  'utf8'
);
const rotationSrc = readFileSync(
  join(__dir, '../core/extraction/ocr-rotation-select.js'),
  'utf8'
);

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(OCR_ABSOLUTE_MAX_MS >= 20000, `absolute max ${OCR_ABSOLUTE_MAX_MS}ms`);
ok(PDF_EXTRACTION_MAX_MS >= 20000, `PDF extraction budget ${PDF_EXTRACTION_MAX_MS}ms`);
ok(OCR_UX_PROGRESS_MS === 3000, 'progress hint at 3s');
ok(OCR_UX_PATIENCE_MS === 5000, 'patience hint at 5s');
ok(OCR_UX_EARLY_PASTE_MS === 8000, 'early paste at 8s');
ok(OCR_SLOW_HINT_MS === OCR_UX_PATIENCE_MS, 'slow hint aligned with patience');
ok(OCR_UI_SOFT_TIMEOUT_MS === OCR_UX_EARLY_PASTE_MS, 'UI soft at early paste');
ok(OCR_ROTATION_TRIAL_MAX_MS === 8000, 'rotation trial max 8s');
ok(OCR_ROTATION_MAX === 4, 'max 4 rotations');
ok(OCR_UI_SOFT_TIMEOUT_MS <= OCR_ABSOLUTE_MAX_MS, 'UI soft within absolute max');
ok(OCR_HARD_TIMEOUT_MS <= OCR_ABSOLUTE_MAX_MS, 'advisory hard within absolute max');
ok(OCR_TIMEOUT_GRACE_MS === 0, 'no grace wait after absolute timeout');
ok(
  /OCR_TIMEOUT_IGNORED_BECAUSE_TEXT_EXISTS/.test(ocrRunSrc),
  'timeout ignored when pass text exists'
);
ok(/OCR_SUCCESS_RETURNED/.test(ocrRunSrc), 'logs OCR_SUCCESS_RETURNED');
ok(/OCR_PASS_TEXT_CAPTURED/.test(ocrRunSrc), 'captures each pass with text');
ok(/hirely:ocr-progress/.test(ocrRunSrc), 'dispatches OCR progress event');
ok(/hirely:ocr-early-paste/.test(ocrRunSrc), 'dispatches early paste event');
ok(/runPdfOcrReturnOnFirstPassText|early-pass/.test(ocrRunSrc), 'returns on first pass with text');
ok(/runOcrPass/.test(ocrRunSrc), 'uses runOcrPass for per-pass capture');
ok(
  !/OCR_FALLBACK_SHOWN.*ui-soft/.test(ocrRunSrc) &&
    !/reject\(Object\.assign\(new Error\('OCR_TIMEOUT'\)/.test(ocrRunSrc),
  'soft timeout never rejects or shows empty fallback'
);
ok(
  !/Promise\.race\(\[\s*workPromise,\s*new Promise\(\(_, reject\)/.test(
    ocrRunSrc.replace(/\s/g, '')
  ),
  'no soft Promise.race reject against workPromise'
);
ok(!/OCR_TIMEOUT_GRACE_MS\)/.test(ocrRunSrc), 'no grace-period wait on absolute timeout');
ok(/OCR_ROTATION_EARLY_STOP/.test(rotationSrc), 'rotation stops early on good score');
ok(/withRotationTrialTimeout/.test(rotationSrc), 'rotation trials use per-trial timeout');
ok(!/VARIANT_RETRY/.test(rotationSrc), 'no extra preprocess variant retries');

const r1 = beginImportRun();
const r2 = beginImportRun();
ok(typeof r1 === 'string' && r1.includes('-'), 'import run id is string token');
ok(isImportRunCurrent(r2) && !isImportRunCurrent(r1), 'import run guard — latest run only');
ok(createImportRunId() !== createImportRunId(), 'import run ids are unique');

console.log(failed ? `\n${failed} failed` : '\nOCR timeout race OK');
process.exit(failed ? 1 : 0);
