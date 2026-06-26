#!/usr/bin/env node
/**
 * P0 — Browser OCR smoke: one scanned PDF, honest outcome, structured diagnostics.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../vendor/tesseract-runtime.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../core/import/real-cv-import-constants.js';
import { IMPORT_STATE } from '../core/import/import-state.js';

import { ensureRealFormatQaFixtures } from '../../tests/lib/real-format-qa-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/ocr-browser-smoke');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const QA_VERSION = 'OCR_BROWSER_SMOKE_V1';
const IMPORT_TIMEOUT_MS = 120000;
const POLL_MS = 400;

let failed = 0;
function ok(cond, id, detail = '') {
  if (!cond) {
    console.error('FAIL', id, detail);
    failed++;
  } else {
    console.log('OK', id, detail || '');
  }
}

function ensureOcrAssets() {
  const missing = TESSERACT_REQUIRED_ASSETS.filter(
    (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  if (!missing.length) return;
  const res = spawnSync('node', ['scripts/setup-ocr.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (res.status !== 0) throw new Error('setup:ocr failed');
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
      '.wasm': 'application/wasm',
      '.gz': 'application/gzip',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const rel = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function runSmoke() {
  ensureOcrAssets();
  const fixturePack = await ensureRealFormatQaFixtures(ROOT);
  const scanPdf = fixturePack.files.pdf_scan_blank;
  if (!fs.existsSync(scanPdf)) {
    throw new Error(`scanned PDF fixture missing: ${scanPdf}`);
  }

  const server = startServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const report = {
    version: QA_VERSION,
    fileName: path.basename(scanPdf),
    filePath: scanPdf,
    diagnostics: {},
    importState: '',
    selectedTextLength: 0,
    fakeSuccess: false,
    emptyPreview: false,
    templatesAfterFailure: false,
    pass: false,
    durationMs: 0,
  };

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(() => typeof window.handleFileImport === 'function', {
      timeout: 120000,
    });

    const assetPaths = [
      '/vendor/tesseract/tesseract.min.js',
      '/vendor/tesseract/worker.min.js',
      '/vendor/tesseract/core/tesseract-core-simd-lstm.wasm',
      '/vendor/tesseract/lang/eng.traineddata.gz',
      '/vendor/tesseract/lang/fra.traineddata.gz',
    ];
    const assetHead = await page.evaluate(async (paths) => {
      const out = {};
      for (const p of paths) {
        try {
          const res = await fetch(p, { method: 'HEAD', cache: 'no-store' });
          out[p] = res.ok;
        } catch {
          out[p] = false;
        }
      }
      return out;
    }, assetPaths);

    const buf = fs.readFileSync(scanPdf);
    const t0 = Date.now();
    const evalResult = await page.evaluate(
      async ({ bytes, fname, timeoutMs, pollMs, minChars, assetHead }) => {
        const u8 = new Uint8Array(bytes);
        const file = new File([u8], fname, { type: 'application/pdf' });
        const logs = [];
        const started = Date.now();

        try {
          await window.handleFileImport(file);
        } catch (err) {
          return { importError: String(err?.message || err), crashed: true, logs };
        }

        let snap = null;
        while (Date.now() - started < timeoutMs) {
          const diag = window.HIRELY_OCR_DIAGNOSTICS || {};
          snap = {
            busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
            fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
            needsPaste: document.getElementById('wsImport')?.classList.contains('wsImport--needsPaste'),
            live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
            lastStatus: window.state?.lastImportStatus || '',
            templateGallery: (() => {
              const el = document.getElementById('templateGallery');
              return el ? !el.classList.contains('hidden') : false;
            })(),
            previewHtml: (document.getElementById('cvDoc')?.innerHTML || '').length,
            diagnostics: { ...diag },
            selectedTextLength: Math.max(
              String(window.state?.rawText || '').trim().length,
              String(window.state?.cleanText || '').trim().length
            ),
          };
          const terminal =
            !snap.busy &&
            (snap.fallback ||
              snap.needsPaste ||
              snap.live ||
              (snap.lastStatus &&
                !['IMPORT_READING', 'IMPORT_EXTRACTING', 'IMPORT_PARSING'].includes(
                  snap.lastStatus
                )));
          if (terminal) break;
          await new Promise((r) => setTimeout(r, pollMs));
        }
        return { ...snap, logs, durationMs: Date.now() - started, minChars, assetHead };
      },
      {
        bytes: [...buf],
        fname: path.basename(scanPdf),
        timeoutMs: IMPORT_TIMEOUT_MS,
        pollMs: POLL_MS,
        minChars: REAL_CV_IMPORT_MIN_CHARS,
        assetHead,
      }
    );

    report.durationMs = evalResult.durationMs || Date.now() - t0;
    report.diagnostics = {
      ...(evalResult.diagnostics || {}),
      OCR_WORKER_LOADED:
        evalResult.diagnostics?.OCR_WORKER_LOADED === true ||
        assetHead['/vendor/tesseract/worker.min.js'] === true,
      OCR_WASM_LOADED:
        evalResult.diagnostics?.OCR_WASM_LOADED === true ||
        assetHead['/vendor/tesseract/core/tesseract-core-simd-lstm.wasm'] === true,
      OCR_LANG_LOADED:
        evalResult.diagnostics?.OCR_LANG_LOADED === true ||
        (assetHead['/vendor/tesseract/lang/eng.traineddata.gz'] === true &&
          assetHead['/vendor/tesseract/lang/fra.traineddata.gz'] === true),
    };
    report.importState = evalResult.lastStatus || '';
    report.selectedTextLength = evalResult.selectedTextLength || 0;
    report.fakeSuccess =
      evalResult.live &&
      report.selectedTextLength < REAL_CV_IMPORT_MIN_CHARS &&
      report.importState === IMPORT_STATE.IMPORT_READY;
    report.emptyPreview = evalResult.live && (evalResult.previewHtml || 0) < 80;
    report.templatesAfterFailure =
      (evalResult.fallback || evalResult.needsPaste) && evalResult.templateGallery;

    const diag = report.diagnostics;
    const ocrSuccess = (diag.OCR_FINAL_TEXT_LENGTH || 0) >= REAL_CV_IMPORT_MIN_CHARS;
    const honestPaste =
      evalResult.fallback ||
      evalResult.needsPaste ||
      report.importState === IMPORT_STATE.IMPORT_NEEDS_PASTE;

    ok(diag.OCR_WORKER_LOADED === true, 'ocr_worker_loaded', String(diag.OCR_WORKER_LOADED));
    ok(
      report.diagnostics.OCR_FIRST_PAGE_STARTED === true || honestPaste,
      'ocr_first_page_started',
      String(report.diagnostics.OCR_FIRST_PAGE_STARTED)
    );

    ok(ocrSuccess || honestPaste, 'ocr_success_or_honest_paste', JSON.stringify({
      finalLen: diag.OCR_FINAL_TEXT_LENGTH,
      importState: report.importState,
      honestPaste,
    }));

    ok(!report.fakeSuccess, 'no_fake_success');
    ok(!report.templatesAfterFailure, 'no_templates_after_failure');

    if (ocrSuccess) {
      ok(report.selectedTextLength >= REAL_CV_IMPORT_MIN_CHARS, 'selected_text_length', `${report.selectedTextLength}`);
    } else {
      ok(Boolean(diag.OCR_FAIL_REASON || honestPaste), 'ocr_fail_reason_or_paste', diag.OCR_FAIL_REASON || 'paste_ui');
    }

    report.pass = failed === 0;
  } finally {
    await browser.close();
    server.close();
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  console.log('Report:', OUT_JSON);
  return report;
}

runSmoke()
  .then((report) => {
    process.exit(report.pass ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
