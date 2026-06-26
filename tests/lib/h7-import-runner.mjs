/**
 * H7 import stability — shared node + browser runners.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { canonicalImportFromFile } from '../../src/core/import/canonical-import.js';
import { runHirelyImportFromFile } from '../../src/core/pipeline/hirely-import.js';
import { IMPORT_STATE } from '../../src/core/import/import-status.js';
import {
  H7_TERMINAL_STATES,
  defaultFixturePaths,
  makeNodeFile,
} from './h7-import-catalog.mjs';
import { isExtensionConsoleNoise } from './qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.bin': 'application/octet-stream',
    }[ext] || 'application/octet-stream'
  );
}

export function ensureH7Fixtures(root) {
  const outDir = path.join(root, 'tests/output/h7-import');
  fs.mkdirSync(outDir, { recursive: true });

  const fixtures = defaultFixturePaths(root);
  if (!fs.existsSync(fixtures.unsupported)) {
    fs.writeFileSync(fixtures.unsupported, 'not-a-cv-format');
  }

  const largePath = path.join(outDir, 'large-repeated.pdf');
  if (!fixtures.pdf) {
    return { ...fixtures, large: null, scanned: null, corrupt: null };
  }

  if (!fs.existsSync(largePath)) {
    const src = fs.readFileSync(fixtures.pdf);
    const repeats = 12;
    const chunks = Array(repeats).fill(src);
    fs.writeFileSync(largePath, Buffer.concat(chunks));
  }

  const scannedPath = path.join(outDir, 'blank-page.pdf');
  if (!fs.existsSync(scannedPath)) {
    const blank = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Root 1 0 R>>\n%%EOF\n'
    );
    fs.writeFileSync(scannedPath, blank);
  }

  const corruptPath = path.join(outDir, 'corrupt.pdf');
  if (!fs.existsSync(corruptPath)) {
    fs.writeFileSync(corruptPath, '%PDF-1.4\n% corrupt\n');
  }

  return {
    ...fixtures,
    large: largePath,
    scanned: scannedPath,
    corrupt: corruptPath,
  };
}

function classifyOutcome({ crashed, threw, importState, importStatus, busy, hasUi }) {
  if (crashed || threw) return { pass: false, risk: 'CRASH', note: threw || 'uncaught rejection' };
  const state = importState || importStatus || '';
  if (state && !H7_TERMINAL_STATES.has(state) && !/^IMPORT_/.test(state)) {
    return { pass: false, risk: 'UNKNOWN_STATE', note: state };
  }
  if (busy) return { pass: false, risk: 'STUCK_LOADING', note: 'loading never cleared' };
  return { pass: true, risk: 'NONE', note: hasUi ? 'terminal UI outcome' : 'terminal import state' };
}

/** @returns {Promise<object>} */
export async function runNodeImportScenario(root, kind, fixtures) {
  let file;
  let label = kind;
  try {
    if (kind === 'corrupt_pdf') {
      const buf = fs.readFileSync(fixtures.corrupt);
      file = makeNodeFile(buf, 'corrupt.pdf', 'application/pdf');
    } else if (kind === 'pdf_scanned') {
      const buf = fs.readFileSync(fixtures.scanned);
      file = makeNodeFile(buf, 'blank-scan.pdf', 'application/pdf');
    } else if (kind === 'pdf_large') {
      const buf = fs.readFileSync(fixtures.large);
      file = makeNodeFile(buf, 'large.pdf', 'application/pdf');
      label = `large (${buf.length} bytes)`;
    } else if (kind === 'pdf') {
      const buf = fs.readFileSync(fixtures.pdf);
      file = makeNodeFile(buf, path.basename(fixtures.pdf), 'application/pdf');
    } else if (kind === 'docx' && fixtures.docx) {
      const buf = fs.readFileSync(fixtures.docx);
      file = makeNodeFile(buf, path.basename(fixtures.docx), mime(fixtures.docx));
    } else if (kind === 'empty_name') {
      file = makeNodeFile(Buffer.from('hello'), '', 'text/plain');
    } else {
      return { kind, label, skipped: true, pass: true, risk: 'SKIP', note: 'fixture missing' };
    }

    const canon = await canonicalImportFromFile(file);
    const hirely = await runHirelyImportFromFile(file);
    const state = canon.importState || hirely.importStatus || IMPORT_STATE.IMPORT_NEEDS_PASTE;
    const rawLen = (canon.rawText || hirely.rawText || '').length;
    const verdict = classifyOutcome({
      crashed: false,
      threw: null,
      importState: state,
      importStatus: hirely.importStatus,
      busy: false,
      hasUi: rawLen > 0 || state !== IMPORT_STATE.IMPORT_READY,
    });
    return {
      kind,
      label,
      skipped: false,
      pass: verdict.pass,
      risk: verdict.risk,
      note: verdict.note,
      importState: state,
      importStatus: hirely.importStatus,
      rawLen,
      errors: [...(canon.errors || []), ...(hirely.errors || [])].slice(0, 4),
    };
  } catch (err) {
    return {
      kind,
      label,
      skipped: false,
      pass: false,
      risk: 'CRASH',
      note: String(err?.message || err),
      importState: '',
      rawLen: 0,
      errors: [String(err?.message || err)],
    };
  }
}

function startStaticServer(root, port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const rel = u === '/' ? '/index.html' : u;
    const fp = path.join(root, decodeURIComponent(rel));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  }).listen(port);
}

