#!/usr/bin/env node
/**
 * HIRELY OCR QA Matrix — import · review · preview · style · export per input type.
 * Generates OCR_IMPORT_QA_REPORT.md
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_MD = path.join(ROOT, 'OCR_IMPORT_QA_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/ocr-import-qa/report.json');

const IMPORT_READY_MS = 30000;
const PDF_OCR_READY_MS = 120000;
const PASTE_PANEL_MS = 90000;
const PASTE_APPLY_MS = 15000;
const STEP_MS = 15000;

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

async function ensureLazy(page, kind) {
  if (kind === 'pdf') {
    await page.waitForFunction(() => typeof window.HirelyLazy?.ensurePdf === 'function', null, {
      timeout: 60000,
    });
    const err = await page.evaluate(async () => {
      try {
        await window.HirelyLazy.ensurePdf();
        return null;
      } catch (e) {
        return String(e?.message || e);
      }
    });
    if (err) throw new Error(`ensurePdf: ${err}`);
  }
  if (kind === 'docx') {
    await page.waitForFunction(() => typeof window.HirelyLazy?.ensureJsZip === 'function', null, {
      timeout: 60000,
    });
    const err = await page.evaluate(async () => {
      try {
        await window.HirelyLazy.ensureJsZip();
        return null;
      } catch (e) {
        return String(e?.message || e);
      }
    });
    if (err) throw new Error(`ensureJsZip: ${err}`);
  }
}

function snap(page) {
  return page.evaluate(() => ({
    cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
    cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
    docStep: document.getElementById('workspace')?.dataset?.docStep || '',
    pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
    pasteTitle: document.getElementById('importPasteFallbackTitle')?.textContent?.trim() || '',
    pasteLead: document.getElementById('importPasteFallbackLead')?.textContent?.trim() || '',
    liveStatus: document.getElementById('importLiveStatus')?.textContent?.trim() || '',
    styleDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled,
    exportDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="export"]')?.disabled,
    downloadDisabled: document.getElementById('downloadBtn')?.disabled,
    loading: document.getElementById('cvDoc')?.classList.contains('cv--loading'),
    ocrAuto: globalThis.HIRELY_OCR_AUTO === true,
    ocrDisabled: globalThis.HIRELY_OCR_DISABLED_V1 === true,
  }));
}

async function waitReviewReady(page, { readyMs = IMPORT_READY_MS } = {}) {
  const t0 = Date.now();
  await page.waitForFunction(
    () => {
      const cv = document.getElementById('cvDoc');
      const cvLen = (cv?.innerText || '').trim().length;
      const step = document.getElementById('workspace')?.dataset?.docStep;
      const loading = cv?.classList.contains('cv--loading');
      const styleOpen =
        document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled === false;
      return cvLen > 80 && step === 'edit' && !loading && styleOpen;
    },
    null,
    { timeout: readyMs }
  );
  return Date.now() - t0;
}

async function waitPastePanel(page, { timeout = PASTE_PANEL_MS } = {}) {
  const t0 = Date.now();
  await page.waitForFunction(
    () => {
      const paste = document.getElementById('importPasteFallback');
      const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
      return paste?.classList.contains('show') && !loading;
    },
    null,
    { timeout }
  );
  return Date.now() - t0;
}

async function applyPasteText(page, text) {
  await page.evaluate((t) => {
    const ta = document.getElementById('importPasteFallbackText');
    if (ta) {
      ta.disabled = false;
      ta.removeAttribute('aria-disabled');
      ta.value = t;
    }
  }, text);
  const t0 = Date.now();
  await page.click('#importPasteFallbackApply');
  const ms = await waitReviewReady(page, { readyMs: PASTE_APPLY_MS });
  const state = await snap(page);
  return { pasteApplyMs: ms, ...state };
}

async function navigateSteps(page) {
  const steps = [];
  for (const step of ['style', 'export']) {
    await page.evaluate((s) => window.setDocStep(s), step);
    await page.waitForFunction(
      (s) => document.getElementById('workspace')?.dataset?.docStep === s,
      step,
      { timeout: STEP_MS }
    );
    steps.push({ step, ...(await snap(page)) });
  }
  return steps;
}

function reviewChecks(s) {
  return {
    reviewOpens: s.docStep === 'edit',
    previewNotEmpty: s.cvLen > 80 && !s.loading,
    styleUnlocked: s.styleDisabled === false,
    exportUnlocked: s.exportDisabled === false,
  };
}

function styleExportChecks(steps) {
  const styleStep = steps.find((x) => x.step === 'style');
  const exportStep = steps.find((x) => x.step === 'export');
  return {
    styleReachable: styleStep?.docStep === 'style',
    exportReachable: exportStep?.docStep === 'export',
    exportDownloadUnlocked: exportStep?.downloadDisabled === false,
    exportPreviewLive: exportStep?.cvLive === true,
  };
}

function assessDownstream(id, imp, steps, { importPath }) {
  const review = reviewChecks(imp);
  const nav = styleExportChecks(steps);
  const pass =
    review.reviewOpens &&
    review.previewNotEmpty &&
    review.styleUnlocked &&
    review.exportUnlocked &&
    nav.styleReachable &&
    nav.exportReachable &&
    nav.exportDownloadUnlocked &&
    nav.exportPreviewLive;

  return {
    id,
    importPath,
    importMs: imp.importMs ?? imp.ms ?? imp.pasteApplyMs ?? -1,
    import: { pass: true, path: importPath, ms: imp.importMs ?? imp.ms ?? -1 },
    review: { pass: review.reviewOpens && review.previewNotEmpty, ...review },
    preview: { pass: review.previewNotEmpty, cvLen: imp.cvLen },
    style: { pass: review.styleUnlocked && nav.styleReachable, ...review, ...nav },
    export: {
      pass: review.exportUnlocked && nav.exportReachable && nav.exportDownloadUnlocked,
      ...review,
      ...nav,
    },
    pass,
    note: pass
      ? `${importPath} → Review → Style → Export`
      : [
          !review.reviewOpens && 'Review not open',
          !review.previewNotEmpty && 'Preview empty',
          !review.styleUnlocked && 'Style locked',
          !review.exportUnlocked && 'Export locked',
          !nav.styleReachable && 'Style step blocked',
          !nav.exportReachable && 'Export step blocked',
        ]
          .filter(Boolean)
          .join('; '),
    snap: imp,
    steps,
  };
}

function assessPasteImport(id, ms, s) {
  const calmTitle = /ce pdf est une image|collez/i.test(s.pasteTitle || '');
  const calmLead = /collez le texte/i.test(s.pasteLead || s.pasteTitle || '');
  const pass = s.pasteVisible && s.docStep === 'import' && (calmTitle || calmLead);
  return {
    pass,
    ms,
    pasteVisible: s.pasteVisible,
    pasteTitle: s.pasteTitle,
    pasteLead: s.pasteLead,
    docStep: s.docStep,
    note: pass ? `Calm paste panel (${ms}ms)` : 'Expected paste panel after unreadable PDF',
  };
}

async function runDirectCase(page, testCase, filePath, lazyKind) {
  await resetPage(page);
  if (lazyKind) await ensureLazy(page, lazyKind);
  const readyMs = lazyKind === 'pdf' ? PDF_OCR_READY_MS : IMPORT_READY_MS;
  const t0 = Date.now();
  await page.locator('#fileInput').setInputFiles(filePath);
  const waitMs = await waitReviewReady(page, { readyMs });
  const imp = { importMs: Date.now() - t0, ...(await snap(page)), waitMs };
  const steps = await navigateSteps(page);
  return assessDownstream(testCase.id, imp, steps, { importPath: 'direct' });
}

async function runOcrCase(page, testCase, filePath) {
  await resetPage(page);
  await ensureLazy(page, 'pdf');
  const t0 = Date.now();
  await page.locator('#fileInput').setInputFiles(filePath);

  let importPath = 'ocr';
  let imp;

  try {
    const waitMs = await waitReviewReady(page, { readyMs: PDF_OCR_READY_MS });
    imp = { importMs: Date.now() - t0, ...(await snap(page)), waitMs };
  } catch {
    const snapState = await snap(page);
    if (snapState.pasteVisible) {
      importPath = 'ocr_failed_paste';
      return {
        id: testCase.id,
        importPath,
        import: {
          pass: false,
          path: importPath,
          ms: Date.now() - t0,
          note: 'OCR expected Review but got paste panel',
        },
        review: { pass: false },
        preview: { pass: false },
        style: { pass: false },
        export: { pass: false },
        pass: false,
        note: 'OCR path failed — paste panel instead of Review',
        snap: snapState,
        steps: [],
      };
    }
    throw new Error(`OCR import timeout for ${testCase.file}`);
  }

  const steps = await navigateSteps(page);
  const row = assessDownstream(testCase.id, imp, steps, { importPath: 'ocr' });
  row.import = { pass: true, path: 'ocr', ms: imp.importMs };
  return row;
}

async function runPasteFileCase(page, testCase, filePath, pasteRecoveryText) {
  await resetPage(page);
  await ensureLazy(page, 'pdf');
  const t0 = Date.now();
  await page.locator('#fileInput').setInputFiles(filePath);
  const panelMs = await waitPastePanel(page);
  const panelSnap = await snap(page);
  const importAssess = assessPasteImport(testCase.id, Date.now() - t0, panelSnap);

  if (!importAssess.pass) {
    return {
      id: testCase.id,
      importPath: 'paste_panel',
      import: { pass: false, path: 'paste_panel', ms: panelMs, ...importAssess },
      review: { pass: false },
      preview: { pass: false },
      style: { pass: false },
      export: { pass: false },
      pass: false,
      note: importAssess.note,
      snap: panelSnap,
      steps: [],
    };
  }

  const afterPaste = await applyPasteText(page, pasteRecoveryText);
  const steps = await navigateSteps(page);
  const row = assessDownstream(testCase.id, afterPaste, steps, { importPath: 'paste_panel→paste' });
  row.import = { pass: true, path: 'paste_panel→paste', ms: panelMs, ...importAssess };
  return row;
}

async function runPasteInputCase(page, testCase, text) {
  await resetPage(page);
  await page.evaluate(() => {
    window.showImportPasteFallback('', 'IMPORT_NEEDS_PASTE', {
      silentLog: true,
      pasteFirst: true,
      reason: 'paste_input',
    });
  });
  const t0 = Date.now();
  const afterPaste = await applyPasteText(page, text);
  afterPaste.importMs = Date.now() - t0;
  const steps = await navigateSteps(page);
  const row = assessDownstream(testCase.id, afterPaste, steps, { importPath: 'paste_input' });
  row.import = { pass: true, path: 'paste_input', ms: afterPaste.importMs };
  return row;
}

function pf(v) {
  return v ? 'PASS' : 'FAIL';
}

async function main() {
  const vendor = ensureVendor();
  const { paths, pastePath } = await ensureOcrImportQaFixtures(ROOT);
  const pasteBody = fs.readFileSync(pastePath, 'utf8');

  for (const c of OCR_IMPORT_QA_CASES) {
    const fp = paths[c.id];
    if (!fp || !fs.existsSync(fp)) {
      console.error(`Missing fixture for ${c.id}: ${fp}`);
      process.exit(1);
    }
  }

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.__port = port;

  const results = [];
  const runAt = new Date().toISOString();

  try {
    for (const testCase of OCR_IMPORT_QA_CASES) {
      const fp = paths[testCase.id];
      try {
        if (testCase.kind === 'direct') {
          const lazy = fp.endsWith('.pdf') ? 'pdf' : fp.endsWith('.docx') ? 'docx' : null;
          results.push(await runDirectCase(page, testCase, fp, lazy));
        } else if (testCase.kind === 'ocr') {
          results.push(await runOcrCase(page, testCase, fp));
        } else if (testCase.kind === 'paste') {
          results.push(await runPasteFileCase(page, testCase, fp, pasteBody));
        } else if (testCase.kind === 'paste_input') {
          results.push(await runPasteInputCase(page, testCase, pasteBody));
        }
      } catch (err) {
        results.push({
          id: testCase.id,
          label: testCase.label,
          file: testCase.file,
          pass: false,
          importPath: testCase.kind,
          import: { pass: false },
          review: { pass: false },
          preview: { pass: false },
          style: { pass: false },
          export: { pass: false },
          note: `Error: ${err?.message || err}`,
          error: String(err?.message || err),
        });
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const ocrFlagsOk = results.every((r) => r.snap?.ocrAuto !== false && r.snap?.ocrDisabled !== true);
  const directCases = ['text_pdf', 'docx', 'txt', 'paste'];
  const ocrCases = ['illustrator_flat', 'scanned_pdf'];
  const pasteCase = results.find((r) => r.id === 'image_only_pdf');

  const directPass = directCases.every((id) => results.find((r) => r.id === id)?.pass);
  const ocrPass = ocrCases.every((id) => results.find((r) => r.id === id)?.pass);
  const pastePass = pasteCase?.pass === true;
  const pastePanelOk =
    pasteCase?.import?.path?.includes('paste') && pasteCase?.import?.pass !== false;

  const checks = [
    { id: 'vendor_assets', pass: vendor.ok, detail: vendor.missing.join(', ') || 'ok' },
    { id: 'ocr_enabled', pass: ocrFlagsOk, detail: String(ocrFlagsOk) },
    { id: 'direct_review_paths', pass: directPass, detail: `${directCases.filter((id) => results.find((r) => r.id === id)?.pass).length}/${directCases.length}` },
    { id: 'ocr_review_paths', pass: ocrPass, detail: `${ocrCases.filter((id) => results.find((r) => r.id === id)?.pass).length}/${ocrCases.length}` },
    { id: 'unreadable_paste_path', pass: pastePass, detail: pasteCase?.import?.path || '—' },
    { id: 'calm_paste_panel', pass: pastePanelOk || pastePass, detail: pasteCase?.import?.pasteTitle || '—' },
  ];

  const allPass = checks.every((c) => c.pass) && results.every((r) => r.pass);
  const status = allPass ? 'PASS' : 'FAIL';

  const payload = {
    generatedAt: runAt,
    status,
    engine: 'OCR_IMPORT_QA_MATRIX_V1',
    checks,
    results: results.map((r) => {
      const meta = OCR_IMPORT_QA_CASES.find((c) => c.id === r.id);
      return { ...r, label: meta?.label, file: meta?.file, expectNote: meta?.expectNote };
    }),
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# OCR Import QA Matrix',
    '',
    `**Status:** ${status}`,
    `**Generated:** ${runAt}`,
    '',
    '## Expected behaviour',
    '',
    '| Input | Import path | Downstream |',
    '|-------|-------------|------------|',
    '| Text PDF, DOCX, TXT, paste | Native / text extract | Direct Review → Style → Export |',
    '| Scanned / flattened PDF | OCR (≤20s) | Review if text readable |',
    '| Unreadable image PDF | OCR attempt | Calm paste panel → paste recovery |',
    '',
    '## Progress copy (OCR)',
    '',
    '- Lecture du PDF…',
    '- Reconnaissance du texte…',
    '- Création du CV…',
    '',
    '## Paste fallback copy',
    '',
    '- **Title:** Ce PDF est une image',
    '- **Message:** Nous n’avons pas pu lire assez de texte automatiquement. Collez le texte du CV ci-dessous pour continuer.',
    '- **Button:** Créer mon CV avec ce texte',
    '',
    '## Matrix',
    '',
    '| Case | File | Import | Review | Preview | Style | Export | Row | Path |',
    '|------|------|--------|--------|---------|-------|--------|-----|------|',
  ];

  for (const r of payload.results) {
    lines.push(
      `| ${r.label || r.id} | \`${r.file}\` | ${pf(r.import?.pass)} | ${pf(r.review?.pass)} | ${pf(r.preview?.pass)} | ${pf(r.style?.pass)} | ${pf(r.export?.pass)} | ${pf(r.pass)} | ${r.importPath || '—'} |`
    );
  }

  lines.push(
    '',
    '## Checks',
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    ...checks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail} |`),
    '',
    '## Detail',
    '',
    '| Case | ms | cvLen | docStep | Paste | Note |',
    '|------|-----|-------|---------|-------|------|'
  );

  for (const r of payload.results) {
    const s = r.snap || {};
    lines.push(
      `| ${r.label || r.id} | ${r.import?.ms ?? '—'} | ${s.cvLen ?? '—'} | ${s.docStep || '—'} | ${s.pasteVisible ? 'yes' : 'no'} | ${(r.note || '').slice(0, 72)} |`
    );
  }

  lines.push(
    '',
    '## Re-run',
    '',
    '```bash',
    'npm run ocr-import-qa-report',
    '```',
    '',
    `Raw JSON: \`tests/output/ocr-import-qa/report.json\``,
    ''
  );

  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log(`Wrote ${OUT_MD} — ${status}`);
  process.exit(status === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
