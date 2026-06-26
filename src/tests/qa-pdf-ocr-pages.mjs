#!/usr/bin/env node
/**
 * Unit tests — PDF page OCR concatenation (no browser).
 */
import { concatPageOcrTexts, PAGE_SEPARATOR } from '../core/extraction/pdf-ocr-pages.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const joined = concatPageOcrTexts(['Page one line', '', '  Page two  ', null]);
ok(joined.includes('Page one line'), 'first page text');
ok(joined.includes('Page two'), 'second page text');
ok(joined.includes(PAGE_SEPARATOR), 'uses page separator');
ok(joined.split(PAGE_SEPARATOR).length === 2, 'two page segments');

process.exit(failed ? 1 : 0);
