#!/usr/bin/env node
/**
 * P0 — Import boot must not depend on templates / pro features.
 * Order: UPLOAD_BIND_OK → IMPORT_UI_READY → CORE_BOOT_OK → TEMPLATE_REGISTRY_READY
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'IMPORT_BOOT_INDEPENDENCE_REPORT.md');

const REQUIRED_ORDER = [
  'UPLOAD_BIND_OK',
  'IMPORT_UI_READY',
  'CORE_BOOT_OK',
  'TEMPLATE_REGISTRY_READY',
];

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
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
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function bootOrderOk(order) {
  let last = -1;
  for (const marker of REQUIRED_ORDER) {
    const idx = order.indexOf(marker);
    if (idx < 0) return { ok: false, reason: `missing ${marker}` };
    if (idx < last) return { ok: false, reason: `${marker} before ${REQUIRED_ORDER[order.indexOf(REQUIRED_ORDER.find((m) => order.indexOf(m) === last))]}` };
    last = idx;
  }
  return { ok: true };
}

async function runScenario(page, base, { breakTemplates = false } = {}) {
  const logs = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    const t = String(err?.message || err);
    if (!isExtensionConsoleNoise(t)) pageErrors.push(t);
  });

  if (breakTemplates) {
    await page.addInitScript(() => {
      window.initHirelyTemplates = () => {
        throw new Error('SIMULATED_TEMPLATE_BOOT_FAIL');
      };
    });
  }

  await page.goto(`${base}index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(
    () => Array.isArray(window.__hirelyBootOrder) && window.__hirelyBootOrder.includes('CORE_BOOT_OK'),
    { timeout: 120000 }
  );

  await page.evaluate(() => {
    const input = document.getElementById('fileInput');
    if (!input) return;
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.id === 'fileInput') window.__hirelyImportPickerProbe = true;
      return orig.call(this);
    };
  });

  const dropLabel = page.locator('.dropLabel', { hasText: 'Déposez votre CV' });
  if ((await dropLabel.count()) > 0) {
    await dropLabel.click({ timeout: 5000 });
  } else {
    await page.locator('[data-upload-zone]').first().click({ timeout: 5000 });
  }
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => ({
    bootOrder: window.__hirelyBootOrder || [],
    handlersBound: !!window.__hirelyImportHandlersBound,
    pickerProbe: !!window.__hirelyImportPickerProbe,
    coreBoot: window.__HIRELY_CORE_BOOT__,
    hasTemplates: !!(window.HirelyTemplates?.list?.length || window.HirelyTemplates?.render),
  }));

  const refErr = pageErrors.some((e) => /ReferenceError|before initialization/i.test(e));

  return { logs, pageErrors, refErr, state, breakTemplates };
}

async function main() {
  const failures = [];
  const server = await startServer();
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let normal;
  let broken;
  try {
    normal = await runScenario(page, base, { breakTemplates: false });

    const brokenPage = await browser.newPage();
    broken = await runScenario(brokenPage, base, { breakTemplates: true });
    await brokenPage.close();
  } finally {
    await browser.close();
    server.close();
  }

  const orderCheck = bootOrderOk(normal.state.bootOrder);
  if (!orderCheck.ok) failures.push(`boot order: ${orderCheck.reason}`);
  if (!normal.state.handlersBound) failures.push('import handlers not bound');
  if (!normal.state.pickerProbe) failures.push('“Déposez votre CV” did not open file picker');
  if (normal.refErr) failures.push(`ReferenceError: ${normal.pageErrors.join('; ')}`);
  if (normal.state.coreBoot !== 'ok') failures.push(`CORE_BOOT state: ${normal.state.coreBoot}`);

  const uploadBeforeCore =
    normal.state.bootOrder.indexOf('UPLOAD_BIND_OK') >= 0 &&
    normal.state.bootOrder.indexOf('UPLOAD_BIND_OK') <
      normal.state.bootOrder.indexOf('CORE_BOOT_OK');
  if (!uploadBeforeCore) failures.push('UPLOAD_BIND_OK must precede CORE_BOOT_OK');

  const templateAfterCore =
    normal.state.bootOrder.indexOf('TEMPLATE_REGISTRY_READY') >
    normal.state.bootOrder.indexOf('CORE_BOOT_OK');
  if (!templateAfterCore) failures.push('TEMPLATE_REGISTRY_READY must follow CORE_BOOT_OK');

  if (!broken.state.pickerProbe) failures.push('file picker broken when templates fail');
  if (!broken.state.handlersBound) failures.push('handlers not bound when templates fail');

  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# Import Boot Independence Report',
    '',
    `**Status:** ${status}`,
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Goal',
    '',
    'Import UI must work even if templates, photo editor, section reorder, or Pro features fail. Upload binding initializes first.',
    '',
    '## Required boot order',
    '',
    ...REQUIRED_ORDER.map((m, i) => `${i + 1}. \`${m}\``),
    '',
    '## Normal boot',
    '',
    '| Check | Result |',
    '|-------|--------|',
    `| Boot order valid | ${orderCheck.ok ? 'yes' : 'no — ' + orderCheck.reason} |`,
    `| \`__hirelyBootOrder\` | \`${normal.state.bootOrder.join(' → ')}\` |`,
    `| Import handlers bound | ${normal.state.handlersBound ? 'yes' : 'no'} |`,
    `| “Déposez votre CV” opens picker | ${normal.state.pickerProbe ? 'yes' : 'no'} |`,
    `| CORE_BOOT | ${normal.state.coreBoot} |`,
    `| ReferenceError | ${normal.refErr ? 'yes' : 'no'} |`,
    '',
    '## Template boot failure simulation',
    '',
    '| Check | Result |',
    '|-------|--------|',
    `| Import handlers bound | ${broken.state.handlersBound ? 'yes' : 'no'} |`,
    `| “Déposez votre CV” opens picker | ${broken.state.pickerProbe ? 'yes' : 'no'} |`,
    `| Template stub/registry | ${broken.state.hasTemplates ? 'present' : 'missing'} |`,
    '',
    '## Changes',
    '',
    '- `ensureImportTemplateStub()` — minimal registry before full template boot',
    '- `bindVerifiedImportHandlers()` runs immediately after definition (not after templates)',
    '- `bootTemplateRegistryDeferred()` runs after `CORE_BOOT_OK`',
    '- Pro/photo init wrapped in try/catch inside deferred template boot',
    '- Post-core `renderAll` / `updatePhotoPreview` wrapped in try/catch',
    '',
  ];

  if (failures.length) {
    lines.push('## Failures', '', ...failures.map((f) => `- ${f}`), '');
  }

  lines.push('## Run', '', '```bash', 'npm run import-boot-independence-report', '```', '');

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`Import boot independence: ${status}`);
  console.log(`Report: ${REPORT}`);
  if (failures.length) {
    failures.forEach((f) => console.error('FAIL:', f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
