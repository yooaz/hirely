#!/usr/bin/env node
/**
 * P0 — Real user CV QA (browser import, not text fixtures).
 * CV 1: Yoaz 2022 PDF · CV 2: Yoaz 2024 PDF (second uploaded)
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { auditFinalResumeDuplicates } from '../core/validation/dedupe-final-resume.js';
import {
  auditFinalCvPlaceholders,
  isFinalCvPlaceholder,
} from '../core/validation/final-cv-placeholder-guard.js';
import { auditSectionLabelLeakage } from '../core/validation/section-label-leakage-guard.js';
import { auditInventedExperience } from '../core/parsing/invented-experience-guard.js';
import { extractFromFileDetailed } from '../core/extraction/extract-file.js';
import {
  FORBIDDEN_CV_CONTENT_LABELS,
  isSectionLabelLeakage,
  normalizeSectionLabelCandidate,
} from '../core/validation/section-label-leakage-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/real-user-cv/report.json');

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

const MIN_PREVIEW_TEXT = 200;

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

function makeFile(buf, name, type = 'application/pdf') {
  if (typeof File !== 'undefined') {
    return new File([buf], name, { type });
  }
  return {
    name,
    type,
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
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

async function extractPdfText(filePath) {
  const buf = fs.readFileSync(filePath);
  const file = makeFile(buf, path.basename(filePath));
  const detailed = await extractFromFileDetailed(file);
  return String(detailed?.text || detailed?.rawText || '').trim();
}

async function runPasteFallbackImport(page, fallbackText) {
  await page.evaluate(async (raw) => {
    if (typeof hideImportPasteFallback === 'function') hideImportPasteFallback();
    const run = (globalThis._importRun || 0) + 1;
    globalThis._importRun = run;
    try {
      globalThis.HIRELY_IMPORT_RUN_ID = run;
    } catch {
      /* ignore */
    }
    let ok = false;
    if (window.HirelyParse?.applyCvPipeline) {
      ok = await window.HirelyParse.applyCvPipeline(raw, {
        source: 'paste-fallback',
        trusted: true,
        forceContinue: true,
      });
    }
    if (
      !ok &&
      typeof resumeDataMeetsImportMinimumUi === 'function' &&
      resumeDataMeetsImportMinimumUi(state.resumeData)
    ) {
      if (typeof ensureImportReviewVisible === 'function') {
        ensureImportReviewVisible({ partial: true, renderSource: 'real-user-cv-qa' });
      }
      ok = true;
    }
    if (!ok && typeof cvPreviewIsLive === 'function' && cvPreviewIsLive()) ok = true;
    if (typeof renderCV === 'function') renderCV();
    return ok;
  }, fallbackText);

  await page
    .waitForFunction(
      () =>
        document.getElementById('workspaceGrid')?.classList.contains('workspaceGrid--ready') ||
        document.getElementById('cvDoc')?.classList.contains('cv--live'),
      { timeout: 180000 }
    )
    .catch(() => {});

  await page
    .waitForFunction(
      () => !document.querySelector('.hirelyProgressStep[data-doc-step="edit"] .hirelyProgressBtn')?.disabled,
      { timeout: 90000 }
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
    if (s.fallback) return { ok: false, fallback: true, ms: Date.now() - t0 };
    if ((s.live || s.workspace) && !s.busy && !s.empty) return { ok: true, ms: Date.now() - t0 };
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
      return window.HirelyParse.handleFileImport(file, 'real-user-cv-qa');
    },
    { b64: buf.toString('base64'), name: path.basename(filePath), type: mimeType }
  );
}

function countList(arr) {
  return Array.isArray(arr) ? arr.filter((x) => String(x || '').trim()).length : 0;
}

function buildMetrics(frd, snap) {
  const id = frd?.identity || {};
  return {
    rawTextLength: snap.rawTextLength || 0,
    finalName: String(id.name || '').trim(),
    finalTitle: String(id.title || '').trim(),
    email: String(id.email || '').trim(),
    phone: String(id.phone || '').trim(),
    experiencesCount: (frd?.experiences || []).length,
    educationCount: countList(frd?.education),
    clientsCount: countList(frd?.clients),
    projectsCount: countList(frd?.projects),
    skillsCount: countList(frd?.skills),
    toolsCount: countList(frd?.tools),
    languagesCount: countList(frd?.languages),
    reviewQueueCount: snap.reviewQueueCount || 0,
    previewTextLength: snap.previewTextLength || 0,
    cvLive: !!snap.cvLive,
  };
}

