#!/usr/bin/env node
/**
 * Import + drop stuck fix — click/drop share handleFileImport; loading always clears.
 * node src/tests/qa-import-silent.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const TXT = path.join(root, 'tests/fixtures/mvp-sample.txt');
const UNSUPPORTED = path.join(root, 'tests/output/import-qa-unsupported.bin');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
  path.join(root, 'tests/output/truth-test/truth-export.pdf'),
].filter(Boolean);

const DOCX_CANDIDATES = [
  process.env.HIRELY_ACCEPT_DOCX,
  '/Users/yohannazancot/Documents/cv .docx',
].filter(Boolean);

function resolveExisting(paths) {
  for (const p of paths) {
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
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.bin': 'application/octet-stream',
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

async function waitForOutcome(page, timeout = 300000) {
  await page.waitForFunction(
    () => {
      const doc = document.querySelector('#cvDoc');
      const live = doc?.classList.contains('cv--live') && (doc?.innerHTML?.length || 0) > 300;
      const paste = document.getElementById('rawDetails')?.open;
      const alert = document.getElementById('extractionAlert')?.classList.contains('show');
      const busy = document.getElementById('wsImport')?.classList.contains('wsImport--loading');
      const done = !busy && (live || paste || alert);
      return done;
    },
    { timeout }
  );
}

const PRODUCT_IMPORT_LOGS = new Set([
  'IMPORT_STARTED',
  'EXTRACTION_DONE',
  'PARSER_DONE',
  'RENDER_DONE',
]);

const FORBIDDEN_NORMAL_CONSOLE = [
  /BLOCKS_CREATED|BLOCKS_CLASSIFIED|RESUME_GRAPH_ENGINE|PRODUCTION_AUDIT|FORENSIC_/,
  /SECTION_ENGINE|EXPERIENCE_CANDIDATES|ZERO_TEXT_LOSS|HIRELY (FILE|EXTRACT|ENTERPRISE|OCR)/,
  /\[Hirely boot\]|\[Hirely extraction\]|\[Hirely trace\]|HIRELY DEBUG/,
];

async function runImport(page, { file, drop } = {}) {
  const logs = [];
  const allConsole = [];
  const errors = [];
  const onConsole = (m) => {
    const t = m.text();
    allConsole.push(t);
    if (/\[Hirely import\]/.test(t)) logs.push(t.replace(/^\[Hirely import\]\s*/, ''));
    if (
      m.type() === 'error' &&
      !isExtensionConsoleNoise(t) &&
      !/favicon|501|structure-cv|404|Not Found/i.test(t)
    ) {
      errors.push(t.slice(0, 180));
    }
  };
  page.on('console', onConsole);

  if (drop) {
    const name = path.basename(file);
    const b64 = fs.readFileSync(file).toString('base64');
    const type = mime(file);
    await page.evaluate(
      ({ name, type, b64 }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], name, { type }));
        const el = document.getElementById('drop');
        el.dispatchEvent(
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
        );
      },
      { name, type, b64 }
    );
  } else if (file) {
    await page.locator('#fileInput').setInputFiles(file);
  }

  await page
    .waitForFunction(
      () => {
        const live = document.getElementById('importLiveStatus')?.textContent || '';
        const busy = document.getElementById('wsImport')?.classList.contains('wsImport--loading');
        return busy || /Lecture|Reading|importé|classer/i.test(live);
      },
      { timeout: 8000 }
    )
    .catch(() => {});

  await waitForOutcome(page).catch(() => {});
  await page.waitForTimeout(400);

  const snap = await page.evaluate(() => ({
    busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
    cvLen: document.querySelector('#cvDoc')?.innerHTML?.length || 0,
    live: document.querySelector('#cvDoc')?.classList.contains('cv--live'),
    pasteOpen: !!document.getElementById('rawDetails')?.open,
    alert: document.getElementById('extractionAlert')?.classList.contains('show'),
    sameFn:
      typeof window.HirelyParse?.handleFileImport === 'function' &&
      !window.HirelyParse?.handleFileImportFile,
  }));

  page.off('console', onConsole);
  return { logs, errors, allConsole, ...snap };
}

function assertSilentImportConsole(allConsole, label) {
  const noisy = allConsole.filter((line) =>
    FORBIDDEN_NORMAL_CONSOLE.some((re) => re.test(line))
  );
  if (noisy.length) {
    console.error(`FAIL ${label}: debug console noise`, noisy.slice(0, 8));
    return false;
  }
  const importLines = allConsole
    .filter((l) => /\[Hirely import\]/.test(l))
    .map((l) => l.replace(/^\[Hirely import\]\s*/, '').split(/\s/)[0]);
  const extras = importLines.filter((step) => !PRODUCT_IMPORT_LOGS.has(step));
  if (extras.length) {
    console.error(`FAIL ${label}: unexpected import logs`, extras);
    return false;
  }
  return true;
}

