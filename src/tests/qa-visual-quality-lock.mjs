#!/usr/bin/env node
/**
 * P0 — Visual quality lock (browser DOM, not JSON counts).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { extractFromFileDetailed } from '../core/extraction/extract-file.js';
import { scoreSectionOrder } from '../core/audit/visual-cv-quality.js';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/visual-quality-lock/report.json');

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');

const REAL_USER_CVS = [
  {
    id: 'yoaz-cv',
    label: 'Yoaz CV',
    path: '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
    mime: 'application/pdf',
  },
  {
    id: 'second-uploaded-cv',
    label: 'Second uploaded CV',
    path: '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
    mime: 'application/pdf',
  },
];

const TEMPLATE_IDS = ['ats', ...PRODUCTION_TEMPLATE_IDS];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
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

function loadOcrFallbackText() {
  if (fs.existsSync(OCR_CACHE)) {
    const t = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8')).ocrText;
    if (t && t.length > 80) return t;
  }
  if (fs.existsSync(TRACE_PATH)) {
    const t = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8')).checkpoints?.OCR_OUTPUT?.object?.text;
    if (t && t.length > 80) return t;
  }
  return '';
}

function loadPdfAcceptanceText() {
  const cachePath = path.join(ROOT, 'tests/output/pdf-acceptance/report.json');
  if (!fs.existsSync(cachePath)) return '';
  const lr = JSON.parse(fs.readFileSync(cachePath, 'utf8'))?.browserReport?.pdf?.lastResult || {};
  return lr.rawText || lr.cleanedText || lr.structuredResume?.rawExtraction || '';
}

async function runPasteFallbackImport(page, fallbackText) {
  await page.evaluate(async (raw) => {
    if (typeof hideImportPasteFallback === 'function') hideImportPasteFallback();
    if (window.HirelyParse?.applyCvPipeline) {
      await window.HirelyParse.applyCvPipeline(raw, {
        source: 'paste-fallback',
        trusted: true,
        forceContinue: true,
      });
    }
    if (typeof ensureImportReviewVisible === 'function') {
      ensureImportReviewVisible({ partial: true, renderSource: 'visual-quality-lock' });
    }
    if (typeof renderCV === 'function') renderCV();
  }, fallbackText);
  await page
    .waitForFunction(
      () =>
        document.getElementById('workspaceGrid')?.classList.contains('workspaceGrid--ready') ||
        document.getElementById('cvDoc')?.classList.contains('cv--live'),
      { timeout: 180000 }
    )
    .catch(() => {});
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
      workspace: document.getElementById('workspaceGrid')?.classList.contains('workspaceGrid--ready'),
    }));
    if (s.gate) {
      const cont = page.locator('#extractionGateContinue');
      if ((await cont.count()) > 0 && (await cont.isVisible())) {
        await cont.click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    if (s.fallback) return { ok: false, fallback: true };
    if ((s.live || s.workspace) && !s.busy && !s.empty) return { ok: true };
    await page.waitForTimeout(500);
  }
  return { ok: false, timeout: true };
}

async function uploadRealFile(page, filePath, mimeType) {
  const buf = fs.readFileSync(filePath);
  return page.evaluate(
    async ({ b64, name, type }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type });
      return window.HirelyParse.handleFileImport(file, 'visual-quality-lock');
    },
    { b64: buf.toString('base64'), name: path.basename(filePath), type: mimeType }
  );
}

async function importRealCv(page, port, cvCase) {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
    timeout: 180000,
  });

  const importStatus = await uploadRealFile(page, cvCase.path, cvCase.mime);
  let importPath = 'direct';
  let imp = await waitImportDone(page, cvCase.id === 'second-uploaded-cv' ? 420000 : 360000);

  if (!imp.ok && (imp.fallback || imp.timeout)) {
    let fallbackText = '';
    if (cvCase.id === 'yoaz-cv') {
      fallbackText = loadOcrFallbackText();
      importPath = 'ocr-cache-fallback';
    } else {
      fallbackText = loadPdfAcceptanceText();
      importPath = 'browser-acceptance-cache';
    }
    if (fallbackText.length >= 80) {
      await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await page.waitForFunction(() => typeof window.HirelyParse?.applyCvPipeline === 'function', {
        timeout: 180000,
      });
      await runPasteFallbackImport(page, fallbackText);
      importPath = `${importPath}-fresh-paste`;
      imp = await waitImportDone(page, 180000);
    }
  }

  return { importStatus, importPath, imp };
}

async function renderTemplateExport(page, templateId) {
  await page.evaluate((tpl) => {
    if (typeof setDocStep === 'function') setDocStep('export');
    state.template = tpl;
    if (typeof renderCV === 'function') renderCV(null, tpl);
    const cv = document.getElementById('cvDoc');
    if (cv?.classList.contains('cv--live') && window.HirelyA4Pages?.layoutCvA4Pages) {
      window.HirelyA4Pages.layoutCvA4Pages(cv);
    }
    if (typeof renderExtractionQualityStep === 'function') renderExtractionQualityStep();
  }, templateId);
  await page.waitForTimeout(1200);
}

async function collectVisualDomSnapshot(page) {
  return page.evaluate(() => {
    const cvDoc = document.getElementById('cvDoc');
    const frd = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const id = frd?.identity || {};
    const sectionOrder = [];
    const seen = new Set();
    const root =
      cvDoc?.querySelector('.cvA4Stack .cvA4Sheet:first-child .cvA4Sheet__surface') ||
      cvDoc?.querySelector('.cvInner') ||
      cvDoc;

    const pushKey = (key) => {
      if (!seen.has(key)) {
        seen.add(key);
        sectionOrder.push(key);
      }
    };

    if (root?.querySelector('.cvHead, .cvName')) pushKey('identity');
    if (root?.querySelector('.cvLead, .cvSection--summary')) pushKey('summary');

    const map = [
      ['experience', '.cvSection--experience'],
      ['clients', '.cvSection--clients'],
      ['projects', '.cvSection--projects'],
      ['education', '.cvSection--education'],
      ['skills', '.cvSection--skills'],
      ['tools', '.cvSection--tools, .cvSection--software'],
      ['languages', '.cvSection--languages'],
    ];
    for (const [key, sel] of map) {
      if (root?.querySelector(sel)) pushKey(key);
    }

    const firstSheet = cvDoc?.querySelector('.cvA4Stack > .cvA4Sheet:first-child') || cvDoc;
    const surface = firstSheet?.querySelector('.cvA4Sheet__surface') || firstSheet;
    const pageText = String(surface?.innerText || cvDoc?.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();
    const contentPx = Math.max(surface?.scrollHeight || 0, surface?.offsetHeight || 0);
    const pageHeightPx = 1123;
    const fillRatio = pageHeightPx > 0 ? Math.min(1, contentPx / pageHeightPx) : 0;

    const expOnPage1 = !!firstSheet?.querySelector(
      '.cvSection--experience .cvExpEntry, .cvSection--experience .cvTimelineItem, .cvSection--experience .cvExpList'
    );

    const dupCounts = {};
    for (const [key, sel] of map) {
      const n = cvDoc ? cvDoc.querySelectorAll(`.cvSection`).length : 0;
      if (!n) continue;
      const c = [...cvDoc.querySelectorAll('.cvSection')].filter((el) => el.matches(sel)).length;
      if (c > 1) dupCounts[key] = c;
    }

    let detectionRows = [];
    if (typeof buildExtractionQualityReport === 'function') {
      const rep = buildExtractionQualityReport();
      detectionRows = rep?.rows || [];
    }

    const hasExp = (frd?.experiences || []).some(
      (e) => e && (e.role || e.company || e.dates || (e.bullets || []).length)
    );

    return {
      identityName: String(id.name || '').trim(),
      sectionOrder,
      page1: {
        fillRatio,
        textLen: pageText.length,
        blankRatio: Math.max(0, 1 - fillRatio),
        contentPx,
      },
      experienceOnPage1: expOnPage1,
      duplicateSections: Object.entries(dupCounts).map(([section, count]) => ({ section, count })),
      detectionRows,
      dataPresent: {
        summary: !!String(frd?.summary || '').trim(),
        experience: hasExp,
        clients: (frd?.clients || []).some((x) => String(x || '').trim()),
        projects: (frd?.projects || []).some((x) => String(x || '').trim()),
        education: (frd?.education || []).some((x) => String(x || '').trim()),
        skills: (frd?.skills || []).some((x) => String(x || '').trim()),
        tools: (frd?.tools || []).some((x) => String(x || '').trim()),
        languages: (frd?.languages || []).some((x) => String(x || '').trim()),
      },
      cvLive: cvDoc?.classList.contains('cv--live'),
      pageCount: cvDoc?.querySelectorAll('.cvA4Stack > .cvA4Sheet').length || 1,
      previewTextLen: String(cvDoc?.innerText || '').replace(/\s+/g, ' ').trim().length,
    };
  });
}

const available = REAL_USER_CVS.filter((c) => fs.existsSync(c.path));
if (available.length < 2) {
  console.error('Need both real user CV files:', REAL_USER_CVS.map((c) => c.path));
  process.exit(1);
}

const port = 3100 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

const reports = [];

for (const cvCase of available) {
  const { importStatus, importPath } = await importRealCv(page, port, cvCase);
  const templateResults = [];

  for (const templateId of TEMPLATE_IDS) {
    await renderTemplateExport(page, templateId);
    const snap = await collectVisualDomSnapshot(page);
    const orderAudit = scoreSectionOrder(snap.sectionOrder, snap.dataPresent);

    const checks = {
      page1Density:
        snap.page1.fillRatio >= 0.4 && snap.page1.textLen >= 180 && snap.cvLive,
      sectionOrder: orderAudit.score >= 75 && !orderAudit.issues.includes('skills_before_experience'),
      noGiantBlank: snap.page1.blankRatio <= 0.38,
      experienceOnPage1: !snap.dataPresent.experience || snap.experienceOnPage1,
      noDuplicateSections: snap.duplicateSections.length === 0,
      detectionParity: !(
        snap.dataPresent.education &&
        snap.detectionRows.find((r) => r.key === 'education' && !r.ok)
      ),
      meaningfulIdentity: snap.identityName.length > 2,
      cvLive: snap.cvLive,
    };

    let visualScore = 0;
    if (checks.page1Density) visualScore += 20;
    if (checks.sectionOrder) visualScore += 20;
    if (checks.noGiantBlank) visualScore += 15;
    if (checks.experienceOnPage1) visualScore += 20;
    if (checks.noDuplicateSections) visualScore += 10;
    if (checks.detectionParity) visualScore += 10;
    if (checks.meaningfulIdentity) visualScore += 5;

    const pass = Object.values(checks).every(Boolean);

    ok(
      pass,
      `${cvCase.id}/${templateId} visual (${visualScore}/100, order=${snap.sectionOrder.join('>')})`
    );

    templateResults.push({
      templateId,
      visualScore,
      pass,
      checks,
      order: snap.sectionOrder,
      orderIssues: orderAudit.issues,
      page1: snap.page1,
      experienceOnPage1: snap.experienceOnPage1,
      duplicates: snap.duplicateSections,
      detectionRows: snap.detectionRows.map((r) => ({ key: r.key, ok: r.ok, label: r.ok ? r.labelOk : r.labelMiss })),
      previewTextLen: snap.previewTextLen,
      pageCount: snap.pageCount,
    });
  }

  const cvPass = templateResults.every((t) => t.pass);
  reports.push({
    id: cvCase.id,
    label: cvCase.label,
    file: cvCase.path,
    importStatus,
    importPath,
    pass: cvPass,
    templates: templateResults,
    primaryTemplate: 'ats',
    primaryPass: templateResults.find((t) => t.templateId === 'ats')?.pass ?? false,
  });
}

await browser.close();
server.close();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: 'browser-visual',
      cvs: reports,
      pass: failed === 0 && reports.every((r) => r.pass),
    },
    null,
    2
  )
);

console.log(`\nReport JSON: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
