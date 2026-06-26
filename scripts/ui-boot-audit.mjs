#!/usr/bin/env node
/**
 * UI boot audit — cv-templates.js parse, initHirelyTemplates, upload zone bind.
 * Output: UI_BOOT_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'UI_BOOT_AUDIT.md');
const PORT = Number(process.env.HIRELY_UI_BOOT_PORT || 3011);

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
  const url = `http://127.0.0.1:${PORT}/index.html`;
  const logs = [];
  const errors = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    logs.push({ type: msg.type(), text });
    if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) errors.push(text);
  });
  page.on('pageerror', (err) => {
    const t = String(err?.message || err);
    if (!isExtensionConsoleNoise(t)) errors.push(t);
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const boot = await page.evaluate(() => ({
    initHirelyTemplates: typeof window.initHirelyTemplates === 'function',
    HirelyTemplates: !!window.HirelyTemplates,
    uploadZone: !!document.querySelector('[data-upload-zone]'),
    fileInput: !!document.querySelector('input[type=file]#fileInput'),
    uploadClickBound: !!document.querySelector('[data-upload-zone]')?._hirelyImportClickBound,
    dropPointerEvents: document.querySelector('[data-upload-zone]')?.style?.pointerEvents || '',
    coreBoot: window.__HIRELY_CORE_BOOT__,
    bootSteps: window.__hirelyBoot || [],
  }));

  const markers = ['CV_TEMPLATE_BOOT_OK', 'CORE_BOOT_OK', 'UPLOAD_BIND_OK', 'IMPORT_UI_READY'];
  const markerHits = Object.fromEntries(markers.map((m) => [m, logs.some((l) => l.text.includes(m))]));

  let filePickerTriggered = false;
  await page.evaluate(() => {
    const input = document.getElementById('fileInput');
    if (!input) return;
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.id === 'fileInput') window.__hirelyPickerProbe = true;
      return orig.call(this);
    };
  });

  const zone = page.locator('[data-upload-zone]');
  if (await zone.count()) {
    await zone.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    filePickerTriggered = await page.evaluate(() => !!window.__hirelyPickerProbe);
  }

  const syntaxErr = errors.some((e) => /Invalid regular expression|SyntaxError/i.test(e));
  const refErr = errors.some((e) => /initHirelyTemplates is not defined|ReferenceError/i.test(e));
  const allMarkers = markers.every((m) => markerHits[m]);
  const pass =
    boot.initHirelyTemplates &&
    boot.HirelyTemplates &&
    boot.uploadZone &&
    boot.fileInput &&
    boot.uploadClickBound &&
    filePickerTriggered &&
    allMarkers &&
    !syntaxErr &&
    !refErr;

  const lines = [
    '# UI Boot Audit',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**URL:** ${url}`,
    `**Date:** ${new Date().toISOString()}`,
    '',
    '## Console markers',
    ...markers.map((m) => `- ${m}: ${markerHits[m] ? 'yes' : 'NO'}`),
    '',
    '## Boot checks',
    `- initHirelyTemplates: ${boot.initHirelyTemplates ? 'yes' : 'NO'}`,
    `- HirelyTemplates: ${boot.HirelyTemplates ? 'yes' : 'NO'}`,
    `- [data-upload-zone]: ${boot.uploadZone ? 'yes' : 'NO'}`,
    `- input#fileInput: ${boot.fileInput ? 'yes' : 'NO'}`,
    `- upload click listener bound: ${boot.uploadClickBound ? 'yes' : 'NO'}`,
    `- file picker opens on zone click: ${filePickerTriggered ? 'yes' : 'NO'}`,
    `- CORE_BOOT_OK marker: ${markerHits.CORE_BOOT_OK ? 'yes' : 'NO'}`,
    `- CORE_BOOT state: ${boot.coreBoot || 'unknown'}`,
    '',
    '## Errors',
    ...(errors.length ? errors.map((e) => `- ${e}`) : ['- none']),
    '',
    '## Boot trace',
    ...(boot.bootSteps.length ? boot.bootSteps.map((s) => `- ${s}`) : ['- (empty)']),
    '',
    '## Fix applied',
    '- Invalid RegExp in `src/ui/templates/cv-templates.js` line ~595 (extra `)` before `$`)',
    '- Added `data-upload-zone` + boot diagnostics',
    '',
  ];

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(lines.join('\n'));

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
