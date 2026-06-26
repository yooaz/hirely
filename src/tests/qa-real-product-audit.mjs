#!/usr/bin/env node
/**
 * Real product QA — full user flow audit (production UI, no ?debug).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/real-product-qa');
fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

const TXT_FIXTURE = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');
const PASTE_TEXT = fs.readFileSync(TXT_FIXTURE, 'utf8');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
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

const report = {
  steps: [],
  consoleErrors: [],
  pageErrors: [],
  firstFailingStep: null,
  fallbacks: [],
};

function step(name, ok, detail = '') {
  report.steps.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok && !report.firstFailingStep) report.firstFailingStep = name;
}

const port = 3040 + Math.floor(Math.random() * 50);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));
const base = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(120000);

page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) report.consoleErrors.push(text);
});
page.on('pageerror', (e) => {
  const text = String(e?.message || e);
  if (!isExtensionConsoleNoise(text)) report.pageErrors.push(text);
});

try {
  // 1 Open app
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const debugMode = await page.evaluate(() => document.documentElement.classList.contains('debug-mode'));
  const heroVisible = await page.isVisible('#hero');
  step('1. Open app', !debugMode && heroVisible, debugMode ? 'debug-mode on' : 'landing ok');

  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 90000 }
  );

  // 5 Paste text (before heavy PDF)
  await page.evaluate((text) => {
    const ta = document.getElementById('cvText');
    if (ta) ta.value = text;
  }, PASTE_TEXT);
  const pasteOutcome = await page.evaluate(async (text) => {
    return window.applyCvPipeline(text, { source: 'paste-text', trusted: true, forceContinue: true });
  }, PASTE_TEXT);
  await page.waitForTimeout(3000);
  let cvLive = await page.evaluate(() => {
    const d = document.getElementById('cvDoc');
    return !!(d && d.classList.contains('cv--live') && (d.innerText || '').length > 60);
  });
  step('5. Paste text', cvLive, `pipeline=${pasteOutcome}`);

  // 4 Import TXT
  const txtBuf = fs.readFileSync(TXT_FIXTURE);
  const txtOutcome = await page.evaluate(
    async ({ b64, name }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: 'text/plain' });
      return window.HirelyParse.handleFileImport(file, 'qa-txt');
    },
    { b64: txtBuf.toString('base64'), name: 'creative-cv.txt' }
  );
  await page.waitForTimeout(2500);
  cvLive = await page.evaluate(() => {
    const d = document.getElementById('cvDoc');
    return !!(d && d.classList.contains('cv--live') && (d.innerText || '').length > 60);
  });
  step('4. Import TXT', cvLive && txtOutcome !== 'PASTE_FALLBACK', String(txtOutcome));

  // 2 Import PDF
  const pdfPath = PDF_CANDIDATES.find((p) => fs.existsSync(p));
  if (pdfPath) {
    const pdfBuf = fs.readFileSync(pdfPath);
    const pdfOutcome = await page.evaluate(
      async ({ b64, name }) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], name, { type: 'application/pdf' });
        return window.HirelyParse.handleFileImport(file, 'qa-pdf');
      },
      { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
    );
    await page.waitForTimeout(45000);
    const pdfState = await page.evaluate(() => {
      const d = document.getElementById('cvDoc');
      const lr = window.HirelyParse?.lastResult || {};
      const live = !!(d && d.classList.contains('cv--live') && (d.innerText || '').length > 60);
      const pasteVisible = /collez|paste/i.test(document.body.innerText || '');
      return {
        outcome: 'pending',
        live,
        pasteVisible,
        rawLen: (lr.rawText || '').length,
        previewLen: (d?.innerText || '').length,
        name: lr.resumeData?.identity?.name || lr.cvData?.name || '',
      };
    });
    pdfState.outcome = pdfOutcome;
    if (pdfOutcome === 'PASTE_FALLBACK') report.fallbacks.push('PDF → paste fallback');
    step(
      '2. Import PDF',
      pdfState.live || pdfOutcome === 'CV_RENDERED',
      `${pdfOutcome} raw=${pdfState.rawLen} preview=${pdfState.previewLen}`
    );
    await page.screenshot({ path: path.join(outDir, 'after-pdf.png') });
  } else {
    step('2. Import PDF', false, 'no PDF fixture on disk');
  }

  // 3 Import DOCX — skip if no file
  step('3. Import DOCX', false, 'no .docx fixture in repo');

  // Ensure edit step
  await page.click('.docNavItem[data-doc-step="edit"]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  // 6 Edit sections
  const editorVisible = await page.evaluate(() => {
    const p = document.getElementById('resumeEditorPanel');
    const r = document.getElementById('resumeEditorRoot');
    return !!(p && !p.classList.contains('hidden') && r && r.innerHTML.length > 200);
  });
  const edited = await page.evaluate(() => {
    const inp = document.querySelector('[data-rd-field="identity.name"]');
    if (!inp) return false;
    inp.value = 'Alex Test';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return document.querySelector('[data-rd-field="identity.name"]')?.value === 'Alex Test';
  });
  await page.waitForTimeout(500);
  const previewName = await page.evaluate(() => document.getElementById('cvDoc')?.innerText || '');
  step('6. Edit sections', editorVisible && edited, editorVisible ? `preview has name: ${/Alex Test/i.test(previewName)}` : 'editor hidden');

  // 7 Move À classer
  const moved = await page.evaluate(() => {
    const btn = document.querySelector('[data-rd-move="skill"]');
    if (!btn) return { ok: false, reason: 'no unsorted move button' };
    btn.click();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  step('7. Move À classer', moved.ok, moved.reason || 'clicked move to skill');

  // 8 Switch template
  await page.click('.docNavItem[data-doc-step="style"]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  const swiss = await page.$('.tplCard[data-id="swiss"]');
  if (swiss) await swiss.click();
  await page.waitForTimeout(600);
  const tplOk = await page.evaluate(() => {
    const d = document.getElementById('cvDoc');
    return d?.className.includes('template-swiss');
  });
  step('8. Switch template', tplOk, tplOk ? 'swiss active' : 'class missing');

  // 9 Export PDF
  await page.click('.docNavItem[data-doc-step="export"]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  const exportBar = await page.isVisible('#cvExportBar');
  const hasHtml2pdf = await page.evaluate(async () => {
    if (window.HirelyLazy?.ensureHtml2pdf) {
      try {
        await window.HirelyLazy.ensureHtml2pdf();
        return typeof window.html2pdf === 'function';
      } catch (e) {
        return false;
      }
    }
    return typeof window.html2pdf === 'function';
  });
  step('9. Export PDF (prereq)', exportBar && hasHtml2pdf, `bar=${exportBar} html2pdf=${hasHtml2pdf}`);

  // UI simplicity checks
  const techHidden = await page.evaluate(() => {
    const score = document.querySelector('.scoreCardPremium');
    const pipe = document.getElementById('pipelineReportPanel');
    const testImport = document.getElementById('hirelyTestImport');
    const sm = getComputedStyle(score || document.body);
    return {
      scoreHidden: !score || score.offsetParent === null,
      pipeHidden: !pipe || pipe.classList.contains('hidden'),
      testHidden: !testImport || testImport.classList.contains('hidden'),
    };
  });
  step('UI: no debug panels', techHidden.scoreHidden && techHidden.testHidden, JSON.stringify(techHidden));

  const canFinish = await page.evaluate(() => {
    const d = document.getElementById('cvDoc');
    const ed = document.getElementById('resumeEditorRoot');
    return (
      d?.classList.contains('cv--live') &&
      (d.innerText || '').length > 40 &&
      ed?.innerHTML?.length > 100
    );
  });
  step('Non-technical user can finish CV', canFinish, canFinish ? 'preview + editor ready' : 'blocked');

  await page.screenshot({ path: path.join(outDir, 'final-state.png'), fullPage: true });
} catch (e) {
  report.pageErrors.push(String(e.message || e));
  if (!report.firstFailingStep) report.firstFailingStep = 'exception';
  console.error('AUDIT_EXCEPTION', e);
} finally {
  await browser.close();
  server.close();
}

report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 20);
report.pageErrors = [...new Set(report.pageErrors)].slice(0, 10);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

const failed = report.steps.filter((s) => !s.ok).length;
console.log('\n--- SUMMARY ---');
console.log('First failing:', report.firstFailingStep || 'none');
console.log('Console errors:', report.consoleErrors.length);
if (report.consoleErrors.length) console.log(report.consoleErrors.slice(0, 5).join('\n'));
console.log('Page errors:', report.pageErrors.join('; ') || 'none');
console.log('Fallbacks:', report.fallbacks.join(', ') || 'none');
process.exit(failed ? 1 : 0);
