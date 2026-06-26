#!/usr/bin/env node
/**
 * P0 — PDF OCR progressive UX (3s progress, 5s patience, 8s early paste, 20s fallback).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_UX_PROGRESS_MS,
  OCR_UX_PATIENCE_MS,
  OCR_UX_EARLY_PASTE_MS,
} from '../core/extraction/pdf-extraction-timeout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/pdf-ocr-ux-progress');
fs.mkdirSync(outDir, { recursive: true });

let failed = 0;
const checks = [];
function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

ok(PDF_EXTRACTION_MAX_MS === 20000, 'core_timeout_20s', String(PDF_EXTRACTION_MAX_MS));
ok(OCR_UX_EARLY_PASTE_MS === 8000, 'early_paste_8s');
ok(OCR_UX_PATIENCE_MS === 5000, 'patience_5s');
ok(OCR_UX_PROGRESS_MS === 3000, 'progress_3s');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    }[ext] || 'application/octet-stream'
  );
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

const port = 3080 + Math.floor(Math.random() * 20);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(120000);

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => globalThis.HirelyCore?.canonicalImportFromFile && document.getElementById('importPasteFallback'),
  { timeout: 90000 }
);

await page.evaluate(() => {
  globalThis.HIRELY_OCR_UX_MS_SCALE = 0.05;
  globalThis.HIRELY_SIMULATE_SLOW_PDF_OCR = true;
  globalThis.HIRELY_SLOW_OCR_MS = 3000;
});

const fakePdf = {
  name: 'slow-ocr.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 slow ocr simulation'),
};

const t0 = Date.now();
await page.locator('#fileInput').setInputFiles(fakePdf);

await page.waitForFunction(
  () => {
    const bar = document.getElementById('progressBar');
    const w = parseInt(String(bar?.style?.width || '0').replace('%', ''), 10);
    return w >= 15;
  },
  { timeout: 5000 }
);
const progressMs = Date.now() - t0;
ok(progressMs >= 100 && progressMs <= 800, 'ui_progress_3s', `${progressMs}ms`);

await page.waitForFunction(
  () =>
    /quelques secondes/i.test(document.getElementById('statusText')?.textContent || '') ||
    /quelques secondes/i.test(document.getElementById('importLiveStatus')?.textContent || ''),
  { timeout: 5000 }
);
const patienceMs = Date.now() - t0;
ok(patienceMs >= 200 && patienceMs <= 1200, 'ui_patience_5s', `${patienceMs}ms`);

await page.waitForFunction(
  () => {
    const panel = document.getElementById('importPasteFallback');
    return (
      panel?.classList.contains('show') &&
      panel?.classList.contains('importPasteFallback--early')
    );
  },
  { timeout: 5000 }
);
const earlyMs = Date.now() - t0;
ok(earlyMs >= 300 && earlyMs <= 1500, 'ui_early_paste_8s', `${earlyMs}ms`);

const earlySnap = await page.evaluate(() => ({
  early: document.getElementById('importPasteFallback')?.classList.contains('importPasteFallback--early'),
  lead: document.getElementById('importPasteFallbackLead')?.textContent || '',
  loading: document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--loading'),
  locked: document.getElementById('importPasteFallback')?.classList.contains('show'),
}));
ok(earlySnap.early, 'early_paste_mode');
ok(/coller le texte/i.test(earlySnap.lead), 'early_paste_copy', earlySnap.lead);

await page.waitForFunction(
  () => {
    const panel = document.getElementById('importPasteFallback');
    const lead = document.getElementById('importPasteFallbackLead')?.textContent || '';
    return (
      panel?.classList.contains('show') &&
      !panel?.classList.contains('importPasteFallback--early') &&
      /pour continuer/i.test(lead)
    );
  },
  { timeout: 5000 }
);
const fullMs = Date.now() - t0;
ok(fullMs >= 800 && fullMs <= 2500, 'ui_full_fallback_20s', `${fullMs}ms`);

const report = {
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  checks,
  timings: { progressMs, patienceMs, earlyMs, fullMs },
  earlySnap,
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

await browser.close();
server.close();

console.log(failed ? `\n${failed} failed` : '\nAll PDF OCR UX progress checks passed');
process.exit(failed ? 1 : 0);
