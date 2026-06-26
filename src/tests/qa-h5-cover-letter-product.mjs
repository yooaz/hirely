#!/usr/bin/env node
/**
 * HIRELY H5 — Cover letter product lock
 * Review step entry → panel → generate → copy → PDF → generic letter
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/h5-cover-letter');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
let failed = 0;

function record(id, pass, detail = '') {
  results.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error('FAIL', id, detail);
  } else {
    console.log('OK', id, detail);
  }
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
    }));
    if (s.live && !s.busy) return { ok: true, ms: Date.now() - t0 };
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


async function safeClick(page, selector) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return { ok: false, reason: `${selector} missing` };
  try {
    await loc.scrollIntoViewIfNeeded();
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    await loc.click({ timeout: 15000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e).split('\n')[0] };
  }
}

// ── Unit preflight ───────────────────────────────────────────────────────
const engineQa = spawnSync('node', ['src/tests/qa-cover-letter-engine.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});
record('engine_unit_pass', engineQa.status === 0, engineQa.status === 0 ? 'ok' : (engineQa.stderr || '').slice(0, 80));

const pasteText = fs.readFileSync(PASTE_FIXTURE, 'utf8');
const pdfPath = path.join(OUT_DIR, 'h5-upload.pdf');
await buildTextPdf(pdfPath, pasteText);

const port = 3060 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 120000 }
  );

  await page.locator('#fileInput').setInputFiles(pdfPath);
  const imp = await waitImportDone(page, 120000);
  record('import_cv', imp.ok, imp.ok ? `${imp.ms}ms` : 'timeout');

  await clickDocStep(page, 'edit');
  await page.waitForSelector('#cvDoc.cv--live', { timeout: 60000 }).catch(() => null);

  const reviewEntry = await page.evaluate(() => {
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    };
    const btn = document.getElementById('openLetterReviewBtn');
    const analysis = document.getElementById('reviewStudioAnalysis');
    return {
      reviewBtnVisible: vis(btn),
      analysisVisible: vis(analysis),
      docStep: document.getElementById('workspace')?.dataset?.docStep || '',
    };
  });
  record(
    'letter_entry_on_review',
    reviewEntry.reviewBtnVisible && reviewEntry.analysisVisible && reviewEntry.docStep === 'edit',
    `btn=${reviewEntry.reviewBtnVisible} step=${reviewEntry.docStep}`
  );

  const openClick = await safeClick(page, '#openLetterReviewBtn');
  record('letter_open_no_hidden_click_fail', openClick.ok, openClick.ok ? 'clicked' : openClick.reason);
  await page.waitForTimeout(500);

  const panel = await page.evaluate(() => {
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    };
    const ws = document.getElementById('coverLetterWorkspace');
    const gen = document.getElementById('generateLetterBtn');
    const role = document.getElementById('letterTargetRole');
    const company = document.getElementById('letterTargetCompany');
    const tones = [...document.querySelectorAll('.coverLetterStyleBtn')].map((b) => b.dataset.letterStyle);
    return {
      workspace: vis(ws),
      generateBtn: vis(gen),
      roleInput: !!role,
      companyInput: !!company,
      tones,
      letterPanelOpen: document.getElementById('workspace')?.classList.contains('letter-panel-open'),
    };
  });
  record(
    'panel_opens_with_controls',
    panel.workspace && panel.generateBtn && panel.roleInput && panel.companyInput && panel.letterPanelOpen,
    `workspace=${panel.workspace} gen=${panel.generateBtn} tones=${panel.tones.join(',')}`
  );
  record('tone_selector_four_modes', panel.tones.length === 4, panel.tones.join(','));

  // Targeted letter
  await page.locator('#letterTargetRole').fill('Senior Graphic Designer');
  await page.locator('#letterTargetCompany').fill('Adobe');
  const genClick = await safeClick(page, '#generateLetterBtn');
  record('generate_click_visible', genClick.ok, genClick.ok ? 'ok' : genClick.reason);
  await page.waitForTimeout(900);

  let letterTargeted = await page.evaluate(() => ({
    text: document.getElementById('coverLetterPreview')?.innerText?.trim() || '',
    generated: typeof state !== 'undefined' ? !!state.coverLetterGenerated : false,
    source: typeof getCoverLetterCvData === 'function' ? !!getCoverLetterCvData() : false,
  }));
  record(
    'letter_generated_targeted',
    letterTargeted.text.length > 80 && letterTargeted.generated,
    `${letterTargeted.text.length} chars finalCv=${letterTargeted.source}`
  );
  record(
    'targeted_mentions_role_company',
    /Senior Graphic Designer/i.test(letterTargeted.text) && /Adobe/i.test(letterTargeted.text),
    'role+company in text'
  );

  // Editable output
  await page.locator('#coverLetterPreview').click();
  await page.keyboard.press('End');
  await page.keyboard.type('\n\n[H5 QA edit marker]');
  await page.waitForTimeout(200);
  const edited = await page.evaluate(
    () => document.getElementById('coverLetterPreview')?.innerText?.includes('[H5 QA edit marker]') || false
  );
  record('letter_output_editable', edited, edited ? 'marker present' : 'edit failed');

  // Copy
  const copyClick = await safeClick(page, '#copyLetterBtn');
  let clipboardText = '';
  if (copyClick.ok) {
    await page.waitForTimeout(300);
    clipboardText = await page.evaluate(async () => {
      try {
        return (await navigator.clipboard.readText()) || '';
      } catch {
        return '';
      }
    });
  }
  record(
    'copy_works',
    copyClick.ok && clipboardText.length > 80,
    copyClick.ok ? `${clipboardText.length} chars` : copyClick.reason
  );

  // PDF export (targeted)
  let letterPdfBytes = 0;
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      safeClick(page, '#downloadLetterPdfBtn'),
    ]);
    const letterPath = path.join(OUT_DIR, 'h5-letter-targeted.pdf');
    await download.saveAs(letterPath);
    letterPdfBytes = fs.statSync(letterPath).size;
    const buf = fs.readFileSync(letterPath);
    const pdf = await PDFDocument.load(buf);
    record('pdf_export_works', letterPdfBytes > 800 && pdf.getPageCount() >= 1, `${letterPdfBytes} bytes`);
  } catch (e) {
    record('pdf_export_works', false, String(e?.message || e).split('\n')[0]);
  }

  // Generic letter — clear job & company
  await page.locator('#letterTargetRole').fill('');
  await page.locator('#letterTargetCompany').fill('');
  await page.waitForTimeout(200);
  const genGeneric = await safeClick(page, '#generateLetterBtn');
  record('generic_generate_click', genGeneric.ok, genGeneric.ok ? 'ok' : genGeneric.reason);
  await page.waitForTimeout(900);

  const generic = await page.evaluate(() => {
    const text = document.getElementById('coverLetterPreview')?.innerText?.trim() || '';
    const inventedCompany = /\b(Initech|Globex|Acme Corp|June 2026|2026-06)\b/i.test(text);
    return {
      textLen: text.length,
      spontaneous: /candidature spontanée|open application|reaching out with an open application/i.test(text),
      noAdobe: !/Adobe/i.test(text),
      inventedCompany,
      cvName: document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '',
      usesCvName: text.includes(document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '___'),
    };
  });
  record(
    'generic_letter_without_job_company',
    generic.textLen > 80 && generic.spontaneous,
    `spontaneous=${generic.spontaneous} len=${generic.textLen}`
  );
  record(
    'no_invented_company_or_date',
    generic.noAdobe && !generic.inventedCompany,
    `noAdobe=${generic.noAdobe} invented=${generic.inventedCompany}`
  );
  record('letter_uses_final_cv_identity', generic.usesCvName, generic.cvName.slice(0, 24));

  // Tone switch — creative
  const creativeBtn = page.locator('.coverLetterStyleBtn[data-letter-style="creative"]');
  if ((await creativeBtn.count()) > 0) {
    await creativeBtn.click();
    await page.waitForTimeout(700);
    const creative = await page.evaluate(() => ({
      style: typeof state !== 'undefined' ? state.letterStyle : '',
      text: document.getElementById('coverLetterPreview')?.innerText?.trim() || '',
    }));
    record('tone_creative_applies', creative.style === 'creative' && creative.text.length > 80, creative.style);
  } else {
    record('tone_creative_applies', false, 'button missing');
  }
} catch (e) {
  record('qa_runner_fatal', false, String(e?.message || e).split('\n')[0]);
} finally {
  const report = {
    timestamp: new Date().toISOString(),
    version: 'H5',
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    pass: failed === 0,
    artifacts: {
      uploadPdf: pdfPath,
      letterPdf: path.join(OUT_DIR, 'h5-letter-targeted.pdf'),
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
  console.log('\nqa-h5-cover-letter-product: PASS');
}
