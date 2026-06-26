#!/usr/bin/env node
/**
 * Hard reset import test — UI/file input only (no OCR/parser).
 * node src/tests/qa-hard-reset-import.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const TXT = path.join(root, 'tests/fixtures/mvp-sample.txt');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' }[ext] || 'application/octet-stream';
}

function startServer() {
  return http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
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

const issues = [];

function ok(cond, msg) {
  if (!cond) issues.push(msg);
  console.log(cond ? 'OK' : 'FAIL', msg);
}

async function main() {
  const server = startServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });

  const ids = await page.evaluate(() => ({
    fileInputId: document.getElementById('fileInput')?.id || null,
    importButtonId: document.getElementById('importClickBtn')?.id || null,
    dropId: document.getElementById('hirelyTestDrop')?.id || null,
    resultId: document.getElementById('hirelyTestResult')?.id || null,
    listenerReady: typeof window.__hirelyTestImportReady === 'boolean',
  }));

  console.log('\n--- IDs ---');
  console.log('file input id:', ids.fileInputId);
  console.log('import button id:', ids.importButtonId);
  console.log('drop zone id:', ids.dropId);
  console.log('result id:', ids.resultId);
  console.log('event listener: bindVerifiedImportHandlers() in initHirelyApp()');

  ok(ids.fileInputId === 'fileInput', 'fileInput exists');
  ok(ids.importButtonId === 'importClickBtn', 'importClickBtn exists');
  ok(ids.dropId === 'hirelyTestDrop', 'hirelyTestDrop exists');

  await page.locator('#fileInput').setInputFiles(TXT);
  await page.waitForFunction(
    () => (document.getElementById('hirelyTestResult')?.textContent || '').includes('mvp-sample'),
    { timeout: 3000 }
  );
  const clickOut = await page.locator('#hirelyTestResult').textContent();
  const clickWorks =
    clickOut.includes('mvp-sample.txt') && clickOut.includes('source: click') && clickOut.includes('type:');
  ok(clickWorks, 'click → name/size/type on screen immediately');
  console.log('whether click works:', clickWorks ? 'YES' : 'NO');
  console.log('click output:\n', clickOut);

  await page.evaluate(() => {
    document.getElementById('hirelyTestResult').textContent = '';
  });

  const dropWorks = await page.evaluate(async () => {
    const buf = await fetch('/tests/fixtures/mvp-sample.txt').then((r) => r.arrayBuffer());
    const file = new File([buf], 'drop-test.txt', { type: 'text/plain' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const drop = document.getElementById('hirelyTestDrop');
    drop.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const out = document.getElementById('hirelyTestResult')?.textContent || '';
    return out.includes('drop-test.txt') && out.includes('source: drop') && out.includes('type:');
  });
  ok(dropWorks, 'drop → name/size/type on screen immediately');
  console.log('whether drop works:', dropWorks ? 'YES' : 'NO');
  const dropOut = await page.locator('#hirelyTestResult').textContent();
  console.log('drop output:\n', dropOut);

  await browser.close();
  server.close();

  console.log('\n--- HARD RESET IMPORT TEST ---');
  if (issues.length) {
    console.log('FAILED', issues.length, 'issue(s)');
    issues.forEach((i) => console.log(' -', i));
    process.exit(1);
  }
  console.log('PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
