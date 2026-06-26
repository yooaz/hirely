#!/usr/bin/env node
/**
 * Live browser — blocked_recovery from REAL file upload (not seeded helper).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  startStaticServer,
  browserImportFile,
  waitImportDone,
  collectLiveSnap,
} from './lib/live-upload-path-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/blocked-recovery-real-path');
const PORT = 4330 + Math.floor(Math.random() * 20);

const REAL_TXT = path.join(ROOT, 'tests/fixtures/blocked-recovery/no-name-cv.txt');
const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  path.join(ROOT, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf'),
].filter((p) => p && fs.existsSync(p));

function countFlowSteps(logs, step) {
  return (logs || []).filter((l) => l?.step === step).length;
}

function assertBlockedInvariants(flow, snap) {
  const panelVisible =
    snap?.recoveryPanelVisible === true || flow?.recoveryPanelVisible === true;
  return {
    current: flow?.current === 'blocked_recovery',
    panelVisible,
    previewAllowed: flow?.previewAllowed === false,
    templateSkipped: flow?.templateRenderSkipped === true,
    invariantViolations: flow?.invariantViolations || [],
    agrees: panelVisible ? flow?.current === 'blocked_recovery' : true,
  };
}

async function waitSettle(page, ms = 2000) {
  await page.waitForTimeout(ms);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startStaticServer(ROOT, PORT);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(360000);

  let failed = 0;
  const ok = (c, m) => {
    if (!c) {
      console.error('FAIL', m);
      failed++;
    } else console.log('OK', m);
  };

  try {
    await page.goto(`http://127.0.0.1:${PORT}/?pro=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.handleFileImport === 'function',
      { timeout: 180000 }
    );

    let pathUsed = 'txt-upload';
    console.log('Real path: uploading', REAL_TXT);
    ok(fs.existsSync(REAL_TXT), 'fixture txt exists');
    await browserImportFile(page, REAL_TXT, 'blocked-recovery-real-txt');
    let importDone = await waitImportDone(page, 120000);
    await waitSettle(page, 2000);

    let snap = await collectLiveSnap(page);
    let flow = await page.evaluate(() => window.__HIRELY_UI_FLOW__ || null);

    if (flow?.current !== 'blocked_recovery' && snap.pasteFallback) {
      pathUsed = 'txt-paste-blocked';
      await waitSettle(page, 1000);
      snap = await collectLiveSnap(page);
      flow = await page.evaluate(() => window.__HIRELY_UI_FLOW__ || null);
    }

    if (flow?.current !== 'blocked_recovery' && PDF_CANDIDATES[0]) {
      console.log('TXT path did not reach blocked_recovery — trying PDF upload');
      pathUsed = 'pdf-upload';
      await page.evaluate(() => {
        globalThis.HIRELY_PDF_EXTRACTION_MAX_MS = 90000;
        globalThis.HIRELY_PDF_OCR_PER_PAGE_MS = 35000;
      });
      await browserImportFile(page, PDF_CANDIDATES[0], 'blocked-recovery-real-pdf');
      importDone = await waitImportDone(page, 300000);
      await waitSettle(page, 2000);
      snap = await collectLiveSnap(page);
      flow = await page.evaluate(() => window.__HIRELY_UI_FLOW__ || null);
    }

    const initial = assertBlockedInvariants(flow, snap);
    ok(flow?.current === 'blocked_recovery', `real import -> blocked_recovery (got ${flow?.current}, path=${pathUsed})`);
    ok(initial.previewAllowed, 'previewAllowed false after real import');
    ok(initial.templateSkipped, 'templateRenderSkipped true after real import');
    ok(
      initial.panelVisible || snap.pasteFallback,
      'recovery panel visible or paste fallback (real blocked path)'
    );

    const tplProbe = await page.evaluate(() =>
      typeof window.HirelyParse.probeTemplateRenderWhileBlocked === 'function'
        ? window.HirelyParse.probeTemplateRenderWhileBlocked()
        : null
    );
    if (flow?.current === 'blocked_recovery' && tplProbe) {
      ok(tplProbe.templateRenderedDelta === 0, `template render suppressed (${tplProbe.templateRenderedDelta})`);
      ok(
        tplProbe.suppressedDelta >= 1 || (tplProbe.uiFlow?.templateRenderSuppressedCount || 0) >= 1,
        `template suppression counted (${tplProbe.suppressedDelta})`
      );
    }

    const commitsBefore = await page.evaluate(() =>
      (window.__HIRELY_FLOW_LOGS || []).filter((l) => l.step === 'FINAL_DATA_COMMITTED').length
    );
    const stress = await page.evaluate(() => window.HirelyParse.stressRenderCycle(8));
    await waitSettle(page, 1500);

    const snapAfter = await collectLiveSnap(page);
    const flowAfter = await page.evaluate(() => window.__HIRELY_UI_FLOW__ || null);
    const commitsAfter = await page.evaluate(() =>
      (window.__HIRELY_FLOW_LOGS || []).filter((l) => l.step === 'FINAL_DATA_COMMITTED').length
    );
    const settled = assertBlockedInvariants(flowAfter, snapAfter);

    ok(stress.delta.TEMPLATE_RENDERED === 0, `no template renders during stress (${stress.delta.TEMPLATE_RENDERED})`);
    ok(commitsAfter - commitsBefore <= 1, `no commit loop (${commitsBefore}->${commitsAfter})`);
    ok(settled.current, `blocked_recovery stable after settle (got ${flowAfter?.current})`);
    ok(settled.previewAllowed, 'previewAllowed false after settle');
    ok((flowAfter?.illegalTransitionCount || 0) === 0, `no illegal transitions (${flowAfter?.illegalTransitionCount})`);

    // Exit flow: user fix -> preview_ready (or remain blocked if other gate issues)
    if (flowAfter?.current === 'blocked_recovery') {
      const exit = await page.evaluate(() =>
        window.HirelyParse.simulateGateExitUserFix('Yohann Azancot')
      );
      await waitSettle(page, 800);
      const flowExit = await page.evaluate(() => window.__HIRELY_UI_FLOW__ || null);
      ok(exit?.ok !== false, `simulateGateExitUserFix (${exit?.error || 'ok'})`);
      const unsafeNameStill = (exit?.gateIssues || []).includes('unsafe_name');
      ok(
        flowExit?.current === 'preview_ready' || !unsafeNameStill,
        `name issue cleared after fix (state=${flowExit?.current}, unsafe_name=${unsafeNameStill})`
      );
    }

    fs.writeFileSync(
      path.join(OUT_DIR, 'report.json'),
      JSON.stringify(
        {
          pathUsed,
          importDone,
          snap,
          snapAfter,
          flowAfter,
          stress,
          tplProbe,
          commitsBefore,
          commitsAfter,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
    server.close();
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nBlocked recovery real-path live test passed.');
  console.log('Report:', path.join(OUT_DIR, 'report.json'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
