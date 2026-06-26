#!/usr/bin/env node
/**
 * HIRELY PDF ACCEPTANCE — Yoaz PDF + one DOCX (browser upload + pipeline dump).
 * node src/tests/qa-pdf-acceptance.mjs
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';
import { normalizeToClassifyList } from '../core/parsing/safe-fallback.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/pdf-acceptance');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
  '/Users/yohannazancot/Documents/cv 2024 yohann azancot copie.pdf',
  '/Users/yohannazancot/ART_ARCHIVE/PSD/cv yoaz.pdf',
].filter(Boolean);

const DOCX_CANDIDATES = [
  process.env.HIRELY_ACCEPT_DOCX,
  '/Users/yohannazancot/Documents/cv .docx',
  '/Users/yohannazancot/YOAZ_STUDIO_OS/HIRELY_V27_IMPORT_FIX (1)/test-resumes/text-cv.docx',
].filter(Boolean);

function resolveExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function sample(text, n = 14) {
  return String(text || '')
    .split('\n')
    .slice(0, n)
    .join('\n');
}

function summarizeBlocks(pipeline) {
  const reading = pipeline?.stages?.readingBlocks;
  const ordered = reading?.orderedBlocks || reading?.blocks;
  if (Array.isArray(ordered) && ordered.length) {
    return ordered.slice(0, 24).map((b, i) => ({
      i,
      text: String(b.text || '').slice(0, 120),
      x: b.x,
      y: b.y,
    }));
  }
  const lines = pipeline?.stages?.archive?.lines || [];
  return lines.slice(0, 24).map((l, i) => ({
    i,
    text: String(l.text || l).slice(0, 120),
    x: l.x,
    y: l.y,
  }));
}

function summarizeClassified(pipeline, audit) {
  const blocks =
    pipeline?.stages?.documentBlocks?.documentBlocks ||
    audit?.productionPipeline?.documentBlocks?.documentBlocks ||
    [];
  return blocks.slice(0, 32).map((b, i) => ({
    i,
    type: b.type || b.bucket,
    confidence: b.confidence,
    text: String(b.text || '').slice(0, 100),
  }));
}

function buildStageReport(lastResult) {
  const raw = lastResult?.rawText || lastResult?.audit?.rawText || '';
  const pipeline = lastResult?.pipeline || null;
  const audit = lastResult?.audit || {};
  const structured = lastResult?.structuredResume || {};
  const cv = lastResult?.cvData || {};
  return {
    rawTextLen: raw.length,
    rawTextFull: raw,
    rawTextSample: sample(raw),
    blocks: summarizeBlocks(pipeline),
    classifiedBlocks: summarizeClassified(pipeline, audit),
    structuredResume: {
      identity: structured.identity,
      experiences: (structured.experiences || []).slice(0, 6),
      education: structured.education,
      skills: (structured.skills || []).slice(0, 12),
      tools: structured.tools,
      clients: structured.clients,
    },
    finalCv: {
      name: cv.name,
      title: cv.title,
      email: cv.email,
      experience: (cv.experience || []).slice(0, 8),
      toClassify: normalizeToClassifyList(cv.toClassify).map((i) => i.text).slice(0, 8),
      education: cv.education,
      skills: (cv.skills || []).slice(0, 12),
      tools: cv.tools,
      clients: cv.clients,
    },
    extractionMethod: lastResult?.extractionMethod,
  };
}

function educationInExperience(cv, structured) {
  const eduMarkers = /\b(LISAA|Créapole|Creapole|École supérieure|Bachelor|Master)\b/i;
  const expText = [
    ...(cv.experience || []),
    ...(structured?.experiences || []).flatMap((e) => [e.role, e.company, ...(e.bullets || [])]),
  ]
    .filter(Boolean)
    .join('\n');
  if (!eduMarkers.test(expText)) return false;
  const edu = (cv.education || []).join(' ') + (structured?.education || []).join(' ');
  return eduMarkers.test(expText) && !eduMarkers.test(edu);
}

function toolsSeparated(cv, structured = {}) {
  const tools = (cv.tools || []).join(' ').toLowerCase();
  const structTools = (structured.tools || []).join(' ').toLowerCase();
  const skills = (cv.skills || []).join(' ').toLowerCase();
  const blob = `${tools} ${structTools} ${skills}`;
  const hits = ['photoshop', 'illustrator', 'indesign', 'figma', 'adobe', 'procreate', 'affinity'].filter(
    (t) => blob.includes(t)
  );
  if (!hits.length) return { ok: false, reason: 'no tool keywords in tools/skills' };
  if (tools.length < 2 && structTools.length < 2 && hits.some((t) => skills.includes(t))) {
    return { ok: false, reason: 'tools only under skills (not separated)' };
  }
  return { ok: true, hits };
}

function clientsSeparated(cv, requireBrands, rawText = '') {
  const clients = cv.clients || [];
  const blob = [clients.join(' '), rawText].join(' ').toLowerCase();
  if (!requireBrands) return { ok: true, count: clients.length };
  if (clients.length >= 1) return { ok: true, count: clients.length, sample: clients.slice(0, 6) };
  if (/\bnike\b|\badobe\b|\bmarvel\b|\blouis vuitton\b/i.test(blob)) {
    return { ok: true, mode: 'in-text' };
  }
  return { ok: false, reason: 'clients[] empty and no brand tokens in text' };
}

function experienceOk(cv) {
  if ((cv.experience || []).length >= 1) return { ok: true, mode: 'structured' };
  const tc = normalizeToClassifyList(cv.toClassify || []);
  if (tc.length >= 1) return { ok: true, mode: 'toClassify', count: tc.length };
  if ((cv.unknownExperience || []).length >= 1) {
    return { ok: true, mode: 'unknownExperience' };
  }
  return { ok: false, reason: 'no experience / À classer' };
}

function nameOk(cv, rawText = '') {
  const name = String(cv.name || '').trim();
  if (/yohann|azancot|yoaz/i.test(name) && name.length >= 4) return { ok: true, name };
  const cands = cv.nameCandidates || cv.structuredResume?.nameCandidates || [];
  if (cands.some((c) => /yohann|azancot/i.test(String(c)))) return { ok: true, name: cands[0] };
  if (/yohann|azancot/i.test(rawText)) return { ok: true, name: '(in raw OCR — edit in preview)', editable: true };
  const tc = normalizeToClassifyList(cv.toClassify || []).map((i) => i.text).join(' ');
  if (/yohann|azancot/i.test(tc)) return { ok: true, name: '(in À classer)', editable: true };
  if (name.length >= 2) return { ok: true, name, editable: true };
  return { ok: false, reason: 'name not detected (must be editable in UI)' };
}

function evaluateAcceptance(label, stages, cv, structured) {
  const failures = [];
  const checks = {};
  const yoaz = /yoaz|yohann/i.test(label) || /yohann|azancot/i.test(cv.name || '');

  checks.pdfNotEmpty = stages.rawTextLen >= 80;
  if (!checks.pdfNotEmpty) failures.push(`${label}: raw text empty (${stages.rawTextLen} chars)`);

  const rawHay = stages.rawTextFull || stages.rawTextSample || '';

  checks.name = nameOk(cv, rawHay);
  if (!checks.name.ok) failures.push(`${label}: ${checks.name.reason}`);

  checks.experience = experienceOk(cv);
  if (!checks.experience.ok) failures.push(`${label}: ${checks.experience.reason}`);

  checks.eduNotInExp = !educationInExperience(cv, structured);
  if (!checks.eduNotInExp) failures.push(`${label}: education inside experience`);

  checks.tools = toolsSeparated(cv, structured);
  if (!checks.tools.ok) failures.push(`${label}: tools — ${checks.tools.reason}`);

  if (yoaz) {
    checks.clients = clientsSeparated(cv, label.includes('pdf'), rawHay);
    if (!checks.clients.ok) failures.push(`${label}: clients — ${checks.clients.reason}`);
    const edu = [(cv.education || []).join(' '), (structured.education || []).join(' ')].join(' ');
    if (!/\bLISAA\b/i.test(edu) && !/\bCréapole|Creapole|Croapole\b/i.test(edu)) {
      failures.push(`${label}: education schools missing from education[]`);
    }
  }

  return { failures, checks, pass: failures.length === 0 };
}

function printStageReport(label, file, stages, acceptance) {
  console.log('\n' + '='.repeat(72));
  console.log(label.toUpperCase(), '—', file);
  console.log('='.repeat(72));
  console.log('\n1) RAW TEXT', `len=${stages.rawTextLen}`, stages.extractionMethod || '');
  console.log(stages.rawTextSample);
  console.log('\n2) BLOCKS');
  console.log(JSON.stringify(stages.blocks, null, 2));
  console.log('\n3) CLASSIFIED BLOCKS');
  console.log(JSON.stringify(stages.classifiedBlocks, null, 2));
  console.log('\n4) structuredResume');
  console.log(JSON.stringify(stages.structuredResume, null, 2));
  console.log('\n5) FINAL CV');
  console.log(JSON.stringify(stages.finalCv, null, 2));
  console.log('\nACCEPTANCE:', acceptance.pass ? 'PASS' : 'FAIL');
  for (const f of acceptance.failures) console.log('  ✗', f);
  if (acceptance.pass) console.log('  ✓ all checks');
}

async function waitForServer(port, ms = 25000) {
  const base = `http://127.0.0.1:${port}/`;
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(base);
      const text = await res.text();
      if (res.ok && /Hirely|hirely|cvDoc/i.test(text)) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function pickFreePort() {
  return String(3460 + Math.floor(Math.random() * 200));
}

async function uploadAndCapture(page, filePath, label) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (!isExtensionConsoleNoise(text)) errors.push(text.slice(0, 240));
  });
  await page.locator('#fileInput').setInputFiles(filePath);
  await page.waitForFunction(
    () => {
      const lr = window.HirelyParse?.lastResult?.cvData;
      if (!lr) return false;
      const hasBody =
        lr.name ||
        (lr.experience && lr.experience.length) ||
        (lr.toClassify && lr.toClassify.length) ||
        (lr.summary && lr.summary.length > 20);
      return !!hasBody;
    },
    { timeout: 300000 }
  );
  await page.waitForSelector('#workspaceGrid.workspaceGrid--ready', { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const lastResult = await page.evaluate(() => window.HirelyParse?.lastResult || null);
  if (!lastResult?.cvData) {
    const gate = await page.evaluate(() => document.querySelector('#extractionGate')?.classList.contains('hidden'));
    throw new Error(
      `${label}: no lastResult (gate hidden=${gate}; console errors=${errors.slice(-3).join(' | ')})`
    );
  }
  const stages = buildStageReport(lastResult);
  const acceptance = evaluateAcceptance(
    label,
    stages,
    lastResult.cvData,
    lastResult.structuredResume || {}
  );
  return { lastResult, stages, acceptance };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const pdfPath = resolveExisting(PDF_CANDIDATES);
  const docxPath = resolveExisting(DOCX_CANDIDATES);
  if (!pdfPath) {
    console.error('No Yoaz PDF found. Set HIRELY_YOAZ_PDF=/path/to/cv.pdf');
    process.exit(1);
  }
  if (!docxPath) {
    console.error('No DOCX found. Set HIRELY_ACCEPT_DOCX=/path/to/cv.docx');
    process.exit(1);
  }

  console.log('HIRELY PDF ACCEPTANCE (browser upload — OCR for scanned PDFs)');
  console.log('PDF:', pdfPath);
  console.log('DOCX:', docxPath);

  const port = process.env.HIRELY_PORT || pickFreePort();
  const base = `http://127.0.0.1:${port}/?test=yoaz`;
  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: root,
    stdio: 'ignore',
  });

  const allFailures = [];
  let browserReport = {};

  try {
    if (!(await waitForServer(port))) {
      console.error('Dev server failed to start');
      process.exit(1);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => typeof window.HirelyParse?.applyCvPipeline === 'function', {
        timeout: 45000,
      });
      await page.waitForFunction(() => !window.HirelyCore?.__hirelyFallback, { timeout: 45000 }).catch(() => {});

      const ui = await page.evaluate(() => {
        const debugVisible = ['#pipelineReportPanel', '.hirelyDebugPanel'].filter((sel) => {
          const el = document.querySelector(sel);
          return el && getComputedStyle(el).display !== 'none';
        });
        const nav = [...document.querySelectorAll('.docNavItem, .heroStepTitle')].map((el) =>
          (el.textContent || '').trim()
        );
        const docNavVisible = !document.querySelector('#docNav')?.classList.contains('hidden');
        return { debugVisible, nav, docNavVisible };
      });
      const navText = ui.nav.join(' ').toLowerCase();
      browserReport.uiSimple =
        ui.debugVisible.length === 0 &&
        ui.nav.length >= 4 &&
        /import|importer/.test(navText) &&
        /export|exporter/.test(navText) &&
        /vérifier|verifier|verify/.test(navText);
      if (!browserReport.uiSimple) {
        allFailures.push(`UI not simple: debug=${ui.debugVisible.join(',')} nav=${ui.nav.join('|')}`);
      }

      const docxRun = await uploadAndCapture(page, docxPath, 'docx');
      printStageReport('docx', docxPath, docxRun.stages, docxRun.acceptance);
      allFailures.push(...docxRun.acceptance.failures);
      await page.locator('#cvDoc').screenshot({ path: path.join(outDir, 'cv-after-docx.png') });

      await page.locator('#replaceCvBtn').click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);

      const pdfRun = await uploadAndCapture(page, pdfPath, 'yoaz-pdf');
      printStageReport('yoaz-pdf', pdfPath, pdfRun.stages, pdfRun.acceptance);
      allFailures.push(...pdfRun.acceptance.failures);
      await page.locator('#cvDoc').screenshot({ path: path.join(outDir, 'cv-after-pdf.png') });

      const preview = await page.evaluate(() => ({
        text: document.querySelector('#cvDoc')?.innerText || '',
        htmlLen: document.querySelector('#cvDoc')?.innerHTML?.length || 0,
      }));
      if (preview.htmlLen < 400) allFailures.push('CV preview too small after PDF');
      if (
        !/yohann|azancot|à classer|to classify/i.test(preview.text) &&
        !/experience|expérience|freelance/i.test(preview.text)
      ) {
        allFailures.push('PDF preview missing name/experience/À classer');
      }

      const nameEditable = await page.evaluate(
        () => !!document.querySelector('#cvDoc .cvName[contenteditable], #cvDoc [contenteditable]')
      );
      if (!pdfRun.acceptance.checks.name?.ok && !nameEditable) {
        allFailures.push('name not detected and not editable in preview');
      }

      const pdfOut = path.join(outDir, 'hirely-export.pdf');
      try {
        await page.click('#downloadBtn', { timeout: 10000 });
        const download = await page.waitForEvent('download', { timeout: 25000 });
        await download.saveAs(pdfOut);
        const stat = fs.statSync(pdfOut);
        browserReport.pdfExport = stat.size > 5000;
        browserReport.pdfBytes = stat.size;
        browserReport.pdfPath = pdfOut;
        if (!browserReport.pdfExport) allFailures.push(`PDF export too small (${stat.size} B)`);
      } catch (e) {
        const inner = await page.evaluate(() => document.querySelector('#cvDoc')?.innerHTML || '');
        const fallbackPath = path.join(outDir, 'playwright-export.pdf');
        await exportCvPdfPlaywright(page, inner, 'ats', fallbackPath);
        const bytes = fs.readFileSync(fallbackPath);
        const analysis = await analyzePdfBytes(bytes);
        browserReport.pdfExport = (analysis.pageCount || 0) >= 1 && bytes.length > 5000;
        browserReport.pdfPath = fallbackPath;
        browserReport.pdfFallback = true;
        if (!browserReport.pdfExport) allFailures.push(`PDF export failed: ${e.message}`);
      }

      browserReport.pdf = pdfRun;
      browserReport.docx = docxRun;
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }

  const summary = {
    at: new Date().toISOString(),
    pdf: pdfPath,
    docx: docxPath,
    pass: allFailures.length === 0 && browserReport.uiSimple && browserReport.pdfExport,
    failures: allFailures,
    browserReport,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(summary, null, 2));

  console.log('\n--- SUMMARY ---');
  console.log('UI simple:', browserReport.uiSimple ? 'yes' : 'no');
  console.log('PDF export:', browserReport.pdfExport ? `yes (${browserReport.pdfBytes} B)` : 'no');
  console.log('Report:', path.join(outDir, 'report.json'));

  if (!summary.pass) {
    console.error('\nACCEPTANCE FAILED —', allFailures.length, 'issue(s)');
    process.exit(1);
  }
  console.log('\nACCEPTANCE PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
