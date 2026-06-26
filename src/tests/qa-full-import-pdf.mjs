#!/usr/bin/env node
/**
 * Full import E2E — PDF upload → HirelyImportResult → visible CV.
 * node src/tests/qa-full-import-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/full-import-pdf');
fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv 2024 yohann azancot copie.pdf',
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
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
    }[ext] || 'application/octet-stream'
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

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const pdfPath = resolvePdf();
if (!pdfPath) {
  console.error('No Yoaz PDF found — set HIRELY_YOAZ_PDF');
  process.exit(1);
}

const port = 3020 + Math.floor(Math.random() * 100);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(300000);
page.setDefaultNavigationTimeout(120000);

try {
  await page.goto(`http://127.0.0.1:${port}/?debug=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyCore?.runHirelyImportFromFile === 'function',
    { timeout: 120000 }
  );

  page.on('console', (msg) => {
    const t = msg.text();
    if (/IMPORT_|CLEANED_|STRUCTURED_|ERROR/i.test(t)) console.log('[browser]', t);
  });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  const pdfBuf = fs.readFileSync(pdfPath);
  const importOutcome = await page.evaluate(
    async ({ b64, name }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: 'application/pdf' });
      return await window.HirelyParse.handleFileImport(file, 'qa-test');
    },
    { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
  );
  console.log('import outcome:', importOutcome);

  await page.waitForFunction(
    () => {
      const doc = document.getElementById('cvDoc');
      return doc && doc.classList.contains('cv--live') && (doc.innerText || '').length > 80;
    },
    { timeout: 60000 }
  );

  const debug = await page.evaluate(() => {
    const lr = window.HirelyParse?.lastResult || {};
    const sr = lr.structuredResume || window.__hirelyState?.structuredResume;
    return {
      rawLen: (lr.rawText || '').length,
      cleanLen: (lr.cleanedText || '').length,
      srJsonLen: sr ? JSON.stringify(sr).length : 0,
      name: sr?.identity?.name || lr.cvData?.name || '',
      title: sr?.identity?.title || lr.cvData?.title || '',
      exp: sr?.experiences?.length ?? lr.cvData?.experience?.length ?? 0,
      unsorted: sr?.unsorted?.length ?? 0,
      previewText: (document.getElementById('cvDoc')?.innerText || '').slice(0, 500),
      errors: lr.errors || [],
    };
  });

  console.log('DEBUG VALUES:', JSON.stringify(debug, null, 2));
  fs.writeFileSync(path.join(outDir, 'debug.json'), JSON.stringify(debug, null, 2));

  const srFull = await page.evaluate(() => {
    const sr = window.HirelyParse?.lastResult?.structuredResume;
    return sr ? JSON.stringify(sr, null, 2) : '';
  });
  fs.writeFileSync(path.join(outDir, 'structuredResume.json'), srFull);

  await page.screenshot({ path: path.join(outDir, 'cv-rendered.png'), fullPage: false });

  ok(debug.rawLen > 0, 'rawText.length > 0');
  ok(debug.cleanLen > 0, 'cleanedText.length > 0');
  ok(debug.srJsonLen > 0 && debug.srJsonLen < 50000, 'structuredResume JSON < 50000');
  ok(!/print logo/i.test(debug.name), 'fake keyword name removed');
  ok(debug.exp > 0 || debug.unsorted > 0, 'experience or à classer');
  ok(debug.previewText.length > 80, 'CV visible in preview');
  ok(/classer|expérience|graphic|designer|freelanc|confirmer/i.test(debug.previewText) || debug.previewText.length > 80, 'preview has content');
} finally {
  await browser.close();
  server.close();
}

console.log('Screenshot:', path.join(outDir, 'cv-rendered.png'));
process.exit(failed ? 1 : 0);
