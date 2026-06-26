#!/usr/bin/env node
/**
 * HIRELY P0 — Single source of truth (finalResumeData drives all surfaces).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/single-source-of-truth');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/mvp-sample.txt');
const REQUIRED_LOGS = [
  'FINAL_DATA_COMMITTED',
  'REVIEW_RENDERED',
  'PREVIEW_RENDERED',
  'TEMPLATE_RENDERED',
  'EXPORT_RENDERED',
];

fs.mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
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
    const rel = (req.url || '/').split('?')[0];
    const fp = path.join(ROOT, decodeURIComponent(rel === '/' ? '/index.html' : rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function waitForCv(page) {
  await page.waitForFunction(
    () => {
      const doc = document.getElementById('cvDoc');
      return doc?.classList.contains('cv--live') && (doc.innerText || '').length > 80;
    },
    undefined,
    { timeout: 120000 }
  );
}

async function clickDocStep(page, step) {
  await page.evaluate((s) => {
    if (typeof setDocStep === 'function') setDocStep(s);
  }, step);
  await page.waitForTimeout(500);
}

async function main() {
  if (!fs.existsSync(PASTE_FIXTURE)) {
    console.error('Missing fixture', PASTE_FIXTURE);
    process.exit(1);
  }

  const port = 3080 + Math.floor(Math.random() * 40);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(120000);

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.importText === 'function',
      undefined,
      { timeout: 120000 }
    );

    const paste = fs.readFileSync(PASTE_FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      window.__HIRELY_FLOW_LOGS = [];
      await window.HirelyParse.importText(text, {
        source: 'paste-text',
        trusted: true,
        forceContinue: true,
      });
    }, paste);
    await waitForCv(page);

    let snap = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
    ok(snap.finalResumeValid, 'finalResumeData valid after import');
    ok(snap.sectionCounts?.parity, 'review/preview section parity after import');
    ok(snap.cvLive && snap.previewName.length > 2, `preview live (${snap.previewName})`);

    for (const step of REQUIRED_LOGS.slice(0, 4)) {
      ok((snap.flowLogs || []).includes(step), `log ${step}`);
    }

    const eduInPreview = (snap.sectionCounts?.preview?.education || 0) > 0;
    const eduInFinal = (snap.sectionCounts?.final?.education || 0) > 0;
    ok(eduInPreview === eduInFinal, `education parity final=${eduInFinal} preview=${eduInPreview}`);

    await page.evaluate(() => {
      const card = document.querySelector('.tplCard[data-id="creative"]');
      if (card?.onclick) card.onclick();
      else card?.click();
    });
    await page.waitForTimeout(600);
    snap = await page.evaluate(() => window.HirelyParse.getFlowSnapshot());
    ok(snap.template === 'creative', `template switch (${snap.template})`);
    ok(snap.cvLive, 'preview live after template switch');
    ok(snap.sectionCounts?.parity, 'section parity after template switch');
    ok((snap.flowLogs || []).includes('TEMPLATE_RENDERED'), 'log TEMPLATE_RENDERED after switch');

    await clickDocStep(page, 'export');
    await page.waitForTimeout(600);
    snap = await page.evaluate(() => {
      const s = window.HirelyParse.getFlowSnapshot();
      s.exportPreviewVisible = !document.getElementById('studioPreview')?.classList.contains('hidden');
      return s;
    });
    ok(snap.exportPreviewVisible, 'export preview visible');
    ok(snap.sectionCounts?.parity, 'section parity on export');
    ok((snap.flowLogs || []).includes('EXPORT_RENDERED'), 'log EXPORT_RENDERED');

    const issues = await page.evaluate(() => {
      const eduIssue = [...document.querySelectorAll('#issuesList li')].some((li) =>
        /education|formation/i.test(li.textContent || '')
      );
      const eduFinal = (typeof getFinalSectionCounts === 'function' ? getFinalSectionCounts().education : 0) > 0;
      return { eduIssue, eduFinal };
    });
    ok(!issues.eduIssue || !issues.eduFinal, 'no false education-missing when education present');

    const report = {
      feature: 'SINGLE_SOURCE_OF_TRUTH',
      generatedAt: new Date().toISOString(),
      snap,
      pass: failed === 0,
    };
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failed ? '\nFAIL single-source-of-truth' : '\nPASS single-source-of-truth');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
