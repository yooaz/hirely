#!/usr/bin/env node
/**
 * Diagnose real PDF import — logs extraction metrics for a file path.
 * Usage: node scripts/diagnose-real-pdf-import.mjs "/path/to/file.pdf"
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PDF_PATH =
  process.argv[2] ||
  '/Users/yohannazancot/Documents/cv hire/cv. Yohann azancot (1) 2.pdf';

if (!fs.existsSync(PDF_PATH)) {
  console.error('PDF not found:', PDF_PATH);
  process.exit(1);
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return { '.html': 'text/html', '.js': 'text/javascript', '.pdf': 'application/pdf' }[ext] || 'application/octet-stream';
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

const port = 3180 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(360000);
await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
  timeout: 360000,
});

const buf = fs.readFileSync(PDF_PATH);
const diag = await page.evaluate(
  async ({ b64, name }) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const file = new File([arr], name, { type: 'application/pdf' });

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => {
      logs.push(args.map(String).join(' '));
      origLog(...args);
    };

    let importStatus = '';
    let lastResult = null;
    try {
      importStatus = await window.HirelyParse.handleFileImport(file, 'pdf-diagnose');
      lastResult = window.HirelyParse.lastResult || null;
    } catch (e) {
      logs.push('IMPORT_THROW:' + (e?.message || e));
    }

    const ent = lastResult?.enterprise || lastResult?.metadata || {};
    const mf = ent?.multiFormat || lastResult?.multiFormat || ent?.metadata?.multiFormat || {};
    const pdfEx = lastResult?.pdfExtraction || ent?.pdfExtraction || {};
    const meta = lastResult?.metadata || ent?.metadata || {};

    const rawText = String(
      lastResult?.rawText || lastResult?.audit?.rawText || window.state?.rawText || ''
    ).trim();

    const ocrStatus =
      window.HirelyLazy?.ocrReady?.() ||
      window.HirelyLazy?.isTesseractReady?.() ||
      !!window.Tesseract ||
      'unknown';

    return {
      importStatus,
      importState: window.state?.lastImportStatus || null,
      fallbackVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
      nativeTextLength: mf.nativeTextLength ?? meta.nativeTextLength ?? 0,
      ocrTextLength: mf.ocrTextLength ?? meta.ocrTextLength ?? 0,
      mergedTextLength: mf.mergedTextLength ?? meta.mergedTextLength ?? 0,
      selectedTextLength: rawText.length,
      selectedSource: mf.selectedSource ?? meta.selectedSource ?? meta.extractionSource ?? pdfEx.selectedSource ?? '',
      extractionError: (lastResult?.errors || []).join('; '),
      extractionWarnings: (lastResult?.warnings || []).join('; '),
      ocrEngineStatus: String(ocrStatus),
      pageCount: pdfEx.pageCount ?? meta.pages ?? ent.pages ?? 0,
      isScanned:
        pdfEx.fileType === 'pdf_scanned' ||
        meta.fileType === 'pdf_scanned' ||
        mf.sourceType === 'pdf_scanned' ||
        mf.sourceType === 'pdf_image',
      isProtected: /protég|encrypt|password|protected/i.test(
        [pdfEx.why, meta.ocrWarning, ...(lastResult?.errors || [])].join(' ')
      ),
      method: lastResult?.extractionMethod || meta.extractionMethod || ent.method || '',
      route: pdfEx.decision || pdfEx.routing?.routingReason || '',
      confidenceScore: mf.confidenceScore ?? meta.confidenceScore ?? 0,
      cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      previewLen: (document.getElementById('cvDoc')?.innerText || '').replace(/\s+/g, ' ').trim().length,
      logs: logs.slice(-40),
    };
  },
  { b64: buf.toString('base64'), name: path.basename(PDF_PATH) }
);

console.log(JSON.stringify({ pdf: PDF_PATH, ...diag }, null, 2));

await browser.close();
server.close();
