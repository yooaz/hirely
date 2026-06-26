#!/usr/bin/env node
/**
 * P0 Subtraction QA — verifies DESIGN_CRITIQUE_REPORT P0 items in browser.
 * Requires dev server: npm run dev (port 3000)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = process.env.HIRELY_URL || 'http://127.0.0.1:3000/?pro=true';
const OUT_DIR = path.join(root, '.qa-screenshots/p0-subtraction');

const checks = [];
let failed = 0;

function ok(msg) {
  checks.push({ ok: true, msg });
  console.log('OK', msg);
}
function fail(msg) {
  failed++;
  checks.push({ ok: false, msg });
  console.error('FAIL', msg);
}

function vis(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, sel);
}

function hidden(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return true;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return true;
    if (el.classList.contains('hidden')) return true;
    const r = el.getBoundingClientRect();
    return r.width === 0 || r.height === 0;
  }, sel);
}

async function shot(page, name) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('SHOT', path.relative(root, file));
}

async function waitReady(page) {
  await page.waitForFunction(
    () => document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready'),
    { timeout: 45000 }
  );
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
    if (typeof renderProgressNav === 'function') renderProgressNav();
    const exBar = document.getElementById('cvExportBar');
    if (exBar) exBar.classList.toggle('hidden', s !== 'export');
  }, step);
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    fail(`Could not load ${BASE} — run: npm run dev`);
    await browser.close();
    process.exit(1);
  }

  await page.locator('#workspace').scrollIntoViewIfNeeded();

  // Import sample via exposed API (sampleBtn removed in P0)
  await page.evaluate(async () => {
    if (typeof globalThis.loadSample !== 'function') throw new Error('loadSample missing');
    await globalThis.loadSample();
  });
  await waitReady(page);
  await shot(page, '01-after-import-review');

  const cvLen = await page.$eval('#cvDoc', (el) => el.innerHTML.length);
  if (cvLen > 400) ok('Import works — CV preview rendered');
  else fail(`Import CV empty (len ${cvLen})`);

  // Review step — no template bar
  await forceDocStep(page, 'edit');
  await shot(page, '02-review-step');

  if (await hidden(page, '#templatePickerBar')) ok('Review — template gallery hidden');
  else fail('Review — template gallery visible');

  const reviewTitle = (await page.textContent('#reviewStudioAnalysis h3'))?.trim();
  if (reviewTitle === 'Review' || reviewTitle === 'Relecture' || /review|relecture/i.test(reviewTitle || '')) ok(`Review sidebar title: ${reviewTitle}`);
  else fail(`Review sidebar title unexpected: ${reviewTitle}`);

  const rccItems = await page.$$eval('#recruiterCommandCenter .rccSlimList .rccListItem', (els) => els.length);
  if (rccItems <= 3) ok(`Review slim list ≤3 items (${rccItems})`);
  else fail(`Review slim list has ${rccItems} items (max 3)`);

  // Style step — templates visible
  await forceDocStep(page, 'style');
  await shot(page, '03-style-step');

  if (await vis(page, '#templatePickerBar')) ok('Style — template gallery visible');
  else fail('Style — template gallery hidden');

  const tplCount = await page.$$eval('.tplCard', (els) => els.filter((e) => {
    const st = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return st.display !== 'none' && r.width > 0;
  }).length);
  if (tplCount >= 10) ok(`Style — ${tplCount} template cards visible`);
  else fail(`Style — only ${tplCount} template cards visible`);

  // Export — PDF primary + More only
  await forceDocStep(page, 'export');
  await shot(page, '04-export-step');

  if (await vis(page, '#downloadBtn')) ok('Export — Download PDF visible');
  else fail('Export — Download PDF missing');

  if (await vis(page, '#exportMoreBtn')) ok('Export — More menu trigger visible');
  else fail('Export — More menu trigger missing');

  const exportBarBtns = await page.$$eval('#cvExportBar > .btn, #cvExportBar .exportMoreWrap > .btn', (els) =>
    els.filter((e) => {
      const st = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return st.display !== 'none' && r.width > 0;
    }).map((e) => e.id || e.textContent?.trim())
  );
  if (exportBarBtns.length <= 2) ok(`Export bar top-level buttons: ${exportBarBtns.join(', ')}`);
  else fail(`Export bar has extra buttons: ${exportBarBtns.join(', ')}`);

  if (await hidden(page, '#exportFinalPanel')) ok('Export — no exportFinalPanel');
  else fail('Export — exportFinalPanel still visible');

  // Debug controls absent in production DOM query
  for (const id of ['hirelyTestClickBtn', 'hirelyTestImport', 'importDebugPanel', 'extractionGate', 'extractionAlert']) {
    const exists = await page.$(`#${id}`);
    if (!exists) ok(`Removed from DOM: #${id}`);
    else if (await hidden(page, `#${id}`)) ok(`Hidden: #${id}`);
    else fail(`Debug/leak visible: #${id}`);
  }

  // Paste fallback panel exists
  const pasteExists = await page.$('#importPasteFallback');
  if (pasteExists) ok('Canonical recovery panel #importPasteFallback present');
  else fail('Missing #importPasteFallback');

  const pasteTitle = await page.textContent('#importPasteFallbackTitle');
  if (/little more text/i.test(pasteTitle || '')) ok('Recovery title canonical');
  else fail(`Recovery title: ${pasteTitle}`);

  await browser.close();

  const reportPath = path.join(root, 'P0_SUBTRACTION_REPORT.md');
  if (!fs.existsSync(reportPath)) {
    console.warn('Note: run full report generation if P0_SUBTRACTION_REPORT.md not yet written');
  }

  console.log('\n--- P0 QA summary ---');
  console.log(`Passed: ${checks.filter((c) => c.ok).length} / ${checks.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
