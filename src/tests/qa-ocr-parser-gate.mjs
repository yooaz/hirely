#!/usr/bin/env node
/**
 * OCR parser gate — bad OCR must not pass to buildResumeData.
 * node src/tests/qa-ocr-parser-gate.mjs
 */
import {
  evaluateOcrParserGate,
  hasReversedCvHeadings,
  OCR_QUALITY_FAIL_MSG,
} from '../core/extraction/ocr-quality-score.js';
import {
  assessOcrBeforeParser,
  isOcrSourcedImport,
} from '../core/import/ocr-parser-gate.js';
import {
  resolveImportState,
  IMPORT_STATE,
} from '../core/import/import-status.js';

const ok = (c, m) => {
  if (!c) {
    console.error('FAIL', m);
    process.exit(1);
  }
  console.log('OK', m);
};

const goodText = `
PROFILE
WORK EXPERIENCE
Graphic Designer
EDUCATION
LISAA Paris
SKILLS
Photoshop, Illustrator
2018 — 2022
contact@example.com
+33 6 12 34 56 78
`.trim();

const badText = `
ION3IIHIAXI HHOM
NOILY3NQ3
YOLVEISNTN
Buipeoy
`.trim();

const reversedHeadingText = `
ECNEIREPXE
NOITACUDE
contact noise only
`.trim();

ok(isOcrSourcedImport({ method: 'ocr' }), 'ocr method detected');
ok(!isOcrSourcedImport({ method: 'docx-upload' }), 'docx not ocr');
ok(
  assessOcrBeforeParser(goodText, { method: 'paste' }).skipped,
  'paste skips gate'
);

const goodGate = evaluateOcrParserGate(goodText);
const badGate = evaluateOcrParserGate(badText);
const revGate = evaluateOcrParserGate(reversedHeadingText);

ok(goodGate.pass, `good OCR passes gate (${goodGate.qualityScore})`);
ok(!badGate.pass, `bad OCR blocked (${badGate.qualityScore})`);
ok(!revGate.pass, 'reversed headings blocked');
ok(hasReversedCvHeadings('ECNEIREPXE\nDesigner'), 'reversed heading detector');
ok(
  assessOcrBeforeParser(badText, { method: 'ocr', fileType: 'pdf_scanned' }).pass === false,
  'assess blocks bad OCR import'
);
ok(
  assessOcrBeforeParser(goodText, { method: 'ocr', fileType: 'pdf_scanned' }).pass,
  'assess allows good OCR import'
);
ok(
  OCR_QUALITY_FAIL_MSG.includes('mal orienté'),
  'user-facing OCR fail message'
);
ok(
  resolveImportState('', { errors: [OCR_QUALITY_FAIL_MSG] }) === IMPORT_STATE.IMPORT_NEEDS_PASTE,
  'OCR quality error maps to NEEDS_PASTE'
);

console.log('\nBad gate reasons:', badGate.reasons.slice(0, 5).join('; '));
