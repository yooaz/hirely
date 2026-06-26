#!/usr/bin/env node
/**
 * Failed extraction must not yield placeholder-only resume for render.
 */
import {
  hasRenderableImportText,
  isPlaceholderOnlyResume,
} from '../core/import/import-render-guard.js';
import {
  IMPORT_FALLBACK_LEAD,
  IMPORT_FALLBACK_TITLE,
  IMPORT_OCR_FAILURE_LEAD,
  IMPORT_TIMEOUT_LEAD,
  pasteFallbackMessage,
} from '../core/import/import-status.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(!hasRenderableImportText(''), 'empty raw not renderable');
ok(!hasRenderableImportText('   ', ''), 'whitespace not renderable');
ok(hasRenderableImportText('x'.repeat(20)), '20 chars renderable');
ok(!hasRenderableImportText('x'.repeat(19)), '19 chars not renderable');

const placeholder = {
  identity: { name: NAME_UNCERTAIN_LABEL, title: TITLE_UNCERTAIN_LABEL },
  experiences: [],
  summary: '',
  unsorted: [],
};
ok(isPlaceholderOnlyResume(placeholder), 'uncertain labels only → placeholder CV');
ok(!isPlaceholderOnlyResume({ ...placeholder, experiences: [{ company: 'Acme' }] }), 'with experience not placeholder-only');

const emptyImport = await runHirelyImportFromText('');
ok(!emptyImport.resumeData, 'empty import — no resumeData');

ok(
  IMPORT_FALLBACK_TITLE.includes('Certaines sections'),
  'fallback title',
  IMPORT_FALLBACK_TITLE
);
ok(IMPORT_FALLBACK_LEAD.includes('scan ou une image'), 'fallback lead mentions scan');
ok(pasteFallbackMessage('PDF_OCR_TIMEOUT') === IMPORT_TIMEOUT_LEAD, 'OCR timeout uses timeout lead');
ok(IMPORT_TIMEOUT_LEAD.includes('Collez le texte du CV'), 'timeout lead copy');
ok(pasteFallbackMessage('PDF_TEXT_EMPTY') === IMPORT_OCR_FAILURE_LEAD, 'OCR quality uses OCR failure lead');
ok(IMPORT_OCR_FAILURE_LEAD.includes('Collez le texte du CV'), 'OCR failure lead copy');

console.log(failed ? `\n${failed} failed` : '\nAll no-empty-CV-render checks passed');
process.exit(failed ? 1 : 0);
