#!/usr/bin/env node
/**
 * UX P2 — A4 fit mode contract (static source checks + zoom math).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { A4_WIDTH_PX, A4_HEIGHT_PX } from '../core/export/pdf-export-config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const a4Js = readFileSync(join(root, 'src/ui/export/a4-viewport.js'), 'utf8');
const a4Css = readFileSync(join(root, 'src/ui/export/a4-viewport.css'), 'utf8');
const pagesCss = readFileSync(join(root, 'src/ui/export/cv-a4-pages.css'), 'utf8');
const studioCss = readFileSync(join(root, 'src/ui/studio/studio-layout.css'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function computeFitZoom(containerW, containerH, padX = 32, padY = 32) {
  const availW = Math.max(100, containerW - padX);
  const availH = Math.max(120, containerH - padY);
  const scaleW = availW / A4_WIDTH_PX;
  const scaleH = availH / A4_HEIGHT_PX;
  return Math.min(scaleW, scaleH, 1);
}

ok(a4Js.includes('ZOOM_MODES') && a4Js.includes("FIT: 'fit'"), 'zoom modes defined');
ok(a4Js.includes('setZoomMode') && a4Js.includes('getZoomMode'), 'zoom mode API');
ok(a4Js.includes('scaleH = availH / A4_HEIGHT_PX'), 'fit uses first-page height for scale');
ok(a4Js.includes('suspendScaleForExport') && a4Js.includes('restoreScaleAfterExport'), 'export scale suspend');
ok(indexHtml.includes('id="a4ZoomBar"'), 'zoom toolbar in DOM');
ok(indexHtml.includes('data-a4-zoom="fit"'), 'Fit control');
ok(indexHtml.includes('data-a4-zoom="90"'), '90% control');
ok(indexHtml.includes('data-a4-zoom="100"'), '100% control');
ok(indexHtml.includes('renderA4ZoomBar'), 'zoom bar chrome wired');
ok(a4Css.includes('.a4ZoomBar'), 'zoom bar styles');
ok(pagesCss.includes('--cv-a4-gap: 24px'), 'stacked page gap 24px');
ok(pagesCss.includes('.cvA4Sheet:not(:first-child)::before'), 'page labels on continuation sheets');
ok(/overflow-x:\s*hidden/.test(a4Css + studioCss + indexHtml), 'horizontal overflow blocked');
ok(a4Js.includes("transformOrigin = 'top center'"), 'preview centered from top');

const desktopZoom = computeFitZoom(1280, 720);
const visualH = A4_HEIGHT_PX * desktopZoom;
ok(visualH <= 720 - 32, `desktop 1280×720 shows full first page (${Math.round(visualH)}px tall)`);

const visualW = A4_WIDTH_PX * desktopZoom;
ok(visualW <= 1280 - 32, `no horizontal overflow at 1280px (${Math.round(visualW)}px wide)`);

if (failed) {
  console.error(`\nqa-a4-fit-mode: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\nqa-a4-fit-mode: all passed\n');
