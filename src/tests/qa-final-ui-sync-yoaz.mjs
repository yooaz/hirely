#!/usr/bin/env node
/**
 * Final UI sync acceptance — Yoaz PDF import (preview, suggestions, recruiter checklist).
 * node src/tests/qa-final-ui-sync-yoaz.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise, isHirelyAppFatal } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/final-ui-sync-yoaz');
fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
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

const pdfPath = resolvePdf();
if (!pdfPath) {
  console.error('Yoaz PDF not found — set HIRELY_YOAZ_PDF');
  process.exit(1);
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const port = 3050 + Math.floor(Math.random() * 50);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const consoleLines = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

page.on('console', (msg) => {
  const text = msg.text();
  consoleLines.push({ type: msg.type(), text });
  if (/CORE_BOOT|IMPORT_|OCR_|EXTRACTION_|PARSER_|RENDER_|BROWSER_RESUMEDATA/i.test(text)) {
    console.log('[browser]', text);
  }
});
page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (!isExtensionConsoleNoise(text)) pageErrors.push(text);
});

async function waitImportDone(maxMs = 300000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      gate: !document.getElementById('extractionGate')?.classList.contains('hidden'),
    }));
    if (s.gate) {
      const cont = page.locator('#extractionGateContinue');
      if ((await cont.count()) > 0 && (await cont.isVisible())) {
        await cont.click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    if ((s.live || s.fallback) && !s.busy) return s;
    await page.waitForTimeout(500);
  }
  return { live: false, timeout: true };
}

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 180000 }
  );
  await page.waitForTimeout(800);

  const pdfBuf = fs.readFileSync(pdfPath);
  await page.evaluate(
    async ({ b64, name }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: 'application/pdf' });
      await window.HirelyParse.handleFileImport(file, 'final-ui-sync');
    },
    { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
  );

  const done = await waitImportDone();
  ok(done.live, 'CV preview is live after import');
  ok(!done.fallback, 'no paste fallback after Yoaz PDF import');

  await page.waitForTimeout(2000);
  if (typeof page.evaluate === 'function') {
    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('edit');
      if (typeof renderMetrics === 'function') renderMetrics();
      if (typeof renderReviewStudioV2 === 'function') renderReviewStudioV2();
    });
  }
  await page.waitForTimeout(1000);

  const snap = await page.evaluate(() => {
    const cvText = document.getElementById('cvDoc')?.innerText || '';
    const cvHtml = document.getElementById('cvDoc')?.innerHTML || '';
    const suggestionCards = Array.from(
      document.querySelectorAll('#suggestionsList .suggestionCard .suggestionText')
    ).map((el) => (el.textContent || '').trim());
    const suggestionTotal = (() => {
      try {
        return typeof collectProductSuggestions === 'function'
          ? collectProductSuggestions().total
          : suggestionCards.length;
      } catch {
        return suggestionCards.length;
      }
    })();
    const checklistItems = Array.from(
      document.querySelectorAll('#reviewV2Checklist .atsCheckItem')
    ).map((el) => ({
      text: (el.textContent || '').trim(),
      ok: el.classList.contains('atsCheckItem--ok'),
    }));
    const scoreReport =
      typeof computeProductScoreReport === 'function' ? computeProductScoreReport() : null;
    const readiness =
      typeof getReviewReadinessReport === 'function' ? getReviewReadinessReport() : null;
    const rd = window.__hirelyState?.resumeData || window.HirelyParse?.lastResult?.resumeData;
    const expRole = rd?.experiences?.[0]?.role || '';
    const expCompany = rd?.experiences?.[0]?.company || '';
    const expDates = [rd?.experiences?.[0]?.startDate, rd?.experiences?.[0]?.endDate]
      .filter(Boolean)
      .join('–');
    const eduLines = (rd?.education || []).map((e) =>
      typeof e === 'string' ? e : [e.school, e.degree, e.dates].filter(Boolean).join(' — ')
    );
    const clients = rd?.clients || [];
    const careerLine =
      '30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.';
    return {
      cvText,
      hasTitle: /graphic designer\s*&\s*illustrator/i.test(cvText),
      hasExpSection: /expérience|experience/i.test(cvText),
      hasFreelanceExp:
        /freelance illustrator/i.test(cvText) &&
        /graphic designer/i.test(cvText) &&
        /2011/.test(cvText) &&
        /2022/.test(cvText),
      hasEduSection: /formation|education/i.test(cvText),
      hasLisaa: /lisaa/i.test(cvText) && /web.*motion|motion.*design/i.test(cvText),
      hasNike: /\bnike\b/i.test(cvText),
      hasLouisVuitton: /louis\s*vuitton/i.test(cvText),
      hasMarvel: /\bmarvel\b/i.test(cvText),
      careerInSuggestions: suggestionCards.some((t) =>
        /30-year old illustrator|freelancer illustrator.*graphic designer/i.test(t)
      ),
      suggestionCards,
      suggestionVisible: suggestionCards.length,
      suggestionTotal,
      checklistItems,
      checks: scoreReport?.checks || null,
      gates: readiness?.gates || null,
      resumeCounts: {
        experiences: (rd?.experiences || []).length,
        education: (rd?.education || []).length,
        skills: (rd?.skills || []).length,
        tools: (rd?.tools || []).length,
        clients: clients.length,
      },
      expPreview: { role: expRole, company: expCompany, dates: expDates },
      eduPreview: eduLines.slice(0, 3),
      clientsPreview: clients.slice(0, 12),
      careerLineInCv: cvText.includes(careerLine.slice(0, 40)),
    };
  });

  const logs = consoleLines.map((l) => l.text);
  const hasTag = (re) => logs.some((t) => re.test(t));

  ok(hasTag(/CORE_BOOT_OK/), 'console: CORE_BOOT_OK');
  ok(hasTag(/IMPORT_STARTED/i), 'console: IMPORT_STARTED');
  ok(hasTag(/OCR_DONE/i), 'console: OCR_DONE');
  ok(hasTag(/EXTRACTION_DONE/i), 'console: EXTRACTION_DONE');
  ok(hasTag(/PARSER_DONE/i), 'console: PARSER_DONE');
  ok(hasTag(/RENDER_DONE/i), 'console: RENDER_DONE');
  ok(hasTag(/BROWSER_RESUMEDATA_COUNTS/i), 'console: BROWSER_RESUMEDATA_COUNTS');

  ok(snap.hasTitle, `CV title Graphic Designer & Illustrator (cvText head: ${snap.cvText.slice(0, 120)})`);
  ok(snap.hasExpSection, 'CV section Expériences visible');
  ok(
    snap.hasFreelanceExp || /independent\s*\/\s*freelance/i.test(snap.cvText),
    `CV shows Freelance experience 2011–2022 (role=${snap.expPreview.role}, company=${snap.expPreview.company})`
  );
  ok(snap.hasEduSection, 'CV section Formation visible');
  ok(snap.hasLisaa || snap.eduPreview.some((e) => /lisaa/i.test(e)), `CV shows LISAA (${snap.eduPreview.join(' | ')})`);
  ok(snap.hasNike && snap.hasMarvel, `Clients clean — Nike=${snap.hasNike} Marvel=${snap.hasMarvel} LV=${snap.hasLouisVuitton}`);

  ok(!snap.careerInSuggestions, 'career line not duplicated in Suggestions');
  ok(snap.suggestionVisible <= 5, `suggestions visible max 5 (got ${snap.suggestionVisible}, total=${snap.suggestionTotal})`);
  const garbageVisible = snap.suggestionCards.some((t) =>
    /^(print|contact|@|v\d+\s*a|lea|s\s+phone)/i.test(t) ||
    /yoaz27\s+2008\s+2009/i.test(t)
  );
  ok(!garbageVisible, 'no garbage suggestions visible');
  const filterLog = consoleLines
    .map((l) => l.text)
    .find((t) => /SUGGESTION_FILTER/.test(t));
  if (filterLog) console.log('[browser]', filterLog);

  const expCheck =
    snap.checks?.experience ||
    snap.checklistItems.find((c) => /expérience|experience/i.test(c.text))?.ok;
  const eduCheck =
    snap.checks?.education ||
    snap.checklistItems.find((c) => /formation|education/i.test(c.text))?.ok;
  const skillsCheck =
    snap.checks?.skills ||
    snap.checklistItems.find((c) => /compétence|skill/i.test(c.text))?.ok;

  ok(!!expCheck, `Analyse recruteur: Experience checked (gates=${JSON.stringify(snap.gates)})`);
  ok(!!eduCheck, `Analyse recruteur: Formation checked (counts=${JSON.stringify(snap.resumeCounts)})`);
  ok(!!skillsCheck, `Analyse recruteur: Compétences checked`);

  ok(pageErrors.length === 0, `no Hirely fatal page errors (got ${pageErrors.length}: ${pageErrors.join('; ')})`);

  const report = {
    pdf: pdfPath,
    timestamp: new Date().toISOString(),
    snap,
    consoleTags: {
      CORE_BOOT_OK: hasTag(/CORE_BOOT_OK/),
      IMPORT_STARTED: hasTag(/IMPORT_STARTED/i),
      OCR_DONE: hasTag(/OCR_DONE/i),
      EXTRACTION_DONE: hasTag(/EXTRACTION_DONE/i),
      PARSER_DONE: hasTag(/PARSER_DONE/i),
      RENDER_DONE: hasTag(/RENDER_DONE/i),
      BROWSER_RESUMEDATA_COUNTS: hasTag(/BROWSER_RESUMEDATA_COUNTS/i),
    },
    pageErrors,
    failed,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(outDir, 'after-import.png'), fullPage: false });

  console.log('\n--- RESUME COUNTS ---', snap.resumeCounts);
  console.log('--- SUGGESTIONS ---', snap.suggestionCards);
  console.log('--- CHECKLIST ---', snap.checklistItems);
  console.log('\nReport:', path.join(outDir, 'report.json'));
} finally {
  await browser.close();
  server.close();
}

process.exit(failed ? 1 : 0);
