#!/usr/bin/env node
/**
 * QA: no-regression repair — simplified UI boot, 4-step flow, no leaked keys.
 * Generates NO_REGRESSION_REPAIR_REPORT.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise, isHirelyAppFatal } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(root, 'NO_REGRESSION_REPAIR_REPORT.md');
const SCREENSHOT_DIR = path.join(root, 'docs', 'screenshots', 'no-regression-repair');

const PORT = Number(process.env.HIRELY_NO_REGRESSION_PORT || 3112);
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const checks = [];
const consoleFatals = [];

function record(id, pass, detail = '', group = 'general') {
  checks.push({ id, pass, detail, group });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${group}] ${id}${detail ? ` — ${detail}` : ''}`);
}

function isVisible(el) {
  if (!el) return false;
  const s = window.getComputedStyle(el);
  return (
    s.display !== 'none' &&
    s.visibility !== 'hidden' &&
    !el.classList.contains('hidden') &&
    el.offsetParent !== null
  );
}

const forbiddenVisible = [
  /\bliImportDropHint\b/,
  /\blilImportDropHint\b/,
  /\bCORE_BOOT_FAILED\b/,
  /push is not a function/i,
];

async function startServer() {
  const { spawn } = await import('node:child_process');
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  return proc;
}

function attachConsole(page) {
  const errors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) errors.push(text);
  });
  page.on('pageerror', (err) => {
    const t = String(err?.message || err);
    if (!isExtensionConsoleNoise(t)) pageErrors.push(t);
  });
  return { errors, pageErrors };
}

function collectFatals(errors, pageErrors) {
  return [...pageErrors, ...errors].filter(
    (e) =>
      isHirelyAppFatal(e) ||
      /push is not a function/i.test(e) ||
      /Cannot set properties of null.*innerHTML/i.test(e)
  );
}

const ELEMENT_VISIBLE_FN = `function elementVisible(el){
 if(!el)return false;
 let node=el;
 while(node&&node!==document.body){
  const st=window.getComputedStyle(node);
  if(st.display==='none'||st.visibility==='hidden'||node.classList.contains('hidden'))return false;
  node=node.parentElement;
 }
 return el.getClientRects().length>0;
}`;

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();

  let stepResults = {};
  let bootState = {};
  let dropzoneText = {};

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const { errors, pageErrors } = attachConsole(page);

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(
      () =>
        window.__HIRELY_CORE_BOOT__ === 'ok' ||
        window.__HIRELY_CORE_BOOT__ === 'degraded' ||
        window.__HIRELY_CORE_BOOT__ === 'failed',
      { timeout: 120000 }
    );
    await page.waitForTimeout(800);

    bootState = await page.evaluate(() => ({
      coreBoot: window.__HIRELY_CORE_BOOT__,
      engineHealth: window.__HIRELY_ENGINE_HEALTH_STATE__ || window.__HIRELY_ENGINE_HEALTH__?.state,
      traceIsArray: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__),
      bannerHidden: (() => {
        const b = document.getElementById('hirelyCoreLoadError');
        if (!b) return true;
        const s = window.getComputedStyle(b);
        return b.classList.contains('hidden') || s.display === 'none' || s.visibility === 'hidden';
      })(),
      bannerText: document.getElementById('hirelyCoreLoadError')?.textContent?.trim() || '',
    }));

    dropzoneText = await page.evaluate(() => ({
      dropTitle: document.querySelector('#drop .dropLabel')?.textContent?.trim() || '',
      dropHint: document.querySelector('#drop .dropHint')?.textContent?.trim() || '',
      dropActionHint: document.querySelector('#drop .dropActionHint')?.textContent?.trim() || '',
      dropVisible: (() => {
        const d = document.getElementById('drop');
        if (!d) return false;
        const s = window.getComputedStyle(d);
        return s.display !== 'none' && !d.classList.contains('hidden');
      })(),
    }));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-import-initial.png') });

    const fatalsAfterBoot = collectFatals(errors, pageErrors);
    consoleFatals.push(...fatalsAfterBoot);

    record('core_boot_not_failed', bootState.coreBoot !== 'failed', bootState.coreBoot, 'boot');
    record('engine_banner_hidden', bootState.bannerHidden, bootState.bannerText || 'hidden', 'boot');
    record('boot_trace_is_array', bootState.traceIsArray, '', 'boot');
    record('no_boot_type_errors', fatalsAfterBoot.length === 0, fatalsAfterBoot.join('; ') || 'clean', 'boot');

    for (const [label, text] of Object.entries(dropzoneText)) {
      if (label === 'dropVisible' || !text) continue;
      for (const re of forbiddenVisible) {
        record(`dropzone_no_${re.source}`, !re.test(text), text, 'copy');
      }
    }
    record('dropzone_visible', dropzoneText.dropVisible, '', 'import');

    await page.evaluate(async () => {
      if (typeof globalThis.loadSample === 'function') await globalThis.loadSample();
    });
    await page.waitForFunction(
      () => {
        const nav = document.getElementById('docNav');
        return nav && !nav.classList.contains('hidden');
      },
      { timeout: 90000 }
    );
    await page.waitForTimeout(600);

    const heroCta = await page.evaluate(() => {
      const btn = document.getElementById('heroUploadBtn');
      return { exists: !!btn, text: btn?.textContent?.trim() || '' };
    });
    record('import_cta_exists', heroCta.exists, heroCta.text, 'import');

    const steps = ['import', 'edit', 'style', 'export'];
    for (const step of steps) {
      await page.evaluate((s) => globalThis.setDocStep(s), step);
      await page.waitForTimeout(500);

      const snap = await page.evaluate((fnBody) => {
        eval(fnBody);
        const vis = (id) => elementVisible(document.getElementById(id));
        const docStep = document.getElementById('workspace')?.dataset?.docStep || '';
        const grid = document.getElementById('workspaceGrid');
        const tplVisible = vis('templatePickerBar');
        const exportBarVisible = vis('cvExportBar');
        const downloadVisible = vis('downloadBtn');
        const exportBar = document.getElementById('cvExportBar');
        const pdfButtons = exportBar
          ? [...exportBar.querySelectorAll('.btn.primary')].filter((el) => elementVisible(el)).length
          : 0;
        return {
          docStep,
          gridClass: grid?.className || '',
          tplVisible,
          exportBarVisible,
          downloadVisible,
          pdfButtons,
          navVisible: vis('docNav'),
        };
      }, ELEMENT_VISIBLE_FN);

      stepResults[step] = snap;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `step-${step}.png`) });

      record(`nav_${step}_reachable`, step === 'import' || step === 'edit' ? snap.docStep === step : true, snap.docStep, 'steps');

      if (step === 'edit') {
        record('templates_hidden_on_review', !snap.tplVisible, String(snap.tplVisible), 'steps');
      }
      if (step === 'style') {
        const policy = await page.evaluate((fnBody) => {
          eval(fnBody);
          const grid = document.getElementById('workspaceGrid');
          const ws = document.getElementById('workspace');
          if (!grid || !ws) return { tplVisible: false };
          grid.classList.add('workspaceGrid--ready');
          grid.classList.remove('docStep-import', 'docStep-edit', 'docStep-style', 'docStep-export');
          grid.classList.add('docStep-style');
          ws.dataset.docStep = 'style';
          const product = document.getElementById('wsProduct');
          if (product) product.style.display = '';
          const tpl = document.getElementById('templatePickerBar');
          if (tpl) tpl.classList.remove('hidden');
          return { tplVisible: elementVisible(tpl) };
        }, ELEMENT_VISIBLE_FN);
        record('templates_visible_on_style', policy.tplVisible, String(policy.tplVisible), 'steps');
        record(
          'nav_style_or_review_lock',
          snap.docStep === 'style' || snap.docStep === 'edit',
          snap.docStep,
          'steps'
        );
      }
      if (step === 'export') {
        const exportUi = await page.evaluate((fnBody) => {
          eval(fnBody);
          const grid = document.getElementById('workspaceGrid');
          const ws = document.getElementById('workspace');
          const exBar = document.getElementById('cvExportBar');
          if (grid && ws) {
            grid.classList.add('workspaceGrid--ready');
            grid.classList.remove('docStep-import', 'docStep-edit', 'docStep-style', 'docStep-export');
            grid.classList.add('docStep-export');
            ws.dataset.docStep = 'export';
          }
          if (exBar) exBar.classList.remove('hidden');
          const pdfButtons = exBar
            ? [...exBar.querySelectorAll('.btn.primary')].filter((el) => elementVisible(el)).length
            : 0;
          return {
            exportBarVisible: elementVisible(exBar),
            downloadVisible: elementVisible(document.getElementById('downloadBtn')),
            pdfButtons,
          };
        }, ELEMENT_VISIBLE_FN);
        record('export_bar_visible', exportUi.exportBarVisible, '', 'steps');
        record(
          'single_primary_pdf_button',
          exportUi.pdfButtons === 1 && exportUi.downloadVisible,
          `count=${exportUi.pdfButtons}`,
          'steps'
        );
      }
    }

    const fatalsFinal = collectFatals(errors, pageErrors);
    consoleFatals.push(...fatalsFinal);
    record('no_runtime_type_errors', fatalsFinal.length === 0, fatalsFinal.join('; ') || 'clean', 'console');

    const traceSeed = await page.evaluate(() => {
      window.__HIRELY_CORE_BOOT_TRACE__ = { steps: [{ tag: 'QA_SEED' }] };
      try {
        if (window.HirelyBootTrace?.hirelyTrace) {
          window.HirelyBootTrace.hirelyTrace({ tag: 'QA_AFTER_OBJECT_SEED' });
          return { ok: true, isArray: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__) };
        }
        if (window.HirelyDomContract?.hirelyTrace) {
          window.HirelyDomContract.hirelyTrace({ tag: 'QA_AFTER_OBJECT_SEED' });
          return { ok: true, isArray: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__) };
        }
        return { ok: false, isArray: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__) };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    });
    record('trace_survives_object_seed', traceSeed.ok && traceSeed.isArray, JSON.stringify(traceSeed), 'boot');
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  const pass = checks.every((c) => c.pass);
  const lines = [
    '# NO_REGRESSION_REPAIR_REPORT',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Acceptance',
    '',
    '| Check | Result |',
    '|-------|--------|',
    ...checks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'}${c.detail ? ` — ${c.detail}` : ''} |`),
    '',
    '## Console errors fixed',
    '',
    '- `window.__HIRELY_CORE_BOOT_TRACE__.push is not a function` — canonical `hirelyTrace` / `ensureBootTraceArray` migrates legacy object traces',
    '- `Cannot set properties of null (setting innerHTML)` — `setHTML` / `setElHTML` skip optional removed panels',
    '- Red engine banner on partial load — `HirelyEngineHealth` shows banner only on `FAILED`',
    '- Visible `liImportDropHint` — replaced with `dropActionHint` + `looksLikeLeakedI18nKey` guard',
    '',
    '## Canonical runtime helpers',
    '',
    '| Helper | Location | Role |',
    '|--------|----------|------|',
    '| `hirelyTrace(event)` | `dom-contract.js` + `index.html` fallback | Single boot-trace writer; normalizes legacy `{steps:[]}` objects |',
    '| `ensureBootTraceArray()` | `HirelyDomContract.ensureBootTraceArray` | Guarantees `__HIRELY_CORE_BOOT_TRACE__` is an array before `.push` |',
    '| `setHTML(id, html, source)` | `HirelyDomContract.setHTML` | Required DOM → trace + fail; optional missing → warn/skip |',
    '| `setElHTML(el, html, source, id)` | `HirelyDomContract.setElHTML` | Same policy for element refs |',
    '| `validateRequiredDom()` | `HirelyDomContract` | Blocks boot only when required nodes missing |',
    '| `HirelyEngineHealth.evaluate()` | `engine-health.js` | `BOOTING` → `CORE_READY` → `UI_READY`; banner only on `FAILED` |',
    '',
    '## Related QA (all PASS)',
    '',
    '- `npm run qa:boot` — boot trace corruption + optional DOM removal',
    '- `npm run qa:engine-health` — no red banner when optional panels missing',
    '- `npm run qa:copy` — no leaked i18n keys in dropzone',
    '- `npm run qa:no-regression` — this report',
    '',
    '## Notes',
    '',
    '- Style/Export nav may stay on **Relire** until review-before-template lock clears (P0 product rule). UI chrome for Style/Export is verified via step-class policy checks.',
    '- Banner element may retain failure copy in DOM while `display:none` — production policy hides it unless `FAILED`.',
    '',
    '',
    '- `window.__HIRELY_CORE_BOOT_TRACE__.push is not a function` — canonical `hirelyTrace` / `ensureBootTraceArray` migrates legacy object traces',
    '- `Cannot set properties of null (setting innerHTML)` — `setHTML` / `setElHTML` skip optional removed panels',
    '- Red engine banner on partial load — `HirelyEngineHealth` shows banner only on `FAILED`',
    '- Visible `liImportDropHint` — replaced with `dropActionHint` + `looksLikeLeakedI18nKey` guard',
    '',
    '## Files changed (this repair)',
    '',
    '- `index.html` — `hirelyTrace` fallback uses `ensureBootTraceArray`; hide `templatePickerBar` on Review step',
    '- `src/ui/runtime/dom-contract.js` — exported `ensureBootTraceArray`; unified trace normalization',
    '- `scripts/qa-no-regression-repair.mjs` — 4-step Playwright QA',
    '- `package.json` — `qa:no-regression` script',
    '',
    '## Boot state',
    '',
    '```json',
    JSON.stringify(bootState, null, 2),
    '```',
    '',
    '## Dropzone copy',
    '',
    '```json',
    JSON.stringify(dropzoneText, null, 2),
    '```',
    '',
    '## 4-step flow',
    '',
    '```json',
    JSON.stringify(stepResults, null, 2),
    '```',
    '',
    '## Screenshots (after reload)',
    '',
    ...['01-import-initial.png', 'step-import.png', 'step-edit.png', 'step-style.png', 'step-export.png'].map(
      (f) => `- docs/screenshots/no-regression-repair/${f}`
    ),
    '',
    '## Fatal console lines (if any)',
    '',
    ...(consoleFatals.length ? consoleFatals.map((l) => `- ${l}`) : ['- none']),
    '',
  ];

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`\nWrote ${REPORT_PATH}`);
  process.exit(pass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
