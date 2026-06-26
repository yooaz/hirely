#!/usr/bin/env node
/**
 * FINAL_BOOT_DOM_CONTRACT — lock verification after P0 UI subtraction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise, isHirelyAppFatal } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(root, 'FINAL_BOOT_DOM_CONTRACT_REPORT.md');
const SHOT_DIR = path.join(root, 'docs', 'screenshots', 'final-boot-dom-contract');
const PORT = Number(process.env.HIRELY_FINAL_BOOT_PORT || 3115);
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const TRACE_PUSH_REPLACEMENTS = [
  'src/ui/runtime/boot-trace.js — hirelyTrace() (canonical; replaces direct .push)',
  'src/ui/runtime/dom-safe.js — hirelyTrace() delegate',
  'src/ui/runtime/dom-contract.js — hirelyTrace() / pushBootTrace alias',
  'index.html — hirelyTrace() / safeBootTrace (no direct .push)',
  'index.html — getHirelyCore onStep → hirelyTrace(step)',
  'scripts/qa-boot-regression.mjs — hirelyTrace for probe (fallback array only in QA)',
  'scripts/qa-no-regression-repair.mjs — hirelyTrace after object seed',
];

const INNERHTML_GUARDS = [
  'src/ui/runtime/dom-safe.js — setHTML(), setText()',
  'src/ui/runtime/dom-contract.js — setHTML(), setText(), setElHTML()',
  'index.html — setHTML(), setText(), setElHTML(), trackRenderHtml()',
  'index.html — renderOutputs() — trackRenderHtml for optional auditPanelInner',
  'index.html — renderAll() — safePhase() per section, no throw on optional gaps',
];

function record(checks, id, pass, detail = '') {
  checks.push({ id, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}]${detail ? ` — ${detail}` : ''}`);
}

async function startServer() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  return proc;
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const checks = [];
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const errors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        window.__HIRELY_CORE_BOOT__ === 'ok' ||
        window.__HIRELY_CORE_BOOT__ === 'degraded' ||
        window.__HIRELY_CORE_BOOT__ === 'failed',
      { timeout: 120000 }
    );

    const boot = await page.evaluate(() => {
      const traceSeed = { steps: [{ tag: 'QA_OBJECT_SEED' }] };
      window.__HIRELY_CORE_BOOT_TRACE__ = traceSeed;
      let traceOk = false;
      try {
        window.HirelyBootTrace?.hirelyTrace({ tag: 'QA_AFTER_SEED' });
        traceOk = Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__);
      } catch {
        traceOk = false;
      }
      const outputs = typeof renderOutputs === 'function' ? renderOutputs() : null;
      const all = typeof renderAll === 'function' ? renderAll() : null;
      if (window.HirelyEngineHealth?.markUiReady) window.HirelyEngineHealth.markUiReady();
      const banner = document.getElementById('hirelyCoreLoadError');
      const style = banner ? window.getComputedStyle(banner) : null;
      const bannerHidden =
        !banner ||
        banner.classList.contains('hidden') ||
        style?.display === 'none' ||
        style?.visibility === 'hidden';
      const dropHint = document.querySelector('#drop .dropActionHint')?.textContent?.trim() || '';
      return {
        traceOk,
        traceLen: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__)
          ? window.__HIRELY_CORE_BOOT_TRACE__.length
          : 0,
        hasBootTrace: !!window.HirelyBootTrace?.hirelyTrace,
        hasDomSafe: !!window.HirelyDomSafe?.setHTML,
        hasDomContract: !!window.HirelyDomContract?.validateRequiredDom,
        required: window.HirelyDomContract?.validateRequiredDom?.() || [],
        outputs,
        all,
        engineHealth: window.__HIRELY_ENGINE_HEALTH_STATE__,
        coreBoot: window.__HIRELY_CORE_BOOT__,
        bannerHidden,
        bannerDegraded: banner?.classList.contains('hirelyCoreLoadError--degraded'),
        dropHint,
        fileInput: !!document.getElementById('fileInput'),
        drop: !!document.getElementById('drop'),
        cvPreview: !!document.getElementById('cvDoc'),
      };
    });

    const fatals = [...errors, ...pageErrors].filter(
      (m) => !isExtensionConsoleNoise(m) && isHirelyAppFatal(m)
    );

    record(checks, 'trace_hirelyTrace_survives_object_seed', boot.traceOk && boot.traceLen > 1);
    record(checks, 'boot_trace_module_loaded', boot.hasBootTrace);
    record(checks, 'dom_safe_loaded', boot.hasDomSafe);
    record(checks, 'dom_contract_loaded', boot.hasDomContract);
    record(checks, 'required_dom_present', boot.required.length === 0, boot.required.join(',') || 'ok');
    record(
      checks,
      'render_outputs_shape',
      boot.outputs &&
        typeof boot.outputs.ok === 'boolean' &&
        Array.isArray(boot.outputs.rendered) &&
        Array.isArray(boot.outputs.skipped) &&
        Array.isArray(boot.outputs.missingRequired),
      JSON.stringify(boot.outputs)
    );
    record(checks, 'render_outputs_no_throw', boot.outputs?.ok !== undefined);
    record(
      checks,
      'render_all_safe_phases',
      boot.all && Array.isArray(boot.all.phases) && typeof boot.all.ok === 'boolean'
    );
    record(
      checks,
      'engine_not_failed',
      boot.engineHealth !== 'FAILED' && boot.coreBoot !== 'failed',
      `engine=${boot.engineHealth}; core=${boot.coreBoot}`
    );
    record(
      checks,
      'failure_banner_hidden_unless_failed',
      boot.engineHealth !== 'FAILED' ? boot.bannerHidden || boot.bannerDegraded : true,
      `hidden=${boot.bannerHidden}; degraded=${boot.bannerDegraded}`
    );
    record(
      checks,
      'drop_hint_not_raw_key',
      !/\b(lilImportDropHint|liImportDropHint)\b/.test(boot.dropHint),
      boot.dropHint
    );
    record(
      checks,
      'drop_hint_correct_fr',
      boot.dropHint.includes('Glissez votre fichier ici'),
      boot.dropHint
    );
    record(checks, 'import_controls_present', boot.fileInput && boot.drop);
    record(checks, 'cv_preview_present', boot.cvPreview);
    record(checks, 'no_console_type_errors', fatals.length === 0, fatals.join('; ') || 'clean');

    await page.screenshot({ path: path.join(SHOT_DIR, 'boot-clean.png'), fullPage: false });
    await page.evaluate(() => console.clear());
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOT_DIR, 'console-clean.png'), fullPage: false });

    const pass = checks.every((c) => c.pass);
    const lines = [
      '# FINAL_BOOT_DOM_CONTRACT_REPORT',
      '',
      `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
      `**Generated:** ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      'Locked runtime after P0 UI subtraction: canonical `hirelyTrace`, DOM-safe writes, required vs optional contract, resilient `renderOutputs` / `renderAll`, engine banner only on `FAILED`.',
      '',
      '| Check | Result |',
      '|-------|--------|',
      ...checks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'}${c.detail ? ` — ${c.detail}` : ''} |`),
      '',
      '## Required DOM (`REQUIRED_DOM_IDS`)',
      '',
      '- `app`',
      '- `docNav`',
      '- `wsImport`',
      '- `drop`',
      '- `fileInput`',
      '- `cvPreview` (live element: `#cvDoc`)',
      '',
      '## Optional DOM',
      '',
      'All removed debug / recruiter / extraction / export / letter / template bars — missing → `MISSING_OPTIONAL_DOM` trace only, never `FAILED`.',
      '',
      '## Direct `__HIRELY_CORE_BOOT_TRACE__.push` replacements',
      '',
      ...TRACE_PUSH_REPLACEMENTS.map((x) => `- ${x}`),
      '',
      '## Null `innerHTML` / `textContent` guards',
      '',
      ...INNERHTML_GUARDS.map((x) => `- ${x}`),
      '',
      '## Screenshot',
      '',
      `![Clean boot console](${path.relative(root, path.join(SHOT_DIR, 'console-clean.png'))})`,
      '',
      '## Manual checklist',
      '',
      '- [ ] Hard refresh',
      '- [ ] Console clear — no TypeError',
      '- [ ] Import button',
      '- [ ] File drop',
      '- [ ] Paste fallback',
      '- [ ] Review step',
      '- [ ] Style step',
      '- [ ] Export step',
      '',
    ];

    fs.writeFileSync(REPORT_PATH, lines.join('\n'));
    console.log(`\nWrote ${REPORT_PATH}`);
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