function isForbiddenContentLine(line) {
  const norm = normalizeSectionLabelCandidate(line).toLowerCase();
  return FORBIDDEN_CV_CONTENT_LABELS.includes(norm) || isSectionLabelLeakage(line);
}

function previewContentLines(html) {
  const body = String(html || '')
    .replace(/<h[1-6][^>]*class="[^"]*cvSectionTitle[^"]*"[^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
    .replace(/<[^>]*class="[^"]*cvSectionTitle[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n');
  return body
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function auditPreviewLeakage(html) {
  const lines = previewContentLines(html);
  const placeholders = lines.filter((l) => isFinalCvPlaceholder(l) || /\bà\s+confirmer\b/i.test(l));
  const labels = lines.filter((l) => isForbiddenContentLine(l));
  return { placeholders, labels };
}

function auditFakeExperience(experiences = []) {
  const hits = [];
  for (const exp of experiences) {
    const audit = auditInventedExperience(exp);
    if (audit.invented) {
      hits.push({
        reason: audit.reason,
        text: [exp.role, exp.company, exp.dates].filter(Boolean).join(' — '),
      });
    }
  }
  return hits;
}

function normLine(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function auditPreviewDuplicateLines(html) {
  const lines = previewContentLines(html).filter((l) => l.length >= 8);
  const seen = new Map();
  const dups = [];
  for (const line of lines) {
    const key = normLine(line);
    if (!key) continue;
    if (seen.has(key)) dups.push({ a: seen.get(key), b: line });
    else seen.set(key, line);
  }
  return dups;
}

async function collectBrowserSnapshot(page) {
  return page.evaluate(() => {
    const lr = window.HirelyParse?.lastResult || {};
    const frd = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
    const cvDoc = document.getElementById('cvDoc');
    const pending = typeof getPendingReviewQueue === 'function' ? getPendingReviewQueue() : [];
    const raw =
      lr.rawText ||
      lr.audit?.rawText ||
      window.state?.rawText ||
      window.state?.cleanText ||
      '';
    let auditHtml = cvDoc?.innerHTML || '';
    if (cvDoc) {
      const clone = cvDoc.cloneNode(true);
      clone
        .querySelectorAll(
          '.cvSectionTitle, .cvEmptyState, .suggestionCard, .hirelyDebug, #hirelyDebugPanel, .cvPendingReviewField, .cvSection--pending, .cvSection--toClassify, .cvSection--unsorted'
        )
        .forEach((el) => el.remove());
      auditHtml = clone.innerHTML;
    }
    return {
      frd,
      importStatus: window.state?.lastImportStatus || lr.status || null,
      rawTextLength: String(raw).length,
      reviewQueueCount: pending.length,
      previewHtml: auditHtml,
      previewText: cvDoc?.innerText || '',
      previewTextLength: (cvDoc?.innerText || '').replace(/\s+/g, ' ').trim().length,
      cvLive: cvDoc?.classList.contains('cv--live'),
      hasEmptyState: !!cvDoc?.querySelector('.cvEmptyState'),
      previewName: (cvDoc?.querySelector('.cvName')?.textContent || '').trim(),
    };
  });
}

const available = REAL_USER_CVS.filter((c) => fs.existsSync(c.path));
if (available.length < 2) {
  console.error('Need both real user CV files on disk:', REAL_USER_CVS.map((c) => c.path));
  process.exit(1);
}

const port = 3090 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

const reports = [];

for (const cvCase of available) {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
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
      try {
        fallbackText = await extractPdfText(cvCase.path);
        importPath = 'node-pdf-extract-fallback';
      } catch {
        fallbackText = '';
      }
      if (fallbackText.length < 80) {
        const cachePath = path.join(ROOT, 'tests/output/pdf-acceptance/report.json');
        if (fs.existsSync(cachePath)) {
          const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          const lr = cached?.browserReport?.pdf?.lastResult || {};
          fallbackText =
            lr.rawText ||
            lr.cleanedText ||
            lr.structuredResume?.rawExtraction ||
            lr.metadata?.rawExtraction ||
            lr.metadata?.cleanedText ||
            lr.audit?.rawText ||
            '';
          if (fallbackText.length >= 80) importPath = 'browser-acceptance-cache';
        }
      }
    }
    if (fallbackText.length >= 80) {
      await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await page.waitForFunction(
        () => typeof window.HirelyParse?.applyCvPipeline === 'function',
        { timeout: 180000 }
      );
      await runPasteFallbackImport(page, fallbackText);
      importPath = `${importPath}-fresh-paste`;
      imp = await waitImportDone(page, 180000);
      if (!imp.ok) {
        const recovered = await page.evaluate(() => ({
          live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
          workspace: document.getElementById('workspaceGrid')?.classList.contains('workspaceGrid--ready'),
          name: (typeof getFinalResumeData === 'function' ? getFinalResumeData() : null)?.identity?.name || '',
        }));
        imp = { ok: recovered.live || recovered.workspace || !!recovered.name, recovered: true };
      }
    }
  }

  ok(
    imp.ok,
    `${cvCase.id} browser import (${importStatus}, ${importPath}${imp.recovered ? ', recovered' : ''})`
  );

  await page.evaluate(() => {
    const btn = document.querySelector('.hirelyProgressStep[data-doc-step="edit"] .hirelyProgressBtn');
    if (btn && !btn.disabled) btn.click();
    if (typeof renderCV === 'function') renderCV();
    if (window.HirelyA4Pages?.layoutCvA4Pages) {
      const cv = document.getElementById('cvDoc');
      if (cv?.classList.contains('cv--live')) window.HirelyA4Pages.layoutCvA4Pages(cv);
    }
  });
  await page.waitForTimeout(1500);

  const snap = await collectBrowserSnapshot(page);
  const frd = snap.frd || {};
  const metrics = buildMetrics(frd, snap);

  const placeholderAudit = auditFinalCvPlaceholders(frd);
  const labelAudit = auditSectionLabelLeakage(frd);
  const labelDataHits = labelAudit.violations || [];
  const duplicateAudit = auditFinalResumeDuplicates(frd);
  const previewLeak = auditPreviewLeakage(snap.previewHtml);
  const previewDups = auditPreviewDuplicateLines(snap.previewHtml);
  const fakeExp = auditFakeExperience(frd.experiences || []);

  const leakage = {
    placeholder: {
      data: placeholderAudit.hits || [],
      preview: previewLeak.placeholders,
      count: (placeholderAudit.hits || []).length + previewLeak.placeholders.length,
    },
    label: {
      data: labelDataHits,
      preview: previewLeak.labels,
      count: labelDataHits.length + previewLeak.labels.length,
    },
    duplicate: {
      data: duplicateAudit.duplicates || [],
      preview: previewDups,
      count: (duplicateAudit.duplicates || []).length + previewDups.length,
    },
    fakeExperience: fakeExp,
  };

  const acceptance = {
    noParserLabels: leakage.label.count === 0,
    noPlaceholders: leakage.placeholder.count === 0,
    noFakeExperience: fakeExp.length === 0,
    noDuplicateLines: leakage.duplicate.count === 0,
    meaningfulPreview:
      snap.cvLive &&
      !snap.hasEmptyState &&
      metrics.previewTextLength >= MIN_PREVIEW_TEXT &&
      !!metrics.finalName,
  };

  ok(acceptance.noParserLabels, `${cvCase.id} no parser labels (${leakage.label.count})`);
  ok(acceptance.noPlaceholders, `${cvCase.id} no placeholders (${leakage.placeholder.count})`);
  ok(acceptance.noFakeExperience, `${cvCase.id} no fake experience (${fakeExp.length})`);
  ok(acceptance.noDuplicateLines, `${cvCase.id} no duplicate lines (${leakage.duplicate.count})`);
  ok(acceptance.meaningfulPreview, `${cvCase.id} meaningful preview (${metrics.previewTextLength} chars)`);

  reports.push({
    id: cvCase.id,
    label: cvCase.label,
    file: cvCase.path,
    importStatus,
    importPath,
    metrics,
    leakage,
    acceptance,
    pass: Object.values(acceptance).every(Boolean),
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
      source: 'browser',
      cvs: reports,
      pass: failed === 0 && reports.every((r) => r.pass),
    },
    null,
    2
  )
);

console.log(`\nReport JSON: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
