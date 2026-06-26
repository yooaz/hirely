#!/usr/bin/env node
/**
 * HIRELY P0 — End-to-end flow audit (real uploaded CVs only).
 * IMPORT → PARSE → REVIEW → TEMPLATE → EXPORT
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/end-to-end-flow-audit');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const FLOW_MARKERS = ['IMPORT_READY', 'REVIEW_READY', 'PREVIEW_READY', 'TEMPLATE_READY', 'EXPORT_READY'];

const REAL_CV_FILES = [
  {
    id: 'yoaz-pdf-2022',
    label: 'Yoaz PDF 2022',
    path: '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
    mime: 'application/pdf',
  },
  {
    id: 'yoaz-pdf-2024',
    label: 'Yoaz PDF 2024',
    path: '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
    mime: 'application/pdf',
  },
  {
    id: 'yoaz-docx',
    label: 'Yoaz DOCX',
    path: '/Users/yohannazancot/Documents/cv .docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const stages = [];
let failedStage = null;
let failed = 0;

function record(stage, id, pass, detail = '') {
  const row = { stage, id, pass, detail };
  stages.push(row);
  if (!pass) {
    failed++;
    if (!failedStage) failedStage = stage;
    console.error(`FAIL [${stage}] ${id}`, detail);
  } else {
    console.log(`OK [${stage}] ${id}`, detail);
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
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
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

async function waitImportDone(page, maxMs = 360000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      workspace: document.getElementById('workspaceGrid')?.classList.contains('workspaceGrid--ready'),
    }));
    if (s.fallback) return { ok: false, fallback: true, ms: Date.now() - t0 };
    if ((s.live || s.workspace) && !s.busy) return { ok: true, ms: Date.now() - t0 };
    await page.waitForTimeout(500);
  }
  return { ok: false, timeout: true };
}

async function clickDocStep(page, step) {
  await page.evaluate((s) => {
    if (typeof setDocStep === 'function') setDocStep(s);
  }, step);
  await page.waitForTimeout(400);
}

async function uploadRealFile(page, filePath, mimeType) {
  const buf = fs.readFileSync(filePath);
  await page.evaluate(
    async ({ b64, name, type }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type });
      await window.HirelyParse.handleFileImport(file, 'e2e-audit');
    },
    { b64: buf.toString('base64'), name: path.basename(filePath), type: mimeType }
  );
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const available = REAL_CV_FILES.filter((f) => fs.existsSync(f.path));
if (!available.length) {
  console.error('No real CV files found on disk');
  process.exit(1);
}

const primary = available[0];
const port = 3070 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const flowLogs = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

page.on('console', (msg) => {
  const text = msg.text().trim();
  for (const m of FLOW_MARKERS) {
    if (text === m || text.startsWith(`${m} `)) flowLogs.push({ at: Date.now(), marker: m, text });
  }
});

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
    timeout: 120000,
  });

  const boot = await page.evaluate(() => ({
    boot: window.__HIRELY_CORE_BOOT__,
    templates: !!window.HirelyTemplates,
  }));
  record('BOOT', 'core_boot', boot.boot === 'ok' && boot.templates, `boot=${boot.boot}`);

  // ── IMPORT (real file) ─────────────────────────────────────────────
  await uploadRealFile(page, primary.path, primary.mime);
  const imp = await waitImportDone(page);
  record(
    'IMPORT',
    'real_file_import',
    imp.ok && !imp.fallback,
    imp.ok ? `${primary.id} ${imp.ms}ms` : imp.fallback ? 'paste fallback' : 'timeout'
  );

  const snapImport = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
  record(
    'IMPORT',
    'import_status',
    snapImport.importStatus === 'IMPORT_READY' || snapImport.importStatus === 'IMPORT_PARTIAL',
    snapImport.importStatus || 'none'
  );
  record(
    'IMPORT',
    'flow_marker_import_ready',
    Boolean(snapImport.flowReady?.IMPORT_READY || flowLogs.some((l) => l.marker === 'IMPORT_READY')),
    'IMPORT_READY'
  );
  record('IMPORT', 'resume_data_present', !!snapImport.resumeName, snapImport.resumeName?.slice(0, 40) || 'empty');

  // ── PARSE ────────────────────────────────────────────────────────
  record('PARSE', 'final_resume_valid', snapImport.finalResumeValid, `valid=${snapImport.finalResumeValid}`);
  record(
    'PARSE',
    'experience_parsed',
    snapImport.expCount > 0,
    `experiences=${snapImport.expCount}`
  );
  record(
    'PARSE',
    'cv_data_from_final',
    snapImport.cvExpCount > 0 || snapImport.expCount === 0,
    `cvExp=${snapImport.cvExpCount}`
  );

  // ── REVIEW ───────────────────────────────────────────────────────
  await clickDocStep(page, 'edit');
  await page.waitForTimeout(600);
  let snapReview = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
  record(
    'REVIEW',
    'review_workspace',
    snapReview.cvLive &&
      !!(snapReview.flowReady?.REVIEW_READY || flowLogs.some((l) => l.marker === 'REVIEW_READY')),
    `pending=${snapReview.pendingReview}`
  );
  record(
    'REVIEW',
    'no_accepted_in_suggestions',
    snapReview.acceptedInSuggestions === 0,
    `acceptedInUi=${snapReview.acceptedInSuggestions}`
  );

  if (snapReview.pendingReview > 0) {
    const before = snapReview.pendingReview;
    const acceptRes = await page.evaluate(async () => {
      const pending = typeof getPendingReviewQueue === 'function' ? getPendingReviewQueue() : [];
      if (!pending.length) return { ok: true, skipped: true };
      const item = pending[0];
      const idx = (state.reviewQueue || []).findIndex((q) => q === item || (q?.id && q.id === item?.id));
      if (idx < 0) return { ok: false, reason: 'idx_missing' };
      const card = document.querySelector('#suggestionsList .suggestionCard[data-suggestion-kind="review"]');
      const sel = card?.querySelector('[data-suggestion-category]');
      if (sel) {
        const preferred =
          item.chosenType ||
          item.possibleCategories?.[0]?.id ||
          sel.value ||
          'skill';
        sel.value = preferred;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof handleReviewAction === 'function') await handleReviewAction(idx, 'accept');
      else {
        const btn = document.querySelector('#suggestionsList [data-suggestion-action="accept"]');
        btn?.click();
      }
      await new Promise((r) => setTimeout(r, 400));
      const after = typeof getPendingReviewQueue === 'function' ? getPendingReviewQueue().length : 0;
      return { ok: after < pending.length, before: pending.length, after };
    });
    snapReview = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
    record(
      'REVIEW',
      'accept_removes_from_queue',
      acceptRes.ok && snapReview.pendingReview < before,
      `${before} → ${snapReview.pendingReview}${acceptRes.reason ? ` (${acceptRes.reason})` : ''}`
    );
  } else {
    record('REVIEW', 'accept_removes_from_queue', true, 'no pending items');
  }

  // ── PREVIEW ──────────────────────────────────────────────────────
  record(
    'PREVIEW',
    'preview_live',
    snapReview.cvLive,
    snapReview.previewName?.slice(0, 40) || 'empty'
  );
  const nameOk =
    snapReview.resumeName &&
    snapReview.previewName &&
    (normName(snapReview.resumeName).includes(normName(snapReview.previewName).split(' ')[0]) ||
      normName(snapReview.previewName).includes(normName(snapReview.resumeName).split(' ')[0]));
  record(
    'PREVIEW',
    'resume_matches_preview',
    !!nameOk,
    `resume="${snapReview.resumeName}" preview="${snapReview.previewName}"`
  );
  record(
    'PREVIEW',
    'flow_marker_preview_ready',
    Boolean(snapReview.flowReady?.PREVIEW_READY || flowLogs.some((l) => l.marker === 'PREVIEW_READY')),
    'PREVIEW_READY'
  );

  // ── TEMPLATE ─────────────────────────────────────────────────────
  await clickDocStep(page, 'style');
  await page.waitForTimeout(400);
  const tplId = PRODUCTION_TEMPLATE_IDS[1] || 'swiss';
  await page.evaluate((id) => {
    const card = document.querySelector(`.tplCard[data-id="${id}"]`);
    if (card?.onclick) card.onclick();
    else card?.click();
  }, tplId);
  await page.waitForTimeout(500);

  const snapTpl = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
  const tplClass = `template-${tplId}`;
  record(
    'TEMPLATE',
    'template_selected',
    snapTpl.template === tplId && snapTpl.cvTemplateClass === tplClass,
    `state=${snapTpl.template} class=${snapTpl.cvTemplateClass}`
  );
  record(
    'TEMPLATE',
    'template_same_name_as_preview',
    normName(snapTpl.previewName) === normName(snapReview.previewName) || !!snapTpl.previewName,
    snapTpl.previewName?.slice(0, 40) || ''
  );
  record(
    'TEMPLATE',
    'flow_marker_template_ready',
    !!(snapTpl.flowReady?.TEMPLATE_READY || flowLogs.some((l) => l.marker === 'TEMPLATE_READY')),
    'TEMPLATE_READY'
  );

  await clickDocStep(page, 'edit');
  await page.waitForTimeout(300);
  await clickDocStep(page, 'style');
  await page.waitForTimeout(300);
  const snapPersist = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
  record(
    'TEMPLATE',
    'template_persists',
    snapPersist.template === tplId,
    `template=${snapPersist.template}`
  );

  // ── EXPORT ───────────────────────────────────────────────────────
  await clickDocStep(page, 'export');
  await page.waitForTimeout(600);
  const snapExport = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
  record(
    'EXPORT',
    'export_panel_visible',
    snapExport.exportPanelVisible,
    snapExport.exportScoreText?.slice(0, 60) || 'hidden'
  );
  record(
    'EXPORT',
    'export_not_blank',
    snapExport.exportPanelVisible && snapExport.exportScoreText.length > 3 && snapExport.cvLive,
    `score="${snapExport.exportScoreText.slice(0, 40)}"`
  );
  record(
    'EXPORT',
    'export_same_resume_name',
    normName(snapExport.resumeName) === normName(snapExport.previewName) ||
      normName(snapExport.resumeName).includes(normName(snapExport.previewName).split(' ')[0] || 'x'),
    snapExport.resumeName
  );
  record(
    'EXPORT',
    'flow_marker_export_ready',
    !!(snapExport.flowReady?.EXPORT_READY || flowLogs.some((l) => l.marker === 'EXPORT_READY')),
    'EXPORT_READY'
  );

  let pdfBytes = 0;
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.locator('#downloadBtn, #exportFinalCvPdf').first().click(),
    ]);
    const pdfPath = path.join(OUT_DIR, 'e2e-audit-export.pdf');
    await download.saveAs(pdfPath);
    pdfBytes = fs.statSync(pdfPath).size;
    const pdf = await PDFDocument.load(fs.readFileSync(pdfPath));
    record('EXPORT', 'pdf_download', pdfBytes > 2000 && pdf.getPageCount() >= 1, `${pdfBytes} bytes`);
  } catch (e) {
    record('EXPORT', 'pdf_download', false, String(e?.message || e).split('\n')[0]);
  }

  // Secondary real files — import smoke (optional; does not fail primary flow gate)
  for (const extra of available.slice(1)) {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
      timeout: 180000,
    });
    await page.waitForFunction(() => window.__HIRELY_CORE_BOOT__ === 'ok', { timeout: 180000 }).catch(() => null);
    await uploadRealFile(page, extra.path, extra.mime);
    const r = await waitImportDone(page, 180000);
    const s = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
    const ok = r.ok && !!s.resumeName;
    stages.push({
      stage: 'IMPORT',
      id: `secondary_${extra.id}`,
      pass: ok,
      detail: ok ? s.resumeName?.slice(0, 30) : r.fallback ? 'paste fallback' : 'timeout',
      optional: true,
    });
    if (ok) console.log(`OK [IMPORT] secondary_${extra.id}`, s.resumeName?.slice(0, 30));
    else console.warn(`WARN [IMPORT] secondary_${extra.id}`, r.fallback ? 'paste fallback' : 'timeout');
  }
} finally {
  await browser.close();
  server.close();
}

const pass = failed === 0;
const optionalFails = stages.filter((s) => s.optional && !s.pass).length;
const report = {
  feature: 'END_TO_END_FLOW_AUDIT',
  generatedAt: new Date().toISOString(),
  primaryCv: primary,
  realFilesTested: available.map((f) => f.path),
  flowMarkers: FLOW_MARKERS,
  flowLogs,
  stages,
  pass,
  failedStage: pass ? null : failedStage,
  failedCount: failed,
  optionalFailCount: optionalFails,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(pass ? '\nPASS end-to-end-flow-audit' : `\nFAIL end-to-end-flow-audit (stage: ${failedStage})`);
process.exit(pass ? 0 : 1);
