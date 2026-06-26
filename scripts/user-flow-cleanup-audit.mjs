#!/usr/bin/env node
/**
 * Visible user-flow audit — import, paste, review, style, export.
 * UI/copy checks only (no engine assertions).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LAB = path.join(ROOT, 'tests/fixtures/hirely-test-lab');
const OUT = path.join(ROOT, 'tests/output/user-flow-cleanup-audit.json');

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
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.wasm': 'application/wasm',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
      const fp = path.join(ROOT, decodeURIComponent(rel));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
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

async function boot(page, port) {
  await page.goto(`http://127.0.0.1:${port}/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => {
      const b = window.__HIRELY_CORE_BOOT__;
      return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
    },
    null,
    { timeout: 60000 }
  );
}

function vis(page, sel) {
  return page.locator(sel).evaluate((el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
  });
}

async function snapshotStep(page, name) {
  return page.evaluate((stepName) => {
    const txt = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      if (s.display === 'none' || el.classList.contains('hidden')) return null;
      return (el.textContent || '').trim().slice(0, 200);
    };
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      if (el.classList.contains('hidden')) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
    };
    return {
      step: stepName,
      docStep: document.getElementById('workspace')?.dataset?.docStep || null,
      progressReview: txt('[data-i="progressReview"]'),
      flowPrimaryCta: vis('#flowPrimaryCta'),
      docNav: vis('#docNav'),
      linkedin: vis('#linkedinImportBlock'),
      importFlowV2: vis('#importFlowV2'),
      pasteTitle: txt('#importPasteFallbackTitle'),
      pasteCta: txt('#importPasteFallbackApply'),
      formatGuide: txt('#importFormatGuideTitle'),
      downloadBtn: txt('#downloadBtn'),
      styleLead: txt('.styleStepLead'),
      bodyHasV1: /(\bFormats V1\b|\bV1 formats\b|pris en charge \(V1\)|not supported in V1)/i.test(
        document.body.innerText
      ),
      scaryFail: /n'avons pas pu lire|not supported in V1|text PDF only in V1/i.test(
        document.body.innerText
      ),
    };
  }, name);
}

async function waitImportReady(page, ms = 60000) {
  await page.waitForFunction(
    () => {
      const cv = document.getElementById('cvDoc');
      const cvLen = (cv?.innerText || '').trim().length;
      const step = document.getElementById('workspace')?.dataset?.docStep;
      const loading = cv?.classList.contains('cv--loading');
      const styleOpen =
        document.querySelector('.hirelyProgressBtn[data-doc-step="style"]')?.disabled === false;
      return cvLen > 80 && step === 'edit' && !loading && styleOpen;
    },
    null,
    { timeout: ms }
  );
}

async function waitScannedPaste(page) {
  await page.waitForFunction(
    () => {
      const paste = document.getElementById('importPasteFallback');
      const loading = document.getElementById('cvDoc')?.classList.contains('cv--loading');
      return paste?.classList.contains('show') && !loading;
    },
    null,
    { timeout: 120000 }
  );
}

async function clickProgress(page, step) {
  await page.evaluate((s) => window.setDocStep(s), step);
  await page.waitForFunction(
    (s) => document.getElementById('workspace')?.dataset?.docStep === s,
    step,
    { timeout: 15000 }
  );
  await page.waitForTimeout(300);
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass, detail });

  try {
    await boot(page, port);
    const importSnap = await snapshotStep(page, 'import');
    add('import-no-v1-copy', !importSnap.bodyHasV1, importSnap.formatGuide);
    add('import-linkedin-hidden', !importSnap.linkedin, 'linkedinImportBlock');
    add('import-flowv2-hidden', !importSnap.importFlowV2, 'importFlowV2');
    add('import-progress-relire', importSnap.progressReview === 'Relire', importSnap.progressReview);

    const scan = path.join(LAB, 'scan.pdf');
    await page.waitForSelector('#fileInput', { state: 'attached', timeout: 15000 });
    await page.locator('#fileInput').setInputFiles(scan);
    await waitScannedPaste(page);
    const pasteSnap = await snapshotStep(page, 'paste');
    add('paste-friendly-title', !/V1|n'est pas pris en charge/i.test(pasteSnap.pasteTitle || ''), pasteSnap.pasteTitle);
    add('paste-cta-continuer', /continuer/i.test(pasteSnap.pasteCta || ''), pasteSnap.pasteCta);
    add('paste-no-scary', !pasteSnap.scaryFail, 'scary language scan');

    const pasteText = fs.readFileSync(path.join(LAB, 'paste.txt'), 'utf8');
    await page.evaluate((t) => {
      const ta = document.getElementById('importPasteFallbackText');
      if (ta) {
        ta.disabled = false;
        ta.removeAttribute('aria-disabled');
        ta.value = t;
      }
    }, pasteText);
    await page.click('#importPasteFallbackApply');
    await waitImportReady(page);
    const reviewSnap = await snapshotStep(page, 'review');
    add('review-progress-relire', reviewSnap.progressReview === 'Relire', reviewSnap.progressReview);
    add('review-no-duplicate-cta', !reviewSnap.flowPrimaryCta, 'flowPrimaryCta hidden when docNav shown');
    add('review-no-v1', !reviewSnap.bodyHasV1, 'V1 in body');

    await clickProgress(page, 'style');
    const styleSnap = await snapshotStep(page, 'style');
    add('style-lead-clean', !/vérifiez ce qui a été extrait/i.test(styleSnap.styleLead || ''), styleSnap.styleLead);
    add('style-no-dup-cta', !styleSnap.flowPrimaryCta, 'flowPrimaryCta hidden');

    await clickProgress(page, 'export');
    const exportSnap = await snapshotStep(page, 'export');
    add('export-download-fr', /télécharger|download pdf/i.test(exportSnap.downloadBtn || ''), exportSnap.downloadBtn);
    add('export-no-v1', !exportSnap.bodyHasV1, 'V1 in body');

    const payload = { at: new Date().toISOString(), checks, snapshots: { importSnap, pasteSnap, reviewSnap, styleSnap, exportSnap } };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
    const failed = checks.filter((c) => !c.pass);
    if (failed.length) {
      console.error('FAIL', failed);
      process.exitCode = 1;
    } else {
      console.log('PASS', checks.length, 'checks');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
