#!/usr/bin/env node
/**
 * P0 gate — browser console must not show CORE_BOOT_FAILED or HIRELY_ENGINE_FAILED.
 * node src/tests/qa-browser-boot-console-gate.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.HIRELY_BOOT_CONSOLE_PORT || 3016);

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
      '.png': 'image/png',
      '.woff2': 'font/woff2',
      '.wasm': 'application/wasm',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let fp = path.join(root, decodeURIComponent(url.pathname.split('?')[0]));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(fp, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(fp) });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];

page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) consoleErrors.push(text);
});
page.on('pageerror', (err) => {
  const t = String(err?.message || err);
  if (!isExtensionConsoleNoise(t)) pageErrors.push(t);
});

try {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => ({
    coreBoot: window.__HIRELY_CORE_BOOT__,
    engineHealth: window.__HIRELY_ENGINE_HEALTH_STATE__,
    importCapable: window.__HIRELY_ENGINE_HEALTH__?.importCapable,
    canonical: typeof window.HirelyCore?.canonicalImportFromFile,
    coreBlocked: document.getElementById('wsImport')?.classList.contains('wsImport--coreBlocked'),
    fileInputDisabled: !!document.getElementById('fileInput')?.disabled,
  }));

  const allErrors = [...pageErrors, ...consoleErrors];
  const coreBootFailed = allErrors.some((e) => /CORE_BOOT_FAILED/i.test(e));
  const engineFailed = allErrors.some((e) => /HIRELY_ENGINE_FAILED/i.test(e));
  const missingExport = allErrors.some((e) =>
    /does not provide an export named/i.test(e)
  );

  ok(!coreBootFailed, 'console has no CORE_BOOT_FAILED');
  ok(!engineFailed, 'console has no HIRELY_ENGINE_FAILED');
  ok(!missingExport, 'console has no missing named export SyntaxError');
  ok(state.coreBoot === 'ok' || state.coreBoot === 'degraded', `__HIRELY_CORE_BOOT__ is ok/degraded (${state.coreBoot})`);
  ok(state.engineHealth !== 'FAILED', `engine health not FAILED (${state.engineHealth})`);
  ok(state.canonical === 'function', 'canonicalImportFromFile available on HirelyCore');
  ok(!state.coreBlocked, 'import zone not core-blocked after successful boot');
  ok(!state.fileInputDisabled, 'file input enabled after successful boot');
} finally {
  await browser.close();
  server.close();
}

console.log(failed ? `\n${failed} failed` : '\nBROWSER BOOT CONSOLE GATE OK');
process.exit(failed ? 1 : 0);
