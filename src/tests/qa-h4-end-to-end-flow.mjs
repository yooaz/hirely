#!/usr/bin/env node
/**
 * HIRELY H4 — End-to-end product flow lock
 * Upload → Review → Score → Templates → CV PDF → Cover letter → Letter PDF
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isHirelyAppFatal } from '../../tests/lib/qa-console-filter.mjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/h4-end-to-end');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
let failed = 0;
let sanitizedCountLogs = 0;

function record(id, pass, detail = '') {
  results.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error('FAIL', id, detail);
  } else {
    console.log('OK', id, detail);
  }
}

function runPreflight(cmd, label) {
  const r = spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  record(label, ok, ok ? 'pass' : (r.stderr || r.stdout || '').trim().slice(0, 120));
  return ok;
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
      '.pdf': 'application/pdf',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(p));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function buildTextPdf(outPath, plainText) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 800;
  for (const line of plainText.split('\n')) {
    if (y < 48) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
    page.drawText(line.slice(0, 95), { x: 48, y, size: 9, font });
    y -= 12;
  }
  fs.writeFileSync(outPath, await pdf.save());
}

async function waitImportDone(page, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      pasteWrap: document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--pasteFallback'),
    }));
    if (s.live && !s.busy) return { ok: true, ms: Date.now() - t0, ...s };
    await page.waitForTimeout(400);
  }
  return { ok: false, timeout: true };
}

async function clickDocStep(page, step) {
  const enabled = page.locator(`#docNav .hirelyProgressBtn[data-doc-step="${step}"]:not([disabled])`);
  if ((await enabled.count()) > 0) await enabled.click();
  else {
    await page.evaluate((s) => {
      if (typeof setDocStep === 'function') setDocStep(s);
    }, step);
  }
  await page.waitForTimeout(350);
}

async function selectTemplateCard(page, id) {
  const clicked = await page.evaluate((tplId) => {
    const card = document.querySelector(`.tplCard[data-id="${tplId}"]`);
    if (!card) return { ok: false, reason: 'missing' };
    card.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (typeof card.onclick === 'function') card.onclick();
    else card.click();
    return { ok: true };
  }, id);
  if (!clicked.ok) throw new Error(`template ${id}: ${clicked.reason}`);
  await page.waitForTimeout(400);
}

const isAppFatal = isHirelyAppFatal;

// ── Preflight ─────────────────────────────────────────────────────────────
runPreflight('npm run check:exports', 'preflight_missing_exports');
runPreflight('npm run check:core', 'preflight_check_core');
runPreflight('npm run build', 'preflight_build');

const pasteText = fs.readFileSync(PASTE_FIXTURE, 'utf8');
const pdfPath = path.join(OUT_DIR, 'yoaz-upload.pdf');
await buildTextPdf(pdfPath, pasteText);

const port = 3050 + Math.floor(Math.random() * 50);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];

page.on('console', (msg) => {
  const text = msg.text();
  if (/SANITIZED_COUNTS/i.test(text)) sanitizedCountLogs++;
  if (msg.type() === 'error' && isAppFatal(text)) consoleErrors.push(text);
});
page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (isAppFatal(text)) consoleErrors.push(text);
});

try {
  // 1 — Open pro session
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 120000 }
  );

  const boot = await page.evaluate(() => ({
    boot: window.__HIRELY_CORE_BOOT__,
    coreReady: window.__hirelyCoreReady !== false,
    banner: document.getElementById('hirelyCoreError')?.textContent?.trim() || '',
    templates: !!window.HirelyTemplates,
  }));
  record(
    'no_core_boot_failed',
    boot.boot !== 'failed' && !/CORE_BOOT_FAILED/i.test(boot.banner) && boot.templates,
    `boot=${boot.boot} banner=${boot.banner.slice(0, 40)}`
  );

  // 2 — Upload PDF
  await page.locator('#fileInput').setInputFiles(pdfPath);
  const imp = await waitImportDone(page, 120000);
  record('upload_pdf_works', imp.ok && !imp.pasteWrap, imp.ok ? `live ${imp.ms}ms` : 'timeout/fallback');

  // 3 — Review step
  await clickDocStep(page, 'edit');
  await page.waitForSelector('#cvDoc.cv--live', { timeout: 60000 }).catch(() => null);
  const review = await page.evaluate(() => {
    const analysis = document.getElementById('reviewStudioAnalysis');
    const grid = document.querySelector('.workspaceGrid');
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    return {
      onReview: grid?.classList.contains('docStep-edit') || grid?.classList.contains('docStep-verify'),
      analysisVisible: vis(analysis),
      cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      name: document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '',
    };
  });
  record(
    'review_visible',
    review.onReview && review.analysisVisible && review.cvLive,
    `review=${review.onReview} name=${review.name.slice(0, 24)}`
  );

  // 4 — Score visible
  const score = await page.evaluate(() => {
    const ring = document.getElementById('reviewV2ScoreTotal');
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    return {
      ringVisible: vis(ring),
      scoreText: (ring?.textContent || '').trim(),
      exportReady: typeof isExportReady === 'function' ? isExportReady() : false,
    };
  });
  record(
    'score_visible',
    score.ringVisible && /\d+/.test(score.scoreText),
    `score=${score.scoreText} exportReady=${score.exportReady}`
  );

  // 5–7 — Template selector + preview + persistence
  await clickDocStep(page, 'style');
  await page.waitForTimeout(400);
  const picker = await page.evaluate((ids) => ({
    count: document.querySelectorAll('#templateGrid .tplCard').length,
    ids: [...document.querySelectorAll('#templateGrid .tplCard')].map((c) => c.dataset.id),
    expected: ids,
  }), PRODUCTION_TEMPLATE_IDS);
  record('templates_five_selectable', picker.count === 5, picker.ids.join(','));

  const templateTrail = [];
  for (const id of PRODUCTION_TEMPLATE_IDS) {
    await selectTemplateCard(page, id);
    const snap = await page.evaluate((tplId) => ({
      cvClass: document.getElementById('cvDoc')?.className || '',
      active: document.querySelector('.tplCard.active')?.dataset?.id || null,
      name: document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '',
      tplId,
    }), id);
    const ok =
      new RegExp(`template-${id.replace('-', '\\-')}`).test(snap.cvClass) &&
      snap.active === id &&
      snap.name.length > 2;
    record(`${id}_preview_updates`, ok, `active=${snap.active} class=${snap.cvClass.match(/template-[\w-]+/)?.[0]}`);
    templateTrail.push(snap.cvClass.match(/template-[\w-]+/)?.[0] || '?');
  }
  record('preview_differs_by_template', new Set(templateTrail).size >= 2, templateTrail.join(' → '));

  // Persistence: select creative, leave style, return
  await selectTemplateCard(page, 'creative');
  await clickDocStep(page, 'export');
  await page.waitForTimeout(300);
  await clickDocStep(page, 'style');
  await page.waitForTimeout(300);
  const persisted = await page.evaluate(() => ({
    active: document.querySelector('.tplCard.active')?.dataset?.id,
    cvClass: document.getElementById('cvDoc')?.className || '',
  }));
  record(
    'template_persists',
    persisted.active === 'creative' && /template-creative/.test(persisted.cvClass),
    `active=${persisted.active} class=${persisted.cvClass.match(/template-[\w-]+/)?.[0]}`
  );

  // 8 — CV PDF export + checklist
  await clickDocStep(page, 'export');
  await page.waitForTimeout(400);
  let cvPdfBytes = 0;
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      page.locator('#downloadBtn').click(),
    ]);
    const savePath = path.join(OUT_DIR, 'h4-cv-export.pdf');
    await download.saveAs(savePath);
    cvPdfBytes = fs.statSync(savePath).size;
    const buf = fs.readFileSync(savePath);
    const pdf = await PDFDocument.load(buf);
    const pages = pdf.getPageCount();
    record('cv_pdf_exports', cvPdfBytes > 2000 && pages >= 1, `${cvPdfBytes} bytes pages=${pages}`);
    await page.waitForTimeout(800);
  } catch (e) {
    record('cv_pdf_exports', false, String(e?.message || e).split('\n')[0]);
  }

  await page
    .waitForFunction(
      () => {
        const items = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')];
        return items.some(
          (el) =>
            el.classList.contains('is-ok') &&
            /export|pdf|télécharger|download/i.test(el.textContent || '')
        );
      },
      { timeout: 12000 }
    )
    .catch(() => null);

  const checklist = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')];
    const exportItem = items.find((el) => /export|pdf|télécharger|download/i.test(el.textContent || ''));
    const okItems = items.filter((el) => el.classList.contains('is-ok')).length;
    return {
      itemCount: items.length,
      okItems,
      exportCheckOk: exportItem?.classList?.contains('is-ok') === true,
      exportLabel: exportItem?.querySelector('.atsCheckLabel')?.textContent?.trim() || '',
    };
  });
  record(
    'pdf_checklist_ok',
    checklist.exportCheckOk || (cvPdfBytes > 2000 && checklist.okItems >= 4),
    `exportOk=${checklist.exportCheckOk} okItems=${checklist.okItems}/${checklist.itemCount}`
  );

  // 9–11 — Cover letter
  await page.waitForSelector('#coverLetterWorkspace:not(.hidden)', { timeout: 30000 }).catch(() => null);
  const letterPanel = await page.evaluate(() => {
    const ws = document.getElementById('coverLetterWorkspace');
    const btn = document.getElementById('generateLetterBtn');
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    return { workspace: vis(ws), generateBtn: vis(btn) };
  });
  record(
    'cover_letter_panel_opens',
    letterPanel.workspace && letterPanel.generateBtn,
    `workspace=${letterPanel.workspace} btn=${letterPanel.generateBtn}`
  );

  const roleInput = page.locator('#letterTargetRole');
  if (await roleInput.isVisible().catch(() => false)) {
    await roleInput.fill('Senior Graphic Designer');
  }

  await page.evaluate(() => {
    const btn = document.getElementById('generateLetterBtn');
    if (btn && typeof btn.onclick === 'function') btn.onclick();
    else btn?.click();
  });
  await page.waitForTimeout(900);

  const letterText = await page.evaluate(
    () => document.getElementById('coverLetterPreview')?.innerText?.trim() || ''
  );
  record(
    'cover_letter_generated',
    letterText.length > 80,
    `${letterText.length} chars`
  );

  let letterPdfBytes = 0;
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.evaluate(() => {
        const btn = document.getElementById('downloadLetterPdfBtn');
        if (btn && typeof btn.onclick === 'function') btn.onclick();
        else btn?.click();
      }),
    ]);
    const letterPath = path.join(OUT_DIR, 'h4-letter-export.pdf');
    await download.saveAs(letterPath);
    letterPdfBytes = fs.statSync(letterPath).size;
    record('cover_letter_exports', letterPdfBytes > 800, `${letterPdfBytes} bytes`);
  } catch (e) {
    record('cover_letter_exports', false, String(e?.message || e).split('\n')[0]);
  }

  record('no_render_loop', sanitizedCountLogs <= 3, `SANITIZED_COUNTS logs=${sanitizedCountLogs}`);
  record('no_fatal_console', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
} catch (e) {
  record('qa_runner_fatal', false, String(e?.message || e).split('\n')[0]);
} finally {
  const report = {
    timestamp: new Date().toISOString(),
    version: 'H4',
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    pass: failed === 0,
    sanitizedCountLogs,
    consoleErrors,
    artifacts: {
      uploadPdf: pdfPath,
      cvExport: path.join(OUT_DIR, 'h4-cv-export.pdf'),
      letterExport: path.join(OUT_DIR, 'h4-letter-export.pdf'),
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-h4-end-to-end-flow: PASS');
}
