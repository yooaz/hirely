#!/usr/bin/env node
/**
 * Live browser — blocked_recovery must stabilize (no render loop).
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
const OUT_DIR = path.join(ROOT, 'tests/output/blocked-recovery-stable');
const PORT = 4322 + Math.floor(Math.random() * 20);

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  path.join(ROOT, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf'),
].filter(Boolean);

const BLOB_TEXT = `Yohann Azancot yoaz@hotmail.fr +33649434839 Paris France
Experience Freelance Illustrator Independent 2011 Present packaging editorial
Education LISAA Web Design 2008 2011
Skills Photoshop Illustrator InDesign Languages French English
Portfolio Sunglass God of War Fortune 500 Metro Display personal project adidas creation
${'Additional line with dates 2019 2020 and contact +33649434839 repeated for length. '.repeat(12)}`;

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

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
    stickyBlocked: flow?.stickyBlocked === true || flow?.current === 'blocked_recovery',
    agrees: panelVisible ? flow?.current === 'blocked_recovery' : true,
  };
}

async function waitSettle(page, ms = 1500) {
  await page.waitForTimeout(ms);
  await page.waitForFunction(
    () => {
      const f = window.__HIRELY_UI_FLOW__;
      return f?.current === 'blocked_recovery' || f?.previewAllowed === false;
    },
    { timeout: 5000 }
  ).catch(() => {});
}

async function seedBlockedRecovery(page) {
  const result = await page.evaluate(() => {
    try {
      if (typeof window.HirelyParse?.forceBlockedRecoveryForTest === 'function') {
        return window.HirelyParse.forceBlockedRecoveryForTest();
      }
      return { ok: false, error: 'forceBlockedRecoveryForTest missing' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  await page.waitForTimeout(500);
  return result;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pdfPath = resolvePdf();
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
      () => typeof window.HirelyParse?.forceBlockedRecoveryForTest === 'function',
      { timeout: 180000 }
    );

    // Secondary deterministic helper (not primary proof — see qa:blocked-recovery-real-path-live)
    console.log('Seeding blocked recovery via forceBlockedRecoveryForTest (secondary)');
    const seed = await seedBlockedRecovery(page);
    ok(seed.ok && seed.blocked, `forceBlockedRecoveryForTest (${seed.error || 'blocked'})`);

    const snap = await collectLiveSnap(page);
    const flow = await page.evaluate(() => window.__HIRELY_UI_FLOW__ || null);
    const logs = await page.evaluate(() => window.__HIRELY_FLOW_LOGS || []);
    const initial = assertBlockedInvariants(flow, snap);

    ok(!snap.cvLive, 'CV preview not live while blocked');
    ok(initial.current, `ui flow blocked_recovery after seed (got ${flow?.current})`);
    ok(initial.previewAllowed, 'previewAllowed false after seed');
    ok(initial.templateSkipped, 'templateRenderSkipped true after seed');
    ok(initial.panelVisible, 'recovery panel visible after seed');
    ok(initial.agrees, 'panel visible implies blocked_recovery');

    const stress = await page.evaluate(() => window.HirelyParse.stressRenderCycle(12));
    await waitSettle(page, 1500);

    const snapAfterStress = await collectLiveSnap(page);
    const flow2 = await page.evaluate(() => window.__HIRELY_UI_FLOW__ || null);
    const settled = assertBlockedInvariants(flow2, snapAfterStress);

    ok(stress.delta.TEMPLATE_RENDERED <= 1, `TEMPLATE_RENDERED delta bounded (${stress.delta.TEMPLATE_RENDERED})`);
    ok(stress.delta.FINAL_DATA_COMMITTED <= 2, `FINAL_DATA_COMMITTED delta bounded (${stress.delta.FINAL_DATA_COMMITTED})`);
    ok(stress.delta.PREVIEW_RENDERED <= 2, `PREVIEW_RENDERED delta bounded (${stress.delta.PREVIEW_RENDERED})`);
    ok(stress.blocked === true, 'still blocked_recovery during stress cycle');

    ok(settled.current, `blocked_recovery stable after settle (got ${flow2?.current})`);
    ok(settled.panelVisible, 'recovery panel visible after settle');
    ok(settled.previewAllowed, 'previewAllowed false after settle');
    ok(settled.templateSkipped, 'templateRenderSkipped true after settle');
    ok(settled.agrees, 'panel visible implies blocked_recovery after settle');

    const logs2 = await page.evaluate(() => window.__HIRELY_FLOW_LOGS || []);

    const warnSpam = await page.evaluate(() => {
      return (window.__HIRELY_CONSOLE_WARN__ || []).filter((w) =>
        /silent failure prevented/i.test(w)
      ).length;
    });

    fs.writeFileSync(
      path.join(OUT_DIR, 'report.json'),
      JSON.stringify(
        {
          snap,
          snapAfterStress,
          uiFlow: flow2,
          settled,
          stress,
          eventCounts: {
            FINAL_DATA_COMMITTED: countFlowSteps(logs2, 'FINAL_DATA_COMMITTED'),
            PREVIEW_RENDERED: countFlowSteps(logs2, 'PREVIEW_RENDERED'),
            TEMPLATE_RENDERED: countFlowSteps(logs2, 'TEMPLATE_RENDERED'),
            REVIEW_RENDERED: countFlowSteps(logs2, 'REVIEW_RENDERED'),
          },
          flowLogsTail: logs2.slice(-30),
          initialLogs: logs.length,
        },
        null,
        2
      )
    );

    ok(warnSpam === 0, 'no silent-failure warning spam');
  } finally {
    await browser.close();
    server.close();
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nBlocked recovery stable live test passed.');
  console.log('Report:', path.join(OUT_DIR, 'report.json'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
