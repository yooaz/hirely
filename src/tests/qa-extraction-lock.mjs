#!/usr/bin/env node
/**
 * EXTRACTION_LOCK — OCR gated when text length ≥ 500 while lock is on.
 */
import {
  EXTRACTION_LOCK,
  EXTRACTION_LOCK_OCR_MIN_CHARS,
  isExtractionLocked,
  shouldRunOcrForTextLength,
} from '../core/extraction/extraction-lock.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(EXTRACTION_LOCK === true, 'EXTRACTION_LOCK defaults true');
ok(EXTRACTION_LOCK_OCR_MIN_CHARS === 500, 'threshold is 500');
ok(isExtractionLocked() === true, 'lock active by default');
ok(shouldRunOcrForTextLength(0) === true, 'OCR allowed when no text');
ok(shouldRunOcrForTextLength(499) === true, 'OCR allowed below threshold');
ok(shouldRunOcrForTextLength(500) === false, 'OCR blocked at threshold');
ok(shouldRunOcrForTextLength(1200) === false, 'OCR blocked at working metrics');

const prev = globalThis.HIRELY_EXTRACTION_LOCK;
globalThis.HIRELY_EXTRACTION_LOCK = false;
ok(isExtractionLocked() === false, 'HIRELY_EXTRACTION_LOCK=false disables lock');
ok(shouldRunOcrForTextLength(1200) === true, 'OCR allowed when lock off');
globalThis.HIRELY_EXTRACTION_LOCK = prev;

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nqa-extraction-lock: all passed');
