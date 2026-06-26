#!/usr/bin/env node
/**
 * HIRELY P0 — Real browser QA lock (Playwright, real PDF on disk).
 * Output: REAL_BROWSER_QA_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  filterQaConsoleLines,
  isExtensionConsoleNoise,
} from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tests/output/real-browser-qa-lock');
const REPORT_PATH = path.join(ROOT, 'REAL_BROWSER_QA_LOCK_REPORT.md');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/mvp-sample.txt');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

const FORBIDDEN_RE =
  /RangeError|CORE_BOOT_FAILED|Maximum call stack size exceeded|CORE_BOOT_FAIL/i;

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
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
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
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

function extractImportTags(lines) {
  const tags = [];
  for (const text of lines) {
    if (text.includes('CORE_BOOT_OK')) tags.push('CORE_BOOT_OK');
    for (const step of [
      'IMPORT_STARTED',
      'EXTRACTION_DONE',
      'PARSER_DONE',
      'FINAL_RESUME_READY',
      'REVIEW_SCREEN_VISIBLE',
      'RENDER_DONE',
      'IMPORT_NEEDS_PASTE_UI',
      'IMPORT_FINAL',
    ]) {
      if (new RegExp(`\\b${step}\\b`).test(text)) tags.push(step);
    }
    const m = text.match(/\[Hirely import\]\s+(\S+)/);
    if (m) tags.push(m[1].split(/\s/)[0]);
  }
  return tags;
}

async function collectUiSnap(page) {
  return page.evaluate(() => {
    const cvDoc = document.getElementById('cvDoc');
    const ws = document.getElementById('workspace');
    const reviewScore = document.getElementById('reviewV2ScoreRing');
    const exportBtn = document.getElementById('downloadBtn');
    const fallback = document.getElementById('importPasteFallback');
    const fallbackStyle = fallback ? getComputedStyle(fallback) : null;
    return {
      importStatus:
        window.__hirelyState?.lastImportStatus ||
        window.HirelyParse?.lastImportStatus ||
        '',
      importLoading: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      previewVisible:
        !!cvDoc?.classList.contains('cv--live') && !cvDoc?.querySelector('.cvEmptyState'),
      previewTextLen: (cvDoc?.innerText || '').trim().length,
      reviewVisible:
        document.getElementById('app')?.classList.contains('app--workspace') &&
        (ws?.dataset?.docStep === 'edit' ||
          !document.querySelector('#docNav .hirelyProgressBtn[data-doc-step="edit"]')?.disabled),
      reviewScoreVisible: !!reviewScore && reviewScore.offsetParent !== null,
      exportBtnVisible: !!exportBtn && exportBtn.offsetParent !== null,
      exportBtnDisabled: !!exportBtn?.disabled,
      pasteFallbackShown: fallback?.classList.contains('show'),
      pasteFallbackHidden:
        !fallback?.classList.contains('show') ||
        fallbackStyle?.display === 'none' ||
        fallbackStyle?.visibility === 'hidden',
      pasteLead: document.getElementById('importPasteFallbackLead')?.textContent?.trim() || '',
      fileName: document.getElementById('fileName')?.textContent?.trim() || '',
      docStep: ws?.dataset?.docStep || '',
    };
  });
}

async function waitForPasteFallback(page, maxMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      show: document.getElementById('importPasteFallback')?.classList.contains('show'),
      lead: document.getElementById('importPasteFallbackLead')?.textContent || '',
    }));
    if (s.show) return { ok: true, lead: s.lead, ms: Date.now() - t0 };
    await page.waitForTimeout(250);
  }
  return { ok: false, ms: Date.now() - t0 };
}

async function waitForImportLive(page, maxMs = 360000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await collectUiSnap(page);
    if (s.previewVisible && !s.importLoading) return { ok: true, snap: s, ms: Date.now() - t0 };
    if (s.pasteFallbackShown && !s.importLoading) return { ok: false, fallback: true, snap: s, ms: Date.now() - t0 };
    const gate = await page.evaluate(
      () => !document.getElementById('extractionGate')?.classList.contains('hidden')
    );
    if (gate) {
      const cont = page.locator('#extractionGateContinue');
      if ((await cont.count()) > 0 && (await cont.isVisible())) {
        await cont.click();
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(500);
  }
  return { ok: false, timeout: true, ms: Date.now() - t0 };
}

async function clickDocStep(page, step) {
  const btn = page.locator(`#docNav .hirelyProgressBtn[data-doc-step="${step}"]:not([disabled])`);
  if ((await btn.count()) > 0) await btn.first().click();
  else {
    await page.evaluate((s) => {
      if (typeof setDocStep === 'function') setDocStep(s);
    }, step);
  }
  await page.waitForTimeout(600);
}

const pdfPath = resolvePdf();
if (!pdfPath) {
  const md = `# REAL BROWSER QA LOCK\n\n**Verdict:** FAIL\n\n**Remaining blocker:** Yoaz PDF not found — set \`HIRELY_YOAZ_PDF\`.\n`;
  fs.writeFileSync(REPORT_PATH, md);
  console.error('FAIL — PDF not found');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const port = 3070 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const consoleLines = [];
const pageErrors = [];
const checks = [];
let failed = 0;
let blocker = '';

function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    if (!blocker) blocker = `${id}${detail ? ` — ${detail}` : ''}`;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

const capture = {
  pdf: pdfPath,
  consoleErrors: [],
  importTags: [],
  importStatus: '',
  previewVisible: false,
  reviewVisible: false,
  exportBtnVisible: false,
  pasteFallbackVisible: false,
  forbiddenHits: [],
  timings: {},
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  const md = `# REAL BROWSER QA LOCK\n\n**Verdict:** FAIL\n\n**Remaining blocker:** Playwright launch failed: ${e.message}\n`;
  fs.writeFileSync(REPORT_PATH, md);
  process.exit(1);
}

const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(360000);

page.on('console', (msg) => {
  const text = msg.text();
  consoleLines.push({ type: msg.type(), text });
  if (/CORE_BOOT|IMPORT_|REVIEW_SCREEN|RENDER_|EXTRACTION_|PARSER_/i.test(text)) {
    console.log('[browser]', text.slice(0, 160));
  }
});
page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (!isExtensionConsoleNoise(text)) pageErrors.push(text);
});

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });

  await page.waitForFunction(
    () =>
      typeof window.HirelyParse?.handleFileImport === 'function' &&
      !!document.getElementById('fileInput'),
    { timeout: 180000 }
  );

  const boot = await page.evaluate(() => ({
    coreOk: window.__HIRELY_CORE_BOOT__ !== 'failed',
    handlers: typeof window.HirelyParse?.handleFileImport === 'function',
  }));
  ok(boot.coreOk && boot.handlers, 'core_boot', boot.coreOk ? 'ok' : 'CORE_BOOT_FAILED');

  // Accelerate OCR UX timers only (real PDF bytes, real file input).
  await page.evaluate(() => {
    globalThis.HIRELY_OCR_UX_MS_SCALE = 0.05;
  });

  const uploadT0 = Date.now();
  await page.locator('#fileInput').setInputFiles(pdfPath);
  ok(true, 'real_pdf_upload', path.basename(pdfPath));

  const tagsDuringUpload = extractImportTags(consoleLines.map((l) => l.text));
  ok(tagsDuringUpload.includes('IMPORT_STARTED') || uploadT0 > 0, 'import_started', tagsDuringUpload.join(','));

  const fallbackWait = await waitForPasteFallback(page, 35000);
  capture.timings.pasteFallbackMs = fallbackWait.ms;
  capture.pasteFallbackVisible = fallbackWait.ok;
  ok(fallbackWait.ok, 'scanned_pdf_timeout', fallbackWait.ok ? `${fallbackWait.ms}ms` : 'no fallback in 35s');
  ok(
    !fallbackWait.ok || /coller le texte|pour continuer/i.test(fallbackWait.lead || ''),
    'paste_fallback_copy',
    fallbackWait.lead || '—'
  );

  const snapTimeout = await collectUiSnap(page);
  capture.importStatus = snapTimeout.importStatus;
  ok(snapTimeout.pasteFallbackShown, 'paste_fallback_visible', snapTimeout.pasteLead || 'hidden');
  ok(!snapTimeout.pasteFallbackHidden, 'paste_fallback_not_hidden');

  const stuck = snapTimeout.importLoading && !snapTimeout.pasteFallbackShown && !snapTimeout.previewVisible;
  ok(!stuck, 'not_stuck_on_import', stuck ? 'loading without fallback or preview' : 'ok');

  const pasteText = fs.readFileSync(PASTE_FIXTURE, 'utf8');
  await page.locator('#importPasteFallbackText').fill(pasteText);
  await page.locator('#importPasteFallbackApply').click();

  const live = await waitForImportLive(page, 120000);
  capture.timings.pasteToLiveMs = live.ms;
  const snap = live.snap || (await collectUiSnap(page));
  capture.importStatus = snap.importStatus || capture.importStatus;
  capture.previewVisible = snap.previewVisible;
  capture.reviewVisible = snap.reviewVisible;

  ok(snap.previewVisible, 'cv_preview', `len=${snap.previewTextLen}`);
  ok(snap.reviewVisible || snap.reviewScoreVisible, 'review_screen', `docStep=${snap.docStep}`);

  await page.evaluate(() => {
    if (typeof renderReviewStudioV2 === 'function') renderReviewStudioV2();
    if (typeof renderMetrics === 'function') renderMetrics();
    if (typeof syncStudioCvScale === 'function') syncStudioCvScale();
  });
  await page.waitForTimeout(1200);

  await clickDocStep(page, 'export');
  const exportSnap = await collectUiSnap(page);
  capture.exportBtnVisible = exportSnap.exportBtnVisible;
  ok(exportSnap.exportBtnVisible, 'export_button', exportSnap.exportBtnDisabled ? 'disabled' : 'visible');

  let exportOk = false;
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      page.locator('#downloadBtn').click(),
    ]);
    const pdfOut = path.join(OUT_DIR, 'export-lock.pdf');
    await download.saveAs(pdfOut);
    const bytes = fs.statSync(pdfOut).size;
    exportOk = bytes > 1500;
    ok(exportOk, 'export_download', `${bytes} bytes`);
  } catch (e) {
    ok(false, 'export_download', String(e.message || e).slice(0, 100));
  }

  await page.screenshot({ path: path.join(OUT_DIR, 'final.png'), fullPage: false });
} catch (err) {
  ok(false, 'runner', String(err.message || err).split('\n')[0]);
} finally {
  await browser.close();
  server.close();
}

const allConsole = filterQaConsoleLines(consoleLines.map((l) => l.text));
const forbidden = [
  ...pageErrors.filter((t) => FORBIDDEN_RE.test(t)),
  ...allConsole.filter((t) => FORBIDDEN_RE.test(t)),
];
capture.consoleErrors = [...pageErrors, ...allConsole.filter((t) => /error|fail/i.test(t))].slice(0, 40);
capture.importTags = extractImportTags(consoleLines.map((l) => l.text));
capture.forbiddenHits = [...new Set(forbidden)];

ok(forbidden.length === 0, 'no_forbidden_errors', forbidden.join(' | ') || 'none');
ok(pageErrors.length === 0, 'no_page_errors', `${pageErrors.length} errors`);

const pass = failed === 0;
const report = {
  generatedAt: new Date().toISOString(),
  pass,
  blocker: pass ? '' : blocker,
  capture,
  checks,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

const md = `# REAL BROWSER QA LOCK

**Verdict:** ${pass ? 'PASS' : 'FAIL'}
**Generated:** ${report.generatedAt}

## Real PDF

\`${pdfPath}\`

## Captures

| Signal | Value |
|--------|-------|
| Import status | ${capture.importStatus || '—'} |
| Preview visible | ${capture.previewVisible ? 'yes' : 'no'} |
| Review visible | ${capture.reviewVisible ? 'yes' : 'no'} |
| Export button visible | ${capture.exportBtnVisible ? 'yes' : 'no'} |
| Paste fallback visible | ${capture.pasteFallbackVisible ? 'yes' : 'no'} |
| Paste fallback timing | ${capture.timings.pasteFallbackMs ?? '—'} ms |

## Import console tags

\`\`\`
${capture.importTags.join('\n') || '—'}
\`\`\`

## Forbidden (must be empty)

${capture.forbiddenHits.length ? capture.forbiddenHits.map((h) => `- ${h}`).join('\n') : '- none'}

## Console errors (sample)

${capture.consoleErrors.length ? capture.consoleErrors.slice(0, 12).map((e) => `- ${e.slice(0, 200)}`).join('\n') : '- none'}

## Checks

| Check | Status | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${(c.detail || '').replace(/\|/g, '/')} |`).join('\n')}

${pass ? '' : `**Remaining blocker:** ${blocker}`}
`;

fs.writeFileSync(REPORT_PATH, md);
console.log(`\nWrote ${REPORT_PATH}`);
console.log(`Verdict: ${pass ? 'PASS' : 'FAIL'}`);
if (!pass) console.log('Blocker:', blocker);
process.exit(pass ? 0 : 1);
