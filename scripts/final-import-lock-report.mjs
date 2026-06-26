#!/usr/bin/env node
/**
 * HIRELY FINAL IMPORT LOCK — verify import always ends in Review or calm paste panel.
 * Generates FINAL_IMPORT_LOCK_REPORT.md
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../src/vendor/tesseract-runtime.js';
import {
  OCR_IMPORT_QA_CASES,
  ensureOcrImportQaFixtures,
} from '../tests/lib/ocr-import-qa-fixtures.mjs';
import {
  FINAL_IMPORT_LOCK_VERSION,
  normalizeFinalImportTerminal,
  classifyFinalImportOutcome,
  countImportDecisionLogs,
  previewTextAllowsExport,
  FINAL_IMPORT_OUTCOME,
} from '../src/core/import/final-import-lock.js';
import { IMPORT_STATE } from '../src/core/import/import-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_MD = path.join(ROOT, 'FINAL_IMPORT_LOCK_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/final-import-lock/report.json');

const IMPORT_READY_MS = 30000;
const PDF_OCR_READY_MS = 120000;
const PASTE_PANEL_MS = 90000;
const PASTE_APPLY_MS = 15000;

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.wasm': 'application/wasm',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain; charset=utf-8',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
      const fp = path.join(ROOT, decodeURIComponent(rel));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': mime(fp) });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function ensureVendor() {
  const missing = TESSERACT_REQUIRED_ASSETS.filter(
    (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  if (!missing.length) return { ok: true, missing: [] };
  spawnSync('node', ['scripts/setup-vendor-tesseract.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 300000,
  });
  const stillMissing = TESSERACT_REQUIRED_ASSETS.filter(
    (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  return { ok: stillMissing.length === 0, missing: stillMissing };
}

function runStaticAudit() {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const checks = [];

  checks.push({
    id: 'final_import_lock_module',
    pass: fs.existsSync(path.join(ROOT, 'src/core/import/final-import-lock.js')),
    detail: FINAL_IMPORT_LOCK_VERSION,
  });

  checks.push({
    id: 'no_endImport_partial_trap',
    pass: !/endImport\s*\(\s*IMPORT_STATE\.IMPORT_PARTIAL/.test(indexHtml),
    detail: 'endImport(IMPORT_PARTIAL) removed',
  });

  checks.push({
    id: 'paste_duplicate_guard',
    pass: /IMPORT_PASTE_UI_SKIP/.test(indexHtml) && /panelDup\?\.classList\.contains\('show'\)/.test(indexHtml),
    detail: 'showImportPasteFallback skips duplicate panel',
  });

  checks.push({
    id: 'finish_import_normalizes_terminal',
    pass: /status=v1NormalizeImportTerminal\(status/.test(indexHtml),
    detail: 'finishImportUi normalizes before apply',
  });

  checks.push({
    id: 'v1_honest_terminal_pipeline',
    pass: /const terminal=v1HonestTerminal\(rawText,state\.resumeData\)/.test(indexHtml),
    detail: 'pipeline uses v1HonestTerminal (no raw PARTIAL preserve)',
  });

  return checks;
}

function runUnitChecks() {
  const checks = [];
  const partialToReady = normalizeFinalImportTerminal(IMPORT_STATE.IMPORT_PARTIAL, 'x'.repeat(150));
  checks.push({
    id: 'partial_with_text_becomes_ready',
    pass: partialToReady === IMPORT_STATE.IMPORT_READY,
    detail: partialToReady,
  });

  const partialToPaste = normalizeFinalImportTerminal(IMPORT_STATE.IMPORT_PARTIAL, 'short');
  checks.push({
    id: 'partial_without_text_becomes_paste',
    pass: partialToPaste === IMPORT_STATE.IMPORT_NEEDS_PASTE,
    detail: partialToPaste,
  });

  const reviewSnap = classifyFinalImportOutcome({
    cvLen: 200,
    docStep: 'edit',
    loading: false,
    styleDisabled: false,
    exportDisabled: false,
  });
  checks.push({
    id: 'classify_review_outcome',
    pass: reviewSnap.outcome === FINAL_IMPORT_OUTCOME.REVIEW && !reviewSnap.deadEnd,
    detail: reviewSnap.outcome,
  });

  const pasteSnap = classifyFinalImportOutcome({
    pasteVisible: true,
    docStep: 'import',
    loading: false,
  });
  checks.push({
    id: 'classify_paste_outcome',
    pass: pasteSnap.outcome === FINAL_IMPORT_OUTCOME.PASTE && !pasteSnap.deadEnd,
    detail: pasteSnap.outcome,
  });

  const exportOk = previewTextAllowsExport({ cvLen: 200, v1FlowUnlocked: true });
  checks.push({
    id: 'preview_text_allows_export',
    pass: exportOk === true,
    detail: String(exportOk),
  });

  const decisionCount = countImportDecisionLogs(['IMPORT_DECISION', 'reason NATIVE_TEXT_OK']);
  checks.push({
    id: 'decision_log_counter',
    pass: decisionCount === 1,
    detail: String(decisionCount),
  });

  return checks;
}

async function resetPage(page) {
  await page.goto(`http://127.0.0.1:${page.__port}/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => {
      const b = window.__HIRELY_CORE_BOOT__;
      return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
    },
    null,
    { timeout: 60000 }
  );
  await page.waitForSelector('#fileInput', { state: 'attached', timeout: 15000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    document.getElementById('importPasteFallback')?.classList.remove('show');
    const cv = document.getElementById('cvDoc');
    if (cv) cv.classList.remove('cv--loading');
  });
  await page.waitForTimeout(250);
}

function attachConsole(page) {
  const lines = [];
  page.on('console', (msg) => {
    try {
      lines.push(msg.text());
    } catch {
      lines.push(String(msg));
    }
  });
  return lines;
}

const SNAP_EVAL = `({
  cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
  cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
  docStep: document.getElementById('workspace')?.dataset?.docStep || '',
  pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
  pasteTitle: document.getElementById('importPasteFallbackTitle')?.textContent?.trim() || '',
  loading: document.getElementById('cvDoc')?.classList.contains('cv--loading'),
  styleDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled,
  exportDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="export"]')?.disabled,
  downloadDisabled: document.getElementById('downloadBtn')?.disabled,
  lastDecision: globalThis.HIRELY_LAST_IMPORT_DECISION || '',
  importLoading: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
})`;

async function waitReviewReady(page, { readyMs = IMPORT_READY_MS } = {}) {
  await page.waitForFunction(
    () => {
      const cv = document.getElementById('cvDoc');
      const cvLen = (cv?.innerText || '').trim().length;
      const step = document.getElementById('workspace')?.dataset?.docStep;
      const loading = cv?.classList.contains('cv--loading');
      return cvLen > 80 && step === 'edit' && !loading;
    },
    null,
    { timeout: readyMs }
  );
}

async function waitPastePanel(page, { timeout = PASTE_PANEL_MS } = {}) {
  await page.waitForFunction(
    () => {
      const paste = document.getElementById('importPasteFallback');
      const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
      return paste?.classList.contains('show') && !loading;
    },
    null,
    { timeout }
  );
}

async function ensureLazy(page, kind) {
  if (kind === 'pdf') {
    await page.waitForFunction(() => typeof window.HirelyLazy?.ensurePdf === 'function', null, {
      timeout: 60000,
    });
    await page.evaluate(async () => {
      await window.HirelyLazy.ensurePdf();
    });
  }
  if (kind === 'docx') {
    await page.waitForFunction(() => typeof window.HirelyLazy?.ensureJsZip === 'function', null, {
      timeout: 60000,
    });
    await page.evaluate(async () => {
      await window.HirelyLazy.ensureJsZip();
    });
  }
}

function assessLockCase(snap, consoleLines, { expectOutcome }) {
  const classified = classifyFinalImportOutcome(snap);
  const decisionLogCount = countImportDecisionLogs(consoleLines);
  const oneDecision = !!snap.lastDecision && decisionLogCount <= 1;
  const noEndlessLoading = !snap.loading && !snap.importLoading;
  const noEmptyPreview =
    expectOutcome === FINAL_IMPORT_OUTCOME.PASTE ||
    (snap.cvLen > 80 && !snap.loading);
  const exportOk =
    expectOutcome === FINAL_IMPORT_OUTCOME.PASTE ||
    previewTextAllowsExport({
      cvLen: snap.cvLen,
      v1FlowUnlocked: snap.cvLen > 100,
      exportDisabled: snap.exportDisabled,
    }) ||
    snap.exportDisabled === false;
  const outcomeOk = classified.outcome === expectOutcome;
  const noDeadEnd = !classified.deadEnd;

  const pass =
    noDeadEnd &&
    outcomeOk &&
    oneDecision &&
    noEndlessLoading &&
    noEmptyPreview &&
    exportOk &&
    !!snap.lastDecision;

  return {
    pass,
    outcome: classified.outcome,
    expectOutcome,
    deadEnd: classified.deadEnd,
    oneDecision,
    decisionReason: snap.lastDecision,
    decisionLogCount,
    noEndlessLoading,
    noEmptyPreview,
    exportOk,
    snap,
  };
}

async function runFileCase(page, testCase, filePath, lazyKind, consoleLines) {
  await resetPage(page);
  consoleLines.length = 0;
  if (lazyKind) await ensureLazy(page, lazyKind);

  const expectOutcome =
    testCase.kind === 'paste' ? FINAL_IMPORT_OUTCOME.PASTE : FINAL_IMPORT_OUTCOME.REVIEW;
  const readyMs = lazyKind === 'pdf' ? PDF_OCR_READY_MS : IMPORT_READY_MS;
  const t0 = Date.now();

  await page.locator('#fileInput').setInputFiles(filePath);

  if (expectOutcome === FINAL_IMPORT_OUTCOME.PASTE) {
    await waitPastePanel(page);
  } else {
    await waitReviewReady(page, { readyMs });
  }

  const snap = await page.evaluate(SNAP_EVAL);
  const ms = Date.now() - t0;
  const lock = assessLockCase(snap, consoleLines, { expectOutcome });

  return {
    id: testCase.id,
    label: testCase.label,
    file: testCase.file,
    ms,
    ...lock,
  };
}

async function runPasteInputCase(page, testCase, pastePath, consoleLines) {
  return runFileCase(page, { ...testCase, kind: 'direct' }, pastePath, null, consoleLines);
}

async function runPasteRecoveryCase(page, testCase, filePath, pasteBody, consoleLines) {
  await resetPage(page);
  consoleLines.length = 0;
  await ensureLazy(page, 'pdf');
  await page.locator('#fileInput').setInputFiles(filePath);
  await waitPastePanel(page);
  const pre = await page.evaluate(SNAP_EVAL);
  if (!pre.pasteVisible) {
    return {
      id: `${testCase.id}_recovery`,
      label: `${testCase.label} → paste recovery`,
      file: testCase.file,
      pass: false,
      note: 'Paste panel missing',
      snap: pre,
      deadEnd: true,
    };
  }
  await page.evaluate((t) => {
    const ta = document.getElementById('importPasteFallbackText');
    if (ta) {
      ta.disabled = false;
      ta.value = t;
    }
  }, pasteBody);
  await page.click('#importPasteFallbackApply');
  await waitReviewReady(page, { readyMs: PASTE_APPLY_MS });
  const snap = await page.evaluate(SNAP_EVAL);
  const lock = assessLockCase(snap, consoleLines, {
    expectOutcome: FINAL_IMPORT_OUTCOME.REVIEW,
  });
  return {
    id: `${testCase.id}_recovery`,
    label: `${testCase.label} → paste recovery`,
    file: testCase.file,
    ...lock,
  };
}

function pf(v) {
  return v ? 'PASS' : 'FAIL';
}

async function main() {
  const staticChecks = runStaticAudit();
  const unitChecks = runUnitChecks();
  const vendor = ensureVendor();
  const { paths, pastePath } = await ensureOcrImportQaFixtures(ROOT);
  const pasteBody = fs.readFileSync(pastePath, 'utf8');

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.__port = port;
  const consoleLines = attachConsole(page);

  const browserResults = [];
  try {
    for (const testCase of OCR_IMPORT_QA_CASES) {
      const fp = paths[testCase.id];
      try {
        if (testCase.kind === 'direct') {
          const lazy = fp.endsWith('.pdf') ? 'pdf' : fp.endsWith('.docx') ? 'docx' : null;
          browserResults.push(await runFileCase(page, testCase, fp, lazy, consoleLines));
        } else if (testCase.kind === 'ocr') {
          browserResults.push(await runFileCase(page, testCase, fp, 'pdf', consoleLines));
        } else if (testCase.kind === 'paste') {
          browserResults.push(await runFileCase(page, testCase, fp, 'pdf', consoleLines));
          browserResults.push(
            await runPasteRecoveryCase(page, testCase, fp, pasteBody, consoleLines)
          );
        } else if (testCase.kind === 'paste_input') {
          browserResults.push(await runPasteInputCase(page, testCase, paths.paste, consoleLines));
        }
      } catch (err) {
        browserResults.push({
          id: testCase.id,
          label: testCase.label,
          file: testCase.file,
          pass: false,
          error: String(err?.message || err),
          deadEnd: true,
        });
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const invariantChecks = [
    {
      id: 'no_dead_ends',
      pass: browserResults.every((r) => r.deadEnd !== true && r.pass !== false),
      detail: `${browserResults.filter((r) => r.pass).length}/${browserResults.length} cases`,
    },
    {
      id: 'one_import_decision_reason',
      pass: browserResults.every((r) => r.oneDecision !== false && r.decisionReason),
      detail: browserResults.map((r) => r.decisionReason || '—').join(', '),
    },
    {
      id: 'no_endless_loading',
      pass: browserResults.every((r) => r.noEndlessLoading !== false),
      detail: String(browserResults.every((r) => r.noEndlessLoading !== false)),
    },
    {
      id: 'review_or_paste_only',
      pass: browserResults.every(
        (r) =>
          r.outcome === FINAL_IMPORT_OUTCOME.REVIEW || r.outcome === FINAL_IMPORT_OUTCOME.PASTE
      ),
      detail: browserResults.map((r) => r.outcome).join(', '),
    },
    {
      id: 'export_unlocked_with_preview_text',
      pass: browserResults.every((r) => r.exportOk !== false),
      detail: String(browserResults.every((r) => r.exportOk !== false)),
    },
  ];

  const allChecks = [
    { section: 'static', checks: staticChecks },
    { section: 'unit', checks: unitChecks },
    { section: 'vendor', checks: [{ id: 'vendor_assets', pass: vendor.ok, detail: vendor.missing.join(', ') || 'ok' }] },
    { section: 'browser_invariants', checks: invariantChecks },
  ];

  const allPass =
    allChecks.every((s) => s.checks.every((c) => c.pass)) &&
    browserResults.every((r) => r.pass);

  const status = allPass ? 'PASS' : 'FAIL';
  const runAt = new Date().toISOString();

  const payload = {
    generatedAt: runAt,
    status,
    engine: FINAL_IMPORT_LOCK_VERSION,
    acceptance: {
      review: 'A. Review with CV content (docStep=edit, cvLen>80)',
      paste: 'B. Clear paste panel (importPasteFallback.show, loading cleared)',
      never: 'dead end (blank screen, endless loading, IMPORT_PARTIAL trap)',
    },
    checks: allChecks,
    browserResults,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# Final Import Lock Report',
    '',
    `**Status:** ${status}`,
    `**Generated:** ${runAt}`,
    `**Engine:** ${FINAL_IMPORT_LOCK_VERSION}`,
    '',
    '## Acceptance',
    '',
    'Every import must end in exactly one of:',
    '',
    '- **A. Review with CV content** — `docStep=edit`, preview text > 80 chars, Style/Export unlocked when text > 100',
    '- **B. Clear paste panel** — calm `importPasteFallback` visible, loading cleared, user can paste to continue',
    '',
    'Never: endless loading, duplicate paste panels, `IMPORT_PARTIAL` blocker, empty preview when text exists, strict validation export lock, or missing `IMPORT_DECISION` reason.',
    '',
    '## Lock invariants',
    '',
    '| Invariant | Result |',
    '|-----------|--------|',
    '| No endless loading | ' + pf(invariantChecks[2].pass) + ' |',
    '| No duplicate paste panels (UI guard) | ' + pf(staticChecks.find((c) => c.id === 'paste_duplicate_guard')?.pass) + ' |',
    '| No IMPORT_PARTIAL endImport trap | ' + pf(staticChecks.find((c) => c.id === 'no_endImport_partial_trap')?.pass) + ' |',
    '| No empty preview when text exists | ' + pf(invariantChecks.find((c) => c.id === 'no_dead_ends')?.pass) + ' |',
    '| No export lock when preview has text | ' + pf(invariantChecks[4].pass) + ' |',
    '| One IMPORT_DECISION reason in console | ' + pf(invariantChecks[1].pass) + ' |',
    '',
    '## Static checks',
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    ...staticChecks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail} |`),
    '',
    '## Unit checks',
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    ...unitChecks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail} |`),
    '',
    '## Browser matrix',
    '',
    '| Case | Outcome | Decision | Dead end | Loading cleared | Export OK | Row |',
    '|------|---------|----------|----------|-----------------|-----------|-----|',
    ...browserResults.map(
      (r) =>
        `| ${r.label || r.id} | ${r.outcome || '—'} | \`${r.decisionReason || '—'}\` | ${pf(!r.deadEnd)} | ${pf(r.noEndlessLoading)} | ${pf(r.exportOk)} | ${pf(r.pass)} |`
    ),
    '',
    '## Commands',
    '',
    '```bash',
    'npm run final-import-lock-report',
    '```',
    '',
  ];

  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log(`Wrote ${OUT_MD} — ${status}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