async function waitForImportOutcome(page, timeout = 300000) {
  await page
    .waitForFunction(
      () => {
        const doc = document.querySelector('#cvDoc');
        const live = doc?.classList.contains('cv--live') && (doc?.innerHTML?.length || 0) > 300;
        const paste = document.getElementById('rawDetails')?.open;
        const alert = document.getElementById('extractionAlert')?.classList.contains('show');
        const busy = document.getElementById('wsImport')?.classList.contains('wsImport--loading');
        return !busy && (live || paste || alert);
      },
      { timeout }
    )
    .catch(() => {});
}

async function triggerBrowserImport(page, { method, filePath, viewport }) {
  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (e) => {
    const text = String(e?.message || e).slice(0, 200);
    if (!isExtensionConsoleNoise(text)) pageErrors.push(text);
  };
  const onConsole = (m) => {
    const text = m.text();
    if (m.type() === 'error' && !isExtensionConsoleNoise(text) && !/favicon|404|structure-cv/i.test(text)) {
      consoleErrors.push(text.slice(0, 180));
    }
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  if (viewport) await page.setViewportSize(viewport);

  let returned;
  if (method === 'null') {
    returned = await page.evaluate(async () => {
      try {
        return await window.HirelyParse.handleFileImport(null, 'click');
      } catch (e) {
        return { error: String(e?.message || e) };
      }
    });
  } else if (method === 'drop' && filePath) {
    const name = path.basename(filePath);
    const b64 = fs.readFileSync(filePath).toString('base64');
    const type = mime(filePath);
    await page.evaluate(
      ({ name, type, b64 }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], name, { type }));
        document.getElementById('drop').dispatchEvent(
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
        );
      },
      { name, type, b64 }
    );
  } else if (filePath) {
    await page.locator('#fileInput').setInputFiles(filePath);
  }

  await waitForImportOutcome(page);
  await page.waitForTimeout(350);

  const snap = await page.evaluate(() => ({
    busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
    cvLen: document.querySelector('#cvDoc')?.innerHTML?.length || 0,
    live: document.querySelector('#cvDoc')?.classList.contains('cv--live'),
    pasteOpen: !!document.getElementById('rawDetails')?.open,
    alert: document.getElementById('extractionAlert')?.classList.contains('show'),
    lastStatus: window.state?.lastImportStatus || '',
  }));

  page.off('pageerror', onPageError);
  page.off('console', onConsole);

  const hasUi = snap.live || snap.pasteOpen || snap.alert || snap.cvLen > 0;
  const threw = pageErrors[0] || null;
  const verdict = classifyOutcome({
    crashed: !!threw,
    threw,
    importState: returned || snap.lastStatus,
    busy: snap.busy,
    hasUi: method === 'null' ? snap.pasteOpen || snap.alert : hasUi,
  });

  return {
    ...snap,
    returned,
    pageErrors,
    consoleErrors,
    pass: verdict.pass && pageErrors.length === 0,
    risk: pageErrors.length ? 'PAGE_CRASH' : verdict.risk,
    note: pageErrors[0] || verdict.note,
  };
}

/** @returns {Promise<object[]>} */
export async function runBrowserImportScenarios(root, scenarios, fixtures) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return scenarios.map((s) => ({
      scenario: s,
      skipped: true,
      pass: true,
      risk: 'SKIP',
      note: 'playwright not installed',
    }));
  }

  const port = 3700 + Math.floor(Math.random() * 200);
  const server = startStaticServer(root, port);
  await new Promise((r) => server.once('listening', r));

  const rows = [];
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);
    await page.addInitScript(() => {
      window.HIRELY_IMPORT_TIMEOUT_MS = 300000;
    });

    const fileFor = (kind) => {
      if (kind === 'pdf' || kind === 'pdf_large') return kind === 'pdf_large' ? fixtures.large : fixtures.pdf;
      if (kind === 'docx') return fixtures.docx;
      if (kind === 'unsupported') return fixtures.unsupported;
      return null;
    };

    for (const scenario of scenarios) {
      if (scenario.channel !== 'browser' && !scenario.channel.includes('browser')) {
        continue;
      }
      const fp = fileFor(scenario.kind);
      if (scenario.kind !== 'none' && !fp && scenario.method !== 'null') {
        rows.push({ scenario, skipped: true, pass: true, risk: 'SKIP', note: 'fixture missing' });
        continue;
      }

      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');

      const viewport =
        scenario.method === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 };
      const method = scenario.method === 'mobile' ? 'click' : scenario.method;

      const result = await triggerBrowserImport(page, {
        method,
        filePath: fp,
        viewport: scenario.method === 'mobile' ? viewport : null,
      });
      rows.push({ scenario, skipped: false, ...result });
    }

    await browser.close();
  } finally {
    server.close();
  }
  return rows;
}

export function summarizeRows(nodeRows, browserRows) {
  const all = [
    ...nodeRows.map((r) => ({ id: r.kind, label: r.label, channel: 'node', ...r })),
    ...browserRows.map((r) => ({
      id: r.scenario?.id,
      label: r.scenario?.label,
      channel: 'browser',
      ...r,
    })),
  ];
  const passCount = all.filter((r) => r.pass && !r.skipped).length;
  const failCount = all.filter((r) => !r.pass && !r.skipped).length;
  const skipCount = all.filter((r) => r.skipped).length;
  const crashRisks = all.filter((r) => /CRASH|STUCK/.test(r.risk));
  return { all, passCount, failCount, skipCount, crashRisks, total: all.length };
}
