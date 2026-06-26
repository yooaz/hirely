#!/usr/bin/env node
/**
 * Boot trace forensic audit — finds first failure in canonical boot chain.
 * Generates BOOT_TRACE_FORENSIC_REPORT.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(root, 'BOOT_TRACE_FORENSIC_REPORT.md');

const CHAIN = [
  'BOOT_START',
  'DOM_CONTRACT_READY',
  'CORE_IMPORT_STARTED',
  'CORE_IMPORT_OK',
  'TEMPLATE_REGISTRY_READY',
  'RENDER_OUTPUTS_START',
  'RENDER_OUTPUTS_OK',
  'RENDER_ALL_START',
  'RENDER_ALL_OK',
  'UI_READY',
  'IMPORT_READY',
];

const PORT = Number(process.env.HIRELY_BOOT_FORENSIC_PORT || 3113);

async function startServer() {
  const { spawn } = await import('node:child_process');
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  return proc;
}

async function runBoot(url, { label }) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleLines = [];
  const pageErrors = [];

  page.on('console', (msg) => consoleLines.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(
    () =>
      window.__HIRELY_CORE_BOOT__ === 'ok' ||
      window.__HIRELY_CORE_BOOT__ === 'degraded' ||
      window.__HIRELY_CORE_BOOT__ === 'failed' ||
      window.HirelyBootTrace?.getForensicReport?.()?.firstFailure,
    { timeout: 120000 }
  );
  await page.waitForTimeout(1200);

  const payload = await page.evaluate(() => {
    const report = window.HirelyBootTrace?.getForensicReport?.() || null;
    const trace = Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__) ? window.__HIRELY_CORE_BOOT_TRACE__ : [];
    return {
      report,
      traceTail: trace.slice(-24),
      coreBoot: window.__HIRELY_CORE_BOOT__ || null,
      bootOrder: window.__hirelyBootOrder || [],
    };
  });

  await browser.close();
  return { label, url, consoleLines, pageErrors, ...payload };
}

function bootMarkersInConsole(lines) {
  const markers = ['BOOT_START', 'CORE_IMPORT_STARTED', 'CORE_IMPORT_OK', 'TEMPLATE_REGISTRY_READY', 'UI_READY'];
  return markers.filter((m) => lines.some((l) => l.text.includes(m) || l.text.trim() === m));
}

function formatFirstFailure(ff) {
  if (!ff) return '_No failure recorded — boot chain completed or still in progress._';
  return [
    `| Field | Value |`,
    `|-------|-------|`,
    `| Step | \`${ff.tag}\` |`,
    `| Error name | \`${ff.errorName || '—'}\` |`,
    `| Error message | ${ff.errorMessage || '—'} |`,
    `| Missing DOM | ${(ff.missingDomIds || []).join(', ') || '—'} |`,
    `| Source | \`${ff.source || ff.module || '—'}\` |`,
    `| Stack | \`${String(ff.stack || '').split('\n')[0] || '—'}\` |`,
  ].join('\n');
}

async function main() {
  const server = await startServer();
  const base = `http://127.0.0.1:${PORT}/index.html`;

  let prod;
  let debug;
  try {
    prod = await runBoot(base, { label: 'production' });
    debug = await runBoot(`${base}?debug=true`, { label: 'debug' });
  } finally {
    server.kill('SIGTERM');
  }

  const report = debug.report || {};
  const firstFailure = report.firstFailure || null;
  const completed = report.completed || [];
  const missing = report.missing || CHAIN.filter((s) => !completed.includes(s));
  const pass = !firstFailure && debug.coreBoot !== 'failed' && missing.length === 0;

  const prodBootLogs = bootMarkersInConsole(prod.consoleLines);
  const debugBootLogs = bootMarkersInConsole(debug.consoleLines);

  const lines = [
    '# BOOT_TRACE_FORENSIC_REPORT',
    '',
    `**Status:** ${pass ? 'PASS' : firstFailure ? 'FAIL' : 'PARTIAL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Canonical boot chain',
    '',
    CHAIN.map((s) => `- \`${s}\``).join('\n'),
    '',
    '## First failure',
    '',
    formatFirstFailure(firstFailure),
    '',
    '## Chain completion (debug run)',
    '',
    '| Step | Status |',
    '|------|--------|',
    ...CHAIN.map((s) => {
      const failed = firstFailure?.tag === s;
      const ok = completed.includes(s);
      const status = failed ? '**FAILED**' : ok ? 'PASS' : 'MISSING';
      return `| ${s} | ${status} |`;
    }),
    '',
    missing.length ? `**Missing steps:** ${missing.map((s) => `\`${s}\``).join(', ')}` : '**Missing steps:** none',
    '',
    '## Production console policy',
    '',
    `- Boot marker strings in production console: ${prodBootLogs.length ? prodBootLogs.join(', ') : 'none (expected)'}`,
    `- Boot marker strings with \`?debug=true\`: ${debugBootLogs.length ? debugBootLogs.join(', ') : 'see [Hirely boot] lines'}`,
    `- Production page errors: ${prod.pageErrors.length ? prod.pageErrors.join('; ') : 'none'}`,
    '',
    '## Debug run summary',
    '',
    '```json',
    JSON.stringify(
      {
        coreBoot: debug.coreBoot,
        engineHealth: report.engineHealth,
        completed,
        missing,
        bootOrder: debug.bootOrder,
        traceLength: report.traceLength,
      },
      null,
      2
    ),
    '```',
    '',
    '## Trace tail (debug, last 24 entries)',
    '',
    '```json',
    JSON.stringify(debug.traceTail, null, 2),
    '```',
    '',
    '## Implementation',
    '',
    '- `src/ui/runtime/boot-trace.js` — canonical milestones; console only when `?debug=true`',
    '- `src/ui/runtime/dom-contract.js` — `DOM_CONTRACT_READY` + missing required DOM capture',
    '- `src/core/boot/core-boot-loader.mjs` — loader logs gated to debug URL',
    '- `index.html` — `bootTraceStep` / `bootTraceFail` at render + core import boundaries',
    '',
    '## Verify',
    '',
    '```bash',
    'npm run qa:boot-trace-forensic',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(pass ? 'BOOT_TRACE_FORENSIC PASS' : 'BOOT_TRACE_FORENSIC FAIL');
  if (firstFailure) {
    console.log('First failure:', firstFailure.tag, firstFailure.errorMessage || '');
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
