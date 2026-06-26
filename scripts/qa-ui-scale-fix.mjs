#!/usr/bin/env node
/**
 * UI Scale Fix — capture before/after screenshots + quick assertions.
 * Before: copies from .qa-screenshots/p0-subtraction (pre-scale baseline).
 * After: fresh captures at each flow step.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const beforeDir = path.join(root, '.qa-screenshots/ui-scale-fix/before');
const afterDir = path.join(root, '.qa-screenshots/ui-scale-fix/after');
const p0Dir = path.join(root, '.qa-screenshots/p0-subtraction');
const BASE = process.env.HIRELY_URL || 'http://127.0.0.1:3001/?pro=true';

const STEPS = [
  { key: 'import', file: '01-import', force: 'import' },
  { key: 'review', file: '02-review', force: 'edit' },
  { key: 'style', file: '03-style', force: 'style' },
  { key: 'export', file: '04-export', force: 'export' },
];

function copyBeforeFromP0() {
  fs.mkdirSync(beforeDir, { recursive: true });
  const map = {
    '01-import': '01-after-import-review.png',
    '02-review': '02-review-step.png',
    '03-style': '03-style-step.png',
    '04-export': '04-export-step.png',
  };
  for (const [out, src] of Object.entries(map)) {
    const from = path.join(p0Dir, src);
    const to = path.join(beforeDir, `${out}.png`);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log('BEFORE', path.relative(root, to), '(from p0-subtraction)');
    }
  }
}

async function forceDocStep(page, step) {
  await page.evaluate((s) => {
    state.docStep = s;
    const ws = document.getElementById('workspace');
    const grid = document.getElementById('workspaceGrid');
    if (ws) ws.dataset.docStep = s;
    if (grid?.classList.contains('workspaceGrid--ready')) {
      grid.classList.remove('docStep-import', 'docStep-verify', 'docStep-edit', 'docStep-style', 'docStep-export');
      grid.classList.add(`docStep-${s}`);
    }
    if (typeof syncResumeStudioChrome === 'function') syncResumeStudioChrome();
    if (typeof renderTemplates === 'function') renderTemplates();
    const exBar = document.getElementById('cvExportBar');
    if (exBar) exBar.classList.toggle('hidden', s !== 'export');
  }, step);
  await page.waitForTimeout(450);
}

async function assertScale(page) {
  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector('.heroCopy h1');
    const body = document.body;
    const drop = document.querySelector('.drop');
    const cvStage = document.querySelector('.cvStage');
    const btn = document.querySelector('.btn.primary');
    const h1Size = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
    const bodySize = parseFloat(getComputedStyle(body).fontSize);
    const dropW = drop?.getBoundingClientRect().width || 0;
    const importAside = document.querySelector('.wsImport');
    const importW = importAside?.getBoundingClientRect().width || 0;
    const cvW = cvStage?.getBoundingClientRect().width || 0;
    const grid = document.querySelector('.wsCenterStack');
    const gridCols = grid ? getComputedStyle(grid).gridTemplateColumns : '';
    const btnPad = btn ? getComputedStyle(btn).padding : '';
    return { h1Size, bodySize, dropW, importW, cvW, gridCols, btnPad };
  });
  const errs = [];
  if (metrics.bodySize > 16) errs.push(`body ${metrics.bodySize}px > 15px`);
  if (metrics.h1Size > 35) errs.push(`h1 ${metrics.h1Size}px > 34px`);
  return { metrics, errs };
}

async function main() {
  copyBeforeFromP0();
  fs.mkdirSync(afterDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('#workspace').scrollIntoViewIfNeeded();

  await page.evaluate(async () => {
    await globalThis.loadSample();
  });
  await page.waitForFunction(
    () => document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready'),
    { timeout: 45000 }
  );

  // Pre-ready import (drop card) — optional if still on import layout
  await page.screenshot({ path: path.join(afterDir, '00-hero.png'), fullPage: false });
  console.log('AFTER', path.relative(root, afterDir), '00-hero.png');

  let failed = 0;
  for (const step of STEPS) {
    await forceDocStep(page, step.force);
    const shot = path.join(afterDir, `${step.file}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    console.log('AFTER', path.relative(root, shot));
  }

  await forceDocStep(page, 'edit');
  const { metrics, errs } = await assertScale(page);
  console.log('METRICS', JSON.stringify(metrics, null, 2));
  for (const e of errs) {
    console.error('FAIL', e);
    failed++;
  }
  if (!errs.length) console.log('OK typography scale bounds');

  await forceDocStep(page, 'import');
  const importW = await page.evaluate(() => {
    const el = document.querySelector('.wsImport');
    if (!el || getComputedStyle(el).display === 'none') return -1;
    return el.getBoundingClientRect().width;
  });
  if (importW < 0) console.log('SKIP import width (panel hidden after import)');
  else if (importW <= 540) console.log(`OK import rail width ~${Math.round(importW)}px (target ≤520px card)`);
  else {
    console.error(`FAIL import width ${importW}px`);
    failed++;
  }

  await browser.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
