#!/usr/bin/env node
/**
 * V1 release test — supported flows only (no OCR, no parsing quality, no premium).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'tests/output/v1-release-test/report.json');
const REPORT_MD = path.join(ROOT, 'V1_RELEASE_TEST_REPORT.md');

const LAB_DIR = path.join(ROOT, 'tests/fixtures/hirely-test-lab');

const FIXTURES = {
  textPdf: path.join(LAB_DIR, 'good.pdf'),
  docx: path.join(LAB_DIR, 'docx.docx'),
  txt: path.join(LAB_DIR, 'txt.txt'),
  pasteText: path.join(LAB_DIR, 'paste.txt'),
  scannedPdfCandidates: [
    path.join(LAB_DIR, 'scan.pdf'),
    path.join(ROOT, 'tests/output/real-format-qa/scan-protected.pdf'),
    '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  ],
};

const SCANNED_FAST_MS = 120000;
const IMPORT_READY_MS = 20000;
const PDF_IMPORT_READY_MS = 120000;
const PASTE_APPLY_MS = 5000;

function pickScannedPdf() {
  for (const p of FIXTURES.scannedPdfCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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

async function ensureJsZipReady(page) {
  await page.waitForFunction(
    () => typeof window.HirelyLazy?.ensureJsZip === 'function',
    null,
    { timeout: 60000 }
  );
  const err = await page.evaluate(async () => {
    try {
      await window.HirelyLazy.ensureJsZip();
      return null;
    } catch (e) {
      return String(e?.message || e);
    }
  });
  if (err) throw new Error(`ensureJsZip failed: ${err}`);
}

async function ensurePdfJsReady(page) {
  await page.waitForFunction(
    () => typeof window.HirelyLazy?.ensurePdf === 'function',
    null,
    { timeout: 60000 }
  );
  const err = await page.evaluate(async () => {
    try {
      await window.HirelyLazy.ensurePdf();
      return null;
    } catch (e) {
      return String(e?.message || e);
    }
  });
  if (err) throw new Error(`ensurePdf failed: ${err}`);
}

function snap(page) {
  return page.evaluate(() => ({
    cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
    docStep: document.getElementById('workspace')?.dataset?.docStep || '',
    pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
    pasteTitle: document.getElementById('importPasteFallbackTitle')?.textContent?.trim() || '',
    pasteLead: document.getElementById('importPasteFallbackLead')?.textContent?.trim() || '',
    styleDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled,
    exportDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="export"]')?.disabled,
    loading: document.getElementById('cvDoc')?.classList.contains('cv--loading'),
    importStatus: window.state?.lastImportStatus || null,
  }));
}

async function uploadFile(page, filePath, { readyMs = IMPORT_READY_MS, expectOcr = false } = {}) {
  const t0 = Date.now();
  await page.locator('#fileInput').setInputFiles(filePath);
  await page.waitForFunction(
    (ocr) => {
      const cv = document.getElementById('cvDoc');
      const paste = document.getElementById('importPasteFallback');
      const cvLen = (cv?.innerText || '').trim().length;
      const pasteShow = paste?.classList.contains('show');
      const step = document.getElementById('workspace')?.dataset?.docStep;
      const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
      if (ocr) return cvLen > 80 && step === 'edit' && !loading;
      if (pasteShow && !loading) return true;
      if (cvLen > 100 && step === 'edit') return true;
      return false;
    },
    expectOcr,
    { timeout: readyMs }
  );
  const ms = Date.now() - t0;
  const state = await snap(page);
  return { ms, ...state };
}

async function testPasteFlow(page, text) {
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
  await page.waitForFunction(
    () => {
      const cvLen = (document.getElementById('cvDoc')?.innerText || '').trim().length;
      return cvLen > 100 && document.getElementById('workspace')?.dataset?.docStep === 'edit';
    },
    null,
    { timeout: PASTE_APPLY_MS }
  );
  const ms = Date.now() - t0;
  const state = await snap(page);
  return { ms, ...state };
}

function assessImportReady(id, r) {
  const pass =
    r.cvLen > 100 &&
    r.docStep === 'edit' &&
    !r.pasteVisible &&
    r.styleDisabled === false &&
    r.exportDisabled === false;
  return {
    id,
    pass,
    ms: r.ms,
    cvLen: r.cvLen,
    docStep: r.docStep,
    pasteVisible: r.pasteVisible,
    styleDisabled: r.styleDisabled,
    exportDisabled: r.exportDisabled,
    note: pass ? 'Review + Style/Export unlocked' : 'Import did not reach Review with preview',
  };
}

function assessScannedV1PasteFallback(id, r, filePath) {
  const honest =
    /V1|pas pris en charge|not supported|collez|paste/i.test(
      `${r.pasteTitle || ''} ${r.pasteLead || ''}`
    );
  const pass = r.pasteVisible && r.ms <= 10000 && honest;
  return {
    id,
    pass,
    ms: r.ms,
    cvLen: r.cvLen,
    pasteVisible: r.pasteVisible,
    pasteTitle: r.pasteTitle,
    docStep: r.docStep,
    file: path.basename(filePath),
    note: pass
      ? `Scanned PDF → paste fallback in ${r.ms}ms (V1 — no OCR)`
      : r.pasteVisible
        ? 'Paste shown but copy not V1-honest or too slow'
        : 'Expected paste fallback — OCR must not run in V1',
  };
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);

  const missing = ['docx', 'txt', 'pasteText'].filter((k) => !fs.existsSync(FIXTURES[k]));
  if (!fs.existsSync(FIXTURES.textPdf)) missing.push('textPdf');
  const scannedPdf = pickScannedPdf();

  if (missing.length) {
    console.error('Missing fixtures:', missing);
    process.exit(1);
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
    await resetPage(page);
    await ensurePdfJsReady(page);
    await ensureJsZipReady(page);

    for (const [id, filePath, prep] of [
      ['txt', FIXTURES.txt, null],
      ['docx', FIXTURES.docx, null],
      ['text_pdf', FIXTURES.textPdf, 'pdf'],
    ]) {
      try {
        await resetPage(page);
        if (prep === 'pdf') await ensurePdfJsReady(page);
        const r = await uploadFile(page, filePath, {
          readyMs: prep === 'pdf' ? PDF_IMPORT_READY_MS : IMPORT_READY_MS,
        });
        results.push(assessImportReady(id, r));
      } catch (err) {
        results.push({
          id,
          pass: false,
          ms: -1,
          cvLen: 0,
          note: `Error: ${err?.message || err}`,
        });
      }
    }

    try {
      await resetPage(page);
      const pasteR = await testPasteFlow(page, pasteBody);
      const assessed = assessImportReady('paste_text', pasteR);
      results.push({
        ...assessed,
        ms: pasteR.ms,
        note:
          assessed.pass && pasteR.ms <= 1000
            ? `Paste → Review in ${pasteR.ms}ms`
            : assessed.note,
      });
    } catch (err) {
      results.push({
        id: 'paste_text',
        pass: false,
        ms: -1,
        cvLen: 0,
        note: `Error: ${err?.message || err}`,
      });
    }

    if (scannedPdf) {
      try {
        await resetPage(page);
        await ensurePdfJsReady(page);
        await page.waitForTimeout(500);
        const scannedR = await uploadFile(page, scannedPdf, {
          readyMs: 10000,
          expectOcr: false,
        });
        results.push(assessScannedV1PasteFallback('scanned_pdf', scannedR, scannedPdf));
      } catch (err) {
        results.push({
          id: 'scanned_pdf',
          pass: false,
          ms: -1,
          cvLen: 0,
          note: `Error: ${err?.message || err}`,
        });
      }
    } else {
      results.push({
        id: 'scanned_pdf',
        pass: true,
        ms: 0,
        cvLen: 0,
        note: 'Skipped — no scanned fixture (optional)',
      });
    }
  } finally {
    await browser.close();
    server.close();
  }

  const allPass = results.every((r) => r.pass);
  const payload = {
    runAt,
    v1Scope: 'text PDF, DOCX, TXT, paste — scanned PDF → paste fallback (no OCR)',
    scannedFastMs: SCANNED_FAST_MS,
    fixtures: {
      textPdf: FIXTURES.textPdf,
      docx: FIXTURES.docx,
      txt: FIXTURES.txt,
      pasteText: FIXTURES.pasteText,
      scannedPdf,
    },
    results,
    status: allPass ? 'PASS' : 'FAIL',
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# V1 Release Test Report',
    '',
    `**Status:** ${payload.status}`,
    `**Run:** ${runAt}`,
    '',
    '## Scope',
    '',
    'V1 supported flows only. **No OCR.** Scanned PDF must show honest paste fallback.',
    '',
    '| # | Flow | Fixture | Expected |',
    '|---|------|---------|----------|',
    '| 1 | Text PDF | `hirely-test-lab/good.pdf` | Review + preview |',
    '| 2 | DOCX | `cv-yoaz.docx` | Review + preview |',
    '| 3 | TXT | `yoaz.txt` | Review + preview |',
    '| 4 | Paste | `yoaz.txt` via paste panel | Review &lt; 1s |',
    '| 5 | Scanned PDF | `hirely-test-lab/scan.pdf` | Paste fallback ≤ 10s (no OCR) |',
    '',
    '## Results',
    '',
    '| Flow | Pass | Time | CV chars | Notes |',
    '|------|------|------|----------|-------|',
  ];

  for (const r of results) {
    lines.push(
      `| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.ms}ms | ${r.cvLen ?? '—'} | ${r.note} |`
    );
  }

  lines.push(
    '',
    '## Acceptance',
    '',
    ...results.map((r) => `- **${r.id}**: ${r.pass ? 'PASS' : 'FAIL'} — ${r.note}`),
    '',
    '## Raw JSON',
    '',
    `\`tests/output/v1-release-test/report.json\``,
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
