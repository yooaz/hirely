#!/usr/bin/env node
/**
 * P0 — IMPORT_FALLBACK_UX_LOCK
 * Unsupported / low-quality import must show paste fallback — never loading, technical errors, or empty CV.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  IMPORT_FALLBACK_UX_LEAD,
  IMPORT_FALLBACK_UX_TITLE,
  IMPORT_FALLBACK_UX_VERSION,
  buildImportFallbackMeta,
  sanitizeImportErrorForUser,
} from '../core/import/import-fallback-ux.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const INDEX = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'tests/output/import-fallback-ux-lock/report.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const SAMPLE_CV = `Alex Martin
Senior Product Designer
alex.martin@example.com · +33 6 11 22 33 44 · Paris

EXPÉRIENCE
Acme Corp — Lead Designer (2021 – Present)
`;

let failed = 0;
const checks = [];
function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

// --- Static lock checks ---
const html = fs.readFileSync(INDEX, 'utf8');
ok(html.includes('import-fallback-ux') || html.includes('IMPORT_FALLBACK_UX_LEAD'), 'static_ux_lead_constant');
ok(html.includes('importPasteFallbackFile'), 'static_meta_filename');
ok(html.includes('importPasteFallbackType'), 'static_meta_filetype');
ok(html.includes('importPasteFallbackReason'), 'static_meta_reason');
ok(html.includes(IMPORT_FALLBACK_UX_LEAD), 'static_lead_copy');
ok(html.includes('id="importPasteFallbackRetryOcr"'), 'static_retry_btn');
ok(html.includes('Remplacer le fichier'), 'static_replace_btn');
ok(html.includes('cvStageWrap--pasteFallback #cvStage'), 'static_hide_cv_on_fallback');
ok(/function showImportPasteFallback/.test(html), 'static_show_fallback_fn');
ok(/_importFallbackUiLock=true/.test(html), 'static_fallback_lock');
ok(sanitizeImportErrorForUser('PDF_EXTRACTION_TIMEOUT') === IMPORT_FALLBACK_UX_LEAD, 'core_sanitize_technical');
ok(buildImportFallbackMeta({ status: 'IMPORT_NEEDS_PASTE', file: { name: 'cv.pdf' } }).fileTypeLabel === 'PDF', 'core_file_type_pdf');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
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

const port = 3090 + Math.floor(Math.random() * 30);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(120000);

const consoleLines = [];
page.on('console', (msg) => consoleLines.push(msg.text()));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => globalThis.HirelyCore?.canonicalImportFromFile && document.getElementById('importPasteFallback'),
  { timeout: 90000 }
);

await page.evaluate(() => {
  globalThis.HIRELY_SIMULATE_PDF_EXTRACTION_TIMEOUT = true;
});

await page.locator('#fileInput').setInputFiles({
  name: 'scan-timeout.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 timeout simulation'),
});

await page.waitForFunction(
  (lead) => {
    const panel = document.getElementById('importPasteFallback');
    const leadEl = document.getElementById('importPasteFallbackLead');
    return panel?.classList.contains('show') && (leadEl?.textContent || '').includes(lead);
  },
  IMPORT_FALLBACK_UX_LEAD,
  { timeout: 30000 }
);

const snap = await page.evaluate(() => ({
  pasteFallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
  needsPasteClass: document.getElementById('wsImport')?.classList.contains('wsImport--needsPaste'),
  title: document.getElementById('importPasteFallbackTitle')?.textContent?.trim() || '',
  lead: document.getElementById('importPasteFallbackLead')?.textContent?.trim() || '',
  fileName: document.getElementById('importPasteFallbackFile')?.textContent?.trim() || '',
  fileType: document.getElementById('importPasteFallbackType')?.textContent?.trim() || '',
  reason: document.getElementById('importPasteFallbackReason')?.textContent?.trim() || '',
  dropFileName: document.getElementById('fileName')?.textContent?.trim() || '',
  textareaVisible: !!document.getElementById('importPasteFallbackText')?.offsetParent,
  retryLabel: document.getElementById('importPasteFallbackRetryOcr')?.textContent?.trim() || '',
  replaceLabel: document.getElementById('importPasteFallbackDocx')?.textContent?.trim() || '',
  loading: document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--loading'),
  pipelineBusy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
  progressHidden: document.getElementById('progress')?.classList.contains('hidden'),
  cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
  cvVisible: !!document.getElementById('cvStage')?.offsetParent,
  cvTextLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
  statusText: document.getElementById('statusText')?.textContent?.trim() || '',
  hasTechnicalStatus: /PDF_EXTRACTION_TIMEOUT|OCR_TIMEOUT|RangeError|stack/i.test(
    document.getElementById('statusText')?.textContent || ''
  ),
}));

ok(snap.pasteFallback, 'ui_panel_visible', JSON.stringify(snap));
ok(snap.needsPasteClass, 'ui_needs_paste_class');
ok(snap.title.includes('Lecture incomplète'), 'ui_title', snap.title);
ok(snap.lead.includes('Collez le texte du CV pour continuer'), 'ui_lead', snap.lead);
ok(snap.fileName.includes('scan-timeout.pdf'), 'ui_meta_filename', snap.fileName);
ok(snap.dropFileName.includes('scan-timeout.pdf'), 'ui_drop_filename', snap.dropFileName);
ok(snap.fileType.includes('PDF'), 'ui_meta_filetype', snap.fileType);
ok(snap.reason.length > 8, 'ui_meta_reason', snap.reason);
ok(snap.textareaVisible, 'ui_paste_box');
ok(snap.retryLabel.includes('Réessayer'), 'ui_retry_btn', snap.retryLabel);
ok(snap.replaceLabel.includes('Remplacer le fichier'), 'ui_replace_btn', snap.replaceLabel);
ok(!snap.loading, 'ui_not_loading');
ok(!snap.pipelineBusy, 'ui_pipeline_not_busy');
ok(snap.progressHidden, 'ui_progress_hidden');
ok(!snap.cvLive, 'ui_no_live_cv');
ok(!snap.cvVisible, 'ui_cv_hidden');
ok(snap.cvTextLen < 20, 'ui_no_empty_cv_content', String(snap.cvTextLen));
ok(!snap.hasTechnicalStatus, 'ui_no_technical_status', snap.statusText);

await page.evaluate((text) => {
  const ta = document.getElementById('importPasteFallbackText');
  if (ta) ta.value = text;
}, SAMPLE_CV);
await page.locator('#importPasteFallbackApply').click({ force: true });

try {
  await page.waitForFunction(
    () =>
      document.getElementById('wsProduct')?.classList.contains('wsProduct--ready') ||
      (document.getElementById('cvDoc')?.classList.contains('cv--live') &&
        /Alex|Martin/i.test(document.getElementById('cvDoc')?.innerText || '')),
    { timeout: 90000 }
  );
} catch {
  /* evaluated below */
}

const afterPaste = await page.evaluate(() => ({
  reviewReady: document.getElementById('wsProduct')?.classList.contains('wsProduct--ready'),
  cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
  cvText: (document.getElementById('cvDoc')?.innerText || '').slice(0, 80),
  pasteHidden: !document.getElementById('importPasteFallback')?.classList.contains('show'),
}));

ok(afterPaste.reviewReady || afterPaste.cvLive, 'paste_recovery', JSON.stringify(afterPaste));
ok(afterPaste.pasteHidden, 'paste_panel_closes');

const report = {
  generatedAt: new Date().toISOString(),
  engineVersion: IMPORT_FALLBACK_UX_VERSION,
  pass: failed === 0,
  checks,
  snap,
  afterPaste,
  consoleTail: consoleLines.slice(-12),
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
await browser.close();
server.close();

console.log(failed ? `\n${failed} failed` : '\nAll IMPORT_FALLBACK_UX_LOCK checks passed');
process.exit(failed ? 1 : 0);
