#!/usr/bin/env node
/**
 * V1 smoke test — 5 flows: TXT, DOCX, text PDF, paste, scanned PDF.
 * Supported → Review → Style → Export. Scanned → paste panel only.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'tests/output/v1-smoke-test/report.json');
const REPORT_MD = path.join(ROOT, 'V1_SMOKE_TEST_REPORT.md');

const LAB_DIR = path.join(ROOT, 'tests/fixtures/hirely-test-lab');

const FIXTURES = {
  textPdf: path.join(LAB_DIR, 'good.pdf'),
  docx: path.join(LAB_DIR, 'docx.docx'),
  txt: path.join(LAB_DIR, 'txt.txt'),
  pasteText: path.join(LAB_DIR, 'paste.txt'),
  scannedPdf: path.join(LAB_DIR, 'scan.pdf'),
};

const IMPORT_READY_MS = 30000;
const PDF_IMPORT_READY_MS = 120000;
const PASTE_APPLY_MS = 10000;
const STEP_MS = 15000;

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.wasm': 'application/wasm',
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

async function resetPage(page) {
  await page.goto(`http://127.0.0.1:${page.__port}/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => {
      const b = window.__HIRELY_CORE_BOOT__;
      return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
    },
    null,
    { timeout: 60000 }
  );
  await page.waitForSelector('#fileInput', { state: 'attached', timeout: 15000 });
  await page.evaluate(() => {
    document.getElementById('importPasteFallback')?.classList.remove('show');
    const cv = document.getElementById('cvDoc');
    if (cv) cv.classList.remove('cv--loading');
  });
  await page.waitForTimeout(300);
}

async function ensureLazy(page, kind) {
  if (kind === 'pdf') {
    await page.waitForFunction(() => typeof window.HirelyLazy?.ensurePdf === 'function', null, {
      timeout: 60000,
    });
    const err = await page.evaluate(async () => {
      try {
        await window.HirelyLazy.ensurePdf();
        return null;
      } catch (e) {
        return String(e?.message || e);
      }
    });
    if (err) throw new Error(`ensurePdf: ${err}`);
  }
  if (kind === 'docx') {
    await page.waitForFunction(() => typeof window.HirelyLazy?.ensureJsZip === 'function', null, {
      timeout: 60000,
    });
    const err = await page.evaluate(async () => {
      try {
        await window.HirelyLazy.ensureJsZip();
        return null;
      } catch (e) {
        return String(e?.message || e);
      }
    });
    if (err) throw new Error(`ensureJsZip: ${err}`);
  }
}

function snap(page) {
  return page.evaluate(() => ({
    cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
    cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
    docStep: document.getElementById('workspace')?.dataset?.docStep || '',
    pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
    pasteTitle: document.getElementById('importPasteFallbackTitle')?.textContent?.trim() || '',
    styleDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled,
    exportDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="export"]')?.disabled,
    downloadDisabled: document.getElementById('downloadBtn')?.disabled,
    exportBarHidden: document.getElementById('cvExportBar')?.classList.contains('hidden'),
    hasResumeData:
      !!window.HirelyParse?.lastResult?.resumeData ||
      document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled === false,
    loading: document.getElementById('cvDoc')?.classList.contains('cv--loading'),
  }));
}

async function waitImportReady(page, { readyMs = IMPORT_READY_MS } = {}) {
  const t0 = Date.now();
  await page.waitForFunction(
    () => {
      const cv = document.getElementById('cvDoc');
      const cvLen = (cv?.innerText || '').trim().length;
      const step = document.getElementById('workspace')?.dataset?.docStep;
      const loading = cv?.classList.contains('cv--loading');
      const styleOpen =
        document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled === false;
      return cvLen > 80 && step === 'edit' && !loading && styleOpen;
    },
    null,
    { timeout: readyMs }
  );
  return Date.now() - t0;
}

async function uploadFile(page, filePath, opts = {}) {
  await page.locator('#fileInput').setInputFiles(filePath);
  const ms = await waitImportReady(page, opts);
  const state = await snap(page);
  return { ms, ...state };
}

async function pasteFlow(page, text) {
  await page.evaluate(() => {
    window.showImportPasteFallback('', 'IMPORT_NEEDS_PASTE', {
      silentLog: true,
      pasteFirst: true,
      reason: 'PDF_IMAGE_OCR_DISABLED',
    });
  });
  await page.evaluate((t) => {
    const ta = document.getElementById('importPasteFallbackText');
    if (ta) {
      ta.disabled = false;
      ta.removeAttribute('aria-disabled');
      ta.value = t;
    }
  }, text);
  const t0 = Date.now();
  await page.click('#importPasteFallbackApply');
  const ms = await waitImportReady(page, { readyMs: PASTE_APPLY_MS });
  const state = await snap(page);
  return { ms: Date.now() - t0, ...state };
}

async function waitScannedPaste(page) {
  const t0 = Date.now();
  await page.waitForFunction(
    () => {
      const paste = document.getElementById('importPasteFallback');
      const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
      return paste?.classList.contains('show') && !loading;
    },
    null,
    { timeout: 15000 }
  );
  return Date.now() - t0;
}

async function navigateSteps(page) {
  const steps = [];
  for (const step of ['style', 'export']) {
    await page.evaluate((s) => window.setDocStep(s), step);
    await page.waitForFunction(
      (s) => document.getElementById('workspace')?.dataset?.docStep === s,
      step,
      { timeout: STEP_MS }
    );
    const s = await snap(page);
    steps.push({ step, ...s });
  }
  return steps;
}

function assessSupportedFlow(id, importMs, imp, steps) {
  const reviewOk =
    imp.cvLen > 80 &&
    imp.docStep === 'edit' &&
    imp.hasResumeData &&
    imp.styleDisabled === false &&
    imp.exportDisabled === false;
  const styleStep = steps.find((s) => s.step === 'style');
  const exportStep = steps.find((s) => s.step === 'export');
  const styleOk = styleStep?.docStep === 'style';
  const exportOk =
    exportStep?.docStep === 'export' &&
    exportStep?.cvLive &&
    exportStep?.downloadDisabled === false;
  const pass = reviewOk && styleOk && exportOk;
  return {
    id,
    pass,
    importMs,
    review: reviewOk,
    style: styleOk,
    export: exportOk,
    cvLen: imp.cvLen,
    docStep: imp.docStep,
    note: pass
      ? `Review → Style → Export (${importMs}ms import)`
      : [
          !reviewOk && 'Review failed',
          !styleOk && 'Style step blocked',
          !exportOk && 'Export step/download blocked',
        ]
          .filter(Boolean)
          .join('; ') || 'Flow incomplete',
  };
}

function assessScanned(id, ms, s) {
  const honest = /V1|pas pris en charge|not supported|collez|paste/i.test(s.pasteTitle || '');
  const pass = s.pasteVisible && honest && s.docStep === 'import';
  return {
    id,
    pass,
    importMs: ms,
    pasteVisible: s.pasteVisible,
    pasteTitle: s.pasteTitle,
    docStep: s.docStep,
    note: pass ? `Paste panel in ${ms}ms (no OCR)` : 'Expected paste panel for scanned PDF',
  };
}

async function runSupported(page, id, filePath, lazyKind) {
  await resetPage(page);
  if (lazyKind) await ensureLazy(page, lazyKind);
  const readyMs = lazyKind === 'pdf' ? PDF_IMPORT_READY_MS : IMPORT_READY_MS;
  const imp = await uploadFile(page, filePath, { readyMs });
  const steps = await navigateSteps(page);
  return assessSupportedFlow(id, imp.ms, imp, steps);
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);
  for (const [k, p] of Object.entries(FIXTURES)) {
    if (!fs.existsSync(p)) {
      console.error(`Missing fixture ${k}: ${p}`);
      process.exit(1);
    }
  }

  const pasteBody = fs.readFileSync(FIXTURES.pasteText, 'utf8');
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.__port = port;

  const results = [];
  const runAt = new Date().toISOString();

  try {
    for (const [id, fp, lazy] of [
      ['txt', FIXTURES.txt, null],
      ['docx', FIXTURES.docx, 'docx'],
      ['text_pdf', FIXTURES.textPdf, 'pdf'],
    ]) {
      try {
        results.push(await runSupported(page, id, fp, lazy));
      } catch (err) {
        results.push({
          id,
          pass: false,
          importMs: -1,
          review: false,
          style: false,
          export: false,
          note: `Error: ${err?.message || err}`,
        });
      }
    }

    try {
      await resetPage(page);
      const imp = await pasteFlow(page, pasteBody);
      const steps = await navigateSteps(page);
      results.push(assessSupportedFlow('paste_text', imp.ms, imp, steps));
    } catch (err) {
      results.push({
        id: 'paste_text',
        pass: false,
        importMs: -1,
        note: `Error: ${err?.message || err}`,
      });
    }

    try {
      await resetPage(page);
      await ensureLazy(page, 'pdf');
      await page.locator('#fileInput').setInputFiles(FIXTURES.scannedPdf);
      const ms = await waitScannedPaste(page);
      const s = await snap(page);
      results.push(assessScanned('scanned_pdf', ms, s));
    } catch (err) {
      results.push({
        id: 'scanned_pdf',
        pass: false,
        importMs: -1,
        note: `Error: ${err?.message || err}`,
      });
    }
  } finally {
    await browser.close();
    server.close();
  }

  const allPass = results.every((r) => r.pass);
  const payload = { runAt, results, status: allPass ? 'PASS' : 'FAIL', fixtures: FIXTURES };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# V1 Smoke Test',
    '',
    `**Status:** **${payload.status}**`,
    `**Run:** ${runAt}`,
    '',
    '## Scope',
    '',
    '| # | Flow | Expected |',
    '|---|------|----------|',
    '| 1 | TXT | Review → Style → Export |',
    '| 2 | DOCX | Review → Style → Export |',
    '| 3 | Text PDF | Review → Style → Export |',
    '| 4 | Paste text | Review → Style → Export |',
    '| 5 | Scanned PDF | Paste panel (no OCR) |',
    '',
    '## Results',
    '',
    '| Flow | Pass | Import | Review | Style | Export | Notes |',
    '|------|------|--------|--------|-------|--------|-------|',
  ];

  for (const r of results) {
    const rev = r.review == null ? '—' : r.review ? '✓' : '✗';
    const sty = r.style == null ? '—' : r.style ? '✓' : '✗';
    const exp = r.export == null ? '—' : r.export ? '✓' : '✗';
    lines.push(
      `| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.importMs ?? '—'}ms | ${rev} | ${sty} | ${exp} | ${r.note} |`
    );
  }

  lines.push(
    '',
    '## Verification',
    '',
    '```bash',
    'npm run v1-smoke-test',
    '```',
    '',
    `Raw JSON: \`tests/output/v1-smoke-test/report.json\``,
    ''
  );

  fs.writeFileSync(REPORT_MD, lines.join('\n'));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
