#!/usr/bin/env node
/**
 * Product recovery acceptance — A4 preview, score panel, clean CV, no debug UI.
 * node src/tests/qa-product-recovery.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { startQaStaticServer } from '../../tests/lib/qa-static-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/product-recovery');
fs.mkdirSync(outDir, { recursive: true });

const FIXTURE = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

async function main() {
  const port = 3700 + Math.floor(Math.random() * 200);
  const server = startQaStaticServer(root);
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForFunction(
    () => window.__hirelyCoreReady === true && typeof window.HirelyParse?.ingestCvText === 'function',
    null,
    { timeout: 120000 }
  );

  const text = fs.readFileSync(FIXTURE, 'utf8');
  await page.evaluate(async (t) => {
    await window.HirelyParse.ingestCvText(t, { silent: true, force: true, confirmed: true, trusted: true });
    if (typeof renderMetrics === 'function') renderMetrics();
    if (typeof setDocStep === 'function') setDocStep('edit');
    if (typeof syncResumeStudioChrome === 'function') syncResumeStudioChrome();
  }, text);

  await page.waitForFunction(
    () => {
      const doc = document.querySelector('#cvDoc');
      return doc && doc.classList.contains('cv--live') && doc.innerHTML.length > 200;
    },
    { timeout: 120000 }
  );

  await page.locator('.hirelyProgressBtn[data-doc-step="edit"]').click().catch(() => {});
  await page.waitForTimeout(1200);

  await page.waitForFunction(
    () => {
      const s = document.querySelector('#studioScore')?.textContent?.trim();
      return s && s !== '—';
    },
    { timeout: 15000 }
  );

  await page.locator('#cvDoc').screenshot({ path: path.join(outDir, 'after-studio.png') });

  await page.waitForFunction(
    () => document.querySelector('#cvDoc.cv--a4 .cvA4Sheet'),
    { timeout: 15000 }
  );

  const checks = await page.evaluate(() => {
    const cv = document.querySelector('#cvDoc');
    const sheet = document.querySelector('#cvDoc .cvA4Sheet');
    const style = sheet ? getComputedStyle(sheet) : cv ? getComputedStyle(cv) : null;
    const w = sheet ? sheet.offsetWidth : cv ? cv.offsetWidth : 0;
    const h = sheet ? sheet.offsetHeight : cv ? cv.offsetHeight : 0;
    const cssW = style ? parseFloat(style.width) : 0;
    const cssH = style ? parseFloat(style.height) : 0;
    const pageCount = document.querySelectorAll('#cvDoc .cvA4Sheet').length;
    const stack = document.querySelector('#cvDoc .cvA4Stack');
    const overflowSheets = [...document.querySelectorAll('#cvDoc .cvA4Sheet')].filter((s) => {
      const inner = s.querySelector('.cvInner');
      return inner && inner.scrollHeight > s.clientHeight + 2;
    }).length;
    const scoreVisible = !!document.querySelector('#studioScorePanel #studioScore');
    const scoreText = document.querySelector('#studioScore')?.textContent?.trim() || '';
    const checklistItems = document.querySelectorAll('#studioAtsChecklist .atsCheckItem').length;
    const metricRows = document.querySelectorAll('#studioMetrics .metric').length;
    const breakdownRows = document.querySelectorAll('#studioMetrics .atsBreakdownRow').length;
    const breakdownSample = document.querySelector('#studioMetrics .atsBreakdownRow .metricRow span:last-child')?.textContent?.trim() || '';
    const panelTitle = document.querySelector('#studioScorePanel h3')?.textContent?.trim() || '';
    const classifyInCv = document.querySelectorAll('#cvDoc .cvExpEntry--toClassify, #cvDoc .cvSection--toClassify').length;
    const pipelineHidden = getComputedStyle(document.querySelector('#pipelineReportPanel') || document.body).display === 'none' ||
      !document.querySelector('#pipelineReportPanel') ||
      document.querySelector('#pipelineReportPanel')?.classList.contains('hidden');
    const debugPanel = document.querySelector('.hirelyDebugPanel');
    const debugHidden = !debugPanel || getComputedStyle(debugPanel).display === 'none';
    const nameText = document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '';
    const badName = /^(ben|music|reading)$/i.test(nameText);
    const minH = style ? parseFloat(style.minHeight) : 0;
    return {
      w,
      h,
      cssW,
      cssH,
      pageCount,
      hasStack: !!stack,
      overflowSheets,
      minH,
      scoreVisible,
      scoreText,
      checklistItems,
      metricRows,
      breakdownRows,
      breakdownSample,
      panelTitle,
      classifyInCv,
      pipelineHidden,
      debugHidden,
      badName,
      nameText,
    };
  });

  ok(checks.hasStack, 'A4 page stack rendered');
  ok(checks.pageCount >= 1, `A4 has ${checks.pageCount} page(s)`);
  ok(checks.cssW >= 790 && checks.cssW <= 798, `A4 sheet width 794px (${checks.cssW}px, rendered ${checks.w}px)`);
  ok(checks.cssH >= 1118 && checks.cssH <= 1128, `A4 sheet height 1123px (${checks.cssH}px, rendered ${checks.h}px)`);
  ok(checks.overflowSheets === 0, `no sheet overflow (${checks.overflowSheets} clipped)`);
  ok(checks.scoreVisible, 'studio score panel visible');
  ok(checks.scoreText && checks.scoreText !== '—', `score populated (${checks.scoreText})`);
  ok(checks.checklistItems === 6, `ATS checklist has 6 items (${checks.checklistItems})`);
  ok(checks.breakdownRows === 6, `ATS breakdown has 6 categories (${checks.breakdownRows})`);
  ok(/\d+\/\d+/.test(checks.breakdownSample), `ATS breakdown uses points/max (${checks.breakdownSample})`);
  ok(/analyse recruteur/i.test(checks.panelTitle), `panel title (${checks.panelTitle})`);
  ok(checks.classifyInCv === 0, 'no À classer blocks inside CV preview');
  ok(!checks.badName, `CV name not garbage (${checks.nameText})`);
  ok(checks.debugHidden, 'debug panel hidden in normal mode');
  ok(checks.pipelineHidden, 'pipeline report hidden in normal mode');

  const openPasteMissing = await page.evaluate(() => !document.getElementById('openPasteCompactBtn'));
  ok(openPasteMissing, 'dead openPasteCompactBtn not in DOM (binding removed)');

  const pasteBtn = page.locator('#openPasteBtn');
  ok(await pasteBtn.count() > 0, 'openPasteBtn exists');

  await browser.close();
  server.close();

  console.log('\nProduct recovery:', failed ? 'FAILED' : 'PASSED');
  console.log('Screenshots:', path.join(outDir, 'after-studio.png'));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
