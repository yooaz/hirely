#!/usr/bin/env node
/**
 * P0 regression — browser boot must bind upload before templates block import.
 * Asserts: no ReferenceError, #fileInput, upload zone click, UPLOAD_BIND_OK, CORE_BOOT_OK.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'BOOT_UPLOAD_FIX_REPORT.md');
const PORT = Number(process.env.HIRELY_BOOT_UPLOAD_PORT || 3012);

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
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
  const checks = [];
  const fail = (name, detail) => checks.push({ name, ok: false, detail });
  const pass = (name, detail = '') => checks.push({ name, ok: true, detail });

  const server = await startServer();
  const url = `http://127.0.0.1:${PORT}/index.html`;
  const logs = [];
  const errors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    logs.push({ type: msg.type(), text });
    if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) errors.push(text);
  });
  page.on('pageerror', (err) => {
    const t = String(err?.message || err);
    if (!isExtensionConsoleNoise(t)) pageErrors.push(t);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(4000);

    const refErr = [...pageErrors, ...errors].some((e) =>
      /ReferenceError|Cannot access .* before initialization/i.test(e)
    );
    refErr
      ? fail('no ReferenceError', pageErrors.concat(errors).join('; ') || 'ReferenceError detected')
      : pass('no ReferenceError');

    const fileInput = await page.$('#fileInput');
    fileInput ? pass('#fileInput exists') : fail('#fileInput exists', 'missing #fileInput');

    await page.evaluate(() => {
      const input = document.getElementById('fileInput');
      if (!input) return;
      const orig = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () {
        if (this.id === 'fileInput') window.__hirelyBootUploadProbe = true;
        return orig.call(this);
      };
    });

    const zone = page.locator('[data-upload-zone]');
    if ((await zone.count()) > 0) {
      await zone.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      const clicked = await page.evaluate(() => !!window.__hirelyBootUploadProbe);
      clicked
        ? pass('upload zone clickable')
        : fail('upload zone clickable', 'click did not open file picker');
    } else {
      const drop = page.locator('#drop');
      if ((await drop.count()) > 0) {
        await drop.click({ timeout: 5000 });
        await page.waitForTimeout(400);
        const clicked = await page.evaluate(() => !!window.__hirelyBootUploadProbe);
        clicked
          ? pass('upload zone clickable')
          : fail('upload zone clickable', '#drop click did not open file picker');
      } else {
        fail('upload zone clickable', 'no [data-upload-zone] or #drop');
      }
    }

    const evalBoot = await page.evaluate(() => {
      const trace = Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__) ? window.__HIRELY_CORE_BOOT_TRACE__ : [];
      const bootOrder = window.__hirelyBootOrder || [];
      return {
        handlersBound: !!window.__hirelyImportHandlersBound,
        registry: !!(window.HirelyTemplates || window.HirelyTemplateRegistry),
        bootSteps: window.__hirelyBoot || [],
        bootOrder,
        coreBoot: window.__HIRELY_CORE_BOOT__,
        engineHealth: window.__HIRELY_ENGINE_HEALTH_STATE__,
        canonical: typeof window.HirelyCore?.canonicalImportFromFile,
        hasBootStart: trace.some((t) => t?.tag === 'BOOT_START'),
        hasCoreImportOk:
          trace.some((t) => t?.tag === 'CORE_IMPORT_OK' && t?.status === 'ok') ||
          bootOrder.includes('CORE_BOOT_OK'),
        hasTemplateReady:
          trace.some((t) => t?.tag === 'TEMPLATE_REGISTRY_READY' && t?.status === 'ok') ||
          bootOrder.includes('TEMPLATE_REGISTRY_READY'),
        hasUploadBind: bootOrder.includes('UPLOAD_BIND_OK'),
      };
    });

    const fatalConsole = [...pageErrors, ...errors].filter(
      (e) => /CORE_BOOT_FAILED|HIRELY_ENGINE_FAILED|does not provide an export named/i.test(e)
    );
    fatalConsole.length
      ? fail('no CORE_BOOT_FAILED / HIRELY_ENGINE_FAILED in console', fatalConsole.join(' | '))
      : pass('no CORE_BOOT_FAILED / HIRELY_ENGINE_FAILED in console');

    evalBoot.coreBoot === 'ok' || evalBoot.coreBoot === 'degraded'
      ? pass('__HIRELY_CORE_BOOT__ ok or degraded')
      : fail('__HIRELY_CORE_BOOT__ ok or degraded', evalBoot.coreBoot || 'missing');

    evalBoot.engineHealth !== 'FAILED'
      ? pass('engine health not FAILED')
      : fail('engine health not FAILED', evalBoot.engineHealth || 'missing');

    evalBoot.canonical === 'function'
      ? pass('canonicalImportFromFile on HirelyCore')
      : fail('canonicalImportFromFile on HirelyCore', evalBoot.canonical || 'missing');

    evalBoot.hasUploadBind
      ? pass('UPLOAD_BIND_OK in boot order')
      : fail('UPLOAD_BIND_OK in boot order', 'marker missing');

    evalBoot.hasCoreImportOk
      ? pass('CORE_IMPORT_OK in boot trace')
      : fail('CORE_IMPORT_OK in boot trace', 'marker missing');

    evalBoot.hasBootStart
      ? pass('BOOT_START in boot trace')
      : fail('BOOT_START in boot trace', 'marker missing');

    evalBoot.hasTemplateReady
      ? pass('TEMPLATE_REGISTRY_READY in boot trace')
      : fail('TEMPLATE_REGISTRY_READY in boot trace', 'marker missing');

    evalBoot.handlersBound
      ? pass('import handlers bound flag')
      : fail('import handlers bound flag', '__hirelyImportHandlersBound false');

    evalBoot.registry
      ? pass('template registry available')
      : fail('template registry available', 'getTemplateRegistrySafe() returned null');
  } finally {
    await browser.close();
    server.close();
  }

  const allOk = checks.every((c) => c.ok);
  const lines = [
    '# BOOT Upload Fix Report',
    '',
    `**Result:** ${allOk ? 'PASS' : 'FAIL'}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Checks',
    '',
    ...checks.map((c) => `- [${c.ok ? 'x' : ' '}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Bootstrap order (expected)',
    '',
    '1. BOOT_START (trace)',
    '2. UPLOAD_BIND_OK (boot order)',
    '3. IMPORT_UI_READY (boot order)',
    '4. CORE_IMPORT_OK (trace; legacy boot order: CORE_BOOT_OK)',
    '5. TEMPLATE_REGISTRY_READY (trace)',
    '',
  ];
  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(allOk ? 'PASS' : 'FAIL');
  console.log(`Report: ${REPORT}`);
  for (const c of checks) {
    console.log(`${c.ok ? 'OK' : 'FAIL'} ${c.name}${c.detail ? `: ${c.detail}` : ''}`);
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('BOOT_UPLOAD_TEST_CRASH', err);
  process.exit(1);
});
