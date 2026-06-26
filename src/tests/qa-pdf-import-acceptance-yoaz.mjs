#!/usr/bin/env node
/**
 * PDF import acceptance — cv2022 yohann azancot copie.pdf
 * node src/tests/qa-pdf-import-acceptance-yoaz.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/pdf-import-acceptance');
fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[
      ext
    ] || 'application/octet-stream'
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

const pdfPath = resolvePdf();
if (!pdfPath) {
  console.error('PDF not found — set HIRELY_YOAZ_PDF');
  process.exit(1);
}

const port = 3040 + Math.floor(Math.random() * 80);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(360000);

const consoleLines = [];
const pageErrors = [];

page.on('console', (msg) => {
  const t = msg.text();
  consoleLines.push({ type: msg.type(), text: t });
  if (/IMPORT_|OCR_|PARSER_|RENDER_|CACHE_|EXTRACTION_|CANONICAL/i.test(t)) {
    console.log('[browser]', t);
  }
});
page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (isExtensionConsoleNoise(text)) return;
  pageErrors.push(text);
  console.error('[pageerror]', text);
});

function parseImportLogs(lines) {
  const tags = [];
  for (const { text } of lines) {
    const m =
      text.match(/\[Hirely import\]\s+(\S+)(.*)/i) ||
      text.match(/\[Hirely extraction\]\s+(\S+)(.*)/i);
    if (m) tags.push({ tag: m[1], detail: (m[2] || '').trim() });
    if (/\bIMPORT_FINAL\b/.test(text) && !tags.some((t) => t.tag === 'IMPORT_FINAL' && t.detail === text)) {
      tags.push({ tag: 'IMPORT_FINAL', detail: text });
    }
    if (/PARSER_STARTED/i.test(text)) tags.push({ tag: 'PARSER_STARTED', detail: '' });
    if (/PARSER_SKIPPED/i.test(text)) tags.push({ tag: 'PARSER_SKIPPED', detail: text });
    if (/RENDER_STARTED/i.test(text)) tags.push({ tag: 'RENDER_STARTED', detail: '' });
    if (/RENDER_SKIPPED/i.test(text)) tags.push({ tag: 'RENDER_SKIPPED', detail: text });
    if (/OCR_CACHE_HIT/i.test(text)) tags.push({ tag: 'OCR_CACHE_HIT', detail: text });
    if (/OCR_CACHE_MISS/i.test(text)) tags.push({ tag: 'OCR_CACHE_MISS', detail: text });
    if (/OCR_RESULT_TEXT_LENGTH|OCR_RESULT_RECEIVED|CANONICAL_RAW/i.test(text)) {
      tags.push({ tag: 'OCR_METRIC', detail: text });
    }
  }
  return tags;
}

async function runImport(runLabel) {
  const pdfBuf = fs.readFileSync(pdfPath);
  const outcome = await page.evaluate(
    async ({ b64, name, label }) => {
      window.__acceptanceLogs = window.__acceptanceLogs || [];
      const log = (k, v) => window.__acceptanceLogs.push({ run: label, k, v });
      try {
        if (window.HirelyCore?.clearPdfOcrCache && label === 'second') {
          /* keep cache for second run */
        }
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], name, {
          type: 'application/pdf',
          lastModified: 1700000000000,
        });
        const status = await window.HirelyParse.handleFileImport(file, `acceptance-${label}`);
        const lr = window.HirelyParse?.lastResult || {};
        const doc = document.getElementById('cvDoc');
        const fallback = document.getElementById('importPasteFallback');
        const state = window.__hirelyState || {};
        log('finalStatus', status);
        log('lastImportStatus', state.lastImportStatus || '');
        log('rawLen', (lr.rawText || state.rawText || '').length);
        log('cleanLen', (lr.cleanedText || state.cleanText || '').length);
        log('canonicalRaw', (state.rawText || lr.rawText || '').length);
        log('cvLive', !!doc?.classList.contains('cv--live'));
        log('cvTextLen', (doc?.innerText || '').trim().length);
        log('pasteFallback', !!fallback?.classList.contains('show'));
        log('placeholderName', /nom à confirmer|poste à compléter/i.test(doc?.innerText || ''));
        log('hasClasser', /classer|à classer/i.test(doc?.innerText || ''));
        log('resumeData', !!lr.resumeData || !!state.resumeData);
        return {
          status,
          rawLen: (lr.rawText || state.rawText || '').length,
          cleanLen: (lr.cleanedText || state.cleanText || '').length,
          cvLive: !!doc?.classList.contains('cv--live'),
          cvTextLen: (doc?.innerText || '').trim().length,
          pasteFallback: !!fallback?.classList.contains('show'),
          placeholderOnly:
            /nom à confirmer|poste à compléter/i.test(doc?.innerText || '') &&
            !/classer|expérience|experience/i.test(doc?.innerText || '') &&
            (doc?.innerText || '').length < 400,
          hasClasser: /classer|à classer/i.test(doc?.innerText || ''),
          name: lr.resumeData?.identity?.name || lr.cvData?.name || state.cvData?.name || '',
          errors: lr.errors || [],
        };
      } catch (e) {
        return { error: String(e?.message || e), status: 'IMPORT_FAILED' };
      }
    },
    { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath), label: runLabel }
  );
  await page.waitForTimeout(1500);
  return outcome;
}

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

