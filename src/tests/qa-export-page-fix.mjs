#!/usr/bin/env node
/**
 * HIRELY P0 — Export page must show template, A4 preview, PDF + letter buttons.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/export-page-fix');
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
      '.pdf': 'application/pdf',
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

async function clickDocStep(page, step) {
  await page.evaluate((s) => {
    if (typeof setDocStep === 'function') setDocStep(s);
  }, step);
  await page.waitForTimeout(500);
}

async function main() {
  if (!fs.existsSync(PASTE_FIXTURE)) {
    console.error('Missing fixture', PASTE_FIXTURE);
    process.exit(1);
  }

  const port = 3060 + Math.floor(Math.random() * 40);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
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

    await clickDocStep(page, 'style');
    await page.waitForFunction(
      () => !document.getElementById('studioPreview')?.classList.contains('hidden'),
      { timeout: 15000 }
    );
    ok(true, 'style step shows A4 preview');

    await clickDocStep(page, 'export');
    await page.waitForTimeout(600);

    const snap = await page.evaluate(() => {
      const preview = document.getElementById('studioPreview');
      const cv = document.getElementById('cvDoc');
      const stage = document.getElementById('cvStage');
      const exportBar = document.getElementById('cvExportBar');
      const exportHead = document.getElementById('exportStepHead');
      const tplName = document.getElementById('exportStepTemplateName');
      const letterWs = document.getElementById('coverLetterWorkspace');
      const pr = preview?.getBoundingClientRect();
      const sr = stage?.getBoundingClientRect();
      return {
        docStep: document.getElementById('workspace')?.dataset?.docStep || '',
        previewVisible: preview && !preview.classList.contains('hidden'),
        previewHeight: Math.round(pr?.height || 0),
        stageHeight: Math.round(sr?.height || 0),
        templateLabel: (tplName?.textContent || '').trim(),
        exportHeadVisible: exportHead && !exportHead.classList.contains('hidden'),
        cvLive: cv?.classList.contains('cv--live'),
        previewName: (cv?.querySelector('.cvName')?.textContent || '').trim(),
        cvTextLen: (cv?.innerText || '').length,
        exportBarVisible: exportBar && !exportBar.classList.contains('hidden'),
        pdfBtn: !!document.getElementById('downloadBtn'),
        letterBtn: !!document.getElementById('openLetterBtn'),
        letterClosedByDefault: letterWs?.classList.contains('hidden'),
        activeTemplate: typeof state !== 'undefined' ? state.activeTemplate : '',
        template: typeof state !== 'undefined' ? state.template : '',
      };
    });

    ok(snap.docStep === 'export', `doc step export (${snap.docStep})`);
    ok(snap.previewVisible, 'studioPreview visible on export');
    ok(snap.previewHeight >= 400, `preview height ${snap.previewHeight}px`);
    ok(snap.stageHeight >= 300, `A4 stage height ${snap.stageHeight}px`);
    ok(snap.exportHeadVisible, 'export step header visible');
    ok(snap.templateLabel && snap.templateLabel.length > 3, `template label "${snap.templateLabel}"`);
    ok(snap.cvLive && snap.cvTextLen > 80, `cv live (${snap.cvTextLen} chars)`);
    ok(!!snap.previewName, `preview name "${snap.previewName.slice(0, 40)}"`);
    ok(snap.exportBarVisible, 'export bar visible');
    ok(snap.pdfBtn, 'PDF download button present');
    ok(snap.letterBtn, 'cover letter button present');
    ok(snap.letterClosedByDefault, 'letter panel closed until user opens');

    await page.locator('#cvStage').screenshot({ path: SHOT }).catch(() => {});

    const report = {
      feature: 'EXPORT_PAGE_FIX',
      generatedAt: new Date().toISOString(),
      snap,
      screenshot: fs.existsSync(SHOT) ? SHOT : null,
      pass: failed === 0,
    };
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failed ? '\nFAIL export-page-fix' : '\nPASS export-page-fix');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
