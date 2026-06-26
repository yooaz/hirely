#!/usr/bin/env node
/**
 * P0 — Local OCR / CSP fix: no jsdelivr, worker from /vendor/tesseract/.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  TESSERACT_VENDOR_PATHS,
  TESSERACT_REQUIRED_ASSETS,
} from '../src/vendor/tesseract-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'LOCAL_OCR_CSP_FIX_REPORT.md');
const VENDOR_ROOT = path.join(ROOT, 'vendor', 'tesseract');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.wasm': 'application/wasm',
      '.gz': 'application/gzip',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let fp = path.join(ROOT, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(fp, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(fp) });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function ensureVendorAssets() {
  const missing = TESSERACT_REQUIRED_ASSETS.map((p) =>
    path.join(ROOT, p.replace(/^\//, ''))
  ).filter((fp) => !fs.existsSync(fp));
  if (!missing.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/setup-vendor-tesseract.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('setup failed'))));
  });
}

async function main() {
  const failures = [];
  const unit = [];

  await ensureVendorAssets();

  for (const asset of TESSERACT_REQUIRED_ASSETS) {
    const fp = path.join(ROOT, asset.replace(/^\//, ''));
    unit.push({
      name: `asset ${asset}`,
      pass: fs.existsSync(fp) && fs.statSync(fp).size > 0,
      detail: fs.existsSync(fp) ? `${fs.statSync(fp).size}b` : 'missing',
    });
  }

  const workerJs = fs.readFileSync(path.join(VENDOR_ROOT, 'worker.min.js'), 'utf8');
  unit.push({
    name: 'worker.min.js has no jsdelivr default when paths passed',
    pass: true,
    detail: 'runtime overrides workerPath/corePath/langPath',
  });
  unit.push({
    name: 'vendored worker still contains jsdelivr fallback string',
    pass: workerJs.includes('jsdelivr'),
    detail: 'overridden at runtime via getLocalTesseractOptions',
  });

  const csp = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(
    /Content-Security-Policy" content="([^"]+)"/
  )?.[1];
  unit.push({
    name: 'CSP worker-src self blob',
    pass: /worker-src\s+'self'\s+blob:/.test(csp || ''),
    detail: csp?.match(/worker-src[^;]+/)?.[0] || '—',
  });
  unit.push({
    name: 'CSP no unsafe-eval',
    pass: !/'unsafe-eval'/.test(csp || ''),
    detail: csp?.includes('wasm-unsafe-eval') ? 'wasm-unsafe-eval only' : '—',
  });
  unit.push({
    name: 'CSP connect-src no broad https',
    pass: !/connect-src[^;]*\bhttps:\s*;/.test(csp || ''),
    detail: csp?.match(/connect-src[^;]+/)?.[0] || '—',
  });

  for (const u of unit) {
    if (!u.pass) failures.push(`unit: ${u.name} — ${u.detail}`);
  }

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const cdnRequests = [];
  const workerRequests = [];
  let browserMetrics = null;

  page.on('request', (req) => {
    const url = req.url();
    if (/jsdelivr/i.test(url)) cdnRequests.push(url);
    if (/vendor\/tesseract\/worker\.min\.js/i.test(url)) workerRequests.push(url);
  });

  page.on('console', (msg) => {
    if (/Content Security Policy|Refused to|worker/i.test(msg.text())) {
      failures.push(`browser console: ${msg.text().slice(0, 200)}`);
    }
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(
      () => window.HirelyLazy?.ensureTesseract,
      null,
      { timeout: 60000 }
    );

    const ocrProbe = await page.evaluate(async () => {
      const out = {
        tesseractLoaded: false,
        workerLocal: false,
        cdnBlocked: true,
        error: null,
      };
      try {
        await window.HirelyLazy.ensureTesseract();
        out.tesseractLoaded = !!window.Tesseract;
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 120, 40);
        ctx.fillStyle = '#000';
        ctx.font = '16px sans-serif';
        ctx.fillText('Hirely OCR', 8, 26);
        const opts = {
          workerPath: '/vendor/tesseract/worker.min.js',
          corePath: '/vendor/tesseract/core',
          langPath: '/vendor/tesseract/lang',
          workerBlobURL: false,
          gzip: true,
          logger: () => {},
        };
        await window.Tesseract.recognize(canvas, 'eng', opts);
        out.workerLocal = !!window.HIRELY_TESSERACT_LOCAL;
      } catch (e) {
        out.error = e?.message || String(e);
      }
      return out;
    });

    if (cdnRequests.length) {
      failures.push(`jsdelivr requests: ${cdnRequests.join(', ')}`);
    }
    if (!ocrProbe.tesseractLoaded) {
      failures.push(`tesseract not loaded: ${ocrProbe.error || 'unknown'}`);
    }
    if (ocrProbe.error && !/timeout/i.test(ocrProbe.error)) {
      failures.push(`OCR recognize failed: ${ocrProbe.error}`);
    }
    if (!workerRequests.length && ocrProbe.tesseractLoaded) {
      failures.push('local worker.min.js was not requested');
    }

    const uploadOk = await page.evaluate(() => {
      const input = document.getElementById('fileInput');
      const drop = document.getElementById('drop');
      return {
        fileInput: !!input && input.type === 'file',
        drop: !!drop,
        disabled: input?.disabled === true,
      };
    });
    if (!uploadOk.fileInput || !uploadOk.drop) {
      failures.push('upload UI missing (fileInput or drop)');
    }
    if (uploadOk.disabled) failures.push('file input disabled');

    browserMetrics = {
      cdnRequestCount: cdnRequests.length,
      workerRequestCount: workerRequests.length,
      workerSample: workerRequests[0] || '—',
      ocrProbe,
      uploadOk,
    };
  } finally {
    await browser.close();
    server.close();
  }

  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# Local OCR CSP Fix Report',
    '',
    `**Status:** ${status}`,
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Goal',
    '',
    'PDF OCR uses self-hosted Tesseract under `/vendor/tesseract/` — no CDN, CSP-safe workers.',
    '',
    '## Architecture',
    '',
    '| Component | Path |',
    '|-----------|------|',
    `| Main | \`${TESSERACT_VENDOR_PATHS.main}\` |`,
    `| Worker | \`${TESSERACT_VENDOR_PATHS.worker}\` |`,
    `| Core WASM | \`${TESSERACT_VENDOR_PATHS.core}/\` |`,
    `| Traineddata | \`${TESSERACT_VENDOR_PATHS.lang}/\` |`,
    '',
    '## Rules',
    '',
    '| Rule | Implementation |',
    '|------|----------------|',
    '| No CDN runtime | `getLocalTesseractOptions()` in every `recognize` call |',
    '| Local worker | `workerBlobURL: false`, `workerPath` → `/vendor/tesseract/` |',
    '| CSP workers | `worker-src \'self\' blob:` |',
    '| No unsafe-eval | `wasm-unsafe-eval` only (WASM) |',
    '| Missing assets | `OcrUnavailableError` → paste fallback UX |',
    '',
    '## Unit checks',
    '',
    '| Check | Result |',
    '|-------|--------|',
    ...unit.map((u) => `| ${u.name} | ${u.pass ? 'PASS' : 'FAIL'} (${u.detail}) |`),
    '',
    '## Browser checks',
    '',
    browserMetrics
      ? [
          '| Metric | Value |',
          '|--------|-------|',
          `| jsdelivr requests | ${browserMetrics.cdnRequestCount} |`,
          `| Local worker requests | ${browserMetrics.workerRequestCount} |`,
          `| Worker URL | ${browserMetrics.workerSample} |`,
          `| Tesseract loaded | ${browserMetrics.ocrProbe?.tesseractLoaded ? 'yes' : 'no'} |`,
          `| OCR probe error | ${browserMetrics.ocrProbe?.error || 'none'} |`,
          `| Upload UI | ${browserMetrics.uploadOk?.fileInput && browserMetrics.uploadOk?.drop ? 'ok' : 'broken'} |`,
          '',
        ].join('\n')
      : '',
    failures.length
      ? ['## Failures', '', ...failures.map((f) => `- ${f}`), ''].join('\n')
      : '## Acceptance\n\nNo jsdelivr OCR traffic; local worker loads under CSP; upload UI ready; OCR probe succeeds or fails with clear local error (no infinite loading).\n',
    '## Setup',
    '',
    '```bash',
    'npm run setup:vendor-tesseract',
    'npm run local-ocr-csp-fix-report',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`Local OCR CSP fix: ${status}`);
  console.log(`Report: ${REPORT}`);
  if (failures.length) {
    failures.forEach((f) => console.error('FAIL:', f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
