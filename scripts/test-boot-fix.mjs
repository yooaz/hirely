#!/usr/bin/env node
/** Boot fix QA — trace array, no TypeError, no CORE_BOOT_FAILED */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.HIRELY_BOOT_FIX_PORT || 3014);

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
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let fp = path.join(ROOT, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(ROOT)) {
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

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const logs = [];

  page.on('console', (msg) => {
    const text = msg.text();
    logs.push(text);
    if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) errors.push(text);
  });
  page.on('pageerror', (err) => {
    const t = String(err?.message || err);
    if (!isExtensionConsoleNoise(t)) errors.push(t);
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => ({
    coreBoot: window.__HIRELY_CORE_BOOT__,
    traceIsArray: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__),
    traceLen: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__) ? window.__HIRELY_CORE_BOOT_TRACE__.length : -1,
    missingDom: (window.__HIRELY_MISSING_DOM__ || []).map((x) => x.id),
    required: {
      app: !!document.getElementById('app'),
      wsImport: !!document.getElementById('wsImport'),
      cvDoc: !!document.getElementById('cvDoc'),
      docNav: !!document.getElementById('docNav'),
    },
  }));

  await browser.close();
  server.close();

  const bad = errors.filter((e) =>
    /Cannot set properties of null.*innerHTML|push is not a function|RENDER_ALL_INIT_FAILED/i.test(e)
  );
  const coreFailed = state.coreBoot === 'failed';

  const checks = [
    { id: 'core_boot_not_failed', pass: !coreFailed, detail: state.coreBoot },
    { id: 'trace_is_array', pass: state.traceIsArray, detail: String(state.traceLen) },
    { id: 'no_type_errors', pass: bad.length === 0, detail: bad.join('; ') || 'clean' },
    { id: 'required_dom_present', pass: Object.values(state.required).every(Boolean), detail: JSON.stringify(state.required) },
    { id: 'core_boot_ok_log', pass: logs.some((l) => l.includes('CORE_BOOT_OK')), detail: 'console marker' },
  ];

  const pass = checks.every((c) => c.pass);
  console.log(JSON.stringify({ pass, state, checks, errors: bad }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
