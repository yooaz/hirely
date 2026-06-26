#!/usr/bin/env node
/**
 * HIRELY FINAL VISIBLE QA — Yoaz PDF browser/manual acceptance.
 * node scripts/visible-qa-yoaz.mjs
 * Output: VISIBLE_QA_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { analyzePdfBytes } from '../src/tests/lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tests/output/visible-qa-yoaz');
const REPORT_PATH = path.join(ROOT, 'VISIBLE_QA_REPORT.md');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

const GARBAGE_RE =
  /\b(B\s*wma|20M|@\s*man|v3\s*2\s*gradric|ee\s+à|_—\s*pe|a>\s*tn|yoaz27\s+2008|weband|created weband)\b|2011–2011|2011-2011|—\s*—\s*[–-]\s*—/i;
const ROLE_IN_TOOLS_RE =
  /\b(graphic designer|freelance|illustrator as role|interest|photograph|and graphic)\b/i;
const LANG_IN_TOOLS_RE = /\b(native|fluent|français|french|english|anglais)\b/i;
const NAME_UNCERTAIN_RE = /nom à confirmer|name to confirm|à confirmer/i;
const TOOL_GARBAGE_RE = /^\[\d+\]|indesign me|me se\b/i;
const PERSON_NAME_RE = /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+)+$/;

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
      '.pdf': 'application/pdf',
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

async function clickDocStep(page, step) {
  const enabled = page.locator(`#docNav .hirelyProgressBtn[data-doc-step="${step}"]:not([disabled])`);
  if ((await enabled.count()) > 0) await enabled.click();
  else {
    await page.evaluate((s) => {
      if (typeof setDocStep === 'function') setDocStep(s);
    }, step);
  }
  await page.waitForTimeout(400);
}

const pdfPath = resolvePdf();
if (!pdfPath) {
  fs.writeFileSync(
    REPORT_PATH,
    '# VISIBLE QA REPORT — Yoaz PDF\n\n## Verdict\n\n**FAIL**\n\nYoaz PDF not found. Set `HIRELY_YOAZ_PDF`.\n'
  );
  console.error('FAIL — Yoaz PDF not found');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const checks = [];
const blockers = [];

function record(id, ok, detail = '') {
  checks.push({ id, ok, detail });
  if (!ok) blockers.push(`${id}${detail ? ` — ${detail}` : ''}`);
  console.log(ok ? `OK ${id}${detail ? ` — ${detail}` : ''}` : `FAIL ${id}${detail ? ` — ${detail}` : ''}`);
}

const port = 3060 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

let browser;
let context;
let page;
try {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(360000);
} catch (launchErr) {
  const msg = String(launchErr?.message || launchErr);
  fs.writeFileSync(
    REPORT_PATH,
    `# VISIBLE QA REPORT — Yoaz PDF\n\n## Verdict\n\n**FAIL**\n\nBrowser launch failed: ${msg}\n`
  );
  console.error('FAIL — browser launch:', msg);
  process.exit(1);
}

let snap = null;
let exportSnap = null;

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  const bootErr = await page.evaluate(() => {
    const banner = document.getElementById('hirelyCoreLoadError');
    const bannerVisible = banner && !banner.classList.contains('hidden');
    const bootFailed =
      window.__HIRELY_CORE_BOOT__ === 'failed' ||
      bannerVisible ||
      /CORE_BOOT_FAILED/i.test(banner?.textContent || '');
    return { bootFailed, boot: window.__HIRELY_CORE_BOOT__ || null, bannerVisible };
  });
  record('core_boot_ok', !bootErr.bootFailed, JSON.stringify(bootErr));
  if (bootErr.bootFailed) throw new Error('CORE_BOOT_FAILED');

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
      await window.HirelyParse.handleFileImport(file, 'visible-qa');
    },
    { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
  );

  const done = await waitImportDone(page);
  record('import_live', done.live, done.fallback ? 'paste fallback shown' : done.timeout ? 'timeout' : '');

  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    if (typeof setDocStep === 'function') setDocStep('edit');
    if (typeof renderMetrics === 'function') renderMetrics();
    if (typeof renderReviewStudioV2 === 'function') renderReviewStudioV2();
  });
  await page.waitForTimeout(1200);

  snap = await page.evaluate(() => {
    const cvEl = document.getElementById('cvDoc');
    const cvText = cvEl?.innerText || '';
    const cvHtml = cvEl?.innerHTML || '';
    const headerName =
      cvEl?.querySelector('.cvName, .cv-name, [data-field="name"]')?.textContent?.trim() ||
      (cvText.split('\n').find((l) => l.trim().length > 2) || '').trim();
    const emailMatch = cvText.match(/[\w.+-]+@[\w.-]+\.\w+/);
    const phoneMatch = cvText.match(/\+?\d[\d\s().-]{8,}\d/);

    const sectionText = (label) => {
      const re = new RegExp(`${label}[\\s\\S]*?(?=\\n[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜÇ][a-zéàèùâêîôûäëïöüç]|$)`, 'i');
      const m = cvText.match(re);
      return m ? m[0] : '';
    };

    const toolsSection = sectionText('Outils|Tools|Logiciels');
    const langSection = sectionText('Langues|Languages');
    const eduSection = sectionText('Formation|Education');
    const expSection = sectionText('Expérience|Experience');
    const clientsSection = sectionText('Clients|Client');

    const suggestionCards = Array.from(
      document.querySelectorAll('#suggestionsList .suggestionCard .suggestionText, #smartRepairList .smartRepairText, .toClassifyItemText')
    ).map((el) => (el.textContent || '').trim()).filter(Boolean);

    const checklistItems = Array.from(
      document.querySelectorAll('#reviewV2Checklist .atsCheckItem')
    ).map((el) => ({
      label: el.querySelector('.atsCheckLabel')?.textContent?.trim() || (el.textContent || '').trim(),
      ok: el.classList.contains('atsCheckItem--ok'),
    }));

    const scoreReport =
      typeof computeProductScoreReport === 'function' ? computeProductScoreReport() : null;
    const finalCv = typeof getFinalCvData === 'function' ? getFinalCvData() : null;
    const finalResume =
      typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const rd = window.__hirelyState?.resumeData || window.HirelyParse?.lastResult?.resumeData;

    const nameUncertain = /nom à confirmer|name to confirm/i.test(headerName || finalCv?.name || '');
    const nameEditableWarning = !!document.querySelector(
      '.nameUncertain, .identity-warning, [data-name-uncertain="true"]'
    );

    return {
      cvText: cvText.slice(0, 8000),
      headerName: headerName || finalCv?.name || rd?.identity?.name || '',
      email: emailMatch?.[0] || finalCv?.email || rd?.identity?.email || '',
      phone: phoneMatch?.[0] || finalCv?.phone || rd?.identity?.phone || '',
      nameUncertain,
      nameEditableWarning,
      expSection: expSection.slice(0, 600),
      eduSection: eduSection.slice(0, 600),
      clientsSection: clientsSection.slice(0, 600),
      toolsSection: toolsSection.slice(0, 400),
      langSection: langSection.slice(0, 300),
      toolsFromData: [...(finalCv?.tools || rd?.tools || [])],
      langsFromData: [...(finalCv?.languages || rd?.languages || [])],
      eduFromData: (finalCv?.education || rd?.education || []).map((e) =>
        typeof e === 'string' ? e : [e.school, e.degree, e.dates].filter(Boolean).join(' — ')
      ),
      clientsFromData: [...(finalCv?.clients || rd?.clients || [])],
      suggestionCards,
      checklistItems,
      score: scoreReport?.score ?? scoreReport?.total ?? null,
      scoreReport,
      finalCvName: finalCv?.name || '',
      hasExpSection: /expérience|experience/i.test(cvText),
      hasEduSection: /formation|education/i.test(cvText),
    };
  });

  await page.screenshot({ path: path.join(OUT_DIR, '01-after-import.png'), fullPage: false });

  // 1. Header
  const displayName = snap.finalCvName || snap.headerName || '';
  const nameOk =
    NAME_UNCERTAIN_RE.test(displayName)
      ? snap.nameEditableWarning
      : PERSON_NAME_RE.test(displayName.trim()) && !GARBAGE_RE.test(displayName);
  record(
    'header_name',
    nameOk,
    nameOk ? displayName : `got "${displayName}" (need person name or editable warning)`
  );
  record('header_email', !!snap.email, snap.email || 'missing');
  record('header_phone', !!snap.phone, snap.phone || 'missing');

  // 2. CV preview
  record('preview_experience', snap.hasExpSection, snap.expSection.slice(0, 120) || 'no section');
  const eduGarbage =
    GARBAGE_RE.test(snap.eduSection) ||
    snap.eduFromData.some((e) => GARBAGE_RE.test(e) || /\)\s*—|weband/i.test(e));
  record('preview_education_clean', !eduGarbage, snap.eduFromData.join(' | '));
  const clientsGarbage = GARBAGE_RE.test(snap.clientsSection);
  record(
    'preview_clients_clean',
    !clientsGarbage && snap.clientsFromData.length > 0,
    `count=${snap.clientsFromData.length} ${snap.clientsFromData.slice(0, 4).join(', ')}`
  );
  const toolsGarbage =
    snap.toolsFromData.some((t) => ROLE_IN_TOOLS_RE.test(t) || LANG_IN_TOOLS_RE.test(t) || TOOL_GARBAGE_RE.test(t)) ||
    ROLE_IN_TOOLS_RE.test(snap.toolsSection) ||
    LANG_IN_TOOLS_RE.test(snap.toolsSection);
  record(
    'preview_tools_clean',
    !toolsGarbage,
    toolsGarbage ? snap.toolsFromData.join(', ') : snap.toolsFromData.join(', ')
  );
  const langKeys = snap.langsFromData.map((l) => l.split('—')[0].trim().toLowerCase());
  const langDupes = langKeys.filter((k, i) => langKeys.indexOf(k) !== i);
  const langsSeparate =
    snap.langsFromData.length >= 1 &&
    langDupes.length === 0 &&
    !snap.toolsFromData.some((t) => LANG_IN_TOOLS_RE.test(t));
  record(
    'preview_languages_separate',
    langsSeparate,
    langDupes.length ? `duplicate: ${snap.langsFromData.join(', ')}` : snap.langsFromData.join(', ') || 'none'
  );
  const previewGarbage = GARBAGE_RE.test(snap.cvText);
  record('preview_no_ocr_garbage', !previewGarbage, previewGarbage ? 'garbage in cvText' : 'clean');

  // 3. Suggestions
  record(
    'suggestions_max_3',
    snap.suggestionCards.length <= 3,
    `visible=${snap.suggestionCards.length} [${snap.suggestionCards.join(' | ')}]`
  );
  const badSuggest = snap.suggestionCards.filter((t) => /B\s*wma|movies\b/i.test(t) || GARBAGE_RE.test(t));
  record('suggestions_no_noise', badSuggest.length === 0, badSuggest.join(' | ') || 'clean');
  const dupSuggest = snap.suggestionCards.filter((t) =>
    /freelance illustrator|lisaa|nike|photoshop/i.test(t) &&
    snap.cvText.toLowerCase().includes(t.toLowerCase().slice(0, 12))
  );
  record('suggestions_no_dup_accepted', dupSuggest.length === 0, dupSuggest.join(' | ') || 'clean');

  // 4. Recruiter score
  const score = Number(snap.score) || 0;
  record('recruiter_score_80', score >= 80, `score=${score}`);
  const checklistFromScore = snap.scoreReport?.checks || {};
  const checklistMatchers = [
    ['email', /email/i, checklistFromScore.email],
    ['phone', /téléphone|phone/i, checklistFromScore.phone],
    ['expérience', /expérience|experience/i, checklistFromScore.experience],
    ['formation', /formation|education/i, checklistFromScore.education],
    ['compétence', /compétence|skill/i, checklistFromScore.skills],
  ];
  for (const [key, re, scoreOk] of checklistMatchers) {
    const domItem = snap.checklistItems.find((c) => re.test(c.label));
    const ok = domItem?.ok ?? scoreOk;
    record(`checklist_${key}`, !!ok, domItem ? `${domItem.label} ${domItem.ok ? '✓' : '✗'}` : `score=${scoreOk}`);
  }

  await page.screenshot({ path: path.join(OUT_DIR, '02-review-checklist.png'), fullPage: false });

  // 5. Export
  await clickDocStep(page, 'export');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '03-export-step.png'), fullPage: false });

  let pdfBytes = 0;
  let pdfPages = 0;
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.locator('#downloadBtn').click(),
    ]);
    const pdfOut = path.join(OUT_DIR, 'yoaz-visible-export.pdf');
    await download.saveAs(pdfOut);
    const buf = fs.readFileSync(pdfOut);
    pdfBytes = buf.length;
    const analysis = await analyzePdfBytes(buf);
    pdfPages = analysis.pageCount;
    record('export_pdf_download', pdfBytes > 2000, `${pdfBytes} bytes pages=${pdfPages}`);
  } catch (e) {
    record('export_pdf_download', false, String(e?.message || e));
  }

  exportSnap = await page.evaluate(() => {
    const items = typeof buildProductChecklist === 'function'
      ? buildProductChecklist(state?.lastScoreReport || null, true)
      : [];
    const exportItem = items.find((i) => i.id === 'export');
    const domTexts = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].map((el) => ({
      label: el.querySelector('.atsCheckLabel')?.textContent?.trim(),
      ok: el.classList.contains('atsCheckItem--ok'),
    }));
    return {
      cvPdfExported: !!state?.cvPdfExported,
      exportChecklistOk: !!exportItem?.ok,
      domItems: domTexts,
    };
  });
  record(
    'export_checklist_checked',
    exportSnap.cvPdfExported && exportSnap.exportChecklistOk,
    JSON.stringify(exportSnap)
  );

  await page.screenshot({ path: path.join(OUT_DIR, '04-after-export.png'), fullPage: false });
} catch (err) {
  record('runner', false, String(err?.message || err).split('\n')[0]);
} finally {
  await browser.close();
  server.close();
}

const pass = blockers.length === 0;
const verdict = pass ? 'PASS' : 'FAIL';

const md = [];
md.push('# VISIBLE QA REPORT — Yoaz PDF');
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push(`PDF: \`${pdfPath}\``);
md.push(`Screenshots: \`tests/output/visible-qa-yoaz/\``);
md.push('');
md.push('## Verdict');
md.push('');
md.push(`**${verdict}**`);
md.push('');
md.push('## Browser checks');
md.push('');
md.push('| Check | Result | Detail |');
md.push('|-------|--------|--------|');
for (const c of checks) {
  md.push(`| ${c.id} | ${c.ok ? '✓' : '✗'} | ${String(c.detail || '').replace(/\|/g, '\\|').slice(0, 120)} |`);
}
md.push('');
if (snap) {
  md.push('## Captured visible state');
  md.push('');
  md.push(`- **Name:** ${snap.headerName || snap.finalCvName || '—'}`);
  md.push(`- **Email:** ${snap.email || '—'}`);
  md.push(`- **Phone:** ${snap.phone || '—'}`);
  md.push(`- **Score:** ${snap.score ?? '—'}`);
  md.push(`- **Tools:** ${snap.toolsFromData.join(', ') || '—'}`);
  md.push(`- **Languages:** ${snap.langsFromData.join(', ') || '—'}`);
  md.push(`- **Education:** ${snap.eduFromData.join(' · ') || '—'}`);
  md.push(`- **Clients:** ${snap.clientsFromData.slice(0, 8).join(', ') || '—'}`);
  md.push(`- **Suggestions (${snap.suggestionCards.length}):** ${snap.suggestionCards.join(' · ') || '—'}`);
  md.push('');
  md.push('### Checklist (DOM)');
  for (const item of snap.checklistItems || []) {
    md.push(`- ${item.ok ? '✓' : '✗'} ${item.label}`);
  }
}
if (exportSnap) {
  md.push('');
  md.push('### Export state');
  md.push(`- cvPdfExported: ${exportSnap.cvPdfExported}`);
  md.push(`- export checklist: ${exportSnap.exportChecklistOk ? '✓' : '✗'}`);
}
md.push('');
if (blockers.length) {
  md.push('## Remaining visible blockers');
  md.push('');
  for (const b of blockers) md.push(`- ${b}`);
} else {
  md.push('## Remaining visible blockers');
  md.push('');
  md.push('_None._');
}
md.push('');

fs.writeFileSync(REPORT_PATH, md.join('\n'));
fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ pass, checks, snap, exportSnap, blockers }, null, 2));

console.log(`\nVISIBLE QA ${verdict}`);
console.log(`Report: ${REPORT_PATH}`);
if (blockers.length) {
  console.log('\nBlockers:');
  for (const b of blockers) console.log(` - ${b}`);
}
process.exit(pass ? 0 : 1);
