#!/usr/bin/env node
/**
 * QA — P1 CV Normalizer
 */
import {
  normalizeCvDocument,
  isPageNumberLine,
  removePageNumberLines,
  CV_NORMALIZER_V1,
} from '../core/parsing/cv-normalizer.js';

let pass = 0;
let fail = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const OCR_SAMPLE = `
Page 1 of 3
JANE DOE
jane . doe @ gmail . com
+41 79 123 45 67
EXPERIENCE
2019-2022 — 2019-2022
Senior Designer at Studio Impressions
Page 2 of 3
Senior Designer at Studio Impressions
||| garbage |||
2019-2022 — 2019-2022
`;

const norm = normalizeCvDocument(OCR_SAMPLE, { ocr: true, extractionMethod: 'pdf_ocr' });

assert('version', norm.version === CV_NORMALIZER_V1);
assert('removes page numbers', !norm.text.match(/page\s+\d/i));
assert('removes duplicate experience line', (norm.text.match(/Senior Designer/gi) || []).length === 1);
assert('normalizes email spacing', norm.text.includes('jane.doe@gmail.com'));
assert('normalizes phone', /\+41791234567|\+41\s*79\s*123\s*45\s*67/.test(norm.text));
assert('dedupes date ranges', !norm.text.includes('2019-2022 — 2019-2022'));
assert('drops garbage line', !norm.text.includes('|||'));
assert('preserves raw archive', norm.rawText.includes('Page 1 of 3'));
assert('stats populated', norm.stats.inputLines > 0 && norm.stats.outputLines > 0);

assert('isPageNumberLine 2/3', isPageNumberLine('2 / 3'));
assert('isPageNumberLine page 1', isPageNumberLine('Page 1'));
assert('removePageNumberLines', removePageNumberLines(['Jane Doe', '2/3', 'Experience']).length === 2);

const empty = normalizeCvDocument('', {});
assert('empty input', empty.text === '' && empty.stats.inputChars === 0);

console.log(`\nqa-cv-normalizer: ${fail === 0 ? 'PASS' : 'FAIL'} (${pass} pass / ${fail} fail)`);
process.exit(fail > 0 ? 1 : 0);
