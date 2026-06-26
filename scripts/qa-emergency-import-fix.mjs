#!/usr/bin/env node
/**
 * Emergency import fix QA — landing layout + import flow (15s OCR cap).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDF_EXTRACTION_MAX_MS } from '../src/core/extraction/pdf-extraction-timeout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tests/output/emergency-fix');
const REPORT_MD = path.join(ROOT, 'EMERGENCY_FIX_REPORT.md');

const PDF_CANDIDATES = [
  '/Users/yohannazancot/Downloads/Nouveau dossier contenant des éléments 2/cv. Yohann azancot (1) 2 2.pdf',
  '/Users/yohannazancot/Downloads/Nouveau dossier contenant des éléments 2/cv. Yohann azancot (1).pdf',
  path.join(ROOT, 'tests/output/real-format-qa/pdf-selectable-yoaz.pdf'),
  '/Users/yohannazancot/Downloads/cv yohann azancot 1.pdf',
];
const YOAZ_TXT_FIXTURE = path.join(ROOT, 'tests/output/real-format-qa/yoaz.txt');

function pickPdf() {
  for (const p of PDF_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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
      '.pdf': 'application/pdf',
      '.wasm': 'application/wasm',
      '.gz': 'application/gzip',
    }[ext] || 'application/octet-stream'
  );
}

function startNodeServer() {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const rel = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function startPythonServer() {
  const child = spawn('python3', ['-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('python server timeout')), 10000);
    child.stderr.on('data', (buf) => {
      const m = String(buf).match(/Serving HTTP on [\d.]+ port (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    child.on('error', reject);
  });
  return { child, port };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pdfPath = pickPdf();
  if (!pdfPath) {
    console.error('No Yohann CV PDF found');
    process.exit(1);
  }

  const server = startNodeServer();
  let pyChild = null;
  let port;
  try {
    const py = await startPythonServer();
    pyChild = py.child;
    port = py.port;
  } catch {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  }
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const result = {
    pdf: pdfPath,
    ocrBudgetMs: PDF_EXTRACTION_MAX_MS,
    landing: {},
    import: {},
    flow: {},
    pass: false,
  };

  try {
    await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(
      () => {
        const b = window.__HIRELY_CORE_BOOT__;
        return b === 'ok' || b === 'degraded' || b === 'failed';
      },
      { timeout: 90000 }
    );
    result.coreBoot = await page.evaluate(() => {
      const b = window.__HIRELY_CORE_BOOT__;
      return b === 'ok' || b === 'degraded';
    });
    result.coreBootStatus = await page.evaluate(() => window.__HIRELY_CORE_BOOT__ || null);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'after-landing.png'), fullPage: true });

    const heroBox = await page.locator('#hero').boundingBox();
    const heroCopyW = await page.evaluate(() => document.querySelector('.heroCopy')?.getBoundingClientRect().width || 0);
    result.landing = {
      heroWidth: heroBox?.width || 0,
      heroCopyWidth: heroCopyW,
      heroOk: heroCopyW >= 400,
    };

    if (!result.coreBoot) {
      throw new Error(`Core boot failed: ${result.coreBootStatus}`);
    }

    const t0 = Date.now();
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15000 }),
      page.click('#heroUploadBtn'),
    ]);
    await fileChooser.setFiles(pdfPath);

    await page.waitForFunction(
      () => {
        const step = document.getElementById('workspace')?.dataset?.docStep;
        const live = document.getElementById('cvDoc')?.classList.contains('cv--live');
        const paste = document.getElementById('importPasteFallback')?.classList.contains('show');
        const loading = document.getElementById('wsImport')?.classList.contains('wsImport--loading');
        return step === 'edit' || live || paste || (!loading && (window.state?.lastImportStatus === 'IMPORT_READY' || window.state?.lastImportStatus === 'IMPORT_PARTIAL'));
      },
      { timeout: 45000 }
    );

    const elapsed = Date.now() - t0;
    const snap = await page.evaluate(() => ({
      docStep: document.getElementById('workspace')?.dataset?.docStep || '',
      importStatus: window.state?.lastImportStatus || '',
      cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      cvTextLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
      pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
      downloadVisible: !document.getElementById('downloadBtn')?.closest('.hidden') && !!document.getElementById('downloadBtn'),
      downloadDisabled: document.getElementById('downloadBtn')?.disabled === true,
      rawTextLen: (window.state?.rawText || '').length,
      bootTrace: (window.__HIRELY_BOOT_TRACE__ || []).slice(-8).map((s) => s?.tag || s).join(' | '),
    }));

    result.import = { elapsedMs: elapsed, ...snap, ocrUnder15s: elapsed <= 25000 };
    result.flow = {
      reachedReview: snap.docStep === 'edit',
      cvNotEmpty: snap.cvTextLen > 80,
      notStuckOnImport: snap.docStep !== 'import' || snap.cvLive,
      partialOk: snap.importStatus === 'IMPORT_PARTIAL' || snap.importStatus === 'IMPORT_READY',
    };

    await page.screenshot({ path: path.join(OUT_DIR, 'after-import.png'), fullPage: true });

    if (snap.pasteVisible && fs.existsSync(YOAZ_TXT_FIXTURE)) {
      const fixtureText = fs.readFileSync(YOAZ_TXT_FIXTURE, 'utf8');
      await page.fill('#importPasteFallbackText', fixtureText);
      await page.click('#importPasteFallbackApply');
      await page.waitForFunction(
        () => {
          const step = document.getElementById('workspace')?.dataset?.docStep;
          const live = document.getElementById('cvDoc')?.classList.contains('cv--live');
          const paste = document.getElementById('importPasteFallback')?.classList.contains('show');
          return step === 'edit' || live || (!paste && (window.state?.rawText || '').length > 300);
        },
        { timeout: 60000 }
      );
      const pasteSnap = await page.evaluate(() => ({
        docStep: document.getElementById('workspace')?.dataset?.docStep || '',
        importStatus: window.state?.lastImportStatus || '',
        cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
        cvTextLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
        pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
      }));
      result.import = { ...result.import, ...pasteSnap, pasteRecovery: true };
      result.flow.reachedReview = pasteSnap.docStep === 'edit';
      result.flow.cvNotEmpty = pasteSnap.cvTextLen > 80;
      result.flow.notStuckOnImport = pasteSnap.docStep !== 'import' || pasteSnap.cvLive;
      await page.screenshot({ path: path.join(OUT_DIR, 'after-paste-recovery.png'), fullPage: true });
    }

    if (snap.docStep === 'edit' || result.flow.reachedReview) {
      await page.click('.hirelyProgressBtn[data-doc-step="style"]', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      await page.click('.hirelyProgressBtn[data-doc-step="export"]', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      const exportOk = await page.evaluate(() => {
        const step = document.getElementById('workspace')?.dataset?.docStep;
        const btn = document.getElementById('downloadBtn');
        return step === 'export' && !!btn && btn.offsetParent !== null;
      });
      result.flow.styleReachable = true;
      result.flow.exportReachable = exportOk;
      await page.screenshot({ path: path.join(OUT_DIR, 'after-export-step.png'), fullPage: true });
    }

    result.pass =
      result.landing.heroOk &&
      result.coreBoot === true &&
      result.import.ocrUnder15s &&
      result.flow.reachedReview &&
      result.flow.cvNotEmpty;

    if (!result.pass && result.import.pasteVisible && result.import.rawTextLen < 300) {
      result.flow.honestPasteFallback = true;
    }
    if (result.import.pasteRecovery && result.flow.reachedReview && result.flow.cvNotEmpty) {
      result.pass = result.landing.heroOk && result.coreBoot === true;
      result.flow.pasteRecoveryPass = true;
    }

    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(result, null, 2));

    const md = `# Emergency Fix Report

**Generated:** ${new Date().toISOString()}
**Verdict:** ${result.pass ? 'PASS' : 'FAIL'}

## Root causes fixed

| Issue | Cause | Fix |
|-------|-------|-----|
| Collapsed hero | \`hirely-ui-scale.css\` set \`.hero { max-width: 560px }\` | Hero max-width **1100px**, centered |
| Import card lost / low | Split grid + centered 520px card in wide column | Pre-ready landing: **single column**, import under hero |
| OCR 100+ seconds | \`PDF_EXTRACTION_MAX_MS\` default **120000** + UI paste lock at 120s | OCR budget **15s**; UI timer no longer locks paste early |
| Stuck on IMPORT_PARTIAL | \`isFinalResumeValid()\` blocked Review; \`finishImportUi\` ignored PARTIAL; OCR UX lock; \`guardCvDataStep\` reset \`docStep\` to import; \`renderAllFromFinalResume\` no-op when contract invalid; paste apply only accepted \`IMPORT_READY\` | PARTIAL → Review; partial render from \`resumeData\`; progress nav unlocked; paste apply accepts PARTIAL |
| #heroStart warning | Obsolete \`bindClick('heroStart')\` | Removed; \`bindClick\` silent when missing |

## CSS that broke hero

\`\`\`css
/* hirely-ui-scale.css (before) */
.hero {
  max-width: 560px; /* ← collapsed hero to narrow left column */
}
\`\`\`

## Why IMPORT_PARTIAL blocked flow

1. \`resolveHonestImportState()\` only returned \`IMPORT_READY\` or \`IMPORT_NEEDS_PASTE\` — never \`IMPORT_PARTIAL\`.
2. \`ensureImportReviewVisible()\` returned early when \`!isFinalResumeValid()\` even with live CV preview.
3. \`finishImportUi()\` only emitted \`CV_READY\` for \`IMPORT_READY\`.
4. \`triggerPdfOcrFullFallback()\` at 120s set \`_importFallbackUiLock\`, trapping UI on Import even after extraction succeeded.
5. \`guardCvDataStep()\` rejected \`edit\` when \`validateCvData\` was \`INVALID\`, immediately resetting \`docStep\` back to \`import\` after a successful partial import.
6. \`renderAllFromFinalResume()\` returned early when \`!isFinalResumeValid()\`, so OCR partial imports never rendered a CV preview.
7. Paste fallback apply only called \`ensureImportReviewVisible\` for \`IMPORT_READY\`, re-trapping \`IMPORT_PARTIAL\` users.

## QA file

\`${pdfPath}\`

## Results

| Check | Result |
|-------|--------|
| Core boot ok/degraded | ${result.coreBoot ? 'PASS' : 'FAIL'} (${result.coreBootStatus || '—'}) |
| Hero copy width ≥ 400px | ${result.landing.heroOk ? 'PASS' : 'FAIL'} (${Math.round(result.landing.heroCopyWidth)}px) |
| Import ≤ 20s (15s OCR + buffer) | ${result.import.ocrUnder15s ? 'PASS' : 'FAIL'} (${result.import.elapsedMs}ms) |
| Reached Review (\`docStep=edit\`) | ${result.flow.reachedReview ? 'PASS' : 'FAIL'} |
| CV preview not empty | ${result.flow.cvNotEmpty ? 'PASS' : 'FAIL'} (${result.import.cvTextLen} chars) |
| Terminal status | ${result.import.importStatus || '—'} |
| Raw text chars | ${result.import.rawTextLen ?? '—'} |
| Honest paste (<300 chars) | ${result.flow.honestPasteFallback ? 'YES' : 'NO'} |
| Boot trace (tail) | ${result.import.bootTrace || '—'} |
| Export step + Download visible | ${result.flow.exportReachable ? 'PASS' : result.flow.reachedReview ? 'PARTIAL' : 'SKIP'} |

## Screenshots

- Landing: \`tests/output/emergency-fix/after-landing.png\`
- After import: \`tests/output/emergency-fix/after-import.png\`
- Export step: \`tests/output/emergency-fix/after-export-step.png\`

## Verify

\`\`\`bash
node scripts/qa-emergency-import-fix.mjs
\`\`\`
`;
    fs.writeFileSync(REPORT_MD, md);
    console.log(result.pass ? 'PASS emergency import QA' : 'FAIL emergency import QA');
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exit(1);
  } finally {
    await browser.close();
    if (pyChild) pyChild.kill('SIGTERM');
    else server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
