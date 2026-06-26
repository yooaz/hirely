#!/usr/bin/env node
/**
 * P0 — Detection panel must match finalResumeData (no preview contradiction).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { getFinalResumeSectionCounts, detectReviewPreviewContradictions } from '../core/validation/review-consistency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/detection-panel-consistency/report.json');

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

function loadQualityModule() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/product/extraction-quality-step.js'), 'utf8');
  const sandbox = { globalThis: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.HirelyExtractionQualityStep;
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
      ensureImportReviewVisible({ partial: true, renderSource: 'detection-panel-consistency' });
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
  await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
    timeout: 180000,
  });

  const buf = fs.readFileSync(cvCase.path);
  await page.evaluate(
    async ({ b64, name, type }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type });
      return window.HirelyParse.handleFileImport(file, 'detection-panel-consistency');
    },
    { b64: buf.toString('base64'), name: path.basename(cvCase.path), type: cvCase.mime }
  );

  let imp = await waitImportDone(page, cvCase.id === 'second-uploaded-cv' ? 420000 : 360000);
  if (!imp.ok) {
    const fallback = cvCase.id === 'yoaz-cv' ? loadOcrFallbackText() : loadPdfAcceptanceText();
    if (fallback.length >= 80) {
      await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.HirelyParse?.applyCvPipeline === 'function', {
        timeout: 180000,
      });
      await runPasteFallbackImport(page, fallback);
      imp = await waitImportDone(page, 180000);
    }
  }
  return imp;
}

const Q = loadQualityModule();

// Unit: object education entries count
const objEdu = Q.buildExtractionQualityStep({
  finalResumeData: {
    identity: { name: 'Test User', email: 'a@b.com' },
    experiences: [{ role: 'Designer', company: 'Studio' }],
    education: [{ school: 'ENSAD', degree: 'Art', dates: '2018' }],
    skills: ['Illustration'],
    tools: ['Photoshop'],
  },
});
ok(objEdu.rows.find((r) => r.key === 'education')?.ok, 'unit: object education → Formation détectée');
ok(objEdu.rows.find((r) => r.key === 'experience')?.ok, 'unit: experience detected');
ok(objEdu.rows.find((r) => r.key === 'skills')?.ok, 'unit: skills/tools detected');
ok(objEdu.source === 'finalResumeData', 'unit: source finalResumeData');

const available = REAL_USER_CVS.filter((c) => fs.existsSync(c.path));
if (available.length < 2) {
  console.error('Need both real CV files');
  process.exit(1);
}

const port = 3130 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

const cvReports = [];

for (const cvCase of available) {
  await importCv(page, port, cvCase);

  await page.evaluate(() => {
    if (typeof setDocStep === 'function') setDocStep('edit');
    if (typeof renderExtractionQualityStep === 'function') renderExtractionQualityStep();
    if (typeof renderCV === 'function') renderCV();
  });
  await page.waitForTimeout(800);

  const snap = await page.evaluate(() => {
    const frd = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const report =
      typeof buildExtractionQualityReport === 'function' ? buildExtractionQualityReport() : null;
    const panelText = document.getElementById('extractionQualityList')?.innerText || '';
    const cvDoc = document.getElementById('cvDoc');
    const previewHasEducation = !!cvDoc?.querySelector('.cvSection--education');
    const previewHasExperience = !!cvDoc?.querySelector('.cvSection--experience');
    const previewHasSkills = !!cvDoc?.querySelector('.cvSection--skills, .cvSection--tools');
    return {
      frd,
      report,
      panelText,
      previewHasEducation,
      previewHasExperience,
      previewHasSkills,
      cvLive: cvDoc?.classList.contains('cv--live'),
    };
  });

  const frd = snap.frd || {};
  const counts = getFinalResumeSectionCounts(frd);
  const rows = snap.report?.rows || [];

  const eduRow = rows.find((r) => r.key === 'education');
  const expRow = rows.find((r) => r.key === 'experience');
  const skillRow = rows.find((r) => r.key === 'skills');

  const checks = {
    cvLive: snap.cvLive,
    educationPanelOk: counts.education === 0 || !!eduRow?.ok,
    experiencePanelOk: counts.experiences === 0 || !!expRow?.ok,
    skillsPanelOk: counts.skills + counts.tools === 0 || !!skillRow?.ok,
    noPreviewEducationContradiction: !snap.previewHasEducation || !!eduRow?.ok,
    noPreviewExperienceContradiction: !snap.previewHasExperience || !!expRow?.ok,
    panelShowsFormationDetected: counts.education === 0 || /Formation détectée/i.test(snap.panelText),
    panelShowsExperienceDetected: counts.experiences === 0 || /Expérience détectée/i.test(snap.panelText),
    panelShowsSkillsDetected:
      counts.skills + counts.tools === 0 || /Compétences détectées/i.test(snap.panelText),
  };

  const pass = Object.values(checks).every(Boolean);
  ok(pass, `${cvCase.id} counts=${JSON.stringify(counts)} panel edu=${eduRow?.ok} previewEdu=${snap.previewHasEducation}`);

  const contradiction = detectReviewPreviewContradictions({
    finalResumeData: frd,
    checklist: rows.map((r) => ({ id: r.key, ok: r.ok })),
    renderedCv: null,
  });

  cvReports.push({
    id: cvCase.id,
    label: cvCase.label,
    pass,
    checks,
    counts,
    panelRows: rows.map((r) => ({
      key: r.key,
      ok: r.ok,
      label: r.ok ? r.labelOk : r.labelMiss,
    })),
    preview: {
      hasEducation: snap.previewHasEducation,
      hasExperience: snap.previewHasExperience,
      hasSkills: snap.previewHasSkills,
    },
    contradictions: contradiction.contradictions,
    panelText: snap.panelText.slice(0, 500),
  });
}

await browser.close();
server.close();

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'finalResumeData',
  cvs: cvReports,
  pass: failed === 0 && cvReports.every((c) => c.pass),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(`\nReport JSON: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
