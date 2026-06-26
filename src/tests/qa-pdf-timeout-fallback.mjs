#!/usr/bin/env node
/**
 * P0 — PDF OCR timeout fallback UX QA.
 * Simulates PDF_EXTRACTION_TIMEOUT and verifies paste panel + parser recovery.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  IMPORT_STATUS,
  pasteFallbackMessage,
} from '../core/import/import-status.js';
import { OCR_TIMEOUT_USER_MSG } from '../core/extraction/pdf-extraction-timeout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/pdf-timeout-fallback');
fs.mkdirSync(outDir, { recursive: true });

const SAMPLE_CV = `Alex Martin
Senior Product Designer
alex.martin@example.com · +33 6 11 22 33 44 · Paris

PROFIL
Product designer with 8+ years crafting B2B SaaS experiences.

EXPÉRIENCE
Acme Corp — Lead Designer (2021 – Present)
- Design system and onboarding flows

FORMATION
ENSAD — Master Design (2016 – 2018)
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

ok(
  pasteFallbackMessage(IMPORT_STATUS.PDF_OCR_TIMEOUT) === OCR_TIMEOUT_USER_MSG,
  'core_timeout_message',
  OCR_TIMEOUT_USER_MSG
);
ok(
  OCR_TIMEOUT_USER_MSG.includes('Certaines sections'),
  'core_timeout_copy_soft',
  OCR_TIMEOUT_USER_MSG
);
ok(
  !OCR_TIMEOUT_USER_MSG.includes('Lecture automatique impossible'),
  'core_no_terminal_phrase'
);

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
    const fp = path.join(root, decodeURIComponent(p));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

const port = 3070 + Math.floor(Math.random() * 30);
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

const fakePdf = {
  name: 'timeout-test.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 timeout simulation'),
};

await page.locator('#fileInput').setInputFiles(fakePdf);

await page.waitForFunction(
  () => {
    const panel = document.getElementById('importPasteFallback');
    const ta = document.getElementById('importPasteFallbackText');
    const wrap = document.getElementById('cvStageWrap');
    const loading = wrap?.classList.contains('cvStageWrap--loading');
    const lead = document.getElementById('importPasteFallbackLead')?.textContent || '';
    const fileName = document.getElementById('fileName')?.textContent || '';
    return (
      panel?.classList.contains('show') &&
      ta &&
      !loading &&
      (lead.includes('Certaines sections') || lead.includes('Collez le texte')) &&
      fileName.includes('timeout-test.pdf')
    );
  },
  { timeout: 30000 }
);

const snap = await page.evaluate(() => ({
  pasteFallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
  textareaVisible: !!document.getElementById('importPasteFallbackText')?.offsetParent,
  loading: document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--loading'),
  pipelineBusy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
  lead: document.getElementById('importPasteFallbackLead')?.textContent || '',
  fileName: document.getElementById('fileName')?.textContent || '',
  applyLabel: document.getElementById('importPasteFallbackApply')?.textContent || '',
  retryLabel: document.getElementById('importPasteFallbackRetryOcr')?.textContent || '',
  otherFileLabel: document.getElementById('importPasteFallbackDocx')?.textContent || '',
  statusText: document.getElementById('statusText')?.textContent || '',
}));

ok(snap.pasteFallback, 'ui_paste_panel_open', JSON.stringify(snap));
ok(snap.textareaVisible, 'ui_textarea_visible');
ok(!snap.loading, 'ui_not_loading', String(snap.loading));
ok(!snap.pipelineBusy, 'ui_pipeline_not_busy', String(snap.pipelineBusy));
ok(
  snap.lead.includes('Certaines sections') || snap.lead.includes('Collez le texte'),
  'ui_timeout_lead',
  snap.lead
);
ok(snap.fileName.includes('timeout-test.pdf'), 'ui_filename_visible', snap.fileName);
ok(snap.applyLabel.includes('Coller le texte'), 'ui_btn_paste', snap.applyLabel);
ok(snap.retryLabel.includes('Réessayer la lecture PDF'), 'ui_btn_retry', snap.retryLabel);
ok(snap.otherFileLabel.includes('Changer de fichier'), 'ui_btn_other_file', snap.otherFileLabel);

await page.evaluate((text) => {
  const ta = document.getElementById('importPasteFallbackText');
  if (ta) ta.value = text;
}, SAMPLE_CV);

await page.click('#importPasteFallbackApply');

await page.waitForFunction(
  () => {
    const doc = document.getElementById('cvDoc');
    const review = document.getElementById('wsProduct');
    const ready = review?.classList.contains('wsProduct--ready');
    const live = doc?.classList.contains('cv--live');
    const name = doc?.innerText || '';
    return (ready || live) && /Alex|Martin/i.test(name);
  },
  { timeout: 90000 }
);

const afterPaste = await page.evaluate(() => ({
  reviewReady: document.getElementById('wsProduct')?.classList.contains('wsProduct--ready'),
  cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
  cvText: (document.getElementById('cvDoc')?.innerText || '').slice(0, 120),
  pasteHidden: !document.getElementById('importPasteFallback')?.classList.contains('show'),
}));

ok(afterPaste.reviewReady || afterPaste.cvLive, 'paste_review_visible', JSON.stringify(afterPaste));
ok(/Alex|Martin/i.test(afterPaste.cvText), 'paste_parser_name', afterPaste.cvText);
ok(afterPaste.pasteHidden, 'paste_panel_closed_after_import');

const pipelineDone = consoleLines.some((l) =>
  /FINAL_RESUME_READY|REVIEW_SCREEN_VISIBLE|RENDER_DONE|PARSER_DONE/.test(l)
);
ok(pipelineDone, 'paste_pipeline_logged', consoleLines.slice(-12).join(' | '));

const report = {
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  checks,
  snap,
  afterPaste,
  pipelineDone,
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

await browser.close();
server.close();

console.log(failed ? `\n${failed} failed` : '\nAll PDF timeout fallback checks passed');
process.exit(failed ? 1 : 0);
