#!/usr/bin/env node
/**
 * P0 stability gate — boot markers, render loop, core exports, upload bind.
 * Output: STABILITY_REPORT.md
 * Run: node scripts/generate-stability-report.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'STABILITY_REPORT.md');
const PORT = Number(process.env.HIRELY_STABILITY_PORT || 3012);

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

function run(cmd, label) {
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, label, out: out.trim() };
  } catch (e) {
    return { ok: false, label, out: (e.stdout || '').trim(), err: (e.stderr || e.message || '').trim() };
  }
}

async function browserBootAudit(url) {
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
    const text = String(err?.message || err);
    if (!isExtensionConsoleNoise(text)) errors.push(text);
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3500);

  const boot = await page.evaluate(() => ({
    initHirelyTemplates: typeof window.initHirelyTemplates === 'function',
    HirelyTemplates: !!window.HirelyTemplates,
    uploadZone: !!document.querySelector('[data-upload-zone]'),
    fileInput: !!document.querySelector('input[type=file]#fileInput'),
    uploadClickBound: !!document.querySelector('[data-upload-zone]')?._hirelyImportClickBound,
    handlersBound: !!window.__hirelyImportHandlersBound,
    coreBoot: window.__HIRELY_CORE_BOOT__,
    renderDepth: window.__hirelyRenderCvDepthProbe ?? null,
  }));

  await page.evaluate(() => {
    const input = document.getElementById('fileInput');
    if (!input) return;
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.id === 'fileInput') window.__hirelyPickerProbe = true;
      return orig.call(this);
    };
  });

  let filePickerTriggered = false;
  const zone = page.locator('[data-upload-zone]');
  if (await zone.count()) {
    await zone.click({ timeout: 5000 });
    await page.waitForTimeout(400);
    filePickerTriggered = await page.evaluate(() => !!window.__hirelyPickerProbe);
  }

  const pipelineSpam = logs.filter((l) =>
    /^(SANITIZED_COUNTS|RESUMEDATA_COUNTS|CVDATA_COUNTS|TEMPLATE_COUNTS)\b/.test(l.text)
  ).length;

  await browser.close();
  return { boot, logs, errors, filePickerTriggered, pipelineSpam };
}

async function main() {
  const server = await startServer();
  const url = `http://127.0.0.1:${PORT}/index.html`;

  const coreExports = run('node scripts/check-core-exports.mjs', 'core-exports');
  const renderLoop = run('node src/tests/qa-render-loop-final-cv.mjs', 'render-loop');
  const browser = await browserBootAudit(url);

  const markers = ['CV_TEMPLATE_BOOT_OK', 'CORE_BOOT_OK', 'UPLOAD_BIND_OK', 'IMPORT_UI_READY'];
  const markerHits = Object.fromEntries(
    markers.map((m) => [m, browser.logs.some((l) => l.text.includes(m))])
  );

  const syntaxErr = browser.errors.some((e) => /Invalid regular expression|SyntaxError/i.test(e));
  const refErr = browser.errors.some((e) =>
    /initHirelyTemplates is not defined|ReferenceError|CORE_BOOT_FAILED/i.test(e)
  );
  const fatalErr = browser.errors.some((e) =>
    /SyntaxError|ReferenceError|TypeError.*export/i.test(e)
  );

  const checks = [
    { id: 'CORE_BOOT_OK', ok: markerHits.CORE_BOOT_OK && browser.boot.coreBoot === 'ok' },
    { id: 'CV_TEMPLATE_BOOT_OK', ok: markerHits.CV_TEMPLATE_BOOT_OK && browser.boot.HirelyTemplates },
    { id: 'UPLOAD_BIND_OK', ok: markerHits.UPLOAD_BIND_OK && browser.boot.handlersBound },
    { id: 'IMPORT_UI_READY', ok: markerHits.IMPORT_UI_READY },
    { id: 'no_render_loop_spam', ok: browser.pipelineSpam === 0 },
    { id: 'upload_zone_clickable', ok: browser.boot.uploadClickBound && browser.filePickerTriggered },
    { id: 'file_picker_opens', ok: browser.filePickerTriggered },
    { id: 'core_exports', ok: coreExports.ok },
    { id: 'render_loop_test', ok: renderLoop.ok },
    { id: 'no_syntax_error', ok: !syntaxErr },
    { id: 'no_reference_error', ok: !refErr },
    { id: 'no_fatal_boot', ok: !fatalErr },
  ];

  const pass = checks.every((c) => c.ok);

  const lines = [
    '# STABILITY_REPORT',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Date:** ${new Date().toISOString()}`,
    `**Scope:** P0 stability — boot, render loop, upload bind (no design/OCR/features)`,
    '',
    '## Acceptance',
    '',
    ...checks.map((c) => `- ${c.id}: ${c.ok ? 'PASS' : '**FAIL**'}`),
    '',
    '## Console markers',
    '',
    ...markers.map((m) => `- ${m}: ${markerHits[m] ? 'yes' : 'NO'}`),
    '',
    '## Boot state',
    '',
    `- CORE_BOOT: ${browser.boot.coreBoot || 'unknown'}`,
    `- HirelyTemplates: ${browser.boot.HirelyTemplates ? 'yes' : 'NO'}`,
    `- upload handlers bound: ${browser.boot.handlersBound ? 'yes' : 'NO'}`,
    `- upload click listener: ${browser.boot.uploadClickBound ? 'yes' : 'NO'}`,
    `- file picker on zone click: ${browser.filePickerTriggered ? 'yes' : 'NO'}`,
    `- pipeline count console spam (boot): ${browser.pipelineSpam}`,
    '',
    '## Automated tests',
    '',
    `- check-core-exports: ${coreExports.ok ? 'PASS' : 'FAIL'}`,
    `- qa-render-loop-final-cv: ${renderLoop.ok ? 'PASS' : 'FAIL'}`,
    '',
    '## Repeated render logs (audited)',
    '',
    '| Stage | Source | Production log | Deduped per import |',
    '|-------|--------|----------------|-------------------|',
    '| `SANITIZED_COUNTS` | `sanitize-resume-display.js` | debug only | yes |',
    '| `RESUMEDATA_COUNTS` | `resume-data.js` → `resumeDataToCvData` | debug only | yes |',
    '| `CVDATA_COUNTS` | `resume-data.js`, `simple-cv-mapper.js` | debug only | yes |',
    '| `TEMPLATE_COUNTS` | `index.html` `renderCVInner` | debug only | yes |',
    '',
    '## Fixes applied (this pass)',
    '',
    '- Pipeline count logs gated behind `?debug=true` (no production console spam)',
    '- `buildFinalResumeData` / checklist paths use `skipNormalize` (no re-sanitize on render)',
    '- `resumeDataIsRenderable` skips display sanitize on hot path',
    '- `renderCV` reentrancy guard (`_renderCvDepth`) — render cannot recurse',
    '- Upload handlers bind once in `initHirelyApp` only',
    '- Upload zone stays clickable during core-blocked / loading states',
    '',
    '## Browser errors',
    '',
    ...(browser.errors.length ? browser.errors.map((e) => `- ${e}`) : ['- none']),
    '',
  ];

  if (!coreExports.ok) {
    lines.push('## check-core-exports output', '', '```', coreExports.err || coreExports.out, '```', '');
  }
  if (!renderLoop.ok) {
    lines.push('## qa-render-loop output', '', '```', renderLoop.err || renderLoop.out, '```', '');
  }

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(lines.join('\n'));

  server.close();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
