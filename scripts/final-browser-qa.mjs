#!/usr/bin/env node
/**
 * HIRELY FINAL BROWSER QA — 5 CV profiles, real Playwright.
 * node scripts/final-browser-qa.mjs
 * Output: FINAL_BROWSER_QA_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';
import { analyzePdfBytes } from '../src/tests/lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tests/output/final-browser-qa');
const REPORT_PATH = path.join(ROOT, 'FINAL_BROWSER_QA_REPORT.md');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

const GARBAGE_RE =
  /\b(B\s*wma|20M|@\s*man|v3\s*2\s*gradric|weband|observation maquette)\b|2011–2011|—\s*—\s*[–-]\s*—/i;
const ROLE_IN_TOOLS_RE =
  /\b(graphic designer|freelance|illustrator as role|interest|photograph|and graphic|senior recruiter)\b/i;
const LANG_IN_TOOLS_RE = /\b(native|fluent|français|french|english|anglais|conversational|professional)\b/i;

const CASES = [
  {
    id: 'yoaz-scanned-pdf',
    label: 'Yoaz scanned PDF',
    kind: 'pdf',
    resolve: () => {
      for (const p of PDF_CANDIDATES) if (p && fs.existsSync(p)) return p;
      return null;
    },
    expectName: /yohann|azancot/i,
    expectEmail: /@/,
    expectPhone: /\+?\d[\d\s().-]{6,}/,
  },
  {
    id: 'clean-text-cv',
    label: 'Clean text CV',
    kind: 'text',
    fixture: 'tests/fixtures/mvp-sample.txt',
    expectName: /yohann|azancot/i,
    expectEmail: /yoaz@/i,
    expectPhone: /\+33|6\s*49/i,
  },
  {
    id: 'developer-cv',
    label: 'Developer CV',
    kind: 'text',
    fixture: 'tests/fixtures/developer-cv/fixture.txt',
    expectName: /alex\s+chen/i,
    expectEmail: /alex\.chen@/i,
    expectPhone: /415|555/i,
  },
  {
    id: 'marketing-cv',
    label: 'Marketing CV',
    kind: 'text',
    fixture: 'tests/fixtures/marketing-cv/fixture.txt',
    expectName: /laura\s+bennett/i,
    expectEmail: /laura\.bennett@/i,
    expectPhone: /7946|\+44/i,
  },
  {
    id: 'recruiter-cv',
    label: 'Recruiter CV',
    kind: 'text',
    fixture: 'tests/fixtures/recruiter-cv/fixture.txt',
    expectName: /david\s+okonkwo/i,
    expectEmail: /david\.okonkwo@/i,
    expectPhone: /646|555/i,
  },
];

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const rel = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function waitImportDone(page, maxMs = 360000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      gate: !document.getElementById('extractionGate')?.classList.contains('hidden'),
      empty: !!document.getElementById('cvDoc')?.querySelector('.cvEmptyState'),
    }));
    if (s.gate) {
      const cont = page.locator('#extractionGateContinue');
      if ((await cont.count()) > 0 && (await cont.isVisible())) {
        await cont.click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    if ((s.live || s.fallback) && !s.busy && !s.empty) return { ...s, ok: s.live };
    await page.waitForTimeout(500);
  }
  return { ok: false, timeout: true };
}

async function clickDocStep(page, step) {
  const enabled = page.locator(`#docNav .hirelyProgressBtn[data-doc-step="${step}"]:not([disabled])`);
  if ((await enabled.count()) > 0) await enabled.click();
  else {
    await page.evaluate((s) => {
      if (typeof setDocStep === 'function') setDocStep(s);
    }, step);
  }
  await page.waitForTimeout(500);
}

async function importCase(page, cvCase) {
  if (cvCase.kind === 'pdf') {
    const pdfPath = cvCase.resolve();
    if (!pdfPath) throw new Error('Yoaz PDF not found');
    const pdfBuf = fs.readFileSync(pdfPath);
    await page.evaluate(
      async ({ b64, name }) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], name, { type: 'application/pdf' });
        await window.HirelyParse.handleFileImport(file, 'final-qa');
      },
      { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
    );
    return;
  }
  const fixturePath = path.join(ROOT, cvCase.fixture);
  const text = fs.readFileSync(fixturePath, 'utf8');
  await page.evaluate(
    async ({ content, name }) => {
      const file = new File([content], name, { type: 'text/plain' });
      await window.HirelyParse.handleFileImport(file, 'final-qa');
    },
    { content: text, name: path.basename(cvCase.fixture) }
  );
}

async function collectSnap(page) {
  return page.evaluate(() => {
    const cvEl = document.getElementById('cvDoc');
    const cvText = cvEl?.innerText || '';
    const finalCv = typeof getFinalCvData === 'function' ? getFinalCvData() : null;
    const finalResume = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const scoreReport =
      typeof computeProductScoreReport === 'function' ? computeProductScoreReport() : null;
    const scoreEl = document.getElementById('studioScore') || document.getElementById('score');
    const scoreText = scoreEl?.textContent?.trim() || '';

    const suggestions = [
      ...(finalResume?.suggestions || []),
      ...Array.from(
        document.querySelectorAll(
          '#suggestionsList .suggestionText, #smartRepairList .smartRepairText, .toClassifyItemText'
        )
      ).map((el) => (el.textContent || '').trim()),
    ].filter(Boolean);

    const uniqSuggest = [...new Set(suggestions.map((s) => s.toLowerCase()))];

    return {
      cvVisible: cvEl?.classList.contains('cv--live') && !cvEl?.querySelector('.cvEmptyState'),
      cvText: cvText.slice(0, 6000),
      name: finalCv?.name || finalResume?.identity?.name || '',
      email: finalCv?.email || finalResume?.identity?.email || '',
      phone: finalCv?.phone || finalResume?.identity?.phone || '',
      experiences: (finalCv?.experience || finalResume?.experiences || []).length,
      education: (finalCv?.education || finalResume?.education || []).map((e) =>
        typeof e === 'string' ? e : [e.school, e.degree, e.dates].filter(Boolean).join(' — ')
      ),
      skills: [...(finalCv?.skills || finalResume?.skills || [])],
      tools: [...(finalCv?.tools || finalResume?.tools || [])],
      languages: [...(finalCv?.languages || finalResume?.languages || [])],
      suggestions: uniqSuggest,
      score: scoreReport?.total ?? scoreReport?.score ?? null,
      scoreText,
      hasExpInPreview: /expérience|experience/i.test(cvText),
    };
  });
}

async function checkUploadClickable(page) {
  return page.evaluate(() => {
    const drop = document.getElementById('drop');
    if (!drop) return { ok: false, reason: 'missing #drop' };
    const style = getComputedStyle(drop);
    const busy = drop.classList.contains('drop--busy');
    const pe = style.pointerEvents;
    const hidden = style.display === 'none' || style.visibility === 'hidden';
    return {
      ok: !busy && pe !== 'none' && !hidden,
      busy,
      pointerEvents: pe,
      hidden,
    };
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const port = 3080 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const globalChecks = {
  fatalErrors: [],
  sanitizedCounts: 0,
  uploadAlwaysClickable: true,
  coreBootOk: false,
};

const caseResults = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  fs.writeFileSync(
    REPORT_PATH,
    `# FINAL BROWSER QA REPORT\n\n**Verdict:** FAIL\n\nBrowser launch failed: ${e.message}\n`
  );
  console.error('FAIL — browser launch');
  process.exit(1);
}

const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(360000);

page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (!isExtensionConsoleNoise(text)) globalChecks.fatalErrors.push(`pageerror: ${text}`);
});
page.on('console', (msg) => {
  const text = msg.text();
  if (
    msg.type() === 'error' &&
    !isExtensionConsoleNoise(text) &&
    /fatal|uncaught|CORE_BOOT_FAILED/i.test(text)
  ) {
    globalChecks.fatalErrors.push(`console: ${text.slice(0, 200)}`);
  }
  if (text.includes('SANITIZED_COUNTS')) globalChecks.sanitizedCounts++;
});

for (const cvCase of CASES) {
  const result = { id: cvCase.id, label: cvCase.label, checks: [], pass: false, blockers: [] };
  const record = (id, ok, detail = '') => {
    result.checks.push({ id, ok, detail });
    if (!ok) result.blockers.push(`${id}${detail ? ` — ${detail}` : ''}`);
  };

  console.log(`\n=== ${cvCase.label} ===`);

  if (cvCase.kind === 'pdf' && !cvCase.resolve()) {
    record('import', false, 'Yoaz PDF not found');
    caseResults.push(result);
    continue;
  }

  const sanitizedBefore = globalChecks.sanitizedCounts;

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    const boot = await page.evaluate(() => ({
      failed:
        window.__HIRELY_CORE_BOOT__ === 'failed' ||
        (document.getElementById('hirelyCoreLoadError') &&
          !document.getElementById('hirelyCoreLoadError').classList.contains('hidden')),
    }));
    if (!globalChecks.coreBootOk) globalChecks.coreBootOk = !boot.failed;
    record('core_boot', !boot.failed, boot.failed ? 'CORE_BOOT_FAILED' : 'ok');

    await page.waitForFunction(
      () => typeof window.HirelyParse?.handleFileImport === 'function',
      { timeout: 180000 }
    );

    const uploadBefore = await checkUploadClickable(page);
    record('upload_clickable_before', uploadBefore.ok, JSON.stringify(uploadBefore));

    await importCase(page, cvCase);
    const done = await waitImportDone(page, cvCase.kind === 'pdf' ? 360000 : 120000);
    record('import_works', !!done.ok, done.timeout ? 'timeout' : done.fallback ? 'paste fallback' : 'live');

    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('edit');
      if (typeof renderMetrics === 'function') renderMetrics();
      if (typeof renderReviewStudioV2 === 'function') renderReviewStudioV2();
      if (typeof syncStudioCvScale === 'function') syncStudioCvScale();
    });
    await page.waitForTimeout(1500);

    const snap = await collectSnap(page);
    await page.screenshot({
      path: path.join(OUT_DIR, `${cvCase.id}.png`),
      fullPage: false,
    });

    record('cv_visible', snap.cvVisible, snap.cvVisible ? 'cv--live' : 'empty');
    record('name_extracted', cvCase.expectName.test(snap.name), snap.name || '—');
    record('email_extracted', cvCase.expectEmail.test(snap.email), snap.email || '—');
    record('phone_extracted', cvCase.expectPhone.test(snap.phone), snap.phone || '—');
    record(
      'experience_visible',
      snap.experiences > 0 || snap.hasExpInPreview,
      `count=${snap.experiences}`
    );

    const eduGarbage =
      snap.education.some((e) => GARBAGE_RE.test(e)) ||
      GARBAGE_RE.test(snap.education.join(' '));
    record('education_clean', snap.education.length > 0 && !eduGarbage, snap.education.join(' | '));

    const toolsGarbage = snap.tools.some(
      (t) => ROLE_IN_TOOLS_RE.test(t) || LANG_IN_TOOLS_RE.test(t)
    );
    const langsInTools = snap.tools.some((t) => LANG_IN_TOOLS_RE.test(t));
    record(
      'skills_tools_langs_clean',
      snap.skills.length > 0 &&
        snap.tools.length > 0 &&
        !toolsGarbage &&
        !langsInTools &&
        snap.languages.length > 0,
      `skills=${snap.skills.length} tools=${snap.tools.join(',')} langs=${snap.languages.join(',')}`
    );

    record(
      'suggestions_lte_2',
      snap.suggestions.length <= 2,
      `count=${snap.suggestions.length} [${snap.suggestions.join(' | ')}]`
    );

    const scoreNum = Number(snap.score);
    const scoreOk = Number.isFinite(scoreNum) && scoreNum > 0;
    record(
      'recruiter_score_updates',
      scoreOk || (snap.scoreText && snap.scoreText !== '—'),
      `score=${snap.score ?? snap.scoreText}`
    );

    await clickDocStep(page, 'export');
    let pdfOk = false;
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 120000 }),
        page.locator('#downloadBtn').click(),
      ]);
      const pdfOut = path.join(OUT_DIR, `${cvCase.id}.pdf`);
      await download.saveAs(pdfOut);
      const buf = fs.readFileSync(pdfOut);
      const analysis = await analyzePdfBytes(buf);
      pdfOk = buf.length > 2000 && analysis.pageCount >= 1;
      record('pdf_export', pdfOk, `${buf.length} bytes pages=${analysis.pageCount}`);
    } catch (e) {
      record('pdf_export', false, String(e.message || e).slice(0, 120));
    }

    const uploadAfter = await checkUploadClickable(page);
    record('upload_clickable_after', uploadAfter.ok, JSON.stringify(uploadAfter));
    if (!uploadAfter.ok) globalChecks.uploadAlwaysClickable = false;

    const sanitizedDelta = globalChecks.sanitizedCounts - sanitizedBefore;
    record('no_render_loop', sanitizedDelta <= 2, `SANITIZED_COUNTS +${sanitizedDelta}`);
  } catch (err) {
    record('runner', false, String(err.message || err).split('\n')[0]);
  }

  result.pass = result.blockers.length === 0;
  caseResults.push(result);
  console.log(result.pass ? `PASS ${cvCase.id}` : `FAIL ${cvCase.id}: ${result.blockers.join('; ')}`);
}

await browser.close();
server.close();

const passCount = caseResults.filter((r) => r.pass).length;
const renderLoopOk = globalChecks.sanitizedCounts <= CASES.length * 2 + 2;
const fatalOk = globalChecks.fatalErrors.length === 0;
const uploadOk = globalChecks.uploadAlwaysClickable;
const coreOk = globalChecks.coreBootOk;

const gatePass = passCount >= 4 && fatalOk && renderLoopOk && uploadOk && coreOk;
const verdict = gatePass ? 'PASS' : passCount >= 3 ? 'PARTIAL' : 'FAIL';

const blockers = [];
if (passCount < 4) blockers.push(`Only ${passCount}/5 CVs passed (need 4)`);
if (!fatalOk) blockers.push(...globalChecks.fatalErrors.map((e) => `Fatal: ${e}`));
if (!renderLoopOk) blockers.push(`Render loop: SANITIZED_COUNTS logged ${globalChecks.sanitizedCounts} times`);
if (!uploadOk) blockers.push('Upload zone not always clickable');
if (!coreOk) blockers.push('Core boot failed');

for (const r of caseResults.filter((c) => !c.pass)) {
  blockers.push(`${r.label}: ${r.blockers.join('; ')}`);
}

const md = [];
md.push('# FINAL BROWSER QA REPORT');
md.push('');
md.push(`**Verdict:** ${verdict}`);
md.push(`**Date:** ${new Date().toISOString()}`);
md.push(`**Pass count:** ${passCount}/5`);
md.push('');
md.push('## Global gates');
md.push('');
md.push(`| Gate | Result |`);
md.push(`|------|--------|`);
md.push(`| 4/5 CVs pass | ${passCount >= 4 ? 'PASS' : 'FAIL'} (${passCount}/5) |`);
md.push(`| No fatal console error | ${fatalOk ? 'PASS' : 'FAIL'} (${globalChecks.fatalErrors.length}) |`);
md.push(`| No render loop | ${renderLoopOk ? 'PASS' : 'FAIL'} (SANITIZED_COUNTS=${globalChecks.sanitizedCounts}) |`);
md.push(`| Upload always clickable | ${uploadOk ? 'PASS' : 'FAIL'} |`);
md.push(`| Core boot OK | ${coreOk ? 'PASS' : 'FAIL'} |`);
md.push('');
md.push('## Per-CV results');
md.push('');
md.push('| CV | Result | Blockers |');
md.push('|----|--------|----------|');
for (const r of caseResults) {
  md.push(
    `| ${r.label} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.blockers.length ? r.blockers.join('; ').replace(/\|/g, '/') : '—'} |`
  );
}
md.push('');
md.push('## Check details');
md.push('');
for (const r of caseResults) {
  md.push(`### ${r.label}`);
  md.push('');
  for (const c of r.checks) {
    md.push(`- ${c.ok ? '✓' : '✗'} **${c.id}**${c.detail ? ` — ${c.detail}` : ''}`);
  }
  md.push('');
}
md.push('## Remaining blockers');
md.push('');
if (blockers.length) {
  for (const b of blockers) md.push(`- ${b}`);
} else {
  md.push('_None._');
}
md.push('');
md.push(`Screenshots: \`tests/output/final-browser-qa/\``);
md.push('');

fs.writeFileSync(REPORT_PATH, md.join('\n'));
fs.writeFileSync(
  path.join(OUT_DIR, 'report.json'),
  JSON.stringify({ verdict, passCount, caseResults, globalChecks, blockers }, null, 2)
);

console.log(`\nFINAL BROWSER QA: ${verdict} (${passCount}/5)`);
console.log(`Report: ${REPORT_PATH}`);
if (blockers.length) {
  console.log('\nBlockers:');
  for (const b of blockers) console.log(` - ${b}`);
}

process.exit(gatePass ? 0 : 1);
