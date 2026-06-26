#!/usr/bin/env node
/**
 * OCR auto-import report — native PDF → OCR fallback → review (no paste-first).
 * Generates OCR_IMPORT_REPORT.md
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../src/vendor/tesseract-runtime.js';
import { OCR_FALLBACK_V1_NATIVE_MIN, OCR_FALLBACK_V1_PASTE_MAX_CHARS, OCR_FALLBACK_V1_OCR_MAX_MS } from '../src/core/import/ocr-fallback-v1.js';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_MD = path.join(ROOT, 'OCR_IMPORT_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/ocr-import-report/report.json');
const BUDGET_MS = 25000;
const AUTO_TARGET_RATE = 0.95;

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

async function runImportCase(page, filePath, label) {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${page._hirelyPort}/index.html`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => {
      const b = window.__HIRELY_CORE_BOOT__;
      return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
    },
    null,
    { timeout: 60000 }
  );

  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  await page.setInputFiles('#fileInput', filePath);

  let outcome;
  try {
    await page.waitForFunction(
      () => {
        const paste = document.getElementById('importPasteFallback')?.classList.contains('show');
        const cvLen = (document.getElementById('cvDoc')?.innerText || '').trim().length;
        const step = document.getElementById('workspace')?.dataset?.docStep;
        const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
        if (paste) return true;
        if (cvLen > 80 && step === 'edit' && !loading) return true;
        return false;
      },
      null,
      { timeout: BUDGET_MS }
    );
    outcome = 'settled';
  } catch {
    outcome = 'timeout';
  }

  const snap = await page.evaluate(() => ({
    cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
    docStep: document.getElementById('workspace')?.dataset?.docStep || '',
    pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
    earlyPaste: document
      .getElementById('importPasteFallback')
      ?.classList.contains('importPasteFallback--early'),
    liveStatus: document.getElementById('importLiveStatus')?.textContent || '',
    statusText: document.getElementById('statusText')?.textContent || '',
    ocrAuto: globalThis.HIRELY_OCR_AUTO === true,
    ocrDisabled: globalThis.HIRELY_OCR_DISABLED_V1 === true,
    pdfMaxMs: Number(globalThis.HIRELY_PDF_EXTRACTION_MAX_MS) || 0,
  }));

  const ms = Date.now() - t0;
  const autoImport =
    !snap.pasteVisible && snap.cvLen > 80 && snap.docStep === 'edit' && outcome === 'settled';
  const ocrProgressSeen = /ocr|analy|extract|building|lecture/i.test(
    `${snap.liveStatus} ${snap.statusText}`
  );

  return {
    label,
    file: path.basename(filePath),
    ms,
    outcome,
    autoImport,
    ocrProgressSeen,
    pasteBeforeOcr: snap.earlyPaste,
    ...snap,
  };
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);
  const vendor = ensureVendor();
  const lab = path.join(ROOT, 'tests/fixtures/hirely-test-lab');
  const cases = [
    { label: 'Scanned PDF (image-only)', file: 'scan.pdf', expectAuto: true },
    { label: 'Text PDF (native)', file: 'good.pdf', expectAuto: true },
    { label: 'Canva export PDF', file: 'canva-export.pdf', expectAuto: true },
    { label: 'Corrupt PDF', file: 'bad.pdf', expectAuto: false },
  ]
    .map((c) => ({ ...c, path: path.join(lab, c.file) }))
    .filter((c) => fs.existsSync(c.path));

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page._hirelyPort = port;

  const results = [];
  try {
    for (const c of cases) {
      results.push(await runImportCase(page, c.path, c.label));
    }
  } finally {
    await browser.close();
    server.close();
  }

  const scannable = results.filter((r) => r.label !== 'Corrupt PDF');
  const autoCount = scannable.filter((r) => r.autoImport).length;
  const autoRate = scannable.length ? autoCount / scannable.length : 0;
  const ocrEnabled = results.every((r) => r.ocrAuto && !r.ocrDisabled);
  const noEarlyPasteOnScan = results
    .filter((r) => /scan|canva/i.test(r.file))
    .every((r) => !r.pasteBeforeOcr);
  const scanAuto = results.find((r) => r.file === 'scan.pdf')?.autoImport === true;
  const meetsTarget = autoRate >= AUTO_TARGET_RATE;

  const checks = [
    { id: 'vendor_assets', pass: vendor.ok, detail: vendor.missing.join(', ') || 'ok' },
    { id: 'ocr_flags_enabled', pass: ocrEnabled, detail: String(ocrEnabled) },
    { id: 'scan_auto_import', pass: scanAuto, detail: String(scanAuto) },
    { id: 'no_early_paste', pass: noEarlyPasteOnScan, detail: String(noEarlyPasteOnScan) },
    {
      id: 'auto_rate_95',
      pass: meetsTarget,
      detail: `${Math.round(autoRate * 100)}% (${autoCount}/${scannable.length})`,
    },
  ];
  const status = checks.every((c) => c.pass) ? 'PASS' : 'FAIL';

  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    minChars: OCR_FALLBACK_V1_NATIVE_MIN,
    ocrReviewMin: OCR_FALLBACK_V1_PASTE_MAX_CHARS + 1,
    ocrMaxMs: OCR_FALLBACK_V1_OCR_MAX_MS,
    autoTargetRate: AUTO_TARGET_RATE,
    autoRate,
    checks,
    results,
    vendor,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# OCR Import Report',
    '',
    `**Status:** ${status}`,
    `**Generated:** ${payload.generatedAt}`,
    '',
    '## Flow',
    '',
    '1. PDF upload',
    '2. Native PDF extraction (pdf.js)',
    `3. If extracted text < ${OCR_FALLBACK_V1_NATIVE_MIN} chars → automatic OCR (max ${OCR_FALLBACK_V1_OCR_MAX_MS / 1000}s)`,
    `4. If OCR text > ${OCR_FALLBACK_V1_PASTE_MAX_CHARS} chars → createResumeFromText → review`,
    `5. If OCR text ≤ ${OCR_FALLBACK_V1_PASTE_MAX_CHARS} chars → paste panel`,
    '',
    '## Progress copy',
    '',
    '- Lecture du PDF…',
    '- Reconnaissance du texte…',
    '- Création du CV…',
    '',
    '## Auto-import rate',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Scannable fixtures | ${scannable.length} |`,
    `| Auto-import (no paste) | ${autoCount} |`,
    `| Rate | ${Math.round(autoRate * 100)}% |`,
    `| Target | ≥ ${Math.round(AUTO_TARGET_RATE * 100)}% |`,
    '',
    '## Checks',
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    ...checks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail} |`),
    '',
    '## Fixture results',
    '',
    '| File | ms | Auto-import | Paste | Live status |',
    '|------|-----|-------------|-------|-------------|',
    ...results.map(
      (r) =>
        `| ${r.file} | ${r.ms} | ${r.autoImport ? 'yes' : 'no'} | ${r.pasteVisible ? 'yes' : 'no'} | ${(r.liveStatus || '—').slice(0, 48)} |`
    ),
    '',
    '## Stack',
    '',
    '- pdf.js — native text layer + page render for OCR',
    '- tesseract.js — multipage scanned PDF / image OCR',
    '',
    '## Re-run',
    '',
    '```bash',
    'npm run ocr-import-report',
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
