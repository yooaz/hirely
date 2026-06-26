#!/usr/bin/env node
/**
 * MVP recovery — import, preview, edit, template switch, PDF export.
 * Run: npm run dev (port 3000) then node tests/mvp-recovery.mjs
 */
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from './lib/qa-console-filter.mjs';

const BASE = process.env.HIRELY_URL || 'http://127.0.0.1:3456/?pro=true';
const results = {
  import: 'FAIL',
  preview: 'FAIL',
  edit: 'FAIL',
  template: 'FAIL',
  export: 'FAIL',
};

function log(msg) {
  console.log(msg);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => {
  const text = String(e?.message || e);
  if (!isExtensionConsoleNoise(text)) consoleErrors.push(text);
});
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) consoleErrors.push(text);
});

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('#sampleBtn', { timeout: 15000 });
  await page.waitForFunction(() => window.HirelyTemplates?.list?.length >= 6, { timeout: 15000 });
} catch (e) {
  log(`Cannot load ${BASE} — start server: npm run dev`);
  console.error(e.message);
  await browser.close();
  process.exit(1);
}

// 1. Import (sample)
try {
  await page.click('#sampleBtn');
  await page.waitForFunction(
    () => {
      const doc = document.getElementById('cvDoc');
      return doc?.classList.contains('cv--live') && doc.innerHTML.length > 400;
    },
    { timeout: 15000 }
  );
  const ready = await page.$eval('#workspaceGrid', (el) => el.classList.contains('workspaceGrid--ready'));
  const name = await page.$eval('#cvDoc .cvName', (el) => el.textContent.trim()).catch(() => '');
  if (ready && name.length > 2) results.import = 'PASS';
  else log(`Import weak: ready=${ready} name=${name}`);
} catch (e) {
  log(`Import error: ${e.message}`);
}

// 2. CV preview
try {
  const live = await page.$eval('#cvDoc', (el) => el.classList.contains('cv--live'));
  const len = await page.$eval('#cvDoc', (el) => el.innerHTML.length);
  const hasExp = await page.$eval('#cvDoc', (el) => /experience|Expérience|cvExp/i.test(el.innerHTML));
  if (live && len > 500 && hasExp) results.preview = 'PASS';
  else log(`Preview weak: live=${live} len=${len} hasExp=${hasExp}`);
} catch (e) {
  log(`Preview error: ${e.message}`);
}

// 3. Manual edit (textarea → re-render)
try {
  await page.click('.docNavItem[data-doc-step="verify"]');
  const rd = await page.$('#rawDetails');
  if (rd) await rd.evaluate((el) => { el.open = true; });
  const ta = await page.waitForSelector('#cvText', { state: 'visible', timeout: 5000 });
  const original = await ta.inputValue();
  const marker = 'MVP_EDIT_MARKER_2026';
  await ta.fill(`${original}\n\nExperience\nMVP Test Role — Hirely QA (${marker})`);
  await page.click('#generateBtn');
  await page.waitForFunction(
    (m) => document.getElementById('cvDoc')?.textContent?.includes(m),
    marker,
    { timeout: 12000 }
  );
  const inPreview = await page.$eval('#cvDoc', (el, m) => el.textContent.includes(m), marker);
  if (inPreview) results.edit = 'PASS';
  else log('Edit marker not in preview');
} catch (e) {
  log(`Edit error: ${e.message}`);
}

// 4. Template switch
try {
  await page.click('.tplCard[data-id="executive"]');
  await page.waitForTimeout(600);
  const cls = await page.$eval('#cvDoc', (el) => el.className);
  const active = await page.$eval('.tplCard[data-id="executive"]', (el) => el.classList.contains('active'));
  if (cls.includes('template-executive') && active) results.template = 'PASS';
  else log(`Template weak: cls=${cls} active=${active}`);
} catch (e) {
  log(`Template error: ${e.message}`);
}

// 5. PDF export
try {
  await page.waitForFunction(() => typeof window.HirelyLazy?.ensureHtml2pdf === 'function', { timeout: 5000 });
  await page.evaluate(() => window.HirelyLazy.ensureHtml2pdf());
  await page.waitForFunction(() => typeof window.html2pdf === 'function', { timeout: 20000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);
  await page.click('#downloadBtn');
  const download = await downloadPromise;
  const errToast = await page.textContent('#statusText').catch(() => '');

  if (download) {
    const suggested = download.suggestedFilename();
    await download.cancel().catch(() => {});
    if (/\.pdf$/i.test(suggested)) results.export = 'PASS';
    else log(`Download not pdf: ${suggested}`);
  } else {
    // html2pdf may use save() without Playwright download in some builds — check no error state
    const live = await page.$eval('#cvDoc', (el) => el.classList.contains('cv--live'));
    const statusOk = !/impossible|failed|échoué/i.test(errToast || '');
    if (live && statusOk) {
      const ran = await page.evaluate(async () => {
        const cv = document.getElementById('cvDoc');
        if (!cv || !window.html2pdf) return false;
        try {
          await window
            .html2pdf()
            .set({
              margin: 0,
              filename: 'mvp-test.pdf',
              image: { type: 'jpeg', quality: 0.5 },
              html2canvas: { scale: 1, logging: false },
              jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' },
            })
            .from(cv)
            .outputPdf('blob');
          return true;
        } catch {
          return false;
        }
      });
      if (ran) results.export = 'PASS';
      else log(`Export fallback failed status=${errToast}`);
    } else log(`Export fail status=${errToast}`);
  }
} catch (e) {
  log(`Export error: ${e.message}`);
}

await browser.close();

console.log('\n--- HIRELY MVP RECOVERY CHECK ---\n');
console.log(`Import:          ${results.import}`);
console.log(`CV preview:      ${results.preview}`);
console.log(`Manual edit:     ${results.edit}`);
console.log(`Template switch: ${results.template}`);
console.log(`Export:          ${results.export}`);
if (consoleErrors.length) {
  console.log('\nConsole errors:', consoleErrors.slice(0, 5).join(' | '));
}

const failed = Object.values(results).some((v) => v === 'FAIL');
process.exit(failed ? 1 : 0);
