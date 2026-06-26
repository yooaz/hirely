#!/usr/bin/env node
/**
 * HIRELY P0 — Clear flow navigation (import → review → template → export).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/clear-flow-navigation');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/mvp-sample.txt');

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

async function waitForCv(page, timeout = 120000) {
  await page.waitForFunction(
    () => {
      const doc = document.getElementById('cvDoc');
      return doc?.classList.contains('cv--live') && (doc.innerText || '').length > 80;
    },
    { timeout }
  );
}

async function setStep(page, step) {
  await page.evaluate((s) => {
    if (typeof setDocStep === 'function') setDocStep(s);
  }, step);
  await page.waitForTimeout(400);
}

async function main() {
  const port = 3070 + Math.floor(Math.random() * 40);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const snap = {};

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.importText === 'function', {
      timeout: 120000,
    });

    const paste = fs.readFileSync(PASTE_FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      await window.HirelyParse.importText(text, {
        source: 'paste-text',
        trusted: true,
        forceContinue: true,
      });
    }, paste);
    await waitForCv(page);

    const nav = await page.evaluate(() => {
      const steps = [...document.querySelectorAll('.hirelyProgressStep')].map((li) => ({
        step: li.dataset.docStep,
        label: li.querySelector('.hirelyProgressLabel')?.textContent?.trim() || '',
      }));
      return { count: steps.length, steps };
    });
    snap.nav = nav;
    ok(nav.count === 4, `progress nav has 4 steps (got ${nav.count})`);
    ok(/relire|review/i.test(nav.steps[1]?.label || ''), 'step 2 is review');
    ok(/modèle|template/i.test(nav.steps[2]?.label || ''), 'step 3 is template');
    ok(/export/i.test(nav.steps[3]?.label || ''), 'step 4 is export');

    await setStep(page, 'edit');
    const reviewCta = await page.evaluate(() => {
      const bar = document.getElementById('flowPrimaryCta');
      const btn = document.getElementById('flowPrimaryCtaBtn');
      const st = bar ? window.getComputedStyle(bar) : null;
      return {
        visible: st && st.display !== 'none' && !bar.classList.contains('hidden'),
        label: btn?.textContent?.trim() || '',
        title: document.getElementById('resumeStudioHead')?.querySelector('h2')?.textContent?.trim() || '',
      };
    });
    snap.review = reviewCta;
    ok(reviewCta.visible, 'review step shows primary CTA');
    ok(/choisir un modèle|choose a template/i.test(reviewCta.label), `review CTA "${reviewCta.label}"`);
    ok(/relire|review/i.test(reviewCta.title), `review title "${reviewCta.title}"`);

    await page.click('#flowPrimaryCtaBtn');
    await page.waitForTimeout(400);
    const styleSnap = await page.evaluate(() => ({
      step: document.getElementById('workspace')?.dataset?.docStep,
      title: document.getElementById('styleStepHead')?.querySelector('h2')?.textContent?.trim() || '',
      tplVisible: !document.getElementById('templatePickerBar')?.classList.contains('hidden'),
      cta: document.getElementById('flowPrimaryCtaBtn')?.textContent?.trim() || '',
    }));
    snap.style = styleSnap;
    ok(styleSnap.step === 'style', `click review CTA → style (got ${styleSnap.step})`);
    ok(/modèle|template/i.test(styleSnap.title), 'style step title visible');
    ok(styleSnap.tplVisible, 'template picker visible on style step');
    ok(/exporter ce cv|export this cv/i.test(styleSnap.cta), `style CTA "${styleSnap.cta}"`);

    await page.click('#flowPrimaryCtaBtn');
    await page.waitForTimeout(500);
    const exportSnap = await page.evaluate(() => {
      const bar = document.getElementById('cvExportBar');
      const st = bar ? window.getComputedStyle(bar) : null;
      const preview = document.getElementById('studioPreview');
      const pst = preview ? window.getComputedStyle(preview) : null;
      return {
        step: document.getElementById('workspace')?.dataset?.docStep,
        exportHead: !document.getElementById('exportStepHead')?.classList.contains('hidden'),
        previewVisible: pst && pst.display !== 'none' && !preview.classList.contains('hidden'),
        pdfBtn: document.getElementById('downloadBtn')?.textContent?.trim() || '',
        exportBarVisible: st && st.display !== 'none' && !bar.classList.contains('hidden'),
        a4H: document.getElementById('cvStage')?.offsetHeight || 0,
      };
    });
    snap.export = exportSnap;
    ok(exportSnap.step === 'export', `click style CTA → export (got ${exportSnap.step})`);
    ok(exportSnap.exportHead, 'export step header visible');
    ok(exportSnap.previewVisible, 'A4 preview visible on export');
    ok(exportSnap.a4H > 400, `A4 stage height ${exportSnap.a4H}px`);
    ok(exportSnap.exportBarVisible, 'export bar visible');
    ok(/télécharger|download/i.test(exportSnap.pdfBtn), `PDF button "${exportSnap.pdfBtn}"`);

    fs.writeFileSync(OUT_JSON, JSON.stringify({ pass: failed === 0, snap }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