async function main() {
  fs.mkdirSync(path.dirname(UNSUPPORTED), { recursive: true });
  if (!fs.existsSync(UNSUPPORTED)) fs.writeFileSync(UNSUPPORTED, 'not-a-cv-format');

  const pdfPath = resolveExisting(PDF_CANDIDATES);
  const docxPath = resolveExisting(DOCX_CANDIDATES);
  if (!pdfPath || !fs.existsSync(TXT)) {
    console.error('Need PDF and TXT fixture');
    process.exit(1);
  }

  const port = String(3600 + Math.floor(Math.random() * 200));
  const server = startServer(Number(port));
  await new Promise((r) => server.listen(Number(port), r));

  const failures = [];
  const ok = (c, m) => (c ? console.log('OK', m) : (failures.push(m), console.error('FAIL', m)));

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);
    await page.addInitScript(() => {
      window.HIRELY_IMPORT_TIMEOUT_MS = 300000;
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');

    ok(!!(await page.$('#drop')), 'drop zone exists');
    ok(!!(await page.$('#fileInput')), 'file input exists');

    const click1 = await runImport(page, { file: pdfPath });
    ok(!click1.busy, 'click PDF: loading cleared');
    ok(click1.cvLen >= 300 || click1.pasteOpen || click1.alert, 'click PDF: CV or fallback');
    ok(click1.logs.some((l) => l.startsWith('IMPORT_STARTED')), 'click: IMPORT_STARTED');
    ok(click1.logs.some((l) => l.startsWith('EXTRACTION_DONE')), 'click: EXTRACTION_DONE');
    ok(click1.logs.some((l) => l.startsWith('PARSER_DONE')), 'click: PARSER_DONE');
    ok(click1.logs.some((l) => l.startsWith('RENDER_DONE')), 'click: RENDER_DONE');
    ok(assertSilentImportConsole(click1.allConsole, 'click PDF'), 'click: silent console');
    ok(click1.errors.length === 0, `click: no uncaught errors (${click1.errors.join('; ')})`);
    console.log('\n--- Click log sample ---');
    click1.logs.forEach((l) => console.log(l));

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');
    const click2 = await runImport(page, { file: pdfPath });
    ok(click2.logs.some((l) => l.startsWith('IMPORT_STARTED')), 'same PDF twice: re-import runs');

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');
    const drop1 = await runImport(page, { file: pdfPath, drop: true });
    ok(!drop1.busy, 'drop PDF: loading cleared');
    ok(drop1.cvLen >= 300 || drop1.pasteOpen || drop1.alert, 'drop PDF: CV or fallback');
    ok(drop1.logs.some((l) => l.startsWith('IMPORT_STARTED')), 'drop: IMPORT_STARTED');
    ok(drop1.logs.some((l) => l.startsWith('EXTRACTION_DONE')), 'drop: EXTRACTION_DONE');
    ok(drop1.logs.some((l) => l.startsWith('PARSER_DONE')), 'drop: PARSER_DONE');
    ok(drop1.logs.some((l) => l.startsWith('RENDER_DONE')), 'drop: RENDER_DONE');
    ok(assertSilentImportConsole(drop1.allConsole, 'drop PDF'), 'drop: silent console');
    ok(drop1.sameFn, 'drop uses canonical handleFileImport only');
    console.log('\n--- Drop log sample ---');
    drop1.logs.forEach((l) => console.log(l));

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');
    const docx = docxPath ? await runImport(page, { file: docxPath, drop: true }) : null;
    if (docx) {
      ok(!docx.busy, 'drop DOCX: loading cleared');
      ok(docx.cvLen >= 300 || docx.pasteOpen, 'drop DOCX: outcome visible');
    }

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');
    const txt = await runImport(page, { file: TXT, drop: true });
    ok(!txt.busy, 'drop TXT: loading cleared');
    ok(txt.live || txt.pasteOpen, 'drop TXT: visible outcome');

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');
    const bad = await runImport(page, { file: UNSUPPORTED, drop: true });
    ok(!bad.busy, 'unsupported: loading cleared');
    ok(bad.pasteOpen || bad.alert || bad.cvLen > 0, 'unsupported: fallback shown');

    await browser.close();
  } finally {
    server.close();
  }

  console.log('\n--- DROP IMPORT STUCK FIX ---');
  if (failures.length) {
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }
  console.log('PASSED', failures.length, 'issue(s)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
