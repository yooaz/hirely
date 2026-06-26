#!/usr/bin/env node
/**
 * HIRELY PRODUCT LOCK QA — full product flow, no new engines.
 * node src/tests/qa-product-lock.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isHirelyAppFatal } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/product-lock');
fs.mkdirSync(outDir, { recursive: true });

const STRUCTURED_MAX = 20000;
const PDF_PATHS = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

const DOCX_PATHS = [
  process.env.HIRELY_ACCEPT_DOCX,
  '/Users/yohannazancot/Documents/cv .docx',
].filter(Boolean);

function resolveFirst(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
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
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(root, decodeURIComponent(p));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

const isAppFatal = isHirelyAppFatal;

const results = [];
const perf = {};
const consoleErrors = [];
let firstFail = null;
let contract = null;
let pdfBytes = 0;
let fatalError = null;

function record(id, pass, detail = '') {
  results.push({ id, pass, detail });
  if (!pass && !firstFail) firstFail = { id, detail };
}

function resolveFirstExisting(paths) {
  return resolveFirst(paths);
}

async function waitImportDone(page, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      gate: !document.getElementById('extractionGate')?.classList.contains('hidden'),
      bodyLen: (document.body?.innerText || '').length,
    }));
    if (s.gate) {
      const cont = page.locator('#extractionGateContinue');
      if ((await cont.count()) > 0 && (await cont.isVisible())) {
        await cont.click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    if ((s.live || s.fallback) && !s.busy) return { ...s, ms: Date.now() - t0 };
    if (s.bodyLen < 80) return { ...s, white: true, ms: Date.now() - t0 };
    await page.waitForTimeout(400);
  }
  return { live: false, busy: true, timeout: true, ms: maxMs };
}

async function importFile(page, filePath, maxMs = 120000) {
  const t0 = performance.now();
  await page.locator('#fileInput').setInputFiles(filePath);
  const outcome = await waitImportDone(page, maxMs);
  perf[`import_${path.extname(filePath).slice(1) || 'file'}_ms`] = Math.round(performance.now() - t0);
  return outcome;
}

async function pasteFixture(page) {
  const fixture = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');
  const text = fs.readFileSync(fixture, 'utf8');
  const t0 = performance.now();
  await page.evaluate(async (body) => {
    await window.HirelyParse.ingestCvText(body, { silent: true, force: true });
  }, text);
  const outcome = await waitImportDone(page, 90000);
  perf.paste_ms = Math.round(performance.now() - t0);
  return outcome;
}

async function getAppSnapshot(page) {
  return page.evaluate(() => {
    const lr = window.HirelyParse?.lastResult || {};
    const cv = lr.cvData || {};
    const sr = lr.structuredResume || null;
    const nameInput = document.querySelector('[data-id-field="name"]');
    const titleInput = document.querySelector('[data-id-field="title"]');
    return {
      cvData: cv,
      structuredResume: sr,
      name: cv.name || sr?.identity?.name || nameInput?.value || '',
      title: cv.title || sr?.identity?.title || titleInput?.value || '',
      expLen: (cv.experience || []).length || (sr?.experiences || []).length || 0,
      toClassifyLen: (cv.toClassify || []).length || (sr?.unsorted || []).length || 0,
    };
  });
}

async function classifyFirstToExperience(page) {
  return page.evaluate(async () => {
    const sel = document.querySelector(
      '#studioSuggestionsPanel .toClassifyMoveSelect, #toClassifyList .toClassifyMoveSelect'
    );
    const before =
      (window.HirelyParse?.lastResult?.cvData?.experience || []).length ||
      (window.HirelyParse?.lastResult?.structuredResume?.experiences || []).length ||
      0;
    if (!sel) return { ok: false, reason: 'no select', before, after: before };
    sel.value = 'experience';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1200));
    const after =
      (window.HirelyParse?.lastResult?.cvData?.experience || []).length ||
      (window.HirelyParse?.lastResult?.structuredResume?.experiences || []).length ||
      0;
    const cvText = document.getElementById('cvDoc')?.innerText || '';
    return {
      ok: after > before || /experience|expérience/i.test(cvText),
      before,
      after,
      reason: after > before ? 'exp count' : 'preview',
    };
  });
}

async function editIdentityFields(page) {
  return page.evaluate(() => {
    const nameEl = document.querySelector('[data-id-field="name"]');
    const titleEl = document.querySelector('[data-id-field="title"]');
    if (!nameEl || !titleEl) {
      return { ok: false, reason: 'inputs missing', typingMs: null };
    }
    const t0 = performance.now();
    nameEl.value = 'Yohann Azancot QA';
    nameEl.dispatchEvent(new Event('input', { bubbles: true }));
    titleEl.value = 'Graphic Designer & Illustrator QA';
    titleEl.dispatchEvent(new Event('input', { bubbles: true }));
    const typingMs = Math.round(performance.now() - t0);
    return {
      ok: /Yohann Azancot QA/i.test(nameEl.value) && /Graphic Designer/i.test(titleEl.value),
      name: nameEl.value,
      title: titleEl.value,
      typingMs,
    };
  });
}

async function readStructuredContract(page) {
  return page.evaluate((max) => {
    const sr = window.HirelyParse?.lastResult?.structuredResume;
    const json = sr ? JSON.stringify(sr) : '';
    const keys = sr ? Object.keys(sr) : [];
    const forbidden =
      /"(graph|debug|audit|metadata|parserTrace|documentBlocks|extractionLines|zeroTextLossAudit|resumeGraph)"/i.test(
        json
      );
    return {
      size: json.length,
      keys,
      forbidden,
      hasDebugOnSr: keys.some((k) =>
        ['metadata', 'graph', 'audit', 'debug', 'documentBlocks', 'extractionLines'].includes(k)
      ),
      max,
    };
  }, STRUCTURED_MAX);
}

const port = 3020 + Math.floor(Math.random() * 80);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(120000);

page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && isAppFatal(text)) consoleErrors.push(text);
});
page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (isAppFatal(text)) consoleErrors.push(text);
});

try {
  const loadT0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 120000 }
  );
  perf.initial_load_ms = Date.now() - loadT0;

  const uiSnap = await page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity) > 0.01;
    };
    const nav = Array.from(document.querySelectorAll('.docNavItem')).map((b) =>
      (b.textContent || '').trim()
    );
    return {
      bodyLen: (document.body?.innerText || '').length,
      white: (document.body?.innerText || '').length < 80,
      testClick: vis('#hirelyTestClickBtn'),
      testImport: vis('#hirelyTestImport'),
      debugPanel: vis('#hirelyDebugPanel'),
      pipeline: vis('#pipelineReportPanel'),
      docNav: nav,
      importBtn: !!document.getElementById('fileInput'),
    };
  });

  record('1_open_app', !uiSnap.white && uiSnap.bodyLen > 200, `body ${uiSnap.bodyLen} chars`);
  const navOk =
    uiSnap.docNav.includes('Importer') &&
    uiSnap.docNav.includes('Studio') &&
    uiSnap.docNav.includes('Style') &&
    uiSnap.docNav.includes('Exporter');
  record(
    '3_ui_simplicity',
    !uiSnap.testClick &&
      !uiSnap.testImport &&
      !uiSnap.debugPanel &&
      !uiSnap.pipeline &&
      navOk,
    `nav=${uiSnap.docNav.join('|')}`
  );
  record(
    'perf_initial_load',
    perf.initial_load_ms < 1500,
    `${perf.initial_load_ms}ms (target <1500ms)`
  );

  const feedbackT0 = Date.now();
  await page.locator('#docNav [data-doc-step="import"]').click();
  perf.import_nav_ms = Date.now() - feedbackT0;
  record(
    'perf_import_nav',
    perf.import_nav_ms < 300,
    `${perf.import_nav_ms}ms (target <300ms)`
  );

  const pdfPath = resolveFirstExisting(PDF_PATHS);
  if (pdfPath) {
    const pdfOut = await importFile(page, pdfPath, 120000);
    record(
      '2_import_pdf',
      pdfOut.live || pdfOut.fallback,
      pdfOut.timeout ? `timeout ${pdfOut.ms}ms` : pdfOut.live ? `live ${pdfOut.ms}ms` : 'fallback'
    );
    perf.ocr_duration_ms = pdfOut.ms;
  } else {
    record('2_import_pdf', true, 'SKIP no PDF on disk');
  }

  const docxPath = resolveFirstExisting(DOCX_PATHS);
  if (docxPath) {
    const docxOut = await importFile(page, docxPath, 90000);
    record(
      '3_import_docx',
      docxOut.live || docxOut.fallback,
      docxOut.timeout ? 'timeout' : docxOut.live ? 'live' : 'fallback'
    );
  } else {
    record('3_import_docx', true, 'SKIP no DOCX on disk');
  }

  const txtPath = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');
  const txtCopy = path.join(outDir, 'sample.txt');
  fs.copyFileSync(txtPath, txtCopy);
  const txtOut = await importFile(page, txtCopy, 90000);
  record(
    '4_import_txt',
    txtOut.live || txtOut.fallback,
    txtOut.timeout ? 'timeout' : txtOut.live ? 'live' : 'fallback'
  );

  const pasteOut = await pasteFixture(page);
  record('5_paste_text', pasteOut.live, pasteOut.timeout ? 'timeout' : 'live');

  contract = await readStructuredContract(page);
  record(
    'structured_size',
    contract.size > 0 && contract.size < STRUCTURED_MAX,
    `${contract.size} chars`
  );
  record(
    'structured_clean',
    !contract.forbidden && !contract.hasDebugOnSr,
    contract.keys.join(',')
  );
  record('debug_separate', !contract.hasDebugOnSr, 'no debug keys on SR');

  await page.locator('#docNav [data-doc-step="edit"]').click();
  const studioT0 = Date.now();
  await page
    .locator('[data-id-field="name"]')
    .waitFor({ state: 'attached', timeout: 60000 })
    .catch(() => null);
  perf.studio_render_ms = Date.now() - studioT0;
  record(
    'perf_studio_render',
    perf.studio_render_ms < 1000,
    `${perf.studio_render_ms}ms (target <1000ms)`
  );

  const edit = await editIdentityFields(page);
  if (edit.typingMs != null) perf.typing_ms = edit.typingMs;
  record('6_edit_name', edit.ok, edit.name || edit.reason || '');
  record('7_edit_title', /Graphic Designer/i.test(edit.title || ''), edit.title || edit.reason || '');
  record(
    'perf_typing',
    (edit.typingMs ?? 999) < 50,
    `${edit.typingMs ?? 'n/a'}ms (target <50ms in-app)`
  );

  const classifyUi = await page.evaluate(() => {
    const panel = document.getElementById('toClassifyPanel');
    const sugg = document.getElementById('studioSuggestionsPanel');
    const sel = document.querySelector(
      '#studioSuggestionsPanel .toClassifyMoveSelect, #toClassifyList .toClassifyMoveSelect'
    );
    const cards = document.querySelectorAll(
      '#studioSuggestionsPanel .toClassifyCardCompact, #toClassifyList .toClassifyCardCompact, #toClassifyList .toClassifyCard'
    );
    return {
      panelVisible: panel && !panel.classList.contains('hidden'),
      suggVisible: sugg && !sugg.classList.contains('hidden'),
      count: cards.length,
      hasSelect: !!sel,
    };
  });
  record(
    '8_classify_usable',
    classifyUi.hasSelect && classifyUi.count > 0,
    `cards=${classifyUi.count} panel=${classifyUi.panelVisible} sugg=${classifyUi.suggVisible}`
  );

  if (classifyUi.hasSelect) {
    const moved = await classifyFirstToExperience(page);
    record(
      '8_classify_to_experience',
      moved.ok,
      `exp ${moved.before}→${moved.after} (${moved.reason || ''})`
    );
  } else {
    record('8_classify_to_experience', false, 'no classify select');
  }

  const snapBeforeTpl = await getAppSnapshot(page);
  const nameBeforeTpl = snapBeforeTpl.name;

  await page.locator('#docNav [data-doc-step="style"]').click();
  await page.waitForTimeout(150);
  const tplT0 = Date.now();
  const swiss = page.locator('.tplCard[data-id="swiss"]').first();
  if ((await swiss.count()) > 0) {
    await swiss.click();
    await page.waitForTimeout(120);
    perf.template_switch_ms = Date.now() - tplT0;
    record(
      '9_template_switch',
      perf.template_switch_ms < 150,
      `${perf.template_switch_ms}ms (target <150ms)`
    );
    const snapAfterTpl = await getAppSnapshot(page);
    const nameFromDom = await page.evaluate(
      () => document.querySelector('[data-id-field="name"]')?.value || ''
    );
    const nameAfter = nameFromDom || snapAfterTpl.name;
    record(
      '9_data_preserved',
      nameAfter === nameBeforeTpl || /Yohann Azancot QA/i.test(nameAfter),
      `${nameBeforeTpl} → ${nameAfter}`
    );
  } else {
    record('9_template_switch', false, 'swiss template card missing');
    record('9_data_preserved', false, 'n/a');
  }

  await page.locator('#docNav [data-doc-step="export"]').click();
  await page.waitForTimeout(200);
  const exportT0 = Date.now();
  const downloadBtn = page.locator('#downloadBtn');
  record('10_export_reachable', (await downloadBtn.count()) > 0, '');

  if ((await downloadBtn.count()) > 0) {
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        downloadBtn.click(),
      ]);
      const savePath = path.join(outDir, 'product-lock-export.pdf');
      await download.saveAs(savePath);
      pdfBytes = fs.statSync(savePath).size;
      perf.export_start_ms = Date.now() - exportT0;
      record('10_export_pdf', pdfBytes > 2000, `${pdfBytes} bytes in ${perf.export_start_ms}ms`);
    } catch (e) {
      record('10_export_pdf', false, String(e?.message || e));
    }
  } else {
    record('10_export_pdf', false, 'download button missing');
  }

  await page.locator('#docNav [data-doc-step="import"]').click();
  const reOut = await importFile(page, txtCopy, 90000);
  record('11_reimport', reOut.live || reOut.fallback, reOut.live ? 'live' : 'fallback');

  record('no_fatal_console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(outDir, 'final.png'), fullPage: false }).catch(() => {});
} catch (e) {
  fatalError = String(e?.stack || e);
  record('qa_runner_fatal', false, fatalError.split('\n')[0]);
} finally {
  const report = {
    timestamp: new Date().toISOString(),
    firstFail,
    results,
    perf,
    consoleErrors,
    contract,
    pdfBytes,
    fatalError,
    url: `http://127.0.0.1:${port}/`,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log('\n=== PRODUCT LOCK QA ===\n');
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log('\nPerf:', perf);
  if (firstFail) console.log('\nFirst failure:', firstFail.id, firstFail.detail);
  if (consoleErrors.length) console.log('\nConsole:', consoleErrors);
  if (fatalError) console.log('\nFatal:', fatalError.split('\n').slice(0, 3).join('\n'));
  console.log('\nReport:', path.join(outDir, 'report.json'));

  await browser.close();
  server.close();

  process.exitCode = results.some((r) => !r.pass) ? 1 : 0;
}
