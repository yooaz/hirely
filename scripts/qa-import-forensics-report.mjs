#!/usr/bin/env node
/**
 * Import lifecycle forensics — traces canonical milestones and finds first failure.
 * Generates IMPORT_FORENSICS_REPORT.md
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(root, 'IMPORT_FORENSICS_REPORT.md');
const PRIMARY_FIXTURE = path.join(
  root,
  process.env.HIRELY_FORENSIC_FIXTURE || 'tests/fixtures/designer-cv-rich.txt'
);
const THRESHOLD_PROBE_FIXTURE = path.join(root, 'tests/fixtures/mvp-sample.txt');
const PORT = Number(process.env.HIRELY_IMPORT_FORENSIC_PORT || 3117);
const BASE = `http://127.0.0.1:${PORT}/index.html?debug=forensic`;

const CHAIN = [
  'DROP_RECEIVED',
  'FILE_SELECTED',
  'FILE_VALIDATED',
  'FILE_ROUTED',
  'PDF_TEXT_FOUND',
  'OCR_STARTED',
  'OCR_FINISHED',
  'EXTRACTION_STARTED',
  'EXTRACTION_FINISHED',
  'CV_READY',
  'EXPORT_READY',
];

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
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let fp = path.join(root, decodeURIComponent(url.pathname));
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

function formatFailure(ff) {
  if (!ff) return '_No failure — chain completed or still in progress._';
  if (ff.type === 'deferred_optional') {
    return [
      `**Type:** deferred (import OK, export not rendered)`,
      `**Tag:** \`${ff.tag}\``,
      `**Detail:** ${ff.detail}`,
    ].join('\n');
  }
  if (ff.type === 'explicit_failure') {
    return [
      `**Type:** explicit failure`,
      `**Tag:** \`${ff.tag}\``,
      `**At:** ${ff.at || '—'}`,
      `**Detail:** ${JSON.stringify(ff.detail)}`,
      `**Chain gap at failure:** \`${ff.chainGapAtFailure || '—'}\``,
    ].join('\n');
  }
  return [
    `**Type:** chain incomplete`,
    `**First missing milestone:** \`${ff.tag}\``,
    `**Detail:** ${ff.detail}`,
  ].join('\n');
}

async function runImportScenario(fixturePath) {
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing fixture: ${fixturePath}`);
  }

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const consoleLines = [];
  const pageErrors = [];

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => consoleLines.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => !!window.__hirelyImportHandlersBound, { timeout: 60000 });

    await page.locator('#fileInput').setInputFiles(fixturePath);

    let importTimedOut = false;
    try {
      await page.waitForFunction(
        () => {
          const r = window.HirelyImportForensics?.getForensicReport?.();
          return r?.completed?.includes('CV_READY') || r?.firstFailure != null;
        },
        { timeout: 120000 }
      );
    } catch (e) {
      importTimedOut = true;
      console.warn('Import wait timed out — capturing partial forensic state');
    }

    await page.evaluate(() => {
      try {
        if (typeof setDocStep === 'function') setDocStep('export');
        else if (window.state) window.state.docStep = 'export';
        if (typeof renderAllFromFinalResume === 'function') {
          renderAllFromFinalResume({ includeExport: true });
        }
      } catch (e) {
        console.error('forensic export trigger', e);
      }
    });

    await page.waitForTimeout(2000);

    const payload = await page.evaluate(() => {
      const report = window.HirelyImportForensics?.getForensicReport?.() || null;
      const flow = (window.__HIRELY_FLOW_LOGS || []).slice(-40);
      return {
        report,
        flow,
        importStatus: window.state?.lastImportStatus || null,
        cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
        rawLen: (window.state?.rawText || '').length,
        handlersBound: !!window.__hirelyImportHandlersBound,
        coreBoot: window.__HIRELY_CORE_BOOT__ || null,
        forensicLoaded: !!window.HirelyImportForensics,
      };
    });

    return { payload, consoleLines, pageErrors, importTimedOut, fixturePath };
  } finally {
    await browser.close();
    server.close();
  }
}

function scenarioPass(report) {
  const completed = report?.completed || [];
  return (
    !report?.firstFailure &&
    completed.includes('EXTRACTION_FINISHED') &&
    completed.includes('CV_READY')
  );
}

function renderScenarioSection(title, fixturePath, { payload, pageErrors, importTimedOut }) {
  const report = payload.report;
  const completed = report?.completed || [];
  const missing = report?.missing || [];
  const firstFp = report?.firstFailurePoint || null;
  const pass = scenarioPass(report);

  return [
    `## ${title}`,
    '',
    `**Fixture:** \`${path.relative(root, fixturePath)}\``,
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    '',
    '### Lifecycle chain',
    '',
    CHAIN.map((s, i) => {
      const ok = completed.includes(s);
      const applicable = report?.applicable || [];
      const branch =
        s === 'PDF_TEXT_FOUND' || s === 'OCR_STARTED' || s === 'OCR_FINISHED' ? ' (branch)' : '';
      const optional = !applicable.includes(s) && ok === false ? ' (n/a)' : '';
      return `${i + 1}. \`${s}\`${branch}${optional} — ${ok ? '✓' : '✗'}`;
    }).join('\n'),
    '',
    '### First failure point',
    '',
    formatFailure(firstFp),
    '',
    '### Runtime summary',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| Import timed out | ${importTimedOut} |`,
    `| Import status | ${payload.importStatus ?? '—'} |`,
    `| CV live | ${payload.cvLive} |`,
    `| Raw text length | ${payload.rawLen} |`,
    `| Branch | ${report?.branch ?? '—'} |`,
    `| Completed | ${completed.join(' → ') || 'none'} |`,
    `| Missing | ${missing.length ? missing.join(', ') : 'none'} |`,
    `| Page errors | ${pageErrors.length ? pageErrors.join('; ') : 'none'} |`,
    '',
    '### Milestone tail',
    '',
    '| Time | Tag | Detail |',
    '|------|-----|--------|',
    ...(report?.steps || []).slice(-12).map((s) => {
      const detail =
        s.detail == null
          ? ''
          : typeof s.detail === 'object'
            ? JSON.stringify(s.detail).slice(0, 60)
            : String(s.detail).slice(0, 60);
      return `| ${s.iso?.slice(11, 23) || '—'} | \`${s.tag}\` | ${detail} |`;
    }),
    '',
  ];
}

async function main() {
  const primary = await runImportScenario(PRIMARY_FIXTURE);
  const primaryPass = scenarioPass(primary.payload.report);

  let threshold = null;
  if (fs.existsSync(THRESHOLD_PROBE_FIXTURE) && THRESHOLD_PROBE_FIXTURE !== PRIMARY_FIXTURE) {
    threshold = await runImportScenario(THRESHOLD_PROBE_FIXTURE);
  }

  const report = primary.payload.report;
  const completed = report?.completed || [];
  const firstFp = report?.firstFailurePoint || null;
  const pass = primaryPass;

  const lines = [
    '# IMPORT_FORENSICS_REPORT',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Source:** \`src/ui/runtime/import-forensics.js\` + \`importLog()\` in \`index.html\``,
    '',
    'Canonical milestones: `DROP_RECEIVED` → `FILE_SELECTED` → `FILE_VALIDATED` → `FILE_ROUTED` → (`PDF_TEXT_FOUND` | `OCR_STARTED` → `OCR_FINISHED`) → `EXTRACTION_STARTED` → `EXTRACTION_FINISHED` → `CV_READY` → `EXPORT_READY`.',
    '',
    ...renderScenarioSection('Primary import (full chain)', PRIMARY_FIXTURE, primary),
    ...(threshold
      ? renderScenarioSection('Threshold probe (sub-300 char paste fallback)', THRESHOLD_PROBE_FIXTURE, threshold)
      : []),
    '## Policy',
    '',
    '- All `importLog()` calls feed `HirelyImportForensics.record()`.',
    '- Legacy tags are aliased (e.g. `EXTRACTION_DONE` → `EXTRACTION_FINISHED`).',
    '- Branch milestones (`PDF_TEXT_FOUND`, `OCR_*`) apply only on PDF/OCR paths.',
    '- **First failure** = earliest `FAILURE_TAGS` event, else first applicable chain gap.',
    '- `RAW_TEXT_THRESHOLD` = extracted text under 300 chars → `IMPORT_NEEDS_PASTE` (no parser).',
    '',
    '## Re-run',
    '',
    '```bash',
    'npm run qa:import-forensics',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Status: ${pass ? 'PASS' : 'FAIL'} | completed: ${completed.join(' → ')}`);
  if (firstFp) console.log(`First failure (primary): ${firstFp.tag} (${firstFp.type})`);
  if (threshold?.payload?.report?.firstFailurePoint) {
    const tfp = threshold.payload.report.firstFailurePoint;
    console.log(`Threshold probe first failure: ${tfp.tag} (${tfp.type})`);
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
