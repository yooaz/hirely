#!/usr/bin/env node
/**
 * OCR Page Renderer report — browser validation + OCR_PAGE_RENDERER_REPORT.md
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../src/vendor/tesseract-runtime.js';
import {
  OCR_PAGE_RENDER_SCALE,
  OCR_PAGE_RENDERER_MAX_MS,
} from '../src/core/extraction/pdf-ocr-page-renderer.js';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_MD = path.join(ROOT, 'OCR_PAGE_RENDERER_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/ocr-page-renderer/report.json');

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
      '.pdf': 'application/pdf',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
      const fp = path.join(ROOT, decodeURIComponent(rel));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': mime(fp) });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function ensureVendor() {
  const missing = TESSERACT_REQUIRED_ASSETS.filter(
    (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  if (!missing.length) return { ok: true, missing: [] };
  const res = spawnSync('node', ['scripts/setup-vendor-tesseract.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 300000,
  });
  const stillMissing = TESSERACT_REQUIRED_ASSETS.filter(
    (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  return { ok: res.status === 0 && stillMissing.length === 0, missing: stillMissing };
}

async function runRendererOnPdf(page, port, pdfRelPath) {
  const t0 = Date.now();
  try {
    const result = await page.evaluate(
      async ({ pdfRelPath, maxMs, scale }) => {
        await window.HirelyLazy?.ensurePdf?.();
        await window.HirelyLazy?.ensureTesseract?.();
        const pdfjs = window.pdfjsLib;
        if (!pdfjs) throw new Error('PDFJS_MISSING');
        const mod = await import('/src/core/extraction/pdf-ocr-page-renderer.js');
        const res = await fetch(pdfRelPath);
        const buf = await res.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
        const out = await mod.ocrPdfPagesWithRenderer(pdf, { maxMs, scale });
        return {
          ...out,
          scaleUsed: scale,
          maxMsUsed: maxMs,
        };
      },
      {
        pdfRelPath,
        maxMs: OCR_PAGE_RENDERER_MAX_MS,
        scale: OCR_PAGE_RENDER_SCALE,
      }
    );
    return { ...result, wallMs: Date.now() - t0, error: null };
  } catch (err) {
    return {
      pageCount: 0,
      ocrAttempted: true,
      ocrTextPerPage: [],
      totalOcrTextLength: 0,
      rawText: '',
      pagesProcessed: 0,
      timedOut: false,
      elapsedMs: Date.now() - t0,
      wallMs: Date.now() - t0,
      error: String(err?.message || err),
    };
  }
}

function validateShape(r) {
  return (
    r &&
    r.ocrAttempted === true &&
    typeof r.pageCount === 'number' &&
    Array.isArray(r.ocrTextPerPage) &&
    typeof r.totalOcrTextLength === 'number' &&
    typeof r.rawText === 'string' &&
    r.totalOcrTextLength === r.rawText.length
  );
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);
  const vendor = ensureVendor();
  const scanPdf = '/tests/fixtures/hirely-test-lab/scan.pdf';
  const badPdf = '/tests/fixtures/hirely-test-lab/bad.pdf';

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  let scan = null;
  let bad = null;
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const b = window.__HIRELY_CORE_BOOT__;
        return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
      },
      null,
      { timeout: 60000 }
    );
    scan = await runRendererOnPdf(page, port, scanPdf);
    bad = await runRendererOnPdf(page, port, badPdf);
  } finally {
    await browser.close();
    server.close();
  }

  const checks = [
    { id: 'vendor_assets', pass: vendor.ok, detail: vendor.missing.join(', ') || 'ok' },
    {
      id: 'return_shape',
      pass: validateShape(scan),
      detail: scan ? 'scan.pdf shape ok' : 'missing scan result',
    },
    {
      id: 'scale_2',
      pass: scan?.scaleUsed === 2,
      detail: String(scan?.scaleUsed),
    },
    {
      id: 'scan_text_length',
      pass: (scan?.totalOcrTextLength ?? 0) > 100,
      detail: String(scan?.totalOcrTextLength ?? 0),
    },
    {
      id: 'pages_in_order',
      pass: (scan?.ocrTextPerPage?.length ?? 0) >= 1 && scan?.pagesProcessed === scan?.ocrTextPerPage?.length,
      detail: `${scan?.pagesProcessed ?? 0}/${scan?.pageCount ?? 0}`,
    },
    {
      id: 'budget_20s',
      pass: (scan?.elapsedMs ?? 99999) <= OCR_PAGE_RENDERER_MAX_MS + 3000,
      detail: `${scan?.elapsedMs ?? '—'}ms`,
    },
    {
      id: 'unreadable_low_text',
      pass: (bad?.totalOcrTextLength ?? 0) <= 100,
      detail: bad?.error ? `open failed: ${bad.error}` : String(bad?.totalOcrTextLength ?? 0),
    },
  ];

  const status = checks.every((c) => c.pass) ? 'PASS' : 'FAIL';

  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    scale: OCR_PAGE_RENDER_SCALE,
    maxMs: OCR_PAGE_RENDERER_MAX_MS,
    checks,
    scan,
    bad,
    vendor,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# OCR Page Renderer Report',
    '',
    `**Status:** ${status}`,
    `**Generated:** ${payload.generatedAt}`,
    '',
    '## Pipeline',
    '',
    'For each PDF page:',
    '',
    `1. Render page to canvas at **scale ${OCR_PAGE_RENDER_SCALE}** (pdf.js)`,
    '2. Convert canvas → PNG image',
    '3. OCR with Tesseract.js',
    '4. Append page text in order',
    '',
    `**Total budget:** ${OCR_PAGE_RENDERER_MAX_MS / 1000}s — no retry loop`,
    '',
    '## Return shape',
    '',
    '```json',
    '{',
    '  "pageCount": number,',
    '  "ocrAttempted": true,',
    '  "ocrTextPerPage": string[],',
    '  "totalOcrTextLength": number,',
    '  "rawText": string',
    '}',
    '```',
    '',
    '## Checks',
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    ...checks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail} |`),
    '',
    '## scan.pdf (readable scan)',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| pageCount | ${scan?.pageCount ?? '—'} |`,
    `| pagesProcessed | ${scan?.pagesProcessed ?? '—'} |`,
    `| totalOcrTextLength | ${scan?.totalOcrTextLength ?? '—'} |`,
    `| elapsedMs | ${scan?.elapsedMs ?? '—'} |`,
    `| timedOut | ${scan?.timedOut ?? '—'} |`,
    '',
    '### Per-page text lengths',
    '',
    ...(scan?.ocrTextPerPage || []).map((t, i) => `- Page ${i + 1}: ${String(t || '').length} chars`),
    '',
    '## bad.pdf (unreadable)',
    '',
    `| totalOcrTextLength | ${bad?.totalOcrTextLength ?? '—'} |`,
    `| paste expected | ≤ 100 chars after import |`,
    '',
    '## Module',
    '',
    '`src/core/extraction/pdf-ocr-page-renderer.js`',
    '',
    '## Re-run',
    '',
    '```bash',
    'npm run ocr-page-renderer-report',
    '```',
    '',
  ];

  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log(`Wrote ${OUT_MD} — ${status}`);
  process.exit(status === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
