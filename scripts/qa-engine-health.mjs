#!/usr/bin/env node
/**
 * QA: engine health policy — optional missing DOM must not show failure banner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(root, 'ENGINE_HEALTH_QA_REPORT.md');

const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}/index.html`;

async function startServer() {
  const { spawn } = await import('node:child_process');
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  return proc;
}

async function runScenario(browser, { caseId, seedMode }) {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (seedMode === 'optional_dom_missing') {
    await page.evaluate(() => {
      ['auditPanelInner', 'linkedinText', 'letterText', 'templateGallery'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    });
  }

  await page.waitForFunction(
    () => window.__HIRELY_CORE_BOOT__ === 'ok' || window.__HIRELY_CORE_BOOT__ === 'degraded' || window.__HIRELY_CORE_BOOT__ === 'failed',
    { timeout: 120000 }
  );

  await page.evaluate(async () => {
    if (typeof renderOutputs === 'function') renderOutputs();
    if (typeof renderAll === 'function') renderAll();
    if (window.HirelyEngineHealth?.markUiReady) window.HirelyEngineHealth.markUiReady();
  });

  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const banner = document.getElementById('hirelyCoreLoadError');
    const style = banner ? window.getComputedStyle(banner) : null;
    const hidden =
      !banner ||
      banner.classList.contains('hidden') ||
      style?.display === 'none' ||
      style?.visibility === 'hidden';
    return {
      engineHealth: window.__HIRELY_ENGINE_HEALTH_STATE__ || null,
      engineHealthFull: window.__HIRELY_ENGINE_HEALTH__ || null,
      coreBoot: window.__HIRELY_CORE_BOOT__ || null,
      bannerHidden: hidden,
      bannerText: banner?.textContent?.trim() || '',
      bannerDegraded: banner?.classList.contains('hirelyCoreLoadError--degraded') || false,
      missingDom: (window.__HIRELY_MISSING_DOM__ || []).map((x) => x.id),
    };
  });

  await page.close();
  return { caseId, result, logs };
}

const checks = [];

function record(id, pass, detail, group) {
  checks.push({ id, pass, detail, group });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  let allPass = true;

  try {
    const baseline = await runScenario(browser, { caseId: 'baseline_boot', seedMode: 'none' });
    record(
      'baseline_not_failed',
      baseline.result.engineHealth !== 'FAILED',
      baseline.result.engineHealth,
      'baseline'
    );
    record(
      'baseline_no_red_banner',
      baseline.result.bannerHidden && !baseline.result.bannerDegraded,
      baseline.result.bannerHidden ? 'hidden' : baseline.result.bannerText || 'visible',
      'baseline'
    );

    const optional = await runScenario(browser, {
      caseId: 'optional_dom_missing',
      seedMode: 'optional_dom_missing',
    });
    const health = optional.result.engineHealth;
    const allowed = ['DEGRADED', 'IMPORT_READY', 'UI_READY', 'CORE_READY'].includes(health);
    record('optional_dom_not_failed', health !== 'FAILED', health, 'optional_dom');
    record('optional_dom_degraded_or_ready', allowed, health, 'optional_dom');
    record(
      'optional_dom_no_failure_banner',
      optional.result.bannerHidden && !optional.result.bannerDegraded,
      optional.result.bannerHidden ? 'hidden' : optional.result.bannerText || 'visible',
      'optional_dom'
    );
    record(
      'optional_dom_core_boot_ok',
      optional.result.coreBoot === 'ok' || optional.result.coreBoot === 'degraded',
      optional.result.coreBoot,
      'optional_dom'
    );
    record(
      'optional_dom_no_core_boot_failed_log',
      !optional.logs.some((l) => /CORE_BOOT_FAILED/i.test(l) && !/CORE_BOOT_FAILED',/i.test(l)),
      'console',
      'optional_dom'
    );

    allPass = checks.every((c) => c.pass);
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  const lines = [
    '# Engine Health QA Report',
    '',
    `**Status:** ${allPass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Checks',
    '',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.group}/${c.id}** — ${c.detail}`),
    '',
    '## Run',
    '',
    '```bash',
    'npm run qa:engine-health',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(allPass ? 'ENGINE_HEALTH_QA PASS' : 'ENGINE_HEALTH_QA FAIL');
  if (!allPass) checks.filter((c) => !c.pass).forEach((c) => console.error(` - ${c.id}: ${c.detail}`));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
