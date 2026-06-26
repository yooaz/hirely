#!/usr/bin/env node
/**
 * HIRELY boot safety regression — trace corruption seeds + optional DOM removal.
 * Generates BOOT_REGRESSION_TEST_REPORT.md
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise, isHirelyAppFatal } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'BOOT_REGRESSION_TEST_REPORT.md');
const PORT = Number(process.env.HIRELY_BOOT_REGRESSION_PORT || 3015);
const BOOT_WAIT_MS = Number(process.env.HIRELY_BOOT_REGRESSION_WAIT_MS || 6000);

/** @type {{ id: string, group: string, pass: boolean, detail: string }[]} */
const checks = [];

function record(id, pass, detail = '', group = 'general') {
  checks.push({ id, pass, detail, group });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${group}] ${id}${detail ? ` — ${detail}` : ''}`);
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
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let fp = path.join(ROOT, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(fp, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(fp) });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/** @returns {Promise<{ logs: string[], errors: string[], pageErrors: string[] }>} */
function attachConsole(page) {
  const logs = [];
  const errors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    logs.push(text);
    if (msg.type() === 'error' && isExtensionConsoleNoise(text) === false) errors.push(text);
  });
  page.on('pageerror', (err) => {
    const t = String(err?.message || err);
    if (!isExtensionConsoleNoise(t)) pageErrors.push(t);
  });
  return { logs, errors, pageErrors };
}

function collectFatals(errors, pageErrors) {
  return [...pageErrors, ...errors].filter(
    (e) =>
      isHirelyAppFatal(e) ||
      /push is not a function/i.test(e) ||
      /Cannot set properties of null.*innerHTML/i.test(e) ||
      /RENDER_ALL_INIT_FAILED/i.test(e)
  );
}

/**
 * @param {import('playwright').Browser} browser
 * @param {{ seed: unknown, seedMode: 'undefined' | 'value', caseId: string, group: string, query?: string }} opts
 */
async function runTraceSeedScenario(browser, opts) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { logs, errors, pageErrors } = attachConsole(page);

  if (opts.seedMode === 'undefined') {
    await page.addInitScript(() => {
      delete window.__HIRELY_CORE_BOOT_TRACE__;
    });
  } else {
    await page.addInitScript((val) => {
      window.__HIRELY_CORE_BOOT_TRACE__ = val;
    }, opts.seed);
  }

  const qs = opts.query ? `?${opts.query}` : '';
  await page.goto(`http://127.0.0.1:${PORT}/index.html${qs}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.waitForTimeout(BOOT_WAIT_MS);

  const state = await page.evaluate(() => {
    let tracePushOk = false;
    try {
      if (typeof window.HirelyBootTrace?.hirelyTrace === 'function') {
        window.HirelyBootTrace.hirelyTrace({ qaProbe: true });
        tracePushOk = true;
      } else if (Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__)) {
        window.__HIRELY_CORE_BOOT_TRACE__.push({ qaProbe: true });
        tracePushOk = true;
      }
    } catch {
      tracePushOk = false;
    }
    const trace = Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__) ? window.__HIRELY_CORE_BOOT_TRACE__ : [];
    const bootOrder = window.__hirelyBootOrder || [];
    const coreImportOk =
      trace.some((t) => t && t.tag === 'CORE_IMPORT_OK' && t.status === 'ok') ||
      bootOrder.includes('CORE_BOOT_OK');
    return {
      coreBoot: window.__HIRELY_CORE_BOOT__,
      traceIsArray: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__),
      traceLen: Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__)
        ? window.__HIRELY_CORE_BOOT_TRACE__.length
        : -1,
      tracePushOk,
      coreStatusLoaded: window.__HIRELY_CORE_STATUS__?.loaded === true,
      coreImportOk,
    };
  });

  const fatals = collectFatals(errors, pageErrors);
  const coreOk = state.coreBoot === 'ok' || state.coreBoot === 'degraded';

  record(`${opts.caseId}_app_boots`, coreOk, state.coreBoot, opts.group);
  record(`${opts.caseId}_trace_is_array`, state.traceIsArray, String(state.traceLen), opts.group);
  record(`${opts.caseId}_trace_push_safe`, state.tracePushOk, '', opts.group);
  record(`${opts.caseId}_no_type_error`, fatals.length === 0, fatals.join('; ') || 'clean', opts.group);
  record(`${opts.caseId}_no_core_boot_failed`, state.coreBoot !== 'failed', state.coreBoot, opts.group);
  record(
    `${opts.caseId}_core_boot_ok_marker`,
    state.coreImportOk,
    'trace CORE_IMPORT_OK or bootOrder CORE_BOOT_OK',
    opts.group
  );

  await context.close();
  return { state, fatals, logs };
}

