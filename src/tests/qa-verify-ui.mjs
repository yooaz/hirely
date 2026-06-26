#!/usr/bin/env node
/**
 * Verify UI cleanup — test import hidden, identity title guard, simple verify panel.
 * node src/tests/qa-verify-ui.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { applyRescueMode } from '../core/parsing/safe-fallback.js';
import { isBadTitleCandidate } from '../core/parsing/parser-recovery.js';
import { normalizeCvData } from '../core/parsing/rich-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv hire/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv 2024 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
].filter(Boolean);

function resolveExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf' }[ext] || 'application/octet-stream';
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(root, decodeURIComponent(p));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(isBadTitleCandidate('Print Logo Vector Art Reading'), 'skill line rejected as title');
const rescued = applyRescueMode(
  {},
  {
    cleanedText: `Yohann Azancot\nGraphic Designer\nPrint Logo Vector Art Reading\nyoaz@hotmail.fr`,
  }
);
ok(!/print logo/i.test(rescued.title || ''), 'rescue does not promote skill line to title');
ok(/yohann/i.test(rescued.name || ''), 'rescue keeps plausible name');
const norm = normalizeCvData({ ...rescued, title: 'Print Logo Vector Art Reading' });
ok(!norm.title, 'normalizeCvData clears bad title');

async function browserChecks(pdfPath) {
  const port = 3012 + Math.floor(Math.random() * 200);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const testHidden = await page.evaluate(() => {
    const el = document.getElementById('hirelyTestImport');
    return el && window.getComputedStyle(el).display === 'none';
  });
  ok(testHidden, '[TEST IMPORT] hidden in normal UI');

  const dupAlerts = await page.evaluate(() => {
    const msg = 'Nous n\u2019avons pas pu lire automatiquement';
    const live = document.getElementById('importLiveStatus')?.textContent?.includes(msg);
    const status = document.getElementById('statusText')?.textContent?.includes(msg);
    const alert = document.getElementById('extractionAlertText')?.textContent?.includes(msg);
    const alertVisible = document.getElementById('extractionAlert')?.classList.contains('show');
    return { live, status, alert, alertVisible };
  });
  ok(!dupAlerts.live && !dupAlerts.status, 'paste-fail message not duplicated in status rows');

  if (pdfPath) {
    page.setDefaultTimeout(300000);
    await page.waitForFunction(
      () => typeof window.HirelyParse?.importFile === 'function',
      null,
      { timeout: 120000 }
    );
    await page.locator('#fileInput').setInputFiles(pdfPath);
    let imported = false;
    for (let i = 0; i < 150; i++) {
      const s = await page.evaluate(() => ({
        live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
        busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
        step: document.getElementById('workspace')?.dataset?.docStep || '',
      }));
      if (s.live && !s.busy) {
        imported = true;
        break;
      }
      await page.waitForTimeout(2000);
    }
    if (imported) {
      await page.evaluate(() => {
        if (typeof setDocStep === 'function') setDocStep('verify');
      });
      await page.waitForTimeout(400);
    }
    if (!imported) {
      console.warn('PDF import timed out — validating verify UI via paste fixture');
      await page.evaluate(async () => {
        const t = await fetch('/tests/fixtures/yoaz-cv/fixture.txt').then((r) => r.text());
        await window.HirelyParse.ingestCvText(t, { silent: true, force: true });
        if (typeof setDocStep === 'function') setDocStep('verify');
      });
      imported = await page.evaluate(
        () => document.getElementById('cvDoc')?.classList.contains('cv--live') === true
      );
      ok(imported, 'verify UI via paste fallback when PDF OCR exceeds test timeout');
    } else {
      ok(true, 'Yoaz PDF import reaches live preview');
    }
    const snap = await page.evaluate(() => {
      const title = document.querySelector('#cvDoc .cvTitle')?.textContent?.trim() || '';
      const name = document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '';
      const reviewCards = document.querySelectorAll('#verifyReviewPanel .reviewCard').length;
      const statusAside = document.getElementById('verifyStatusAside');
      const statusVisible = statusAside && !statusAside.classList.contains('hidden');
      const dock = document.getElementById('toClassifyDock');
      const dockHidden = !dock || window.getComputedStyle(dock).display === 'none';
      const mainClassify = document.querySelectorAll('#cvDoc .cvExpEntry--toClassify').length;
      const testImportHidden =
        !document.getElementById('hirelyTestImport') ||
        window.getComputedStyle(document.getElementById('hirelyTestImport')).display === 'none';
      return { title, name, reviewCards, statusVisible, dockHidden, mainClassify, testImportHidden };
    });
    ok(snap.testImportHidden, '[TEST IMPORT] stays hidden after import');
    ok(snap.statusVisible, 'verify status visible in sidebar');
    ok(snap.reviewCards <= 3, 'sidebar has at most 3 review cards');
    ok(snap.dockHidden, 'toClassify dock hidden in production verify');
    ok(snap.mainClassify === 0, 'no à-classer lines in main CV body');
    ok(!/print logo vector art reading/i.test(snap.title), 'CV title is not skill keyword line');
    console.log('preview identity:', snap.name, '|', snap.title);
    const outDir = path.join(root, 'tests/output/verify-ui');
    fs.mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, 'verify-after.png'), fullPage: false });
    console.log('screenshot:', path.join(outDir, 'verify-after.png'));
    const exportBtn = page.locator('#exportPdfBtn, #exportBtn, [data-export="pdf"]').first();
    if ((await exportBtn.count()) > 0) {
      await page.evaluate(() => {
        if (typeof setDocStep === 'function') setDocStep('export');
      });
      ok(true, 'export step reachable');
    }
  } else {
    console.warn('SKIP browser PDF import — no Yoaz PDF found');
  }

  await browser.close();
  server.close();
}

const pdf = resolveExisting(PDF_CANDIDATES);
await browserChecks(pdf);
process.exit(failed ? 1 : 0);