try {
  await page.goto(`http://127.0.0.1:${port}/?debug=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 180000 }
  );

  if (await page.evaluate(() => typeof window.HirelyCore?.clearPdfOcrCache === 'function')) {
    await page.evaluate(() => window.HirelyCore.clearPdfOcrCache());
  }

  console.log('\n=== Run 1 (cold OCR) ===');
  const run1 = await runImport('first');

  const tags1 = parseImportLogs(consoleLines);
  const importFinals = consoleLines
    .map((l) => l.text)
    .filter((t) => /\[Hirely import\] IMPORT_FINAL\b/.test(t));
  const parserRan = tags1.some((t) => t.tag === 'PARSER_STARTED');
  const parserSkipped = tags1.some((t) => t.tag === 'PARSER_SKIPPED');
  const renderRan = tags1.some((t) => t.tag === 'RENDER_STARTED') && !tags1.some((t) => t.tag === 'RENDER_SKIPPED_EMPTY_RAW');
  const cacheMiss = tags1.some((t) => t.tag === 'OCR_CACHE_MISS');
  const cacheHit = tags1.some((t) => t.tag === 'OCR_CACHE_HIT');

  const ocrMetric = consoleLines
    .map((l) => l.text)
    .filter((t) => /OCR_RESULT_TEXT_LENGTH|OCR_RESULT_RECEIVED|CANONICAL_RAW_TEXT_LENGTH/i.test(t))
    .join('\n');

  const caseA = run1.rawLen > 0 && !run1.pasteFallback;
  const caseB = run1.rawLen === 0 || run1.pasteFallback;

  const report = {
    pdf: pdfPath,
    timestamp: new Date().toISOString(),
    case: caseA ? 'A_OCR_SUCCESS' : caseB ? 'B_OCR_FAIL_OR_TIMEOUT' : 'UNKNOWN',
    run1,
    metrics: {
      ocrLogSnippet: ocrMetric.slice(0, 800),
      canonicalRawTextLength: run1.rawLen,
      finalImportStatus: run1.status,
      parserRan: parserRan && !parserSkipped,
      parserSkipped,
      renderRan: renderRan && run1.cvLive,
      cacheFirstRun: cacheMiss ? 'miss' : cacheHit ? 'hit' : 'unknown',
      importFinalCount: importFinals.length,
      importFinalStatuses: importFinals,
    },
    pageErrors,
    contradictoryStatuses: new Set(importFinals.map((t) => t.replace(/.*IMPORT_FINAL\s*/, '').trim())).size > 1,
  };

  console.log('\n=== Run 2 (cache check) ===');
  const linesBefore2 = consoleLines.length;
  const run2 = await runImport('second');
  const tags2 = parseImportLogs(consoleLines.slice(linesBefore2));
  const cacheHit2 = tags2.some((t) => t.tag === 'OCR_CACHE_HIT');
  const cacheMiss2 = tags2.some((t) => t.tag === 'OCR_CACHE_MISS');
  report.run2 = run2;
  report.metrics.cacheSecondRun = cacheHit2 ? 'hit' : cacheMiss2 ? 'miss' : 'unknown';

  console.log('\n--- ACCEPTANCE REPORT ---');
  console.log(JSON.stringify(report, null, 2));

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(outDir, 'after-import.png'), fullPage: false });

  ok(importFinals.length === 1, `one IMPORT_FINAL (got ${importFinals.length})`);
  ok(!report.contradictoryStatuses, 'no contradictory final statuses');

  if (report.case === 'A_OCR_SUCCESS') {
    ok(run1.rawLen > 0, 'Case A: rawText.length > 0');
    ok(parserRan || run1.resumeData !== false, 'Case A: parser ran or resume built');
    ok(run1.cvLive || run1.hasClasser, 'Case A: CV live or À classer');
    ok(!run1.placeholderOnly, 'Case A: no empty placeholder CV');
    if (run1.rawLen > 0) ok(cacheHit2, 'Case A: second import OCR_CACHE_HIT');
  } else {
    ok(!parserRan || parserSkipped, 'Case B: parser skipped on empty');
    ok(!run1.cvLive || run1.cvTextLen < 80, 'Case B: CV not live with content');
    ok(run1.pasteFallback, 'Case B: paste fallback visible');
    ok(!run1.placeholderOnly, 'Case B: no fake placeholder CV');
    ok(run1.rawLen === 0 || run1.pasteFallback, 'Case B: empty raw or fallback');
  }

  ok(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} finally {
  await browser.close();
  server.close();
}

console.log('\nReport:', path.join(outDir, 'report.json'));
process.exit(failed ? 1 : 0);
