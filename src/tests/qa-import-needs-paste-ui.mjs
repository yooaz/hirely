#!/usr/bin/env node
/**
 * P0 — IMPORT_NEEDS_PASTE UI QA.
 * Simulates PDF_EXTRACTION_TIMEOUT and verifies paste panel UX + parser recovery.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/import-needs-paste-ui');
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

const port = 3080 + Math.floor(Math.random() * 30);
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
    const imp = document.getElementById('wsImport');
    const progress = document.getElementById('progress');
    const title = document.getElementById('importPasteFallbackTitle')?.textContent || '';
    const lead = document.getElementById('importPasteFallbackLead')?.textContent || '';
    const fileName = document.getElementById('fileName')?.textContent || '';
    return (
      panel?.classList.contains('show') &&
      imp?.classList.contains('wsImport--needsPaste') &&
      ta &&
      !document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--loading') &&
      progress?.classList.contains('hidden') &&
      title.includes('Lecture incomplète') &&
      lead.includes('Collez le texte du CV pour continuer') &&
      fileName.includes('timeout-test.pdf')
    );
  },
  { timeout: 30000 }
);

const snap = await page.evaluate(() => ({
  pasteFallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
  needsPasteClass: document.getElementById('wsImport')?.classList.contains('wsImport--needsPaste'),
  importExpandedVisible: !!document.getElementById('importExpanded')?.offsetParent,
  textareaVisible: !!document.getElementById('importPasteFallbackText')?.offsetParent,
  textareaFocused: document.activeElement?.id === 'importPasteFallbackText',
  loading: document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--loading'),
  pipelineBusy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
  progressHidden: document.getElementById('progress')?.classList.contains('hidden'),
  title: document.getElementById('importPasteFallbackTitle')?.textContent || '',
  lead: document.getElementById('importPasteFallbackLead')?.textContent || '',
  fileName: document.getElementById('fileName')?.textContent || '',
  applyLabel: document.getElementById('importPasteFallbackApply')?.textContent || '',
  retryLabel: document.getElementById('importPasteFallbackRetryOcr')?.textContent || '',
  otherFileLabel: document.getElementById('importPasteFallbackDocx')?.textContent || '',
  pasteInImportArea: !!document.getElementById('importExpanded')?.contains(
    document.getElementById('importPasteFallback')
  ),
}));

ok(snap.pasteFallback, 'ui_paste_panel_open', JSON.stringify(snap));
ok(snap.needsPasteClass, 'ui_needs_paste_class', String(snap.needsPasteClass));
ok(snap.importExpandedVisible, 'ui_import_expanded_visible', String(snap.importExpandedVisible));
ok(snap.textareaVisible, 'ui_textarea_visible');
ok(snap.textareaFocused, 'ui_textarea_focused', String(snap.textareaFocused));
ok(!snap.loading, 'ui_not_loading', String(snap.loading));
ok(!snap.pipelineBusy, 'ui_pipeline_not_busy', String(snap.pipelineBusy));
ok(snap.progressHidden, 'ui_progress_hidden', String(snap.progressHidden));
ok(snap.title.includes('Lecture incomplète'), 'ui_title', snap.title);
ok(snap.lead.includes('Collez le texte du CV pour continuer'), 'ui_lead', snap.lead);
ok(snap.fileName.includes('timeout-test.pdf'), 'ui_filename_visible', snap.fileName);
ok(/Coller|Continuer/.test(snap.applyLabel), 'ui_btn_paste', snap.applyLabel);
ok(snap.retryLabel.includes('Réessayer'), 'ui_btn_retry', snap.retryLabel);
ok(snap.otherFileLabel.includes('Remplacer le fichier'), 'ui_btn_other_file', snap.otherFileLabel);
ok(snap.pasteInImportArea, 'ui_paste_in_import_area', String(snap.pasteInImportArea));

await page.evaluate(() => {
  globalThis.dispatchEvent(
    new CustomEvent('hirely:ocr-progress', {
      detail: { pct: 72, importRunId: globalThis.HIRELY_IMPORT_RUN_ID },
    })
  );
  globalThis.dispatchEvent(
    new CustomEvent('hirely:import-status', {
      detail: {
        terminal: true,
        status: 'PDF_OCR_TIMEOUT',
        message: 'PDF_EXTRACTION_TIMEOUT',
        importRunId: globalThis.HIRELY_IMPORT_RUN_ID,
      },
    })
  );
});

await page.waitForTimeout(120);

const afterRace = await page.evaluate(() => ({
  pasteFallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
  pipelineBusy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
  progressHidden: document.getElementById('progress')?.classList.contains('hidden'),
}));

ok(afterRace.pasteFallback, 'race_paste_stays_open', JSON.stringify(afterRace));
ok(!afterRace.pipelineBusy, 'race_no_spinner_restart', String(afterRace.pipelineBusy));
ok(afterRace.progressHidden, 'race_progress_stays_hidden', String(afterRace.progressHidden));

await page.evaluate((text) => {
  const ta = document.getElementById('importPasteFallbackText');
  if (ta) ta.value = text;
}, SAMPLE_CV);

await page.locator('#importPasteFallbackApply').click({ force: true });

let afterPaste = {
  reviewReady: false,
  cvLive: false,
  cvText: '',
  pasteHidden: false,
};
try {
  await page.waitForFunction(
    () => {
      const review = document.getElementById('wsProduct');
      if (review?.classList.contains('wsProduct--ready')) return true;
      const doc = document.getElementById('cvDoc');
      const live = doc?.classList.contains('cv--live');
      const name = doc?.innerText || '';
      return live && /Alex|Martin/i.test(name);
    },
    { timeout: 90000 }
  );
} catch {
  /* captured below */
}

afterPaste = await page.evaluate(() => ({
  reviewReady: document.getElementById('wsProduct')?.classList.contains('wsProduct--ready'),
  cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
  cvText: (document.getElementById('cvDoc')?.innerText || '').slice(0, 120),
  pasteHidden: !document.getElementById('importPasteFallback')?.classList.contains('show'),
  pasteReopened: document.getElementById('importPasteFallback')?.classList.contains('show'),
  loading: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
  status: document.getElementById('statusText')?.textContent || '',
}));


const reviewVisible =
  afterPaste.reviewReady ||
  afterPaste.cvLive ||
  consoleLines.some((l) => /REVIEW_SCREEN_VISIBLE/.test(l));
ok(reviewVisible, 'paste_review_visible', JSON.stringify(afterPaste));
ok(
  reviewVisible && (/Alex|Martin/i.test(afterPaste.cvText) || afterPaste.reviewReady),
  'paste_parser_name',
  afterPaste.cvText
);
ok(afterPaste.pasteHidden, 'paste_panel_closed_after_import');

const pipelineDone = consoleLines.some((l) => /REVIEW_SCREEN_VISIBLE/.test(l));
ok(pipelineDone, 'paste_pipeline_logged', consoleLines.slice(-16).join(' | '));

const report = {
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  checks,
  snap,
  afterRace,
  afterPaste,
  pipelineDone,
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

await browser.close();
server.close();

console.log(failed ? `\n${failed} failed` : '\nAll IMPORT_NEEDS_PASTE UI checks passed');
process.exit(failed ? 1 : 0);
