#!/usr/bin/env node
/**
 * Empty CV protection — unit + browser gates. Writes EMPTY_CV_PROTECTION_REPORT.md
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { validateCvData, CV_DATA_STATUS } from '../src/core/validation/cv-data-protection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT = path.join(root, 'EMPTY_CV_PROTECTION_REPORT.md');
const PORT = Number(process.env.HIRELY_EMPTY_CV_PORT || 3121);
const RICH_FIXTURE = path.join(root, 'tests/fixtures/designer-cv-rich.txt');

const checks = [];

function record(id, ok, detail = '') {
  checks.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
}

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

function runUnitSuite() {
  const r = spawnSync('node', ['src/tests/qa-cv-data-protection.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  record('unit_validateCvData', r.status === 0, r.status !== 0 ? (r.stderr || r.stdout).trim() : '');
}

async function browserScenario() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, {
      waitUntil: 'networkidle',
      timeout: 120000,
    });
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => typeof window.getCvDataValidation === 'function', {
      timeout: 120000,
    });

    const emptyGate = await page.evaluate(() => {
      const fn = window.getCvDataValidation;
      const invalid = fn();
      let exportBlocked = false;
      const prevStep = window.state?.docStep;
      if (typeof window.setDocStep === 'function') {
        window.setDocStep('export');
        exportBlocked = window.state?.docStep !== 'export';
        if (prevStep != null && window.state) window.state.docStep = prevStep;
      }
      const dl = document.getElementById('downloadBtn');
      return {
        invalidStatus: invalid.status,
        reasons: invalid.reasons || [],
        blockExport: invalid.blockExport,
        blockReview: invalid.blockReview,
        exportBlocked,
        downloadDisabled: dl ? !!dl.disabled : true,
      };
    });

    record(
      'browser_empty_cv_invalid',
      emptyGate.invalidStatus === 'INVALID' && emptyGate.blockExport,
      JSON.stringify(emptyGate)
    );
    record(
      'browser_export_nav_blocked_when_invalid',
      emptyGate.exportBlocked,
      emptyGate.exportBlocked ? '' : 'setDocStep(export) succeeded on empty CV'
    );

    await page.locator('#fileInput').setInputFiles(RICH_FIXTURE);
    await page.waitForFunction(
      () =>
        window.HirelyImportForensics?.getForensicReport?.()?.completed?.includes('CV_READY') ||
        document.getElementById('cvDoc')?.classList.contains('cv--live'),
      { timeout: 120000 }
    );
    await page.waitForTimeout(2000);

    const richGate = await page.evaluate(() => {
      const fn = window.getCvDataValidation;
      const v = fn ? fn() : { status: 'UNKNOWN' };
      const editBtn = document.querySelector('.hirelyProgressBtn[data-doc-step="edit"]');
      const exportBtn = document.querySelector('.hirelyProgressBtn[data-doc-step="export"]');
      return {
        status: v.status,
        blockExport: v.blockExport,
        editDisabled: editBtn?.disabled,
        exportDisabled: exportBtn?.disabled,
        cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      };
    });

    record(
      'browser_rich_import_valid_or_partial',
      richGate.status === 'VALID' || richGate.status === 'PARTIAL',
      JSON.stringify(richGate)
    );
    record(
      'browser_rich_cv_live',
      richGate.cvLive,
      richGate.cvLive ? '' : 'preview not live'
    );

    return { emptyGate, richGate };
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  runUnitSuite();

  const empty = validateCvData({
    cvData: { name: '', experience: [] },
    sectionCounts: {},
    previewLive: false,
    previewText: '',
  });
  record('report_invalid_status', empty.status === CV_DATA_STATUS.INVALID, empty.status);

  let browser = null;
  try {
    browser = await browserScenario();
  } catch (e) {
    record('browser_scenario', false, String(e?.message || e));
  }

  const pass = checks.every((c) => c.ok);
  const lines = [
    '# EMPTY_CV_PROTECTION_REPORT',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Module:** \`src/core/validation/cv-data-protection.js\``,
    '',
    '## validateCvData() outcomes',
    '',
    '| Status | Meaning | Review | Style | Export |',
    '|--------|---------|--------|-------|--------|',
    '| `VALID` | Name, experience, sections, and preview OK | ✓ | ✓ | ✓ |',
    '| `PARTIAL` | Minimum structure but not export-safe | ✓ | ✗ | ✗ |',
    '| `INVALID` | Missing name, experience, sections, or preview | ✗ | ✗ | ✗ |',
    '',
    '## INVALID triggers',
    '',
    '- `name_missing` — invalid or placeholder name',
    '- `experience_missing` — zero experiences',
    '- `all_sections_empty` — no section content and no summary',
    '- `preview_empty` — preview not live and no displayable text',
    '',
    '## INVALID behavior',
    '',
    '- Recovery UI via `extractionRecoveryPanel` + import warning',
    '- `setDocStep(edit|style|export)` redirected to import',
    '- `downloadPDF()` hard-blocked',
    '- Progress nav disables Review / Style / Export',
    '',
    '## Checks',
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    ...checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`),
    '',
    '## Browser snapshot',
    '',
    browser
      ? [
          '```json',
          JSON.stringify(browser, null, 2),
          '```',
        ].join('\n')
      : '_Browser scenario did not complete._',
    '',
    '## Re-run',
    '',
    '```bash',
    'npm run qa:empty-cv-protection',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`Wrote ${REPORT}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
