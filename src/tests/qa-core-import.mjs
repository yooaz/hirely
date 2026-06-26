#!/usr/bin/env node
/**
 * Core import integrity — no missing exports, no fallback triggers.
 */
import {
  FACT_TYPE_TO_CV_FIELD as FACT_FROM_TYPES,
  FACT_CONFIDENCE_THRESHOLD,
} from '../core/parsing/fact-types.js';
import { normalizeReviewItem, mergeReviewQueues } from '../core/parsing/review-queue-merge.js';
import { enforceCvDataSectionContract } from '../core/parsing/cv-section-contract.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const core = await import('../core/index.js');
ok(!core.__hirelyFallback, 'core is not fallback');
ok(typeof core.runHirelyImportFromText === 'function', 'runHirelyImportFromText');
ok(typeof core.runSectionEngineV2 === 'function', 'runSectionEngineV2');
ok(typeof core.runResumeGraphEngine === 'function', 'runResumeGraphEngine');
ok(typeof core.runFactPipeline === 'function', 'runFactPipeline');
ok(!!core.FACT_TYPE_TO_CV_FIELD?.skill, 'FACT_TYPE_TO_CV_FIELD from core');
ok(core.FACT_TYPE_TO_CV_FIELD.skill === 'skills', 'skill maps to skills');
ok(FACT_FROM_TYPES.skill === 'skills', 'fact-types canonical export');
ok(FACT_CONFIDENCE_THRESHOLD === 0.8, 'FACT_CONFIDENCE_THRESHOLD acyclic');
ok(typeof normalizeReviewItem === 'function', 'review-queue-merge normalizeReviewItem');
ok(typeof mergeReviewQueues === 'function', 'review-queue-merge mergeReviewQueues');
ok(typeof enforceCvDataSectionContract === 'function', 'cv-section-contract acyclic');

const merged = mergeReviewQueues([
  { field: 'skill', detected: 'Branding', sourceText: 'Branding', confidence: 55, status: 'pending' },
]);
ok(merged.length === 1, 'mergeReviewQueues works');

async function testBrowserBoot() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.log('SKIP browser boot (playwright not installed)');
    return;
  }
  const fs = await import('fs');
  const http = await import('http');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const repoRoot = path.join(root, '..');

  function mime(fp) {
    const ext = path.extname(fp).toLowerCase();
    return (
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
      }[ext] || 'application/octet-stream'
    );
  }

  const port = 3900 + Math.floor(Math.random() * 100);
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const rel = u === '/' ? '/index.html' : u;
    const fp = path.join(repoRoot, decodeURIComponent(rel));
    if (!fp.startsWith(repoRoot) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });

  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(m.text()));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(
    () => window.__HIRELY_CORE_BOOT__ === 'ok' || window.__HIRELY_CORE_BOOT__ === 'failed',
    null,
    { timeout: 120000 }
  );
  const boot = await page.evaluate(() => ({
    boot: window.__HIRELY_CORE_BOOT__,
    loaded: window.__HIRELY_CORE_STATUS__?.loaded,
    fact: window.HirelyCore?.FACT_TYPE_TO_CV_FIELD?.skill,
    importFn: typeof window.HirelyCore?.runHirelyImportFromText,
  }));
  await browser.close();
  server.close();

  ok(boot.boot === 'ok', `browser CORE_BOOT ok (${boot.boot})`);
  ok(boot.loaded === true, 'browser core status loaded');
  ok(boot.fact === 'skills', 'browser FACT_TYPE_TO_CV_FIELD');
  ok(boot.importFn === 'function', 'browser runHirelyImportFromText');
  ok(
    !consoleLines.some((l) => l.includes('FACT_TYPE_TO_CV_FIELD') || l.includes('degraded import')),
    'browser console clean'
  );
  ok(consoleLines.some((l) => l.includes('CORE_BOOT_OK')), 'browser logs CORE_BOOT_OK');
}

await testBrowserBoot();

console.log(failed ? '\nCORE_BOOT_FAILED' : '\nCORE_BOOT_OK');
console.log(failed ? `\n${failed} FAILED` : '\nqa-core-import: all passed');
process.exit(failed ? 1 : 0);
