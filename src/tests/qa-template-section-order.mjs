#!/usr/bin/env node
/**
 * P0 — Template section order lock (browser DOM + A4 page 1).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { scoreSectionOrder } from '../core/audit/visual-cv-quality.js';
import { UNIVERSAL_SECTION_ORDER } from '../ui/templates/universal-section-order.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/template-section-order/report.json');

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const PDF_CACHE = path.join(ROOT, 'tests/output/pdf-acceptance/report.json');

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
    { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf' }[
      ext
    ] || 'application/octet-stream'
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
  return '';
}

function loadPdfAcceptanceText() {
  if (!fs.existsSync(PDF_CACHE)) return '';
  const lr = JSON.parse(fs.readFileSync(PDF_CACHE, 'utf8'))?.browserReport?.pdf?.lastResult || {};
  return lr.rawText || lr.cleanedText || '';
}

async function runPasteFallbackImport(page, text) {
  await page.evaluate(async (raw) => {
    if (window.HirelyParse?.applyCvPipeline) {
      await window.HirelyParse.applyCvPipeline(raw, {
        source: 'paste-fallback',
        trusted: true,
        forceContinue: true,
      });
    }
    if (typeof ensureImportReviewVisible === 'function') {
      ensureImportReviewVisible({ partial: true, renderSource: 'template-section-order' });
    }
    if (typeof renderCV === 'function') renderCV();
  }, text);
  await page.waitForFunction(
    () =>
      document.getElementById('workspaceGrid')?.classList.contains('workspaceGrid--ready') ||
      document.getElementById('cvDoc')?.classList.contains('cv--live'),
    { timeout: 180000 }
  ).catch(() => {});
}

async function waitImportDone(page, maxMs = 360000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      empty: !!document.getElementById('cvDoc')?.querySelector('.cvEmptyState'),
      workspace: document.getElementById('workspaceGrid')?.classList.contains('workspaceGrid--ready'),
    }));
    if (s.fallback) return { ok: false, fallback: true };
    if ((s.live || s.workspace) && !s.busy && !s.empty) return { ok: true };
    await page.waitForTimeout(500);
  }
  return { ok: false, timeout: true };
}

async function importCv(page, port, cvCase) {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', { timeout: 180000 });

  const buf = fs.readFileSync(cvCase.path);
  const importStatus = await page.evaluate(
    async ({ b64, name, type }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type });
      return window.HirelyParse.handleFileImport(file, 'template-section-order');
    },
    { b64: buf.toString('base64'), name: path.basename(cvCase.path), type: cvCase.mime }
  );

  let imp = await waitImportDone(page);
  if (!imp.ok) {
    const fallback = cvCase.id === 'yoaz-cv' ? loadOcrFallbackText() : loadPdfAcceptanceText();
    if (fallback.length >= 80) {
      await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.HirelyParse?.applyCvPipeline === 'function', { timeout: 180000 });
      await runPasteFallbackImport(page, fallback);
      imp = await waitImportDone(page, 180000);
    }
  }
  return { importStatus, imp };
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

async function auditTemplate(page, templateId) {
  await page.evaluate((tpl) => {
    if (typeof setDocStep === 'function') setDocStep('export');
    state.template = tpl;
    if (typeof renderCV === 'function') renderCV(null, tpl);
    const cv = document.getElementById('cvDoc');
    if (cv?.classList.contains('cv--live') && window.HirelyA4Pages?.layoutCvA4Pages) {
      window.HirelyA4Pages.layoutCvA4Pages(cv);
    }
  }, templateId);
  await page.waitForTimeout(1000);

  return page.evaluate(() => {
    const cvDoc = document.getElementById('cvDoc');
    const frd = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const hasExp = (frd?.experiences || []).some(
      (e) => e && (e.role || e.company || e.dates || (e.bullets || []).length)
    );

    const order = [];
    const seen = new Set();
    const push = (k) => {
      if (!seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    };
    const root =
      cvDoc?.querySelector('.cvA4Stack .cvA4Sheet:first-child .cvA4Sheet__surface') ||
      cvDoc?.querySelector('.cvInner') ||
      cvDoc;
    if (root?.querySelector('.cvHead, .cvName')) push('identity');
    if (root?.querySelector('.cvLead, .cvSection--summary')) push('summary');
    const map = [
      ['experiences', '.cvSection--experience'],
      ['clients', '.cvSection--clients'],
      ['projects', '.cvSection--projects'],
      ['education', '.cvSection--education'],
      ['skills', '.cvSection--skills'],
      ['tools', '.cvSection--tools, .cvSection--software'],
      ['languages', '.cvSection--languages'],
    ];
    for (const [key, sel] of map) if (root?.querySelector(sel)) push(key);

    const firstSheet = cvDoc?.querySelector('.cvA4Stack > .cvA4Sheet:first-child') || cvDoc;
    const expOnPage1 = !!firstSheet?.querySelector(
      '.cvSection--experience .cvExpEntry, .cvSection--experience .cvTimelineItem, .cvSection--experience .cvExpList, .cvSection--experience .cvTimeline'
    );

    const dupCounts = {};
    for (const [key, sel] of map) {
      const c = cvDoc ? [...cvDoc.querySelectorAll('.cvSection')].filter((el) => el.matches(sel)).length : 0;
      if (c > 1) dupCounts[key] = c;
    }

    const dataPresent = {
      summary: !!String(frd?.summary || '').trim(),
      experience: hasExp,
      clients: (frd?.clients || []).some((x) => String(x || '').trim()),
      projects: (frd?.projects || []).some((x) => String(x || '').trim()),
      education: (frd?.education || []).some((x) => String(x || '').trim()),
      skills: (frd?.skills || []).some((x) => String(x || '').trim()),
      tools: (frd?.tools || []).some((x) => String(x || '').trim()),
      languages: (frd?.languages || []).some((x) => String(x || '').trim()),
    };

    return { order, expOnPage1, dupCounts, dataPresent, cvLive: cvDoc?.classList.contains('cv--live') };
  });
}

const available = REAL_USER_CVS.filter((c) => fs.existsSync(c.path));
if (available.length < 2) {
  console.error('Need both real CV files');
  process.exit(1);
}

const port = 3110 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

const reports = [];

for (const cvCase of available) {
  const { importStatus } = await importCv(page, port, cvCase);
  const templateIds = await getAllTemplateIds(page);
  const templateResults = [];

  for (const templateId of templateIds) {
    const snap = await auditTemplate(page, templateId);
    const present = {
      summary: snap.dataPresent.summary,
      experience: snap.dataPresent.experience,
      clients: snap.dataPresent.clients,
      projects: snap.dataPresent.projects,
      education: snap.dataPresent.education,
      skills: snap.dataPresent.skills,
      tools: snap.dataPresent.tools,
      languages: snap.dataPresent.languages,
    };
    const orderAudit = scoreSectionOrder(
      snap.order.map((k) => (k === 'experiences' ? 'experience' : k)),
      {
        summary: present.summary,
        experience: present.experience,
        clients: present.clients,
        projects: present.projects,
        education: present.education,
        skills: present.skills,
        tools: present.tools,
        languages: present.languages,
      }
    );

    const expIdx = snap.order.indexOf('experiences');
    const skillIdx = snap.order.indexOf('skills');
    const toolIdx = snap.order.indexOf('tools');
    const expBeforeSkills =
      !present.experience ||
      !present.skills ||
      skillIdx === -1 ||
      (expIdx !== -1 && expIdx < skillIdx);
    const expBeforeTools =
      !present.experience ||
      !present.tools ||
      toolIdx === -1 ||
      (expIdx !== -1 && expIdx < toolIdx);

    const checks = {
      cvLive: snap.cvLive,
      experienceOnPage1: !present.experience || snap.expOnPage1,
      experienceBeforeSkills: expBeforeSkills,
      experienceBeforeTools: expBeforeTools,
      sectionOrderOk: orderAudit.score >= 75,
      noDuplicates: Object.keys(snap.dupCounts).length === 0,
    };
    const pass = Object.values(checks).every(Boolean);

    ok(
      pass,
      `${cvCase.id}/${templateId} order=${snap.order.join('>')} expP1=${snap.expOnPage1}`
    );

    templateResults.push({
      templateId,
      pass,
      checks,
      order: snap.order,
      orderIssues: orderAudit.issues,
      duplicates: snap.dupCounts,
      experienceOnPage1: snap.expOnPage1,
    });
  }

  reports.push({
    id: cvCase.id,
    label: cvCase.label,
    importStatus,
    pass: templateResults.every((t) => t.pass),
    templates: templateResults,
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
      universalOrder: UNIVERSAL_SECTION_ORDER,
      cvs: reports,
      pass: failed === 0 && reports.every((r) => r.pass),
    },
    null,
    2
  )
);

console.log(`\nReport JSON: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
