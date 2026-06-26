#!/usr/bin/env node
/**
 * HIRELY P1 — Real World CV QA Lock (5 diverse inputs, Playwright).
 * Output: REAL_WORLD_CV_QA_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { FORBIDDEN_TEMPLATE_CV_KEYS } from '../src/core/pipeline/hirely-flow-lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tests/output/real-world-cv-qa-lock');
const REPORT_PATH = path.join(ROOT, 'REAL_WORLD_CV_QA_LOCK_REPORT.md');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
  path.join(ROOT, 'tests/output/p7-final-lock/fixture.pdf'),
].filter(Boolean);

const SECTION_LABEL_RE =
  /\b(education|formation|competences|compétences|langues|languages|clients|skills|tools|experience|experiences|profile|contact)\b/i;

const CASES = [
  {
    id: 'yoaz-scanned-pdf',
    label: 'Yoaz scanned PDF',
    kind: 'pdf',
    resolve: () => PDF_CANDIDATES.find((p) => p && fs.existsSync(p)) || null,
  },
  {
    id: 'designer-cv',
    label: 'Designer CV',
    kind: 'text',
    fixture: 'tests/fixtures/creative-cv/fixture.txt',
  },
  {
    id: 'developer-cv',
    label: 'Developer CV',
    kind: 'text',
    fixture: 'tests/fixtures/developer-cv/fixture.txt',
  },
  {
    id: 'marketing-cv',
    label: 'Marketing CV',
    kind: 'text',
    fixture: 'tests/fixtures/marketing-cv/fixture.txt',
  },
  {
    id: 'simple-text-cv',
    label: 'Simple text CV',
    kind: 'text',
    fixture: 'tests/fixtures/mvp-sample.txt',
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
        await window.HirelyParse.handleFileImport(file, 'real-world-qa');
      },
      { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
    );
    return { source: pdfPath };
  }
  const fixturePath = path.join(ROOT, cvCase.fixture);
  const text = fs.readFileSync(fixturePath, 'utf8');
  await page.evaluate(
    async ({ content, name }) => {
      const file = new File([content], name, { type: 'text/plain' });
      await window.HirelyParse.handleFileImport(file, 'real-world-qa');
    },
    { content: text, name: path.basename(cvCase.fixture) }
  );
  return { source: cvCase.fixture };
}

async function collectCaseReport(page, forbiddenKeys) {
  return page.evaluate((forbidden) => {
    const sectionLabelRe =
      /\b(education|formation|competences|compétences|langues|languages|clients|skills|tools|experience|experiences|profile|contact)\b/i;

    const normKey = (s) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const cvEl = document.getElementById('cvDoc');
    const cvText = cvEl?.innerText || '';
    const finalCv = typeof getFinalCvData === 'function' ? getFinalCvData() : null;
    const finalResume = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const scoreReport =
      typeof computeProductScoreReport === 'function' ? computeProductScoreReport() : null;
    const importQuality =
      typeof resolveImportQualityScore === 'function' ? resolveImportQualityScore() : null;
    const scoreEls = ['studioScore', 'score', 'recruiterAtsScore', 'exportFinalScore'].map((id) =>
      document.getElementById(id)
    );
    const metricsEl = document.getElementById('studioMetrics') || document.getElementById('metrics');
    const exportBtn = document.getElementById('downloadBtn');
    const exportFinalBtn = document.getElementById('exportFinalCvPdf');

    const bootFailed =
      window.__HIRELY_CORE_BOOT__ === 'failed' ||
      (document.getElementById('hirelyCoreLoadError') &&
        !document.getElementById('hirelyCoreLoadError').classList.contains('hidden'));

    const education = (finalResume?.education || finalCv?.education || []).map((e) =>
      typeof e === 'string' ? e : [e.school, e.degree, e.dates].filter(Boolean).join(' — ')
    );
    const experiences = finalResume?.experiences || [];

    const eduDupes = [];
    const eduSeen = new Set();
    for (const line of education) {
      const key = normKey(line);
      if (!key) continue;
      if (eduSeen.has(key)) eduDupes.push(line);
      eduSeen.add(key);
    }

    const expDupes = [];
    const expSeen = new Set();
    for (const exp of experiences) {
      const key = normKey(`${exp?.role}|${exp?.company}|${exp?.dates}`);
      if (!key.replace(/\|/g, '').length) continue;
      if (expSeen.has(key)) expDupes.push(`${exp?.role} @ ${exp?.company}`);
      expSeen.add(key);
    }

    const headerBlob = [
      finalResume?.identity?.name,
      finalResume?.identity?.title,
      finalCv?.name,
      finalCv?.title,
    ]
      .filter(Boolean)
      .join(' ');

    const forbiddenCvKeys = Object.keys(finalCv || {}).filter((k) => forbidden.includes(k));
    const forbiddenWarnings = [];

    const visibleIssues = [];
    if (!cvEl?.classList.contains('cv--live') || cvEl?.querySelector('.cvEmptyState')) {
      visibleIssues.push('CV preview empty or not live');
    }
    if (sectionLabelRe.test(headerBlob)) {
      visibleIssues.push(`Section label in header: ${headerBlob.slice(0, 80)}`);
    }
    if (eduDupes.length) visibleIssues.push(`Duplicate education: ${eduDupes.join(' | ')}`);
    if (expDupes.length) visibleIssues.push(`Duplicate experience: ${expDupes.join(' | ')}`);
    if (forbiddenCvKeys.length) {
      visibleIssues.push(`TEMPLATE_FORBIDDEN_CV_KEY: ${forbiddenCvKeys.join(', ')}`);
    }
    if (/\b(wustrator|mustrator|gradric|v3\s*2|20M|@\s*man)\b/i.test(cvText)) {
      visibleIssues.push('Raw OCR fragments in preview');
    }

    const contractRenderable =
      typeof isFinalResumeValid === 'function' ? isFinalResumeValid() : !!finalResume;

    const pipeline = typeof state !== 'undefined' ? state?.lastPipeline : null;
    const importStatus =
      (typeof state !== 'undefined' ? state?.lastImportStatus : null) || pipeline?.importStatus || '—';
    const extractionMethod = pipeline?.method || window.state?.lastAudit?.extractionMethod || '—';

    return {
      boot: bootFailed ? 'CORE_BOOT_FAILED' : 'ok',
      import: window.state?.lastImportStatus || (cvEl?.classList.contains('cv--live') ? 'IMPORT_OK' : 'pending'),
      extraction: {
        status: importStatus,
        method: extractionMethod,
        quality:
          (typeof state !== 'undefined' ? state?.extractionQuality : null) ||
          pipeline?.assessment?.quality ||
          '—',
        lineCount: pipeline?.stages?.extraction?.lineCount ?? pipeline?.extractionReport?.lineCount ?? null,
        retentionPct: pipeline?.retention?.retentionPct ?? null,
      },
      parser: {
        status: finalResume ? (contractRenderable ? 'ok' : 'not_renderable') : 'missing',
        contractOk: contractRenderable,
        warnings: [],
      },
      counts: {
        experiences: experiences.length,
        education: education.length,
        skills: (finalResume?.skills || finalCv?.skills || []).length,
        tools: (finalResume?.tools || finalCv?.tools || []).length,
        languages: (finalResume?.languages || finalCv?.languages || []).length,
        clients: (finalResume?.clients || finalCv?.clients || []).length,
        suggestions: (finalResume?.suggestions || []).length,
      },
      visibleIssues,
      score: {
        product: scoreReport?.total ?? scoreReport?.score ?? null,
        importQuality,
        text:
          scoreEls
            .map((el) => el?.textContent?.trim())
            .find((t) => t && t !== '—' && /\d/.test(t)) || '',
        visible:
          (Number.isFinite(scoreReport?.total ?? scoreReport?.score) &&
            (scoreReport?.total ?? scoreReport?.score) > 0) ||
          scoreEls.some((el) => {
            const t = el?.textContent?.trim() || '';
            return t && t !== '—' && /\d/.test(t);
          }),
        metricsVisible: !!(metricsEl && metricsEl.innerHTML?.trim()),
      },
      export: {
        buttonVisible: false,
        buttonDisabled: !!exportBtn?.disabled,
        docStep: typeof state !== 'undefined' ? state?.docStep || '' : '',
        exportFinalVisible: !!(exportFinalBtn && !exportFinalBtn.closest('.hidden')),
      },
      cvVisible: cvEl?.classList.contains('cv--live') && !cvEl?.querySelector('.cvEmptyState'),
      eduDupes,
      expDupes,
      forbiddenCvKeys,
      headerHasSectionLabel: sectionLabelRe.test(headerBlob),
      cvTextSample: cvText.slice(0, 1200),
      name: finalResume?.identity?.name || finalCv?.name || '',
    };
  }, forbiddenKeys);
}

async function tryExport(page) {
  try {
    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('export');
    });
    await page.waitForTimeout(600);
    const btn = page.locator('#downloadBtn');
    if ((await btn.count()) === 0 || !(await btn.isVisible())) {
      return { ok: false, reason: 'export button not visible' };
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      btn.click(),
    ]);
    const out = path.join(OUT_DIR, `export-${Date.now()}.pdf`);
    await download.saveAs(out);
    const size = fs.statSync(out).size;
    return { ok: size > 1500, reason: size > 1500 ? `${size} bytes` : `too small (${size})`, path: out };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 120) };
  }
}

function evaluatePass(report, exportResult) {
  const blockers = [];
  if (report.boot !== 'ok') blockers.push('CORE_BOOT_FAILED');
  if (!report.cvVisible) blockers.push('CV preview not visible');
  if (!report.score.visible) blockers.push('Score not visible');
  if (!report.export.buttonVisible) blockers.push('Export button not visible');
  if (!exportResult.ok) blockers.push(`Missing export — ${exportResult.reason}`);
  if (report.forbiddenCvKeys.length) {
    blockers.push(`TEMPLATE_FORBIDDEN_CV_KEY — ${report.forbiddenCvKeys.join(', ')}`);
  }
  if (report.eduDupes.length) blockers.push(`Duplicate education — ${report.eduDupes.join(' | ')}`);
  if (report.expDupes.length) blockers.push(`Duplicate experience — ${report.expDupes.join(' | ')}`);
  if (report.headerHasSectionLabel) blockers.push('Section label in header');
  return { pass: blockers.length === 0, blockers };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const port = 3090 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const globalBlockers = [];
const caseResults = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  const md = `# Real World CV QA Lock Report\n\n**Verdict:** FAIL\n\nBrowser launch failed: ${e.message}\n`;
  fs.writeFileSync(REPORT_PATH, md);
  console.error('FAIL — browser launch');
  process.exit(1);
}

const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(360000);

page.on('console', (msg) => {
  const text = msg.text();
  if (/CORE_BOOT_FAILED/i.test(text)) globalBlockers.push(`console: ${text.slice(0, 160)}`);
});

for (const cvCase of CASES) {
  console.log(`\n=== ${cvCase.label} ===`);
  const row = {
    id: cvCase.id,
    label: cvCase.label,
    source: cvCase.kind === 'pdf' ? cvCase.resolve() : cvCase.fixture,
    pass: false,
    blockers: [],
    report: null,
    export: null,
  };

  if (cvCase.kind === 'pdf' && !cvCase.resolve()) {
    row.blockers = ['Yoaz PDF not found on disk'];
    caseResults.push(row);
    continue;
  }

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
      timeout: 180000,
    });

    const importMeta = await importCase(page, cvCase);
    row.source = importMeta.source;

    const done = await waitImportDone(page, cvCase.kind === 'pdf' ? 360000 : 120000);
    if (!done.ok) row.blockers.push(done.timeout ? 'Import timeout' : 'Import did not complete');

    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('edit');
      if (typeof renderMetrics === 'function') renderMetrics();
      if (typeof renderReviewStudioV2 === 'function') renderReviewStudioV2();
      if (typeof syncStudioCvScale === 'function') syncStudioCvScale();
    });
    await page.waitForTimeout(1500);

    let report = await collectCaseReport(page, FORBIDDEN_TEMPLATE_CV_KEYS);

    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('export');
      if (typeof syncExportFinalPanel === 'function') syncExportFinalPanel();
    });
    await page.waitForTimeout(800);

    const exportUi = await page.evaluate(() => {
      const downloadBtn = document.getElementById('downloadBtn');
      const exportFinalCvPdf = document.getElementById('exportFinalCvPdf');
      const exportBar = document.getElementById('cvExportBar');
      const btnVisible = (el) => {
        if (!el) return false;
        if (el.disabled) return false;
        const barHidden = exportBar?.classList.contains('hidden');
        return !barHidden || !el.closest('.hidden');
      };
      return {
        downloadBtn: btnVisible(downloadBtn),
        exportFinalCvPdf: btnVisible(exportFinalCvPdf),
      };
    });
    report.export.buttonVisible = exportUi.downloadBtn || exportUi.exportFinalCvPdf;
    row.report = report;

    const exportResult = await tryExport(page);
    row.export = exportResult;

    const verdict = evaluatePass(report, exportResult);
    row.blockers.push(...verdict.blockers);
    row.pass = verdict.pass && row.blockers.length === 0;

    await page.screenshot({ path: path.join(OUT_DIR, `${cvCase.id}.png`), fullPage: false });
    console.log(row.pass ? `PASS ${cvCase.id}` : `FAIL ${cvCase.id}: ${row.blockers.join('; ')}`);
  } catch (err) {
    row.blockers.push(String(err.message || err).split('\n')[0]);
    console.log(`FAIL ${cvCase.id}: ${row.blockers.join('; ')}`);
  }

  caseResults.push(row);
}

await browser.close();
server.close();

const passCount = caseResults.filter((r) => r.pass).length;
const allPass = passCount === CASES.length && globalBlockers.length === 0;
const verdict = allPass ? 'PASS' : 'FAIL';

const remainingBlockers = [...new Set(globalBlockers)];
for (const r of caseResults.filter((c) => !c.pass)) {
  remainingBlockers.push(`${r.label}: ${r.blockers.join('; ')}`);
}

const md = [];
md.push('# Real World CV QA Lock Report');
md.push('');
md.push(`**Verdict:** ${verdict}`);
md.push(`**Generated:** ${new Date().toISOString()}`);
md.push(`**Pass count:** ${passCount}/${CASES.length}`);
md.push('');
md.push('## PASS gates (all required per CV)');
md.push('');
md.push('- No `CORE_BOOT_FAILED`');
md.push('- No missing export');
md.push('- No `TEMPLATE_FORBIDDEN_CV_KEY`');
md.push('- No duplicate education');
md.push('- No duplicate experience');
md.push('- No section labels in header');
md.push('- CV preview visible');
md.push('- Score visible');
md.push('- Export button visible');
md.push('');
md.push('## Summary');
md.push('');
md.push('| CV | Result | Score | Export |');
md.push('|----|--------|-------|--------|');
for (const r of caseResults) {
  const score = r.report?.score?.product ?? r.report?.score?.text ?? '—';
  const exp = r.export?.ok ? 'ok' : r.export?.reason || 'fail';
  md.push(`| ${r.label} | ${r.pass ? 'PASS' : 'FAIL'} | ${score} | ${exp} |`);
}
md.push('');
md.push('## Per-CV detail');
md.push('');

for (const r of caseResults) {
  md.push(`### ${r.label} — ${r.pass ? 'PASS' : 'FAIL'}`);
  md.push('');
  md.push(`- **Source:** \`${r.source || '—'}\``);
  if (!r.report) {
    md.push(`- **Blockers:** ${r.blockers.join('; ') || '—'}`);
    md.push('');
    continue;
  }
  const rep = r.report;
  md.push(`- **Boot:** ${rep.boot}`);
  md.push(`- **Import:** ${rep.import}`);
  md.push(
    `- **Extraction:** ${rep.extraction.status} · method=${rep.extraction.method} · quality=${rep.extraction.quality}` +
      (rep.extraction.lineCount != null ? ` · lines=${rep.extraction.lineCount}` : '') +
      (rep.extraction.retentionPct != null ? ` · retention=${rep.extraction.retentionPct}%` : '')
  );
  md.push(
    `- **Parser:** ${rep.parser.status}` +
      (rep.parser.contractOk ? ' · contract renderable' : ' · contract not renderable')
  );
  if (rep.parser.warnings?.length) {
    md.push(`  - warnings: ${rep.parser.warnings.join('; ')}`);
  }
  md.push(
    `- **finalResumeData counts:** exp=${rep.counts.experiences} edu=${rep.counts.education} skills=${rep.counts.skills} tools=${rep.counts.tools} langs=${rep.counts.languages} clients=${rep.counts.clients} suggestions=${rep.counts.suggestions}`
  );
  md.push(`- **Name:** ${rep.name || '—'}`);
  md.push(`- **Score:** ${rep.score.product ?? rep.score.text ?? '—'} (visible=${rep.score.visible || rep.score.metricsVisible})`);
  if (rep.score.importQuality) {
    const iq = rep.score.importQuality;
    md.push(
      `  - import quality: total=${iq.total ?? '—'} extraction=${iq.extraction ?? iq.metrics?.extraction ?? '—'} parser=${iq.parser ?? iq.metrics?.parser ?? '—'} completeness=${iq.completeness ?? iq.metrics?.completeness ?? '—'}`
    );
  }
  md.push(`- **Export readiness:** buttonVisible=${rep.export.buttonVisible} · export=${r.export?.ok ? 'ok' : r.export?.reason || 'fail'}`);
  md.push(`- **Visible CV issues:** ${rep.visibleIssues.length ? rep.visibleIssues.join('; ') : 'none'}`);
  if (!r.pass) md.push(`- **Blockers:** ${r.blockers.join('; ')}`);
  md.push('');
}

md.push('## Remaining blockers');
md.push('');
if (remainingBlockers.length) {
  for (const b of remainingBlockers) md.push(`- ${b}`);
} else {
  md.push('_None._');
}
md.push('');
md.push(`Artifacts: \`tests/output/real-world-cv-qa-lock/\``);
md.push('');
md.push('```bash');
md.push('npm run qa:real-world-cv-lock');
md.push('npm run real-world-cv-qa-lock-report');
md.push('```');
md.push('');

fs.writeFileSync(REPORT_PATH, md.join('\n'));
fs.writeFileSync(
  path.join(OUT_DIR, 'report.json'),
  JSON.stringify({ verdict, passCount, caseResults, globalBlockers, remainingBlockers }, null, 2)
);

console.log(`\nREAL WORLD CV QA LOCK: ${verdict} (${passCount}/${CASES.length})`);
console.log(`Report: ${REPORT_PATH}`);
if (remainingBlockers.length) {
  console.log('\nRemaining blockers:');
  for (const b of remainingBlockers) console.log(` - ${b}`);
}

process.exit(allPass ? 0 : 1);
