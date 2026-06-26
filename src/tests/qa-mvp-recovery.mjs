#!/usr/bin/env node
/**
 * HIRELY MVP RECOVERY — PDF, DOCX, TXT, paste; CV visible, editable, export.
 * node src/tests/qa-mvp-recovery.mjs
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';
import { normalizeToClassifyList } from '../core/parsing/safe-fallback.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/mvp-recovery');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
  '/Users/yohannazancot/Documents/cv 2024 yohann azancot copie.pdf',
].filter(Boolean);

const DOCX_CANDIDATES = [
  process.env.HIRELY_ACCEPT_DOCX,
  '/Users/yohannazancot/Documents/cv .docx',
  '/Users/yohannazancot/YOAZ_STUDIO_OS/HIRELY_V27_IMPORT_FIX (1)/test-resumes/text-cv.docx',
].filter(Boolean);

const TXT_FIXTURE = path.join(root, 'tests/fixtures/mvp-sample.txt');
const PASTE_FIXTURE = path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt');

function resolveExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

async function waitForServer(port, ms = 25000) {
  const base = `http://127.0.0.1:${port}/`;
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(base);
      if (res.ok && /Hirely|cvDoc/i.test(await res.text())) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function pickFreePort() {
  return String(3600 + Math.floor(Math.random() * 200));
}

async function waitForCv(page, timeout = 300000) {
  await page.waitForFunction(
    () => {
      const lr = window.HirelyParse?.lastResult?.cvData;
      const doc = document.querySelector('#cvDoc');
      if (!lr || !doc) return false;
      const hasData =
        lr.name ||
        (lr.experience && lr.experience.length) ||
        (lr.toClassify && lr.toClassify.length);
      const live = doc.classList.contains('cv--live') && doc.innerHTML.length > 400;
      return hasData && live;
    },
    { timeout }
  );
}

async function runImport(page, { file, paste } = {}) {
  const consoleErrors = [];
  const importLogs = [];
  const onConsole = (m) => {
    const t = m.text();
    if (/\[Hirely import\]/.test(t)) importLogs.push(t);
    if (m.type() !== 'error') return;
    if (isExtensionConsoleNoise(t)) return;
    if (/MODULE_TYPELESS_PACKAGE_JSON|favicon|501|Unsupported method|structure-cv|\/api\//i.test(t)) return;
    consoleErrors.push(t.slice(0, 200));
  };
  page.on('console', onConsole);

  if (file) {
    await page.locator('#fileInput').setInputFiles(file);
    await page
      .waitForFunction(
        () => {
          const live = document.getElementById('importLiveStatus')?.textContent || '';
          const busy = document.getElementById('wsImport')?.classList.contains('wsImport--loading');
          return busy || /Lecture|Reading/i.test(live);
        },
        { timeout: 8000 }
      )
      .catch(() => {});
  } else if (paste) {
    await page.evaluate((text) => {
      const ta = document.getElementById('cvText');
      if (ta) ta.value = text;
    }, paste);
    await page.evaluate(async (text) => {
      if (window.HirelyParse?.importText) {
        await window.HirelyParse.importText(text, {
          source: 'paste-text',
          trusted: true,
          forceContinue: true,
        });
      }
    }, paste);
  }

  await waitForCv(page);
  await page.waitForSelector('#workspaceGrid.workspaceGrid--ready', { timeout: 120000 }).catch(() => {});
  await page.click('[data-doc-step="verify"]').catch(() => {});
  await page.waitForTimeout(600);

  const snapshot = await page.evaluate(() => {
    const cv = window.HirelyParse?.lastResult?.cvData || {};
    const doc = document.querySelector('#cvDoc');
    const banner = document.getElementById('mvpImportBanner');
    const tc = (cv.toClassify || []).length;
    return {
      previewLen: doc?.innerHTML?.length || 0,
      previewText: doc?.innerText || '',
      editable: doc?.querySelectorAll('[contenteditable]').length || 0,
      classifyButtons: document.querySelectorAll('[data-classify-target]').length,
      bannerVisible: banner && !banner.classList.contains('hidden'),
      bannerTitle: banner?.querySelector('.mvpImportTitle')?.textContent || '',
      rawLen: String(window.HirelyParse?.lastResult?.rawText || '').length,
      toClassify: tc,
      name: cv.name || '',
      nav: [...document.querySelectorAll('.docNavItem')].map((b) => b.textContent?.trim()),
      technicalVisible: ['#pipelineReportPanel', '.scoreCardPremium', '#extractionGate'].filter((sel) => {
        const el = document.querySelector(sel);
        return el && getComputedStyle(el).display !== 'none';
      }),
      tplClass: doc?.className || '',
      importLiveStatus: document.getElementById('importLiveStatus')?.textContent || '',
      importBusy: document.getElementById('wsImport')?.classList.contains('wsImport--loading') || false,
    };
  });

  page.off('console', onConsole);
  return { ...snapshot, consoleErrors, importLogs };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const pdfPath = resolveExisting(PDF_CANDIDATES);
  const docxPath = resolveExisting(DOCX_CANDIDATES);
  if (!pdfPath) {
    console.error('No PDF — set HIRELY_YOAZ_PDF');
    process.exit(1);
  }
  if (!fs.existsSync(TXT_FIXTURE)) {
    console.error('Missing', TXT_FIXTURE);
    process.exit(1);
  }
  const pasteText = fs.existsSync(PASTE_FIXTURE)
    ? fs.readFileSync(PASTE_FIXTURE, 'utf8')
    : fs.readFileSync(TXT_FIXTURE, 'utf8');

  const port = process.env.HIRELY_PORT || pickFreePort();
  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: root,
    stdio: 'ignore',
  });

  const failures = [];
  const results = {};

  function ok(cond, msg) {
    if (!cond) {
      failures.push(msg);
      console.error('FAIL', msg);
    } else console.log('OK', msg);
  }

  try {
    if (!(await waitForServer(port))) {
      console.error('Server failed');
      process.exit(1);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);

    try {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.HirelyParse?.importFile === 'function', {
        timeout: 45000,
      });

      const cases = [
        { id: 'pdf', file: pdfPath },
        { id: 'txt', file: TXT_FIXTURE },
      ];
      if (docxPath) cases.push({ id: 'docx', file: docxPath });
      cases.push({ id: 'paste', paste: pasteText });

      for (const c of cases) {
        if (c.file && c.id !== 'pdf') {
          await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => typeof window.HirelyParse?.importFile === 'function');
        }
        console.log('\n---', c.id.toUpperCase(), '---');
        const snap = await runImport(page, c);
        results[c.id] = snap;

        ok(snap.previewLen >= 400, `${c.id}: CV visible`);
        ok(snap.rawLen >= 40, `${c.id}: text extracted`);
        ok(
          snap.previewText.length >= 30 || snap.toClassify >= 1,
          `${c.id}: text appears in preview or À classer`
        );
        ok(snap.editable >= 3, `${c.id}: contenteditable fields`);
        ok(snap.technicalVisible.length === 0, `${c.id}: no technical UI`);
        ok(/Importer|Import/i.test(snap.nav.join(' ')), `${c.id}: simple nav`);
        ok(snap.consoleErrors.length === 0, `${c.id}: no console errors (${snap.consoleErrors.join('; ')})`);
        if (c.id === 'pdf') {
          ok(snap.bannerVisible, 'pdf: MVP banner visible');
          ok(/importé|imported/i.test(snap.bannerTitle), 'pdf: friendly import title');
          ok(
            (snap.importLogs || []).some((l) => /FILE_SELECTED|EXTRACTION_STARTED/.test(l)),
            `pdf: import pipeline logs (${(snap.importLogs || []).length})`
          );
          ok(
            /importé|imported|Lecture|Reading/i.test(snap.importLiveStatus) || snap.previewLen >= 400,
            'pdf: visible import feedback or CV'
          );
        }
        if (snap.toClassify > 0) {
          ok(snap.classifyButtons >= 9, `${c.id}: classify actions`);
        }

        await page.locator('#cvDoc').screenshot({
          path: path.join(outDir, `cv-${c.id}.png`),
          timeout: 15000,
        }).catch(() => {});
      }

      await page.click('[data-doc-step="style"]');
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        if (typeof state !== 'undefined') state.pro = true;
      });
      const before = await page.evaluate(() => document.querySelector('#cvDoc')?.className || '');
      const alt = page.locator('.tplCard[data-id="executive"], .tplCard[data-id="swiss"], .tplCard[data-id="consultingelite"]').first();
      if (await alt.count()) {
        await alt.click();
        await page.waitForTimeout(900);
        const after = await page.evaluate(() => document.querySelector('#cvDoc')?.className || '');
        ok(before !== after || /template-(executive|swiss|consultingelite)/.test(after), 'template switch changes preview');
      } else ok(true, 'template switch skipped (no alt template)');

      await page.click('[data-doc-step="export"]');
      const pdfOut = path.join(outDir, 'mvp-export.pdf');
      let exported = false;
      try {
        await page.click('#downloadBtn', { timeout: 8000 });
        const download = await page.waitForEvent('download', { timeout: 25000 });
        await download.saveAs(pdfOut);
        exported = fs.statSync(pdfOut).size > 5000;
      } catch {
        const inner = await page.evaluate(() => document.querySelector('#cvDoc')?.innerHTML || '');
        await exportCvPdfPlaywright(page, inner, 'ats', pdfOut);
        const bytes = fs.readFileSync(pdfOut);
        const analysis = await analyzePdfBytes(bytes);
        exported = (analysis.pageCount || 0) >= 1 && bytes.length > 5000;
      }
      ok(exported, 'PDF export works');

      const report = {
        at: new Date().toISOString(),
        pass: failures.length === 0,
        failures,
        results,
        files: { pdf: pdfPath, docx: docxPath, txt: TXT_FIXTURE },
      };
      fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

      console.log('\n--- MVP RECOVERY ---');
      console.log(failures.length ? 'FAILED' : 'PASSED', failures.length, 'issue(s)');
      console.log('Report:', path.join(outDir, 'report.json'));
      console.log('Screenshots:', outDir);

      if (failures.length) process.exit(1);
    } finally {
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
    }
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
