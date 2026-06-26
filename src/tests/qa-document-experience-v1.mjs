#!/usr/bin/env node
/**
 * Document Experience V1 QA
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const CSS_PATH = join(ROOT, 'src/ui/document-experience-v1.css');
const INDEX_PATH = join(ROOT, 'index.html');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function main() {
  ok(readFileSync(CSS_PATH, 'utf8').length > 200, 'document-experience-v1.css exists');
  const css = readFileSync(CSS_PATH, 'utf8');
  const index = readFileSync(INDEX_PATH, 'utf8');

  ok(index.includes('document-experience-v1.css'), 'index.html links document-experience-v1.css');
  const v3Idx = index.indexOf('design-system-v3.css');
  const dexIdx = index.indexOf('document-experience-v1.css');
  ok(v3Idx > -1 && dexIdx > v3Idx, 'DEX loads after design-system-v3');

  const rules = [
    ['--dex-canvas', 'canvas token'],
    ['--dex-float-shadow', 'floating shadow'],
    ['html.dex-document', 'document mode class'],
    ['position: fixed', 'floating controls'],
    ['backdrop-filter', 'glass floats'],
    ['cvDocWrap--keynoteIn', 'keynote transition'],
    ['min-height: calc(100vh', 'large canvas'],
    ['prefers-reduced-motion', 'motion respect'],
    ['.wsDocNav', 'floating toolbar'],
    ['.cvExportBar', 'floating export dock'],
    ['.wsInsights', 'floating inspector'],
    ['.wsImport', 'floating import card'],
    ['@keyframes dexCanvasIn', 'canvas entrance'],
  ];
  for (const [needle, label] of rules) ok(css.includes(needle), label);

  ok(index.includes("classList.toggle('dex-document'"), 'dex-document toggle in renderProgressNav');
  ok(
    /previewOn=ready&&\(step==='import'\|\|step==='edit'\|\|step==='style'\|\|step==='export'\)/.test(
      index
    ),
    'CV preview on all ready steps including import'
  );

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nDOCUMENT_EXPERIENCE_V1 QA: PASS');
}

main();
