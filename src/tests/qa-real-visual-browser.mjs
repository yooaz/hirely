#!/usr/bin/env node
/**
 * P0 — Real visual browser QA (screenshots + DOM, not JSON counts).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { scoreRealVisualBrowser } from '../core/audit/visual-cv-quality.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/visual-browser-qa');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const PDF_CACHE = path.join(ROOT, 'tests/output/pdf-acceptance/report.json');
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
    if (t?.length > 80) return t;
  }
  if (fs.existsSync(TRACE_PATH)) {
    const t = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8')).checkpoints?.OCR_OUTPUT?.object?.text;
    if (t?.length > 80) return t;
  }
  return '';
}

function loadPdfAcceptanceText() {
  if (!fs.existsSync(PDF_CACHE)) return '';
  const lr = JSON.parse(fs.readFileSync(PDF_CACHE, 'utf8'))?.browserReport?.pdf?.lastResult || {};
  return lr.rawText || lr.cleanedText || '';
}

async function runPasteFallbackImport(page, text) {
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
      ensureImportReviewVisible({ partial: true, renderSource: 'real-visual-browser' });
    }
    if (typeof renderCV === 'function') renderCV();
  }, text);
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

async function importCv(page, port, cvCase) {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
    timeout: 180000,
  });

  const buf = fs.readFileSync(cvCase.path);
  const importStatus = await page.evaluate(
    async ({ b64, name, type }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type });
      return window.HirelyParse.handleFileImport(file, 'real-visual-browser');
    },
    { b64: buf.toString('base64'), name: path.basename(cvCase.path), type: cvCase.mime }
  );

  let importPath = 'direct';
  let imp = await waitImportDone(page, cvCase.id === 'second-uploaded-cv' ? 420000 : 360000);

  if (!imp.ok) {
    const fallback =
      cvCase.id === 'yoaz-cv' ? loadOcrFallbackText() : loadPdfAcceptanceText();
    if (fallback.length >= 80) {
      await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.HirelyParse?.applyCvPipeline === 'function', {
        timeout: 180000,
      });
      await runPasteFallbackImport(page, fallback);
      importPath = cvCase.id === 'yoaz-cv' ? 'ocr-cache-fallback' : 'browser-acceptance-cache';
      imp = await waitImportDone(page, 180000);
    }
  }

  return { importStatus, importPath, imp };
}

async function getAllTemplateIds(page) {
  return page.evaluate(() => {
    const ids = new Set();
    if (window.HirelyTemplates?.list) {
      for (const t of window.HirelyTemplates.list) if (t?.id) ids.add(t.id);
    }
    if (window.HirelyTemplates?.PRODUCTION_TEMPLATE_IDS) {
      for (const id of window.HirelyTemplates.PRODUCTION_TEMPLATE_IDS) ids.add(id);
    }
    ids.add('ats');
    return [...ids];
  });
}

async function renderExportTemplate(page, templateId) {
  await page.evaluate((tpl) => {
    if (typeof setDocStep === 'function') setDocStep('export');
    state.template = tpl;
    if (typeof renderCV === 'function') renderCV(null, tpl);
    const cv = document.getElementById('cvDoc');
    if (cv?.classList.contains('cv--live') && window.HirelyA4Pages?.layoutCvA4Pages) {
      window.HirelyA4Pages.layoutCvA4Pages(cv);
    }
    if (typeof ensureExportPreviewRendered === 'function') ensureExportPreviewRendered();
    if (window.HirelyA4Viewport?.applyZoom) window.HirelyA4Viewport.applyZoom('fit');
  }, templateId);
  await page.waitForTimeout(1200);
}

async function collectVisualSnapshot(page) {
  return page.evaluate(() => {
    const cvDoc = document.getElementById('cvDoc');
    const preview = document.getElementById('studioPreview');
    const frd = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const id = frd?.identity || {};

    const sectionVisible = (sel, minLen = 8) => {
      const el = cvDoc?.querySelector(sel);
      if (!el) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
      const text = String(el.innerText || '').replace(/\s+/g, ' ').trim();
      return text.length >= minLen;
    };

    const identityEl = cvDoc?.querySelector('.cvName, .cvHead h1, .cvHead .cvName');
    const identityText = String(identityEl?.innerText || cvDoc?.querySelector('.cvHead')?.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();

    const firstSheet = cvDoc?.querySelector('.cvA4Stack > .cvA4Sheet:first-child') || cvDoc;
    const surface = firstSheet?.querySelector('.cvA4Sheet__surface') || firstSheet;
    const pageText = String(surface?.innerText || cvDoc?.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();
    const contentPx = Math.max(surface?.scrollHeight || 0, surface?.offsetHeight || 0);
    const pageHeightPx = 1123;
    const fillRatio = pageHeightPx > 0 ? Math.min(1, contentPx / pageHeightPx) : 0;

    const expOnPage1 = !!firstSheet?.querySelector(
      '.cvSection--experience .cvExpEntry, .cvSection--experience .cvTimelineItem, .cvSection--experience .cvExpList, .cvSection--experience .cvTimeline'
    );

    const map = [
      ['experience', '.cvSection--experience'],
      ['clients', '.cvSection--clients'],
      ['projects', '.cvSection--projects'],
      ['education', '.cvSection--education'],
      ['skills', '.cvSection--skills'],
      ['tools', '.cvSection--tools, .cvSection--software'],
      ['languages', '.cvSection--languages'],
    ];
    const dupCounts = {};
    for (const [key, sel] of map) {
      const c = cvDoc
        ? [...cvDoc.querySelectorAll('.cvSection')].filter((el) => el.matches(sel)).length
        : 0;
      if (c > 1) dupCounts[key] = c;
    }

    const internalClip = [];
    const walkClip = (el) => {
      const st = getComputedStyle(el);
      if (
        (st.overflow === 'hidden' || st.overflowY === 'hidden' || st.overflowY === 'auto' || st.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 4 &&
        (el.classList?.contains('cvSectionBody') ||
          el.classList?.contains('cvA4Sheet__surface') ||
          el.classList?.contains('cvInner') ||
          el.classList?.contains('cvA4Sheet'))
      ) {
        internalClip.push({
          cls: el.className,
          page: el.closest('.cvA4Sheet')?.dataset?.page || '1',
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          delta: el.scrollHeight - el.clientHeight,
        });
      }
      for (const ch of el.children || []) walkClip(ch);
    };
    if (cvDoc) walkClip(cvDoc);

    const hasExp = (frd?.experiences || []).some(
      (e) => e && (e.role || e.company || e.dates || (e.bullets || []).length)
    );

    return {
      identityName: String(id.name || identityText || '').trim(),
      experienceOnPage1: expOnPage1,
      page1: {
        fillRatio,
        textLen: pageText.length,
        blankRatio: Math.max(0, 1 - fillRatio),
        contentPx,
      },
      duplicateSections: Object.entries(dupCounts).map(([section, count]) => ({ section, count })),
      internalClip: internalClip.slice(0, 12),
      dom: {
        identityVisible: identityText.length > 2,
        clientsVisible: sectionVisible('.cvSection--clients', 6),
        educationVisible: sectionVisible('.cvSection--education', 6),
        experienceVisible: sectionVisible('.cvSection--experience', 12),
      },
      export: {
        docStep: document.getElementById('workspace')?.dataset?.docStep || '',
        previewVisible: !!(preview && !preview.classList.contains('hidden')),
        previewExportClass: preview?.classList.contains('studioPreview--export'),
        cvVisible: !!(cvDoc && cvDoc.offsetParent !== null),
        cvLive: cvDoc?.classList.contains('cv--live'),
        cvA4: cvDoc?.classList.contains('cv--a4'),
        cvTextLen: String(cvDoc?.innerText || '').replace(/\s+/g, ' ').trim().length,
        previewHeight: Math.round(preview?.getBoundingClientRect()?.height || 0),
      },
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
      pageCount: cvDoc?.querySelectorAll('.cvA4Stack > .cvA4Sheet').length || 1,
    };
  });
}

async function captureScreenshots(page, cvId, templateId) {
  const dir = path.join(OUT_DIR, cvId, templateId);
  fs.mkdirSync(dir, { recursive: true });

  const exportView = path.join(dir, 'export-view.png');
  const page1Cv = path.join(dir, 'page1-cv.png');

  const preview = page.locator('#studioPreview');
  if ((await preview.count()) > 0) {
    await preview.screenshot({ path: exportView, timeout: 30000 });
  } else {
    await page.screenshot({ path: exportView, fullPage: false });
  }

  const cv = page.locator('#cvDoc');
  if ((await cv.count()) > 0) {
    await cv.screenshot({ path: page1Cv, timeout: 30000 });
  }

  return {
    exportView: path.relative(ROOT, exportView),
    page1Cv: path.relative(ROOT, page1Cv),
  };
}

const available = REAL_USER_CVS.filter((c) => fs.existsSync(c.path));
if (available.length < 2) {
  console.error('Need both real user CV files');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const port = 3120 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

const reports = [];

for (const cvCase of available) {
  const { importStatus, importPath } = await importCv(page, port, cvCase);
  const templateIds = await getAllTemplateIds(page);
  const templateResults = [];

  for (const templateId of templateIds) {
    await renderExportTemplate(page, templateId);
    const snap = await collectVisualSnapshot(page);
    const audit = scoreRealVisualBrowser(snap);
    const screenshots = await captureScreenshots(page, cvCase.id, templateId);

    ok(
      audit.pass,
      `${cvCase.id}/${templateId} score=${audit.visualScore} issues=${audit.issues.join(',') || 'none'}`
    );

    templateResults.push({
      templateId,
      pass: audit.pass,
      visualScore: audit.visualScore,
      checks: audit.checks,
      issues: audit.issues,
      page1: audit.page1,
      experienceOnPage1: snap.experienceOnPage1,
      identityName: snap.identityName,
      internalClip: audit.internalClip,
      duplicates: audit.duplicates,
      export: snap.export,
      dataPresent: snap.dataPresent,
      screenshots,
    });
  }

  reports.push({
    id: cvCase.id,
    label: cvCase.label,
    file: cvCase.path,
    importStatus,
    importPath,
    pass: templateResults.every((t) => t.pass),
    templates: templateResults,
  });
}

await browser.close();
server.close();

const payload = {
  generatedAt: new Date().toISOString(),
  version: 'REAL_VISUAL_BROWSER_QA_V1',
  outputDir: path.relative(ROOT, OUT_DIR),
  cvs: reports,
  pass: failed === 0 && reports.every((r) => r.pass),
};

fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));
console.log(`\nScreenshots: ${OUT_DIR}`);
console.log(`Report JSON: ${OUT_JSON}`);
process.exit(failed === 0 ? 0 : 1);
