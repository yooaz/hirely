#!/usr/bin/env node
/**
 * HIRELY P0 — Export page full preview (template, A4, zoom fit, PDF, back).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/export-page-full-preview');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/mvp-sample.txt');
const SHOT = path.join(OUT_DIR, 'export-page.png');

fs.mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
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
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const rel = (req.url || '/').split('?')[0];
    const fp = path.join(ROOT, decodeURIComponent(rel === '/' ? '/index.html' : rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
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
      const doc = document.getElementById('cvDoc');
      return doc?.classList.contains('cv--live') && (doc.innerText || '').length > 80;
    },
    { timeout }
  );
}

async function setStep(page, step) {
  await page.evaluate((s) => {
    if (typeof setDocStep === 'function') setDocStep(s);
  }, step);
  await page.waitForTimeout(700);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(html.includes('ensureExportPreviewRendered'), 'index defines ensureExportPreviewRendered');
ok(html.includes('id="exportBackToTemplatesBtn"'), 'export back button in bar');
ok(html.includes('id="exportBackToTemplatesHeadBtn"'), 'export back button in header');
ok(html.includes('id="a4ZoomBar"'), 'zoom bar present');

let browserSnap = {};
try {
  const port = 3065 + Math.floor(Math.random() * 40);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.HirelyParse?.importText === 'function', {
    timeout: 120000,
  });

  const paste = fs.readFileSync(PASTE_FIXTURE, 'utf8');
  await page.evaluate(async (text) => {
    await window.HirelyParse.importText(text, {
      source: 'paste-text',
      trusted: true,
      forceContinue: true,
    });
  }, paste);
  await waitForCv(page);
  await setStep(page, 'style');
  await setStep(page, 'export');

  browserSnap = await page.evaluate(() => {
    const preview = document.getElementById('studioPreview');
    const cv = document.getElementById('cvDoc');
    const stage = document.getElementById('cvStage');
    const exportBar = document.getElementById('cvExportBar');
    const exportHead = document.getElementById('exportStepHead');
    const zoomBar = document.getElementById('a4ZoomBar');
    const fitBtn = document.querySelector('.a4ZoomBtn[data-a4-zoom="fit"]');
    const pr = preview?.getBoundingClientRect();
    const sr = stage?.getBoundingClientRect();
    return {
      docStep: document.getElementById('workspace')?.dataset?.docStep || '',
      previewVisible: preview && !preview.classList.contains('hidden'),
      previewExportClass: preview?.classList.contains('studioPreview--export'),
      previewHeight: Math.round(pr?.height || 0),
      stageHeight: Math.round(sr?.height || 0),
      templateLabel: (document.getElementById('exportStepTemplateName')?.textContent || '').trim(),
      exportHeadVisible: exportHead && !exportHead.classList.contains('hidden'),
      cvLive: cv?.classList.contains('cv--live'),
      cvA4: cv?.classList.contains('cv--a4'),
      previewName: (cv?.querySelector('.cvName')?.textContent || '').trim(),
      cvTextLen: (cv?.innerText || '').length,
      exportBarVisible: exportBar && !exportBar.classList.contains('hidden'),
      pdfBtnLabel: (document.getElementById('downloadBtn')?.textContent || '').trim(),
      backBtnLabel: (document.getElementById('exportBackToTemplatesBtn')?.textContent || '').trim(),
      zoomBarVisible: zoomBar && !zoomBar.classList.contains('hidden'),
      zoomFitActive: fitBtn?.classList.contains('active') || fitBtn?.getAttribute('aria-pressed') === 'true',
      zoomMode: window.HirelyA4Viewport?.getZoomMode?.() || '',
    };
  });

  ok(browserSnap.docStep === 'export', `doc step export (${browserSnap.docStep})`);
  ok(browserSnap.previewVisible, 'studioPreview visible');
  ok(browserSnap.previewExportClass, 'studioPreview--export class');
  ok(browserSnap.previewHeight >= 400, `preview height ${browserSnap.previewHeight}px`);
  ok(browserSnap.stageHeight >= 300, `stage height ${browserSnap.stageHeight}px`);
  ok(browserSnap.exportHeadVisible, 'export header visible');
  ok(browserSnap.templateLabel.length > 3, `template "${browserSnap.templateLabel}"`);
  ok(browserSnap.cvLive && browserSnap.cvTextLen > 80, `cv rendered (${browserSnap.cvTextLen} chars)`);
  ok(!!browserSnap.previewName, `name "${browserSnap.previewName.slice(0, 40)}"`);
  ok(browserSnap.exportBarVisible, 'export bar visible');
  ok(/télécharger pdf|download pdf/i.test(browserSnap.pdfBtnLabel), `PDF btn "${browserSnap.pdfBtnLabel}"`);
  ok(/retour aux modèles|back to templates/i.test(browserSnap.backBtnLabel), `back btn "${browserSnap.backBtnLabel}"`);
  ok(browserSnap.zoomBarVisible, 'zoom bar visible');
  ok(browserSnap.zoomFitActive || browserSnap.zoomMode === 'fit', 'zoom fit active');

  await page.click('#exportBackToTemplatesBtn');
  await page.waitForTimeout(500);
  const afterBack = await page.evaluate(() => ({
    step: document.getElementById('workspace')?.dataset?.docStep || '',
    tplVisible: !document.getElementById('templatePickerBar')?.classList.contains('hidden'),
  }));
  ok(afterBack.step === 'style', `back → style (${afterBack.step})`);
  ok(afterBack.tplVisible, 'template picker visible after back');

  await page.locator('#cvStage').screenshot({ path: SHOT }).catch(() => {});
  await browser.close();
  server.close();
} catch (err) {
  ok(false, `browser QA: ${err.message}`);
}

const report = {
  feature: 'EXPORT_PAGE_FULL_PREVIEW',
  generatedAt: new Date().toISOString(),
  snap: browserSnap,
  screenshot: fs.existsSync(SHOT) ? SHOT : null,
  pass: failed === 0,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL export-page-full-preview' : '\nPASS export-page-full-preview');
process.exit(failed ? 1 : 0);
