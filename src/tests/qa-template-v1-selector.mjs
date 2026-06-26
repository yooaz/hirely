#!/usr/bin/env node
/**
 * HIRELY H3 — Template V1 selector QA (browser)
 * Prerequisite: P7 pass. Verifies 3-template picker, preview swap, PDF per template.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/template-v1-selector');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
let failed = 0;

function record(id, pass, detail = '') {
  results.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error('FAIL', id, detail);
  } else {
    console.log('OK', id, detail);
  }
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
    const fp = path.join(ROOT, decodeURIComponent(p));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function waitImportDone(page, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
    }));
    if (s.live && !s.busy) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

async function pasteFixture(page, text) {
  await page.evaluate(async (body) => {
    await window.HirelyParse.applyCvPipeline(body, {
      source: 'paste-text',
      trusted: true,
      forceContinue: true,
      silent: true,
    });
  }, text);
  return waitImportDone(page, 90000);
}

async function clickDocStep(page, step) {
  const enabled = page.locator(`#docNav .hirelyProgressBtn[data-doc-step="${step}"]:not([disabled])`);
  if ((await enabled.count()) > 0) {
    await enabled.click();
  } else {
    await page.evaluate((s) => {
      if (typeof setDocStep === 'function') setDocStep(s);
    }, step);
  }
  await page.waitForTimeout(300);
}

async function getPickerSnapshot(page) {
  return page.evaluate((expectedNames) => {
    const cards = [...document.querySelectorAll('#templateGrid .tplCard')];
    return {
      count: cards.length,
      ids: cards.map((c) => c.dataset.id),
      names: cards.map((c) => c.querySelector('.tplName')?.textContent?.trim() || ''),
      activeId: cards.find((c) => c.classList.contains('active'))?.dataset?.id || null,
      cvClass: document.getElementById('cvDoc')?.className || '',
      cvName: document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '',
      stateTemplate: window.state?.template || null,
      expectedNames,
    };
  }, PRODUCTION_TEMPLATE_IDS.map((id) => PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]));
}

const pasteText = fs.readFileSync(PASTE_FIXTURE, 'utf8');
const port = 3040 + Math.floor(Math.random() * 60);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.applyCvPipeline === 'function' && window.HirelyTemplates,
    { timeout: 120000 }
  );

  const imported = await pasteFixture(page, pasteText);
  record('import_fixture', imported, imported ? 'live preview' : 'import timeout');

  await clickDocStep(page, 'style');
  await page.waitForTimeout(400);

  const picker0 = await getPickerSnapshot(page);
  record('selector_five_cards', picker0.count === 5, `count=${picker0.count} ids=${picker0.ids.join(',')}`);
  record(
    'selector_canonical_ids',
    PRODUCTION_TEMPLATE_IDS.every((id) => picker0.ids.includes(id)),
    picker0.ids.join(',')
  );
  record(
    'selector_display_names',
    PRODUCTION_TEMPLATE_DISPLAY_NAMES.ats === picker0.names[0] ||
      picker0.names.includes(PRODUCTION_TEMPLATE_DISPLAY_NAMES.ats),
    picker0.names.join(' | ')
  );

  const previewSnapshots = {};
  async function selectTemplateCard(id) {
    const clicked = await page.evaluate((tplId) => {
      const card = document.querySelector(`.tplCard[data-id="${tplId}"]`);
      if (!card) return { ok: false, reason: 'missing' };
      card.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (typeof card.onclick === 'function') {
        card.onclick();
        return { ok: true, mode: 'onclick' };
      }
      card.click();
      return { ok: true, mode: 'native' };
    }, id);
    if (!clicked.ok) throw new Error(`template card ${id}: ${clicked.reason || 'click failed'}`);
    await page.waitForTimeout(400);
    await page.waitForFunction(
      (tplId) => {
        const cv = document.getElementById('cvDoc');
        return cv?.classList.contains(`template-${tplId}`) || cv?.className.includes(`template-${tplId}`);
      },
      id,
      { timeout: 15000 }
    ).catch(() => null);
  }

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const card = page.locator(`.tplCard[data-id="${id}"]`).first();
    record(`${id}_card_visible`, (await card.count()) > 0, id);
    await selectTemplateCard(id);

    const snap = await getPickerSnapshot(page);
    previewSnapshots[id] = snap;
    const tplClassOk = new RegExp(`template-${id.replace('-', '\\-')}`).test(snap.cvClass);
    record(
      `${id}_preview_updates`,
      snap.activeId === id && tplClassOk && snap.cvName.length > 2,
      `active=${snap.activeId} class=${snap.cvClass.slice(0, 72)}`
    );
    record(
      `${id}_same_resume_data`,
      /Yohann/i.test(snap.cvName),
      snap.cvName
    );
  }

  record(
    'preview_differs_by_template',
    PRODUCTION_TEMPLATE_IDS.some(
      (id, i, arr) =>
        i > 0 && previewSnapshots[id].cvClass !== previewSnapshots[arr[0]].cvClass
    ),
    PRODUCTION_TEMPLATE_IDS.map((id) => previewSnapshots[id]?.cvClass?.match(/template-[\w-]+/)?.[0] || '?').join(' → ')
  );

  const a4 = await page.evaluate(() => {
    const cv = document.getElementById('cvDoc');
    if (!cv || !cv.classList.contains('cv--live')) return { ok: false, reason: 'no-live-cv' };
    const cs = window.getComputedStyle(cv);
    const layoutW = Math.round(parseFloat(cs.width) || 0);
    const layoutH = Math.round(parseFloat(cs.height) || 0);
    return {
      ok: layoutW >= 790 && layoutW <= 810 && cv.classList.contains('cv--a4'),
      layoutW,
      layoutH,
      a4Class: cv.classList.contains('cv--a4'),
    };
  });
  record(
    'a4_preview_width',
    a4.ok,
    `layout=${a4.layoutW}x${a4.layoutH} a4=${a4.a4Class}${a4.reason ? ` ${a4.reason}` : ''}`
  );

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    await selectTemplateCard(id);
    await clickDocStep(page, 'export');
    await page.waitForTimeout(300);

    const beforeExport = await page.evaluate(() => document.getElementById('cvDoc')?.className || '');
    const exportClassOk = new RegExp(`template-${id.replace('-', '\\-')}`).test(beforeExport);

    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        page.locator('#downloadBtn').click(),
      ]);
      const savePath = path.join(OUT_DIR, `v1-${id}.pdf`);
      await download.saveAs(savePath);
      const bytes = fs.statSync(savePath).size;
      const buf = fs.readFileSync(savePath);
      let pages = 0;
      try {
        const pdf = await PDFDocument.load(buf);
        pages = pdf.getPageCount();
      } catch {
        pages = 0;
      }
      record(
        `${id}_pdf_export`,
        bytes > 2000 && pages >= 1 && exportClassOk,
        `${bytes} bytes pages=${pages} classOk=${exportClassOk}`
      );
    } catch (e) {
      record(`${id}_pdf_export`, false, String(e?.message || e).split('\n')[0]);
    }

    await clickDocStep(page, 'style');
    await page.waitForTimeout(200);
  }

  const noParser = await page.evaluate(() => {
    const html = document.getElementById('cvDoc')?.innerHTML || '';
    return !/parser|ocrText|rawText|factPipeline/i.test(html);
  });
  record('no_parser_in_template_html', noParser, 'render-only');
} catch (e) {
  record('qa_runner_fatal', false, String(e?.message || e).split('\n')[0]);
} finally {
  const report = {
    timestamp: new Date().toISOString(),
    templates: PRODUCTION_TEMPLATE_IDS.map((id) => ({
      id,
      displayName: PRODUCTION_TEMPLATE_DISPLAY_NAMES[id],
    })),
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    pass: failed === 0,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-template-v1-selector: PASS');
}
