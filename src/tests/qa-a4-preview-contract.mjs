#!/usr/bin/env node
/**
 * A4 preview layout contract — CSS + zoom rules (no browser).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const a4Css = readFileSync(join(root, 'src/ui/export/a4-viewport.css'), 'utf8');
const a4Js = readFileSync(join(root, 'src/ui/export/a4-viewport.js'), 'utf8');
const studioCss = readFileSync(join(root, 'src/ui/studio/studio-layout.css'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(a4Js.includes('ZOOM_MODES') && a4Js.includes("FIT: 'fit'"), 'fit mode default zoom');
ok(indexHtml.includes('data-a4-zoom="fit"') && indexHtml.includes('data-a4-zoom="90"') && indexHtml.includes('data-a4-zoom="100"'), 'zoom controls Fit 90% 100%');
ok(a4Js.includes('A4_WIDTH_PX = 794') && a4Js.includes('A4_HEIGHT_PX = 1123'), 'A4 px canvas 794×1123');
ok(/aspect-ratio:\s*210\s*\/\s*297/.test(indexHtml + a4Css), 'A4 aspect ratio locked');
ok(indexHtml.includes('width:794px') && indexHtml.includes('min-height:1123px'), 'preview page uses 794×1123');
ok(indexHtml.includes('overflow-wrap:anywhere'), 'long lines wrap in preview');
ok(indexHtml.includes('#workspace[data-doc-step="edit"] .docFooter{display:none'), 'footer hidden on edit step');
ok(indexHtml.includes('position:static') && indexHtml.includes('#workspace[data-doc-step="export"] .docFooter'), 'export footer not sticky');
ok(!/#workspace\[data-doc-step="export"\][^{]*\{[^}]*position:\s*sticky/.test(indexHtml), 'export footer avoids sticky overlap');
ok(a4Css.includes('overflow-x: hidden'), 'viewport blocks horizontal overflow');
ok(studioCss.includes('overflow: hidden') && studioCss.includes('.studioPreview'), 'preview column scroll contained');
ok(a4Js.includes("transformOrigin = 'top center'"), 'preview centered from top');

if (failed) {
  console.error(`\nqa-a4-preview-contract: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\nqa-a4-preview-contract: all passed\n');
