#!/usr/bin/env node
/**
 * Paste guaranteed flow — >100 chars → Review <1s, preview live, Style/Export unlocked.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { applyPasteGuaranteedFlow, buildPasteFirstPanelCopy } from '../core/import/paste-first-flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/paste-guaranteed-flow');
fs.mkdirSync(outDir, { recursive: true });

const SAMPLE = `Alex Martin
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

const core = applyPasteGuaranteedFlow(SAMPLE, (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);
ok(core.ok, 'core_apply_ok');
ok((core.html || '').length > 200, 'core_html_nonempty', String((core.html || '').length));
ok(core.resumeData?.identity, 'core_resume_object');

const imageCopy = buildPasteFirstPanelCopy({ reason: 'PDF_IMAGE_OCR_DISABLED' });
ok(
  /Collez le texte.*pour continuer/i.test(imageCopy.title),
  'image_pdf_copy',
  imageCopy.title
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

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
      const fp = path.join(root, decodeURIComponent(rel));
      if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
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

const server = await startServer();
const port = server.address().port;
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

await page.evaluate(() => {
  window.showImportPasteFallback('', 'IMPORT_NEEDS_PASTE', {
    silentLog: true,
    pasteFirst: true,
    reason: 'PDF_IMAGE_OCR_DISABLED',
  });
});

await page.evaluate((text) => {
  const ta = document.getElementById('importPasteFallbackText');
  if (ta) {
    ta.disabled = false;
    ta.removeAttribute('aria-disabled');
    ta.value = text;
  }
}, SAMPLE);

const t0 = Date.now();
await page.click('#importPasteFallbackApply');
await page.waitForFunction(
  () => {
    const cvLen = (document.getElementById('cvDoc')?.innerText || '').trim().length;
    return cvLen > 100 && document.getElementById('workspace')?.dataset?.docStep === 'edit';
  },
  null,
  { timeout: 5000 }
);
const ms = Date.now() - t0;

const snap = await page.evaluate(() => ({
  ms: 0,
  cvLen: (document.getElementById('cvDoc')?.innerText || '').trim().length,
  docStep: document.getElementById('workspace')?.dataset?.docStep || '',
  pasteVisible: document.getElementById('importPasteFallback')?.classList.contains('show'),
  styleDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled,
  exportDisabled: document.querySelector('.hirelyProgressBtn[data-doc-step="export"]')?.disabled,
  cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
  rawFallback: document.getElementById('cvDoc')?.classList.contains('cv--raw-fallback'),
}));
snap.ms = ms;

ok(ms < 2000, 'review_under_2s', `${ms}ms`);
ok(snap.cvLen > 100, 'preview_nonempty', String(snap.cvLen));
ok(snap.docStep === 'edit', 'doc_step_edit', snap.docStep);
ok(!snap.pasteVisible, 'paste_panel_hidden');
ok(snap.styleDisabled === false, 'style_unlocked');
ok(snap.exportDisabled === false, 'export_unlocked');
ok(snap.cvLive, 'cv_live');
ok(snap.rawFallback, 'raw_fallback_class');

const report = {
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  checks,
  snap,
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

await browser.close();
server.close();

console.log(failed ? `\n${failed} failed` : '\nAll paste guaranteed checks passed');
process.exit(failed ? 1 : 0);
