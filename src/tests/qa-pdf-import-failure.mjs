#!/usr/bin/env node
/**
 * PDF import failure — empty extraction must not build fallback CV or call parser.
 */
import {
  IMPORT_STATUS,
  IMPORT_FALLBACK_TITLE,
  resolveImportStatus,
  importStatusAllowsParser,
  importStatusRequiresPasteFallback,
  pasteFallbackMessage,
} from '../core/import/import-status.js';
import { runHirelyImportFromFile, runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(
  resolveImportStatus('', { errors: ['OCR_TIMEOUT'] }) === IMPORT_STATUS.PDF_OCR_TIMEOUT,
  'OCR timeout → PDF_OCR_TIMEOUT'
);
ok(importStatusRequiresPasteFallback(IMPORT_STATUS.PDF_TEXT_EMPTY), 'PDF_TEXT_EMPTY needs fallback');
ok(!importStatusAllowsParser(IMPORT_STATUS.PASTE_FALLBACK_REQUIRED), 'paste fallback blocks parser');
ok(
  pasteFallbackMessage(IMPORT_STATUS.PDF_OCR_TIMEOUT).includes('Collez le texte du CV'),
  'timeout message uses paste/DOCX fallback lead'
);
ok(
  IMPORT_FALLBACK_TITLE.includes('Certaines sections'),
  'fallback title copy',
  IMPORT_FALLBACK_TITLE
);

const emptyText = await runHirelyImportFromText('   ');
ok(emptyText.importStatus === IMPORT_STATUS.PASTE_FALLBACK_REQUIRED, 'empty text import status');
ok(!emptyText.resumeData, 'empty text — no resumeData');
ok(!emptyText.structuredResume, 'empty text — no structuredResume');

const fakeFile = { name: 'empty.pdf', type: 'application/pdf', size: 12 };
const fromFile = await runHirelyImportFromFile(fakeFile);
ok(fromFile.errors.length > 0, 'file import records error');
ok(fromFile.importStatus === IMPORT_STATUS.PASTE_FALLBACK_REQUIRED, 'node file import → paste fallback status');
ok(
  !fromFile.resumeData || fromFile.importStatus !== IMPORT_STATUS.IMPORT_SUCCESS,
  'failed file — no success resume'
);
if (fromFile.resumeData?.identity?.name) {
  ok(
    fromFile.resumeData.identity.name !== NAME_UNCERTAIN_LABEL,
    'failed file must not use Nom à confirmer fallback'
  );
}

console.log(failed ? `\n${failed} failed` : '\nAll PDF import failure checks passed');
process.exit(failed ? 1 : 0);
