#!/usr/bin/env node
/**
 * P0 gate — export lock: finalResumeData + visible #cvDoc, checklist, letter PDF.
 * node src/tests/qa-export-lock.mjs
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';
import {
  EXPORT_LOCK_VERSION,
  validateExportLock,
  validateFinalResumeForExport,
  validateExportCvElement,
  validateExportSectionParity,
  buildCvExportFilename,
} from '../core/export/export-lock.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../core/resume-data.js';
import { A4_WIDTH_PX } from '../core/export/pdf-export-config.js';
import { analyzePdfBytes } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/export-lock');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const PASTE_FIXTURE = path.join(root, 'tests/fixtures/mvp-sample.txt');

const errors = [];
const checks = [];

function pass(label, detail = '') {
  checks.push({ label, ok: true, detail });
  console.log(`OK ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail) {
  checks.push({ label, ok: false, detail });
  errors.push(`${label}: ${detail}`);
  console.error(`FAIL ${label}: ${detail}`);
}

function record(id, ok, detail = '') {
  if (ok) pass(id, detail);
  else fail(id, detail);
}

function isAppFatal(text) {
  const t = String(text || '');
  if (!t || isExtensionConsoleNoise(t)) return false;
  if (/favicon|501|Unsupported method|structure-cv|\/api\//i.test(t)) return false;
  return /CORE_BOOT_FAILED|TypeError|ReferenceError|SyntaxError|uncaught/i.test(t);
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.woff2': 'font/woff2',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(root, rel.replace(/^\//, ''));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function waitForCv(page, timeout = 120000) {
  await page.waitForFunction(
    () => {
      const doc = document.querySelector('#cvDoc');
      const name =
        (typeof getFinalCvData === 'function' ? getFinalCvData()?.name : '') ||
        window.HirelyParse?.lastResult?.cvData?.name ||
        '';
      return (
        doc?.classList.contains('cv--live') &&
        (doc.innerText || '').length > 80 &&
        !!String(name).trim()
      );
    },
    { timeout }
  );
}

async function clickDocStep(page, step) {
  const enabled = page.locator(`#docNav .hirelyProgressBtn[data-doc-step="${step}"]:not([disabled])`);
  if ((await enabled.count()) > 0) await enabled.click();
  else {
    await page.evaluate((s) => {
      if (typeof setDocStep === 'function') setDocStep(s);
    }, step);
  }
  await page.waitForTimeout(300);
}

// --- Core unit tests ---
if (EXPORT_LOCK_VERSION !== 'export-lock-v1') fail('version', EXPORT_LOCK_VERSION);
else pass('export-lock version');

const sampleRd = normalizeResumeData({
  identity: {
    name: 'Jane Doe',
    title: 'Designer',
    email: 'jane@example.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris',
  },
  summary: 'Designer.',
  experiences: [
    { role: 'Senior Designer', company: 'Acme', dates: '2020 – Present', bullets: ['Brand work.'] },
  ],
  education: ['École ABC — BA Design'],
  skills: ['Figma', 'Branding'],
  tools: [],
  languages: [],
  clients: [],
  projects: [],
  unsorted: [],
  meta: {},
});
const built = buildFinalResumeData(sampleRd);
const lockOk = validateExportLock({
  finalResumeData: built.finalResumeData,
  contract: built.contract,
  cvMetrics: {
    className: 'cv cv-page cv--live template-ats',
    hasEmptyState: false,
    widthPx: A4_WIDTH_PX,
    scrollHeight: 1400,
    clientHeight: 600,
    sectionCount: 4,
    textLength: 400,
  },
  cvData: {
    ...built.cvData,
    education: built.cvData.education?.length
      ? built.cvData.education
      : ['École ABC — BA Design — 2016'],
    experience: built.cvData.experience?.length
      ? built.cvData.experience
      : ['Senior Designer — Acme — 2020–Present'],
  },
  domText: `${built.cvData.name} ${built.cvData.experience?.[0] || ''} ${built.cvData.education?.[0] || 'École ABC'} Figma`,
});
if (!lockOk.ok) fail('validateExportLock sample', lockOk.errors.join(','));
else pass('validateExportLock sample');

const cropPreview = validateExportCvElement({
  className: 'cv cv-page cv--live',
  widthPx: A4_WIDTH_PX,
  scrollHeight: 2200,
  clientHeight: 480,
  sectionCount: 3,
  textLength: 500,
});
if (!cropPreview.ok) fail('preview scroll not cropped', cropPreview.errors.join(','));
else pass('multi-page preview not flagged cropped');

const cropSingle = validateExportCvElement({
  className: 'cv cv-page cv--live',
  widthPx: A4_WIDTH_PX,
  scrollHeight: 1300,
  clientHeight: 1123,
  sectionCount: 3,
  textLength: 500,
});
if (cropSingle.ok) fail('single-page crop detect', 'expected CONTENT_CROPPED');
else if (!cropSingle.errors.includes('CONTENT_CROPPED')) fail('single-page crop detect', cropSingle.errors.join(','));
else pass('single-page crop detected');

const badResume = validateFinalResumeForExport(null, null);
if (badResume.ok) fail('reject null resume', 'expected invalid');
else pass('reject null resume');

const fn = buildCvExportFilename({ name: 'Jane Doe' });
if (fn !== 'hirely-Jane-Doe.pdf') fail('buildCvExportFilename', fn);
else pass('buildCvExportFilename');

const parity = validateExportSectionParity(built.cvData, built.cvData.name + ' Acme École Figma');
if (!parity.ok) fail('section parity', parity.errors.join(','));
else pass('section parity');

// --- index.html wiring ---
const wiring = [
  'prepareLockedCvExport',
  'validateLockedCvExport',
  'markCvExportChecklistDone',
  'collectCvExportMetrics',
  'validateExportLock',
  'getFinalCvData',
  'getFinalResumeData',
];
for (const sym of wiring) {
  if (!indexHtml.includes(sym)) fail(`index.html ${sym}`, 'missing');
  else pass(`index.html ${sym}`);
}

const dlIdx = indexHtml.indexOf('async function downloadPDF');
const dlEnd = indexHtml.indexOf('async function downloadTXT', dlIdx);
const dlChunk = indexHtml.slice(dlIdx, dlEnd > dlIdx ? dlEnd : dlIdx + 2500);
if (!dlChunk.includes('prepareLockedCvExport')) fail('downloadPDF lock', 'no prepareLockedCvExport');
else pass('downloadPDF uses prepareLockedCvExport');
if (!dlChunk.includes('markCvExportChecklistDone')) fail('downloadPDF checklist', 'no markCvExportChecklistDone');
else pass('downloadPDF marks checklist');

// --- Playwright e2e ---
const consoleErrors = [];
let e2e = { skipped: false };

if (!fs.existsSync(PASTE_FIXTURE)) {
  record('e2e fixture', false, 'mvp-sample.txt missing');
  e2e.skipped = true;
} else {
  const port = 3040 + Math.floor(Math.random() * 60);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(120000);

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && isAppFatal(text)) consoleErrors.push(text.slice(0, 200));
  });
  page.on('pageerror', (err) => {
    const text = String(err?.message || err);
    if (isAppFatal(text)) consoleErrors.push(text.slice(0, 200));
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HirelyCore?.validateExportLock, { timeout: 120000 });
    record('core validateExportLock in browser', true);

    const paste = fs.readFileSync(PASTE_FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      if (window.HirelyParse?.importText) {
        await window.HirelyParse.importText(text, {
          source: 'paste-text',
          trusted: true,
          forceContinue: true,
        });
      }
    }, paste);
    await waitForCv(page);
    record('1_import_cv', true, 'paste import live');

    await clickDocStep(page, 'edit');
    await page.waitForSelector('#cvDoc.cv--live', { timeout: 60000 });
    const reviewSnap = await page.evaluate(() => ({
      finalValid: typeof isFinalResumeValid === 'function' ? isFinalResumeValid() : false,
      exportReady: typeof isExportReady === 'function' ? isExportReady() : false,
      previewLen: document.getElementById('cvDoc')?.innerText?.length || 0,
    }));
    record('2_review_cv', reviewSnap.finalValid && reviewSnap.previewLen > 80, JSON.stringify(reviewSnap));

    await clickDocStep(page, 'export');
    await page.waitForTimeout(400);
    await page.locator('#letterTargetRole').fill('Graphic Designer', { force: true }).catch(() => {});
    await page.locator('#generateLetterBtn').click({ force: true });
    await page.waitForTimeout(900);
    const letterSnap = await page.evaluate(() => ({
      generated: typeof state !== 'undefined' ? !!state.coverLetterGenerated : false,
      textLen: document.getElementById('coverLetterPreview')?.innerText?.trim().length || 0,
    }));
    record(
      '3_cover_letter',
      letterSnap.textLen > 60,
      `generated=${letterSnap.generated} len=${letterSnap.textLen}`
    );

    const preExport = await page.evaluate(async () => {
      if (typeof prepareLockedCvExport !== 'function') return { ok: false, err: 'no fn' };
      const prep = await prepareLockedCvExport();
      const cv = document.getElementById('cvDoc');
      return {
        ok: prep.ok,
        errors: prep.errors || [],
        nameInDom: (cv?.innerText || '').includes(
          (typeof getFinalCvData === 'function' ? getFinalCvData()?.name : '')?.slice(0, 8) || 'Yohann'
        ),
        width: cv?.offsetWidth || 0,
        classes: cv?.className || '',
      };
    });
    record(
      'export_lock_prep',
      preExport.ok && preExport.nameInDom,
      preExport.ok ? `w=${preExport.width}` : (preExport.errors || []).join(',')
    );

    let cvPdfPath = '';
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        page.locator('#downloadBtn').click(),
      ]);
      cvPdfPath = path.join(outDir, 'cv-export.pdf');
      await download.saveAs(cvPdfPath);
      const bytes = fs.statSync(cvPdfPath).size;
      const analysis = await analyzePdfBytes(fs.readFileSync(cvPdfPath));
      record(
        '4_export_cv_pdf',
        bytes > 2000 && analysis.a4 !== false,
        `${bytes} bytes pages=${analysis.pageCount}`
      );
    } catch (e) {
      record('4_export_cv_pdf', false, String(e?.message || e));
    }

    const checklistSnap = await page.evaluate(() => {
      const items = typeof buildProductChecklist === 'function'
        ? buildProductChecklist(state?.lastScoreReport || null, true)
        : [];
      const exportItem = items.find((i) => i.id === 'export');
      const domTexts = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].map((el) => ({
        label: el.querySelector('.atsCheckLabel')?.textContent?.trim(),
        ok: el.classList.contains('atsCheckItem--ok'),
      }));
      return {
        cvPdfExported: !!state?.cvPdfExported,
        exportChecklistOk: !!exportItem?.ok,
        domItems: domTexts,
      };
    });
    record(
      'export_checklist_checked',
      checklistSnap.cvPdfExported && checklistSnap.exportChecklistOk,
      JSON.stringify(checklistSnap)
    );

    let letterPdfPath = '';
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        page.locator('#downloadLetterPdfBtn').click(),
      ]);
      letterPdfPath = path.join(outDir, 'letter-export.pdf');
      await download.saveAs(letterPdfPath);
      const bytes = fs.statSync(letterPdfPath).size;
      record('5_export_letter_pdf', bytes > 800, `${bytes} bytes`);
    } catch (e) {
      record('5_export_letter_pdf', false, String(e?.message || e));
    }

    const letterExported = await page.evaluate(() => !!state?.letterPdfExported);
    record('letter_pdf_state', letterExported, letterExported ? 'ok' : 'not set');

    record('no_fatal_console', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
  } catch (e) {
    record('e2e_runner', false, String(e?.message || e).split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }
}

fs.mkdirSync(outDir, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  version: EXPORT_LOCK_VERSION,
  checks,
  errors,
  consoleErrors,
  e2e,
  pass: errors.length === 0,
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

if (errors.length) {
  console.error(`\nqa-export-lock FAILED (${errors.length})`);
  process.exit(1);
}
console.log('\nqa-export-lock PASSED');
process.exit(0);