/**
 * @param {import('playwright').Browser} browser
 */
async function runOptionalDomScenario(browser) {
  const group = 'optional_dom';
  const context = await browser.newContext();
  const page = await context.newPage();
  const { logs, errors, pageErrors } = attachConsole(page);

  await page.goto(`http://127.0.0.1:${PORT}/index.html?debug=1`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.waitForTimeout(BOOT_WAIT_MS);

  const pre = await page.evaluate(() => {
    const optionalIds = [
      'auditPanelInner',
      'linkedinText',
      'letterText',
      'auditPanel',
      'linkedinPanel',
      'letterPanel',
    ];
    const removedDebugIds = ['auditPanelInner', 'linkedinText', 'letterText'];
    const optionalMissing = optionalIds.filter((id) => !document.getElementById(id));
    const debugRemoved = removedDebugIds.every((id) => !document.getElementById(id));
    const required = {
      app: !!document.getElementById('app'),
      wsImport: !!document.getElementById('wsImport'),
      cvDoc: !!document.getElementById('cvDoc'),
      docNav: !!document.getElementById('docNav'),
    };
    return { optionalMissing, debugRemoved, required };
  });

  record(
    'optional_panels_missing',
    pre.optionalMissing.includes('auditPanelInner'),
    pre.optionalMissing.join(', '),
    group
  );
  record('debug_panels_removed', pre.debugRemoved, 'auditPanelInner, linkedinText, letterText', group);
  record(
    'required_dom_present',
    Object.values(pre.required).every(Boolean),
    JSON.stringify(pre.required),
    group
  );

  const invoke = await page.evaluate(async () => {
    const out = {
      renderOutputsOk: false,
      renderAllOk: false,
      renderOutputsError: null,
      renderAllError: null,
      missingDomIds: [],
      missingDomTraceTags: [],
    };
    try {
      if (typeof renderOutputs === 'function') {
        const status = renderOutputs();
        out.renderOutputsStatus = status;
        out.renderOutputsOk = !!(status && Array.isArray(status.skipped) && Array.isArray(status.rendered));
      }
    } catch (e) {
      out.renderOutputsError = String(e?.message || e);
    }
    try {
      if (typeof renderAll === 'function') {
        const boot = renderAll();
        out.renderAllStatus = boot;
        out.renderAllOk = !!(boot && Array.isArray(boot.phases) && boot.phases.every((p) => p.ok));
      }
    } catch (e) {
      out.renderAllError = String(e?.message || e);
    }
    out.missingDomIds = (window.__HIRELY_MISSING_DOM__ || []).map((x) => x.id);
    out.missingDomTraceTags = (window.__HIRELY_CORE_BOOT_TRACE__ || [])
      .filter((s) => s && (s.tag === 'MISSING_DOM_TARGET' || s.tag === 'MISSING_OPTIONAL_DOM'))
      .map((s) => s.id);
    out.coreBoot = window.__HIRELY_CORE_BOOT__;
    out.traceIsArray = Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__);
    out.domContract = !!window.HirelyDomContract;
    out.engineHealth = window.__HIRELY_ENGINE_HEALTH_STATE__ || null;
    const banner = document.getElementById('hirelyCoreLoadError');
    out.failureBannerHidden = !banner || banner.classList.contains('hidden');
    out.failureBannerDegradedOnly =
      !!banner &&
      !banner.classList.contains('hidden') &&
      banner.classList.contains('hirelyCoreLoadError--degraded');
    return out;
  });

  record(
    'render_outputs_returns_status',
    invoke.renderOutputsOk,
    invoke.renderOutputsStatus
      ? `skipped=${invoke.renderOutputsStatus.skipped?.join(',')}`
      : invoke.renderOutputsError || 'missing',
    group
  );
  record(
    'render_outputs_missing_target',
    invoke.renderOutputsOk && !invoke.renderOutputsError,
    invoke.renderOutputsError || 'ok',
    group
  );
  record(
    'render_all_before_optional_panels',
    invoke.renderAllOk && !invoke.renderAllError,
    invoke.renderAllError || 'ok',
    group
  );
  record('dom_contract_loaded', !!invoke.domContract, 'HirelyDomContract', group);
  record(
    'missing_optional_logged_not_fatal',
    invoke.missingDomIds.includes('auditPanelInner') ||
      invoke.missingDomTraceTags.includes('auditPanelInner'),
    `missingDom=${invoke.missingDomIds.join(',')}; trace=${invoke.missingDomTraceTags.join(',')}`,
    group
  );
  record(
    'missing_dom_warnings_only',
    invoke.coreBoot !== 'failed' && invoke.traceIsArray,
    invoke.coreBoot,
    group
  );

  const fatals = collectFatals(errors, pageErrors);
  if (invoke.renderOutputsError) fatals.push(invoke.renderOutputsError);
  if (invoke.renderAllError) fatals.push(invoke.renderAllError);

  record('optional_dom_no_type_error', fatals.length === 0, fatals.join('; ') || 'clean', group);
  record(
    'optional_dom_no_core_boot_failed',
    !logs.some((l) => /CORE_BOOT_FAILED/i.test(l)) &&
      !logs.some((l) => /HIRELY_ENGINE_FAILED/i.test(l)) &&
      invoke.coreBoot !== 'failed',
    invoke.coreBoot,
    group
  );
  record(
    'optional_dom_failure_banner_hidden',
    invoke.engineHealth !== 'FAILED' &&
      (invoke.failureBannerHidden || invoke.failureBannerDegradedOnly),
    `engineHealth=${invoke.engineHealth}; redHidden=${invoke.failureBannerHidden}; degradedOnly=${invoke.failureBannerDegradedOnly}`,
    group
  );
  record(
    'optional_dom_engine_not_failed',
    invoke.engineHealth !== 'FAILED',
    invoke.engineHealth || '—',
    group
  );

  await context.close();
  return { pre, invoke, fatals };
}

