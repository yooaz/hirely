#!/usr/bin/env node
/**
 * HIRELY QUALITY GATE — yoaz CV import + OCR corruption regression.
 * node src/tests/qa-quality-gate.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { loadHirelyParse } from './load-hirely-parse.mjs';
import { evaluateExtraction, evaluateYoazFixture, hasOcrGarbageInStructured } from '../../tests/lib/quality-gate.mjs';
import { linesRemoved } from '../debug/stats.js';
import { buildOcrForensic } from '../debug/ocr-forensic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/quality-gate');
const SAMPLE_LINES = 12;
const FAIL_STRINGS = ['Ce Frei Re', 'A>o', "N'$ak"];
const FAIL_REGEX = [
  /\b[A-Za-z]\s+[A-Za-z]\s+[A-Za-z]\s+[A-Za-z]\s+[A-Za-z]\s+[A-Za-z]\b/,
  /[|¦‖§¶†‡]{2,}/,
  /@@@|###/,
];

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function sampleLines(text, n = SAMPLE_LINES) {
  return String(text || '')
    .split(/\n/)
    .slice(0, n)
    .join('\n');
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects / Selected Work',
        summary: 'Summary',
      }[k] || k),
    cvBlock: (title, html) =>
      html && String(html).replace(/<[^>]+>/g, '').trim()
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills, chips) =>
      chips
        ? `<div class="cvSkillTags">${skills.map((s) => `<span class="cvSkillTag">${esc(s)}</span>`).join('')}</div>`
        : `<p class="cvSkillLine">${skills.map(esc).join(', ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function visibleText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function emptySectionCount(html) {
  const re = /<section[^>]*class="[^"]*cvSection[^"]*"[^>]*>[\s\S]*?<\/section>/gi;
  let empty = 0;
  let m;
  while ((m = re.exec(html))) {
    const body = m[0].replace(/<h3[\s\S]*?<\/h3>/i, '');
    if (!body.replace(/<[^>]+>/g, '').trim()) empty++;
  }
  return empty;
}

function projectInExperienceWithoutStructure(cv) {
  const exp = (cv.experience || []).join('\n');
  const projects = cv.projects || [];
  if (!projects.length) return false;
  return projects.some((p) => {
    const frag = String(p).slice(0, 24);
    if (!frag || exp.includes(p)) return false;
    return exp.includes(frag) && !/\d{4}|—|–|-|present|présent/i.test(exp);
  });
}

function auditRendered(html, cv) {
  const text = visibleText(html);
  const failures = [];
  for (const s of FAIL_STRINGS) {
    if (text.includes(s)) failures.push(`render contains forbidden: ${s}`);
  }
  for (const re of FAIL_REGEX) {
    if (re.test(text)) failures.push(`render matches garbage pattern: ${re}`);
  }
  if (hasOcrGarbageInStructured(cv)) failures.push('structured CV still has OCR garbage flags');
  if (/@/.test(String(cv.summary || ''))) failures.push('email inside summary (structured)');
  const edu = cv.education || [];
  if (edu.some((l) => /@|\+?\d[\d\s().-]{7,}\d/.test(l))) failures.push('contact inside education (structured)');
  if (emptySectionCount(html) > 0) failures.push(`empty template sections: ${emptySectionCount(html)}`);
  if (projectInExperienceWithoutStructure(cv)) failures.push('project text in experience without date/company');
  return failures;
}

async function runPipeline(Parse, rawText, label, method = 'paste-text') {
  const pipe = await Parse.runExtractionPipeline(rawText, { extractionMethod: method });
  const cv = pipe.validatedCVData || {};
  const removed = linesRemoved(pipe.rawText, pipe.cleanedText);
  const forensic = buildOcrForensic(rawText, {
    rawText: pipe.rawText,
    cleanedText: pipe.cleanedText,
    rejectedLines: pipe.rejectedLines || [],
    structuredResume: pipe.structuredResume,
    validatedCVData: cv,
    extractionMethod: method,
    audit: pipe.audit,
  });
  const gate = evaluateExtraction({
    cv,
    audit: pipe.audit,
    rejectedLinesCount: removed.count,
  });
  if (label === 'yoaz-cv') {
    const yoazWarns = evaluateYoazFixture(cv, pipe.cleanedText);
    if (yoazWarns.length) gate.reviews.push(...yoazWarns.map((w) => `yoaz: ${w}`));
  }
  return { pipe, cv, removed, forensic, gate, label };
}

async function waitForServer(url, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function browserGate(yoazRaw) {
  const port = process.env.HIRELY_PORT || '3456';
  const base = process.env.HIRELY_URL || `http://127.0.0.1:${port}/?pro=true`;
  const report = {
    screenshot: null,
    pdf: null,
    templateSwitch: false,
    editable: false,
    cvVisible: false,
    failures: [],
  };

  const up = await waitForServer(base.split('?')[0]);
  if (!up) {
    report.failures.push('dev server not running on :3000 (npm run dev)');
    return report;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForFunction(() => typeof window.HirelyParse?.applyCvPipeline === 'function', {
      timeout: 15000,
    });

    await page.setInputFiles('#fileInput', {
      name: 'yoaz-cv.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(yoazRaw, 'utf8'),
    });

    await page.waitForFunction(
      () => document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready'),
      { timeout: 45000 }
    );

    const cvLen = await page.$eval('#cvDoc', (el) => el.innerHTML.length);
    report.cvVisible = cvLen > 500;
    if (!report.cvVisible) report.failures.push(`CV preview too short (${cvLen} chars)`);

    const renderedText = await page.$eval('#cvDoc', (el) => el.innerText || '');
    for (const s of FAIL_STRINGS) {
      if (renderedText.includes(s)) report.failures.push(`browser CV contains: ${s}`);
    }

    fs.mkdirSync(outDir, { recursive: true });
    const shotPath = path.join(outDir, 'rendered-cv.png');
    await page.locator('#cvDoc').screenshot({ path: shotPath });
    report.screenshot = shotPath;

    await page.click('.tplCard[data-id="productdesigner"]');
    await page.waitForTimeout(400);
    const mod = await page.$eval('#cvDoc', (el) => el.className.includes('template-productdesigner'));
    report.templateSwitch = mod;
    if (!mod) report.failures.push('template switch to productdesigner failed');

    const editable = await page.$eval('#cvDoc [contenteditable]', (el) => !!el);
    report.editable = editable;
    if (!editable) report.failures.push('no contenteditable fields in CV');

    const pdfPath = path.join(outDir, 'export-test.pdf');
    try {
      await page.click('#downloadBtn', { timeout: 5000 });
      const download = await page.waitForEvent('download', { timeout: 12000 });
      await download.saveAs(pdfPath);
      const stat = fs.statSync(pdfPath);
      report.pdf = { path: pdfPath, bytes: stat.size, ok: stat.size > 8000 };
      if (!report.pdf.ok) report.failures.push(`PDF too small (${stat.size} bytes)`);
    } catch (e) {
      report.pdf = { ok: false, error: e.message };
      report.failures.push(`PDF export failed: ${e.message}`);
    }
  } finally {
    await browser.close();
  }
  return report;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const yoazRaw = fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
  const ocrRaw = `Yohann Azancot
C e   F r e i   R e
F r e e l a n c e   I l l u s t r a t o r   /   G r a p h i c   D e s i g n e r
yoaz@hotmail.fr
+33 6 49 43 48 39

Experience
Freelance Illustrator / Graphic Designer
Independent · 2011 — Present
Nike, Adobe, Louis Vuitton

Education
LISAA — Web & Motion Design
Créapole — Visual Communication

Skills
Illustration, Graphic Design

Tools
Photoshop, Illustrator`;

  const Parse = await loadHirelyParse();
  const T = loadTemplates();

  const yoaz = await runPipeline(Parse, yoazRaw, 'yoaz-cv', 'paste-text');
  const ocr = await runPipeline(Parse, ocrRaw, 'ocr-corruption', 'pdf-ocr');

  const templateId = 'ats';
  const renderedHtml = T.render(yoaz.cv, templateId);
  const renderFailures = auditRendered(renderedHtml, yoaz.cv);
  const previewHtml = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="../../src/ui/templates/cv-design-tokens.css">
<link rel="stylesheet" href="../../src/ui/templates/cv-templates-premium.css">
<link rel="stylesheet" href="../../src/ui/hirely-document.css">
<style>body{margin:0;padding:24px;background:#efefeb}.cv{margin:0 auto;box-shadow:0 8px 32px rgba(0,0,0,.08)}</style>
</head><body><div id="cvDoc" class="cv template-${templateId} spacing-normal">${renderedHtml}</div></body></html>`;
  fs.writeFileSync(path.join(outDir, 'rendered-preview.html'), previewHtml);
  const ocrRendered = visibleText(T.render(ocr.cv, templateId));
  const ocrLeak = FAIL_STRINGS.some((s) => ocrRendered.includes(s));

  let serverProc = null;
  if (!process.env.HIRELY_SKIP_SERVER) {
    const port = process.env.HIRELY_PORT || '3456';
    serverProc = spawn('python3', ['-m', 'http.server', port], {
      cwd: root,
      stdio: 'ignore',
    });
    await waitForServer(`http://127.0.0.1:${port}/`);
  }

  let browser = { failures: [], screenshot: null, pdf: null, offlineScreenshot: null };
  try {
    browser = await browserGate(yoazRaw);
  } catch (e) {
    browser.failures.push(`browser gate error: ${e.message}`);
  }
  if (!browser.screenshot) {
    try {
      const b = await chromium.launch();
      const p = await b.newPage();
      const previewPath = path.join(outDir, 'rendered-preview.html');
      await p.goto(`file://${previewPath}`, { waitUntil: 'load' });
      const offlineShot = path.join(outDir, 'rendered-cv-offline.png');
      await p.locator('#cvDoc').screenshot({ path: offlineShot });
      browser.offlineScreenshot = offlineShot;
      await b.close();
    } catch (e) {
      browser.failures.push(`offline screenshot failed: ${e.message}`);
    }
  }
  if (serverProc) serverProc.kill('SIGTERM');

  const report = {
    ranAt: new Date().toISOString(),
    fixture: 'yoaz-cv',
    pass: false,
    yoaz: {
      status: yoaz.gate.status,
      failures: yoaz.gate.failures,
      reviews: yoaz.gate.reviews,
      rawSample: sampleLines(yoaz.pipe.rawText),
      cleanedSample: sampleLines(yoaz.pipe.cleanedText),
      rejectedLines: yoaz.pipe.rejectedLines || yoaz.pipe.audit?.rejectedLines || [],
      structuredResume: yoaz.pipe.structuredResume,
      renderedTemplate: templateId,
      renderFailures,
    },
    ocrScenario: {
      status: ocr.gate.status,
      failures: ocr.gate.failures,
      cleanedSample: sampleLines(ocr.pipe.cleanedText),
      corruptionLeakedToRender: ocrLeak,
      corruptionPin: ocr.forensic?.corruption,
    },
    browser,
  };

  const allFailures = [
    ...yoaz.gate.failures,
    ...renderFailures,
    ...browser.failures,
  ];
  if (ocrLeak) allFailures.push('OCR corruption scenario leaked forbidden strings into render');
  if (ocr.gate.status === 'FAIL' && ocr.gate.failures.some((f) => f.includes('garbage'))) {
    allFailures.push(...ocr.gate.failures.filter((f) => f.includes('garbage')));
  }

  report.pass =
    yoaz.gate.status !== 'FAIL' &&
    allFailures.length === 0 &&
    browser.cvVisible &&
    browser.templateSwitch &&
    browser.editable &&
    browser.pdf?.ok;

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log('\n══════════════════════════════════════════════════');
  console.log('HIRELY QUALITY GATE — yoaz-cv import');
  console.log('══════════════════════════════════════════════════\n');

  console.log('1. RAW EXTRACTION SAMPLE');
  console.log('─'.repeat(50));
  console.log(report.yoaz.rawSample);
  console.log('');

  console.log('2. CLEANED TEXT SAMPLE');
  console.log('─'.repeat(50));
  console.log(report.yoaz.cleanedSample);
  console.log('');

  console.log('3. REJECTED LINES');
  console.log('─'.repeat(50));
  const rej = report.yoaz.rejectedLines;
  console.log(rej.length ? rej.slice(0, 20).join('\n') : '(none)');
  console.log('');

  console.log('4. structuredResume JSON');
  console.log('─'.repeat(50));
  console.log(JSON.stringify(report.yoaz.structuredResume, null, 2).slice(0, 4000));
  if (JSON.stringify(report.yoaz.structuredResume).length > 4000) console.log('… [truncated in console; see report.json]');
  console.log('');

  console.log('5. RENDERED CV SCREENSHOT');
  console.log('─'.repeat(50));
  console.log(browser.screenshot || '(not captured — start npm run dev)');
  console.log('');

  console.log('6. EXPORT PDF RESULT');
  console.log('─'.repeat(50));
  console.log(browser.pdf ? JSON.stringify(browser.pdf, null, 2) : '(not captured)');
  console.log('');

  console.log('OCR corruption scenario (regression)');
  console.log('  cleaned:', report.ocrScenario.cleanedSample.split('\n')[0]);
  console.log('  leaked to render:', report.ocrScenario.corruptionLeakedToRender);
  console.log('');

  console.log('VERDICT:', report.pass ? 'PASS' : 'FAIL');
  if (!report.pass) {
    console.log('Failures:');
    [...new Set(allFailures)].forEach((f) => console.log('  •', f));
  }

  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
