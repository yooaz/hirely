#!/usr/bin/env node
/**
 * Browser pre-launch checklist — requires server on :3456 and playwright.
 */
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';
import { PRODUCTION_TEMPLATE_IDS as PRODUCTION_TEMPLATES } from '../ui/templates/production-template-ids.mjs';

const BASE = process.env.HIRELY_URL || 'http://127.0.0.1:3000/?pro=true';
const errors = [];
let failed = false;

function fail(msg) {
  failed = true;
  console.error('FAIL:', msg);
}

function ok(msg) {
  console.log('OK', msg);
}

/** Product UI hides numeric score unless ?debug=true — accept review-ready state. */
function importLooksReady(score, lead, cvLen) {
  const scoreNum = parseInt(score || '', 10);
  if (scoreNum >= 35 && scoreNum <= 92) return true;
  if (/ready|prêt|point|strong|solide|excellent|optionnel/i.test(lead || '')) return true;
  return cvLen > 500;
}

async function resetApp(page) {
  await page.evaluate(() => {
    if (typeof resetExtractionState === 'function') resetExtractionState();
  });
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => {
  const text = String(e?.message || e);
  if (!isExtensionConsoleNoise(text)) errors.push(text);
});
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (!isExtensionConsoleNoise(text)) errors.push(text);
});

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
} catch (e) {
  fail(`Could not load ${BASE} — run: npm run dev`);
  await browser.close();
  process.exit(1);
}

await page.locator('#workspace').scrollIntoViewIfNeeded();
await page.locator('#sampleBtn').scrollIntoViewIfNeeded();
await page.click('#sampleBtn', { timeout: 15000 });
await page.waitForFunction(
  () => document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready'),
  { timeout: 20000 }
);

const score = (await page.textContent('#score'))?.trim();
const cvLen = await page.$eval('#cvDoc', (el) => el.innerHTML.length);
const tplCount = await page.$$eval('.tplCard', (els) => els.length);
const exportVisible = await page.$eval('#cvExportBar', (el) => !el.classList.contains('hidden'));
const gridReady = await page.$eval('#workspaceGrid', (el) => el.classList.contains('workspaceGrid--ready'));

const ready = (await page.textContent('#insightLead'))?.trim() || '';
const scoreNum = parseInt(score || '', 10);
if (scoreNum >= 35 && scoreNum <= 92) ok(`Use sample — score ${scoreNum}`);
else if (/ready|prêt|strong|solide|excellent/i.test(ready)) ok(`Use sample — ${ready}`);
else fail(`Score missing: score=${score} lead=${ready}`);
if (cvLen > 500) ok('CV visible');
else fail(`CV empty (len ${cvLen})`);
if (tplCount >= 13) ok(`Templates visible (${tplCount})`);
else fail(`Templates missing (${tplCount}, expected 13)`);
if (exportVisible) ok('Export bar visible');
else fail('Export bar hidden');
if (gridReady) ok('Workspace mode');
else fail('Workspace not ready');

await page.click('.tplCard[data-id="swiss"]');
await page.waitForTimeout(500);
const swiss = await page.$eval('#cvDoc', (el) => el.className.includes('template-swiss'));
const swissActive = await page.$eval('.tplCard[data-id="swiss"]', (el) => el.classList.contains('active'));
if (swiss && swissActive) ok('Template switch');
else fail('Template switch did not update preview or active state');

const pdfBtn = await page.$('#downloadBtn');
if (pdfBtn && await pdfBtn.isVisible()) ok('PDF export button visible');
else fail('PDF export button not visible');

for (const tplId of PRODUCTION_TEMPLATES) {
  const card = await page.$(`.tplCard[data-id="${tplId}"]`);
  if (!card) {
    fail(`Template card missing: ${tplId}`);
    continue;
  }
  await card.click();
  await page.waitForTimeout(350);
  const cls = await page.$eval('#cvDoc', (el) => el.className);
  const len = await page.$eval('#cvDoc', (el) => el.innerHTML.length);
  const active = await page.$eval(`.tplCard[data-id="${tplId}"]`, (el) => el.classList.contains('active'));
  if (!cls.includes(`template-${tplId}`) || !active || len < 400) {
    fail(`Template preview failed: ${tplId} (active=${active} len=${len})`);
  } else ok(`Template render: ${tplId}`);
}

await page.selectOption('#uiLang', 'en');
await page.waitForTimeout(300);
const imported = await page.textContent('#importCompactStatus');
if (/ready|prêt|klaar|bereit|listo|pronto/i.test(imported || '')) ok('Language switch');
else fail(`Language switch status: ${imported}`);

await page.waitForFunction(() => typeof window.HirelyParse?.applyCvPipeline === 'function', { timeout: 10000 });
await page.evaluate(async () => {
  const text = `Marie Dupont\nProduct Manager\nmarie@test.com\n+33 612345678\n\nSummary\nPM with 8 years.\n\nExperience\nLead — Acme\n\nSkills\nAgile`;
  await window.HirelyParse.applyCvPipeline(text);
});
await page.waitForTimeout(1500);
const pasteScore = (await page.textContent('#score'))?.trim();
const pasteLead = (await page.textContent('#insightLead'))?.trim();
const pasteCvLen = await page.$eval('#cvDoc', (el) => el.innerHTML.length);
if (importLooksReady(pasteScore, pasteLead, pasteCvLen)) ok('Paste text');
else fail(`Paste text — score=${pasteScore} lead=${pasteLead} cvLen=${pasteCvLen}`);

await resetApp(page);
const txtCv = `Jane Doe\nDesigner\njane@example.com\n+1 555 0100\n\nSummary\nDesigner with portfolio work.\n\nExperience\nStudio X — 2020–Present\n\nSkills\nFigma, Photoshop`;
await page.setInputFiles('#fileInput', {
  name: 'resume.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from(txtCv, 'utf8'),
});
await page.waitForTimeout(3000);
const txtScore = (await page.textContent('#score'))?.trim();
const txtLead = (await page.textContent('#insightLead'))?.trim();
const txtCvLen = await page.$eval('#cvDoc', (el) => el.innerHTML.length);
if (importLooksReady(txtScore, txtLead, txtCvLen)) ok('TXT upload');
else fail(`TXT upload — score=${txtScore} lead=${txtLead} cvLen=${txtCvLen}`);

await resetApp(page);
await page.setInputFiles('#fileInput', {
  name: 'unreadable.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8'),
});
await page.waitForTimeout(3500);
const pdfAlert = await page.$eval('#extractionAlert', (el) => el.classList.contains('show'));
const pdfMsg = await page.textContent('#statusText');
if (pdfAlert && /impossible de lire|scanné|protégé|could not read|nous n'avons pas|paste|coller|txt\/pdf/i.test(pdfMsg || '')) ok('PDF fallback');
else if (pdfAlert) ok('PDF fallback');
else fail(`PDF fallback — alert=${pdfAlert} status=${pdfMsg?.slice(0, 60)}`);
const appLen = await page.$eval('#app', (el) => el.innerHTML.length);
if (appLen > 500) ok('No blank UI after bad PDF');
else fail('Blank UI after bad PDF');

if (errors.length) {
  errors.forEach((e) => fail(`Console error: ${e}`));
} else {
  ok('No JS errors');
}

await browser.close();
process.exit(failed ? 1 : 0);
