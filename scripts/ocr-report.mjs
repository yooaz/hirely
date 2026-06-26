#!/usr/bin/env node
/**
 * P0 OCR auto-import report — Tesseract pipeline, scanned PDF, confidence UI.
 * Generates OCR_REPORT.md
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../src/vendor/tesseract-runtime.js';
import { OCR_CONFIDENCE_WARN_THRESHOLD } from '../src/core/extraction/ocr-quality-score.js';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'OCR_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/ocr-report/report.json');
const SCANNED_FAST_MS = 90000;

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

async function uploadFile(page, filePath) {
  const t0 = Date.now();
  await page.setInputFiles('#fileInput', filePath);
  await page.waitForFunction(
    () => {
      const paste = document.getElementById('importPasteFallback')?.classList.contains('show');
      const cvLen = (document.getElementById('cvDoc')?.innerText || '').trim().length;
      const step = document.getElementById('workspace')?.dataset?.docStep;
      const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
      if (cvLen > 80 && step === 'edit' && !loading) return true;
      return false;
    },
    null,
    { timeout: SCANNED_FAST_MS }
  );
  return page.evaluate(() => ({
    ms: 0,
    cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
    docStep: document.getElementById('workspace')?.dataset?.docStep || '',
    pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
    liveStatus: document.getElementById('importLiveStatus')?.textContent || '',
    ocrConfidence: document.getElementById('importOcrConfidence')?.textContent || '',
    ocrConfidenceVisible: !document
      .getElementById('importOcrConfidence')
      ?.classList.contains('hidden'),
    statusText: document.getElementById('statusText')?.textContent || '',
    ocrAuto: globalThis.HIRELY_OCR_AUTO === true,
    ocrDisabled: globalThis.HIRELY_OCR_DISABLED_V1 === true,
  })).then((r) => ({ ...r, ms: Date.now() - t0 }));
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);
  const vendor = ensureVendor();
  const scannedPdf = [
    path.join(ROOT, 'tests/fixtures/hirely-test-lab/scan.pdf'),
    path.join(ROOT, 'tests/fixtures/scanned-pdf/sample.pdf'),
  ].find((p) => fs.existsSync(p));

  const checks = [];
  let pass = vendor.ok && !!scannedPdf;

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  let scanned = null;
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
    if (scannedPdf) scanned = await uploadFile(page, scannedPdf);
  } finally {
    await browser.close();
    server.close();
  }

  const ocrEnabled = scanned?.ocrAuto === true && scanned?.ocrDisabled !== true;
  const noPaste = scanned ? !scanned.pasteVisible : false;
  const hasCv = scanned ? scanned.cvLen > 80 : false;
  const hasConfidence = scanned ? scanned.ocrConfidenceVisible && /confiance/i.test(scanned.ocrConfidence) : false;
  const fastEnough = scanned ? scanned.ms <= SCANNED_FAST_MS : false;

  checks.push({ id: 'vendor_assets', pass: vendor.ok, detail: vendor.missing.join(', ') || 'ok' });
  checks.push({ id: 'ocr_auto_flag', pass: ocrEnabled, detail: String(ocrEnabled) });
  checks.push({ id: 'scanned_no_paste', pass: noPaste, detail: scanned?.pasteVisible ? 'paste shown' : 'ok' });
  checks.push({ id: 'scanned_cv_preview', pass: hasCv, detail: String(scanned?.cvLen ?? 0) });
  checks.push({ id: 'ocr_confidence_ui', pass: hasConfidence, detail: scanned?.ocrConfidence || 'missing' });
  checks.push({ id: 'scanned_timing', pass: fastEnough, detail: `${scanned?.ms ?? '—'}ms` });

  pass = checks.every((c) => c.pass);

  const payload = {
    generatedAt: new Date().toISOString(),
    status: pass ? 'PASS' : 'FAIL',
    confidenceWarnThreshold: OCR_CONFIDENCE_WARN_THRESHOLD,
    scannedPdf: scannedPdf ? path.relative(ROOT, scannedPdf) : null,
    vendor,
    scanned,
    checks,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const md = [
    '# OCR Report (P0 auto-import)',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${payload.generatedAt}`,
    '',
    '## Pipeline',
    '',
    '1. PDF/image upload',
    '2. Native text probe → image/scanned detection',
    '3. Tesseract.js OCR (local vendored worker + WASM)',
    '4. Text cleanup → parser → CV generation',
    '5. Confidence shown; warning if < 60% — import never blocked',
    '',
    '## UX',
    '',
    '- Loading: **Analyse du CV...**',
    `- Confidence warn threshold: **${OCR_CONFIDENCE_WARN_THRESHOLD}%**`,
    '- Paste fallback: **not used** for OCR-sourced imports when text is recovered',
    '',
    '## Vendor',
    '',
    `| Check | Result |`,
    `|-------|--------|`,
    `| Tesseract assets | ${vendor.ok ? 'OK' : 'FAIL'} |`,
    ...(vendor.missing.length ? [`| Missing | \`${vendor.missing.join('`, `')}\` |`] : []),
    '',
    '## Scanned PDF test',
    '',
    scannedPdf ? `Fixture: \`${path.relative(ROOT, scannedPdf)}\`` : '_No scanned fixture found_',
    '',
    scanned
      ? [
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Duration | ${scanned.ms}ms |`,
          `| CV preview chars | ${scanned.cvLen} |`,
          `| Doc step | ${scanned.docStep} |`,
          `| Paste panel | ${scanned.pasteVisible ? 'visible (FAIL)' : 'hidden (OK)'} |`,
          `| Live status | ${scanned.liveStatus || '—'} |`,
          `| OCR confidence UI | ${scanned.ocrConfidence || '—'} |`,
          `| HIRELY_OCR_AUTO | ${scanned.ocrAuto} |`,
        ].join('\n')
      : '',
    '',
    '## Checks',
    '',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.detail}`),
    '',
    '## Commands',
    '',
    '```bash',
    'npm run setup:vendor-tesseract',
    'npm run ocr-report',
    '```',
    '',
  ].join('\n');

  fs.writeFileSync(OUT_MD, md);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
