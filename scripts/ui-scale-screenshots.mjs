#!/usr/bin/env node
/**
 * Capture Hirely UI rebalance "after" screenshots for all flow steps.
 * Run: node scripts/ui-scale-screenshots.mjs
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.qa-screenshots', 'ui-scale-rebalance');
const fixture = path.join(root, 'tests/fixtures/mvp-sample.txt');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const rel = (req.url || '/').split('?')[0];
    const fp = path.join(root, decodeURIComponent(rel === '/' ? '/index.html' : rel));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function waitForCv(page, timeout = 120000) {
  await page.waitForFunction(
    () => {
      const doc = document.getElementById('cvDoc');
      return doc?.classList.contains('cv--live') && (doc.innerText || '').length > 80;
    },
    { timeout }
  );
}

async function setStep(page, step) {
  await page.evaluate((s) => {
    if (typeof setDocStep === 'function') setDocStep(s);
  }, step);
  await page.waitForTimeout(800);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(fixture)) {
    console.error('Missing fixture:', fixture);
    process.exit(1);
  }

  const port = 3071 + Math.floor(Math.random() * 30);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${base}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(outDir, 'after-01-dashboard.png') });
  console.log('OK after-01-dashboard.png');

  await page.waitForFunction(() => typeof window.HirelyParse?.importText === 'function', {
    timeout: 120000,
  });

  const paste = fs.readFileSync(fixture, 'utf8');
  await page.evaluate(async (text) => {
    await window.HirelyParse.importText(text, {
      source: 'paste-text',
      trusted: true,
      forceContinue: true,
    });
  }, paste);
  await waitForCv(page);

  await setStep(page, 'import');
  await page.screenshot({ path: path.join(outDir, 'after-02-import.png') });
  console.log('OK after-02-import.png');

  await setStep(page, 'edit');
  await page.screenshot({ path: path.join(outDir, 'after-03-analysis-edit.png') });
  console.log('OK after-03-analysis-edit.png');

  await setStep(page, 'style');
  await page.screenshot({ path: path.join(outDir, 'after-04-templates.png') });
  console.log('OK after-04-templates.png');

  await setStep(page, 'export');
  await page.screenshot({ path: path.join(outDir, 'after-05-export.png') });
  console.log('OK after-05-export.png');

  await browser.close();
  server.close();
  console.log(`Screenshots → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