function writeReport(allPass) {
  const groups = [...new Set(checks.map((c) => c.group))];
  const lines = [
    '# BOOT Regression Test Report',
    '',
    `**Status:** ${allPass ? 'PASS' : 'FAIL'}`,
    `**Engine:** HIRELY_BOOT_REGRESSION_V1`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    'Automated regression for boot trace corruption seeds and P0-removed optional DOM panels.',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total checks | ${checks.length} |`,
    `| Passed | ${checks.filter((c) => c.pass).length} |`,
    `| Failed | ${checks.filter((c) => !c.pass).length} |`,
    '',
    '## Test cases',
    '',
    '| # | Case | Group |',
    '|---|------|-------|',
    '| 1 | `__HIRELY_CORE_BOOT_TRACE__` undefined | trace_undefined |',
    '| 2 | `__HIRELY_CORE_BOOT_TRACE__` is `{}` | trace_empty_object |',
    '| 3 | `__HIRELY_CORE_BOOT_TRACE__` is string | trace_string |',
    '| 4 | Optional DOM panels missing | optional_dom |',
    '| 5 | Debug panels removed | optional_dom |',
    '| 6 | `renderOutputs()` with missing optional target | optional_dom |',
    '| 7 | `renderAll()` before optional panels exist | optional_dom |',
    '',
    '## Expected behaviour',
    '',
    '- App boots (`CORE_BOOT_OK` or degraded, never failed from trace/DOM)',
    '- No `TypeError` (`push is not a function`, null `innerHTML`)',
    '- No `CORE_BOOT_FAILED` from regression paths',
    '- Missing optional nodes logged via `MISSING_DOM_TARGET` / `__HIRELY_MISSING_DOM__` only',
    '',
    '## Results',
    '',
  ];

  for (const group of groups) {
    lines.push(`### ${group}`, '');
    for (const c of checks.filter((x) => x.group === group)) {
      lines.push(`- [${c.pass ? 'x' : ' '}] **${c.id}**${c.detail ? ` — ${c.detail}` : ''}`);
    }
    lines.push('');
  }

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    lines.push('## Failures', '', ...failed.map((c) => `- \`${c.id}\`: ${c.detail || 'failed'}`), '');
  }

  lines.push('## Run', '', '```bash', 'npm run qa:boot', '```', '');

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    await runTraceSeedScenario(browser, {
      caseId: 'trace_undefined',
      group: 'trace_undefined',
      seedMode: 'undefined',
    });

    await runTraceSeedScenario(browser, {
      caseId: 'trace_empty_object',
      group: 'trace_empty_object',
      seedMode: 'value',
      seed: {},
    });

    await runTraceSeedScenario(browser, {
      caseId: 'trace_string',
      group: 'trace_string',
      seedMode: 'value',
      seed: 'legacy-corrupt-trace-string',
    });

    await runOptionalDomScenario(browser);
  } finally {
    await browser.close();
    server.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeReport(allPass);

  console.log('');
  console.log(allPass ? 'BOOT_REGRESSION PASS' : 'BOOT_REGRESSION FAIL');
  console.log(`Report: ${REPORT_PATH}`);

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('BOOT_REGRESSION_CRASH', err);
  process.exit(1);
});
