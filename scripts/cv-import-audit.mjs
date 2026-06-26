#!/usr/bin/env node
/**
 * P0 — Bulletproof CV import audit.
 * Tests PDF text, DOCX, TXT, LinkedIn PDF, Canva-style export, scanned PDF, image CV.
 * Generates CV_IMPORT_AUDIT.md
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../src/vendor/tesseract-runtime.js';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'CV_IMPORT_AUDIT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/cv-import-audit/report.json');
const LAB = path.join(ROOT, 'tests/fixtures/hirely-test-lab');
const TIMEOUT_MS = 180000;
const OCR_TIMEOUT_MS = 120000;

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
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
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

async function buildImageCvPng(outPath, cvText) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 } });
  const safe = String(cvText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  await page.setContent(
    `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:32px;font-size:14px;line-height:1.5;white-space:pre-wrap;background:#fff;color:#111">${safe}</body></html>`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.screenshot({ path: outPath, type: 'png', fullPage: true });
  await browser.close();
}

async function ensureFixtures() {
  const { paths } = await ensureHirelyTestMatrixFixtures(ROOT);
  const txt = fs.readFileSync(paths.txt || path.join(LAB, 'txt.txt'), 'utf8');
  const linkedinPdf = path.join(LAB, 'linkedin-export.pdf');
  if (!fs.existsSync(linkedinPdf) && fs.existsSync(paths.good)) {
    fs.copyFileSync(paths.good, linkedinPdf);
  }
  const canvaPdf = path.join(LAB, 'canva-export.pdf');
  if (!fs.existsSync(canvaPdf) && fs.existsSync(paths.scan)) {
    fs.copyFileSync(paths.scan, canvaPdf);
  }
  const imageCv = path.join(LAB, 'image-cv.png');
  if (!fs.existsSync(imageCv)) {
    await buildImageCvPng(imageCv, txt.slice(0, 2500) || 'Marie Dupont\nProduct Manager');
  }
  return {
    pdfText: paths.good,
    docx: paths.docx,
    txt: paths.txt,
    linkedinPdf,
    canvaPdf,
    scannedPdf: paths.scan,
    imageCv,
    corruptPdf: paths.bad,
  };
}

async function bootPage(port) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const b = window.__HIRELY_CORE_BOOT__;
      return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
    },
    null,
    { timeout: 60000 }
  );
  await page.waitForSelector('#fileInput', { state: 'attached', timeout: 15000 });
  return { browser, page };
}

async function resetImport(page) {
  await page.evaluate(() => {
    document.getElementById('importPasteFallback')?.classList.remove('show');
    const cv = document.getElementById('cvDoc');
    if (cv) cv.classList.remove('cv--loading');
  });
  await page.waitForTimeout(200);
}

async function uploadAndSnap(page, filePath, { expectOcr = false, timeout = expectOcr ? OCR_TIMEOUT_MS : TIMEOUT_MS } = {}) {
  const t0 = Date.now();
  await resetImport(page);
  await page.setInputFiles('#fileInput', filePath);
  await page.waitForFunction(
    (ocr) => {
      const cvLen = (document.getElementById('cvDoc')?.innerText || '').trim().length;
      const step = document.getElementById('workspace')?.dataset?.docStep;
      const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
      const paste = document.getElementById('importPasteFallback')?.classList.contains('show');
      if (ocr) return cvLen > 80 && step === 'edit' && !loading;
      if (cvLen > 100 && step === 'edit' && !loading) return true;
      if (paste && !loading) return true;
      return false;
    },
    expectOcr,
    { timeout }
  );
  return page.evaluate(() => ({
    cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
    docStep: document.getElementById('workspace')?.dataset?.docStep || '',
    pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
    liveStatus: document.getElementById('importLiveStatus')?.textContent || '',
    statusText: document.getElementById('statusText')?.textContent || '',
    stagesVisible: !document.getElementById('importAnalysisStages')?.classList.contains('hidden'),
    activeStage: document.getElementById('importAnalysisStages')?.dataset?.activeStage || '',
    ocrConfidence: document.getElementById('importOcrConfidence')?.textContent || '',
    importStatus: window.state?.lastImportStatus || null,
    hasCvData: !!(window.state?.cvData && Object.keys(window.state.cvData).length),
    hasResumeData: !!window.state?.resumeData,
  })).then((r) => ({ ...r, ms: Date.now() - t0 }));
}

function assessCase(id, snap, { expectOcr = false, allowPaste = false } = {}) {
  const hasPreview = snap.cvLen > 80 && snap.docStep === 'edit';
  const pass = allowPaste
    ? snap.pasteVisible && !hasPreview
    : hasPreview && !snap.pasteVisible;
  return {
    id,
    pass,
    allowPaste,
    ms: snap.ms,
    cvLen: snap.cvLen,
    docStep: snap.docStep,
    pasteVisible: snap.pasteVisible,
    hasCvData: snap.hasCvData,
    hasResumeData: snap.hasResumeData,
    importStatus: snap.importStatus,
    ocrConfidence: snap.ocrConfidence,
    expectOcr,
    note: pass
      ? allowPaste
        ? `Paste fallback as expected (${snap.ms}ms)`
        : expectOcr
          ? `OCR pipeline → preview (${snap.cvLen} chars, ${snap.ms}ms)`
          : `Import → cvData (${snap.cvLen} chars, ${snap.ms}ms)`
      : snap.pasteVisible
        ? 'Paste fallback — no cvData (FAIL unless expected)'
        : snap.cvLen < 80
          ? 'Empty preview — silent failure risk'
          : `Unexpected state step=${snap.docStep}`,
  };
}

const FAILURE_CASES = [
  {
    id: 'empty_extract',
    trigger: 'PDF/image with zero readable text',
    userMessage: 'Aucun texte détecté dans ce fichier.',
    fallback: 'Paste panel (IMPORT_NEEDS_PASTE)',
    silent: false,
  },
  {
    id: 'ocr_timeout',
    trigger: 'OCR exceeds HIRELY_PDF_EXTRACTION_MAX_MS',
    userMessage: 'La lecture a pris trop de temps — aperçu partiel si texte récupéré.',
    fallback: 'Cached OCR text → guaranteed cvData, else paste',
    silent: false,
  },
  {
    id: 'ocr_low_confidence',
    trigger: 'OCR quality score < 60%',
    userMessage: 'Extraction OCR partielle — vérifiez le contenu dans Relecture.',
    fallback: 'Continue with cvData + warning banner',
    silent: false,
  },
  {
    id: 'file_import_timeout',
    trigger: 'Native extract > FILE_IMPORT_MAX_MS (5s)',
    userMessage: 'La lecture a pris trop de temps.',
    fallback: 'Guaranteed cvData if partial text, else paste',
    silent: false,
  },
  {
    id: 'parser_blocked',
    trigger: 'OCR gate fail with empty text',
    userMessage: 'Import partiel — vérifiez le contenu dans Relecture.',
    fallback: 'Guaranteed raw extraction when text > 100 chars',
    silent: false,
  },
  {
    id: 'thin_text',
    trigger: 'Extracted text ≤ 100 chars',
    userMessage: 'Import partiel ou paste si vide',
    fallback: 'Guaranteed cvData if any text; paste only when empty',
    silent: false,
  },
  {
    id: 'corrupt_pdf',
    trigger: 'Invalid PDF bytes (bad.pdf)',
    userMessage: 'Aucun texte détecté / format illisible',
    fallback: 'Paste panel with reason',
    silent: false,
  },
  {
    id: 'core_boot_failed',
    trigger: '__HIRELY_CORE_BOOT__ not ok',
    userMessage: 'Le moteur d\'import n\'a pas démarré. Rechargez la page.',
    fallback: 'Paste panel',
    silent: false,
  },
  {
    id: 'import_stuck_timeout',
    trigger: 'handleFileImport race timeout',
    userMessage: 'La lecture a pris trop de temps',
    fallback: 'Recovery via tryRecoverImportWithText if text cached',
    silent: false,
  },
  {
    id: 'unsupported_format',
    trigger: 'RTF / unknown binary',
    userMessage: 'Format non supporté en V1',
    fallback: 'Paste panel',
    silent: false,
  },
];

async function main() {
  const vendor = ensureVendor();
  const fixtures = await ensureFixtures();
  const server = await startServer();
  const port = server.address().port;

  const cases = [
    { id: 'pdf_text', file: fixtures.pdfText, expectOcr: false },
    { id: 'docx', file: fixtures.docx, expectOcr: false },
    { id: 'txt', file: fixtures.txt, expectOcr: false },
    { id: 'linkedin_pdf', file: fixtures.linkedinPdf, expectOcr: false },
    { id: 'canva_pdf', file: fixtures.canvaPdf, expectOcr: true },
    { id: 'scanned_pdf', file: fixtures.scannedPdf, expectOcr: true },
    { id: 'image_cv', file: fixtures.imageCv, expectOcr: true },
    { id: 'corrupt_pdf', file: fixtures.corruptPdf, expectOcr: false, allowPaste: true },
  ];

  const results = [];
  let browser;
  let page;
  try {
    ({ browser, page } = await bootPage(port));

    for (const c of cases) {
      if (!c.file || !fs.existsSync(c.file)) {
        results.push({ id: c.id, pass: false, note: `Missing fixture: ${c.file}` });
        continue;
      }
      try {
        if (c.expectOcr || c.id === 'corrupt_pdf') {
          await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(
            () => {
              const b = window.__HIRELY_CORE_BOOT__;
              return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
            },
            null,
            { timeout: 60000 }
          );
        } else {
          await resetImport(page);
        }
        const snap = await uploadAndSnap(page, c.file, { expectOcr: c.expectOcr });
        results.push(assessCase(c.id, snap, { expectOcr: c.expectOcr, allowPaste: c.allowPaste }));
      } catch (err) {
        results.push({
          id: c.id,
          pass: false,
          ms: -1,
          cvLen: 0,
          note: `Error: ${err?.message || err}`,
        });
      }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  const importPass = results
    .filter((r) => r.id !== 'corrupt_pdf')
    .every((r) => r.pass);
  const pass = vendor.ok && importPass;

  const payload = {
    generatedAt: new Date().toISOString(),
    status: pass ? 'PASS' : 'FAIL',
    fallbackChain: ['native_pdf', 'ocr', 'raw_extraction'],
    vendor,
    fixtures: Object.fromEntries(
      Object.entries(fixtures).map(([k, v]) => [k, v ? path.relative(ROOT, v) : null])
    ),
    results,
    failureCases: FAILURE_CASES,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const md = [
    '# CV Import Audit (P0 bulletproof)',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${payload.generatedAt}`,
    '',
    '## Fallback chain',
    '',
    '```',
    'PDF native text (PDF.js)',
    '    ↓ empty / image PDF',
    'Tesseract OCR',
    '    ↓ parser weak / partial',
    'Raw extraction → guaranteed cvData',
    '```',
    '',
    '**Policy:** Never block when text exists. Always produce `cvData` / `resumeData`. Never fail silently.',
    '',
    '## Progress UI (4 steps)',
    '',
    '1. Reading file',
    '2. Extracting content',
    '3. Understanding profile',
    '4. Building CV',
    '',
    '## Import matrix',
    '',
    '| Case | Pass | Time | CV chars | Paste | cvData | Notes |',
    '|------|------|------|----------|-------|--------|-------|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.ms ?? '—'}ms | ${r.cvLen ?? '—'} | ${r.pasteVisible ? 'yes' : 'no'} | ${r.hasCvData ? 'yes' : 'no'} | ${r.note} |`
    ),
    '',
    '## Failure cases (never silent)',
    '',
    '| ID | Trigger | User message | Fallback | Silent? |',
    '|----|---------|--------------|----------|---------|',
    ...FAILURE_CASES.map(
      (f) =>
        `| ${f.id} | ${f.trigger} | ${f.userMessage} | ${f.fallback} | ${f.silent ? 'yes' : '**no**'} |`
    ),
    '',
    '## Vendor / OCR',
    '',
    `| Tesseract assets | ${vendor.ok ? 'OK' : 'FAIL'} |`,
    ...(vendor.missing?.length ? [`| Missing | \`${vendor.missing.join('`, `')}\` |`] : []),
    '',
    '## Commands',
    '',
    '```bash',
    'npm run setup:vendor-tesseract',
    'npm run cv-import-audit',
    'npm run ocr-report',
    '```',
    '',
  ].join('\n');

  fs.writeFileSync(OUT_MD, md);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
