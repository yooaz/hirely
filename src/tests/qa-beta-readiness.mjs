#!/usr/bin/env node
/**
 * HIRELY BETA LOCK — full product readiness gates (no new features).
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { chromium } from 'playwright';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import { canonicalImportFromFile, canonicalImportFromText } from '../core/import/canonical-import.js';
import { computeAtsScore } from '../core/validation/ats-engine.js';
import {
  buildCoverLetterFromResumeData,
  validateCoverLetterInputs,
} from '../core/export/cover-letter-engine.js';
import { renderCoverLetter } from '../core/export/cover-letter-renderer.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { validateExportLock } from '../core/export/export-lock.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { A4_WIDTH_PX } from '../core/export/pdf-export-config.js';
import {
  exportCvPdfPlaywright,
  analyzePdfBytes,
} from './lib/pdf-export-playwright.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const betaOutDir = path.join(root, 'tests/output/beta-readiness');
const PDF_FIXTURE = path.join(root, 'tests/output/p7-final-lock/fixture.pdf');
const DOCX_FIXTURE = path.join(root, 'tests/output/p7-final-lock/fixture.docx');
const PASTE_FIXTURE = path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt');

const gates = [];

function recordGate(id, name, pass, detail = '', commands = []) {
  gates.push({ id, name, pass, detail, commands });
  console.log(pass ? `PASS ${name}` : `FAIL ${name}`, detail ? `— ${detail}` : '');
}

async function bootstrapNodeExtractors() {
  if (!globalThis.mammoth) {
    const m = await import('mammoth');
    globalThis.mammoth = m.default || m;
  }
  if (!globalThis.pdfjsLib) {
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      'pdfjs-dist/legacy/build/pdf.worker.js'
    );
    globalThis.pdfjsLib = pdfjs;
  }
}

function runScript(script) {
  const res = spawnSync('npm', ['run', script], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, CI: '1' },
  });
  return {
    script,
    pass: res.status === 0,
    stdout: (res.stdout || '').trim(),
    stderr: (res.stderr || '').trim(),
  };
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console, document: undefined };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const deps = {
    esc,
    sectionLabel: (k) => k,
    cvBlock: (title, html) => (html ? `<section><h3>${title}</h3>${html}</section>` : ''),
    cvSkillsHtml: (skills) => skills.map((s) => esc(s)).join(', '),
    getPhotoHtml: () => '',
  };
  sandbox.initHirelyTemplates(deps);
  return sandbox.HirelyTemplates;
}

async function gateImport() {
  const cmds = ['check:core', 'qa:core-import', 'qa:saas-recovery'];
  const results = cmds.map(runScript);
  const allPass = results.every((r) => r.pass);
  const failed = results.filter((r) => !r.pass).map((r) => r.script);
  recordGate(
    'import',
    'Import works',
    allPass,
    allPass ? 'core + canonical import' : `failed: ${failed.join(', ')}`,
    cmds
  );
}

async function gateDocx() {
  const cmds = ['qa:docx'];
  const scriptPass = runScript('qa:docx').pass;
  let filePass = false;
  let detail = '';

  await bootstrapNodeExtractors();

  if (!fs.existsSync(DOCX_FIXTURE)) {
    detail = 'fixture.docx missing';
  } else {
    try {
      const buf = fs.readFileSync(DOCX_FIXTURE);
      const file = new File([buf], 'fixture.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const imp = await canonicalImportFromFile(file, { source: 'docx' });
      filePass =
        !!imp?.resumeData &&
        imp.rawText?.length > 20 &&
        (imp.importState === 'IMPORT_READY' || imp.importStatus === 'IMPORT_SUCCESS');
      detail = filePass
        ? `imported ${imp.rawText?.length || 0} chars, state=${imp.importState || 'ok'}`
        : `empty docx import (${imp?.importState || imp?.importStatus || 'unknown'})`;
    } catch (e) {
      detail = e.message;
    }
  }

  recordGate('docx', 'DOCX works', scriptPass && filePass, detail, cmds);
}

async function gatePdf() {
  const cmds = ['qa:pdf-routing', 'qa:document-extract'];
  const routing = runScript('qa:pdf-routing');
  const extract = runScript('qa:document-extract');
  let filePass = false;
  let detail = '';

  await bootstrapNodeExtractors();

  if (!fs.existsSync(PDF_FIXTURE)) {
    detail = 'fixture.pdf missing';
  } else {
    try {
      const buf = fs.readFileSync(PDF_FIXTURE);
      const file = new File([buf], 'fixture.pdf', { type: 'application/pdf' });
      const imp = await canonicalImportFromFile(file, { source: 'pdf' });
      filePass =
        !!imp?.resumeData &&
        imp.rawText?.length > 10 &&
        (imp.importState === 'IMPORT_READY' || imp.importStatus === 'IMPORT_SUCCESS');
      detail = filePass
        ? `pdf import state=${imp.importState || 'ok'} chars=${imp.rawText?.length || 0}`
        : `pdf import failed: ${imp?.importState || imp?.importStatus || 'unknown'}`;
    } catch (e) {
      detail = e.message;
    }
  }

  recordGate(
    'pdf',
    'PDF works',
    routing.pass && extract.pass && filePass,
    detail,
    cmds
  );
}

async function gatePaste() {
  let pass = false;
  let detail = '';
  try {
    const text = fs.readFileSync(PASTE_FIXTURE, 'utf8');
    const imp = await canonicalImportFromText(text, { source: 'paste' });
    pass =
      !!imp?.resumeData &&
      imp.rawText.length > 50 &&
      !!(imp.resumeData.identity?.name || imp.resumeData.experiences?.length);
    detail = pass
      ? `name=${imp.resumeData.identity?.name || '(from exp)'}`
      : 'paste import empty';
  } catch (e) {
    detail = e.message;
  }
  recordGate('paste', 'Paste works', pass, detail, ['canonicalImportFromText']);
}

async function gateTemplates() {
  const cmds = ['production-template-ids + cv-templates.js'];
  let inlinePass = true;
  const detailParts = [];

  try {
    const HirelyTemplates = loadTemplates();
    const sample = {
      name: 'Marie Dupont',
      title: 'Product Designer',
      email: 'marie@example.com',
      experience: ['Lead Designer — Acme — 2020–Present'],
      education: ['Master — ENSAD'],
      skills: ['Figma', 'UX'],
      languages: ['French', 'English'],
    };
    for (const id of PRODUCTION_TEMPLATE_IDS) {
      const html = HirelyTemplates.render(sample, id);
      if (!html || html.length < 200 || !html.includes('Marie Dupont')) {
        inlinePass = false;
        detailParts.push(`${id}: empty or placeholder render`);
      }
    }
    if (inlinePass) {
      detailParts.push(`${PRODUCTION_TEMPLATE_IDS.join(', ')} render OK`);
    }
  } catch (e) {
    inlinePass = false;
    detailParts.push(e.message);
  }

  recordGate('templates', '3 templates work', inlinePass, detailParts.join('; '), cmds);
}

async function gatePdfExport() {
  const cmds = ['export-lock.js', 'pdf-export-playwright'];
  fs.mkdirSync(betaOutDir, { recursive: true });
  const exportPdf = path.join(betaOutDir, 'cv-export.pdf');
  let pass = false;
  let detail = '';

  try {
    const sampleRd = {
      identity: { name: 'Marie Dupont', title: 'Product Designer', email: 'marie@example.com' },
      summary: 'Product designer.',
      experiences: [{ role: 'Designer', company: 'Acme', dates: '2020–Present', bullets: ['Shipped'] }],
      education: ['Master Design'],
      skills: ['Figma'],
      tools: ['Photoshop'],
      languages: ['French'],
      clients: [],
      projects: [],
      unsorted: [],
      meta: {},
    };
    const built = buildFinalResumeData(sampleRd);
    const lock = validateExportLock({
      finalResumeData: built.finalResumeData,
      contract: built.contract,
      cvMetrics: {
        className: 'cv cv-page cv--live template-ats',
        hasEmptyState: false,
        widthPx: A4_WIDTH_PX,
        scrollHeight: 1400,
        clientHeight: 600,
        sectionCount: 4,
        textLength: 400,
      },
      cvData: built.cvData,
      domText: `${built.cvData.name} ${built.cvData.experience?.[0] || ''} ${built.cvData.education?.[0] || ''} Figma`,
    });
    if (!lock.ok) throw new Error(lock.errors.join(',') || 'export lock rejected');

    const HirelyTemplates = loadTemplates();
    const sample = {
      name: 'Marie Dupont',
      title: 'Product Designer',
      email: 'marie@example.com',
      experience: ['Designer — Acme — 2020–Present'],
      education: ['Master Design'],
      skills: ['Figma'],
      languages: ['French'],
    };
    const inner = HirelyTemplates.render(sample, 'ats');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await exportCvPdfPlaywright(page, inner, 'ats', exportPdf);
    await browser.close();

    const bytes = fs.readFileSync(exportPdf);
    const analysis = await analyzePdfBytes(bytes);
    pass =
      bytes.length > 1500 &&
      analysis.pageCount >= 1 &&
      analysis.a4 === true;
    detail = pass
      ? `${bytes.length} bytes, ${analysis.pageCount} page(s), A4`
      : `export invalid: ${analysis.error || 'checks failed'}`;
  } catch (e) {
    detail = e.message;
  }

  recordGate('pdf_export', 'PDF export works', pass, detail, cmds);
}

async function gateAts() {
  const cmds = ['qa:ats-pipeline', 'qa:ats-scoring-audit'];
  const pipeline = runScript('qa:ats-pipeline');
  const audit = runScript('qa:ats-scoring-audit');
  const text = fs.readFileSync(PASTE_FIXTURE, 'utf8');
  const imp = await canonicalImportFromText(text, { source: 'paste' });
  const cv = resumeDataToCvData(imp.resumeData);
  const score = computeAtsScore(cv);
  const live =
    !!score &&
    score.total > 0 &&
    score.breakdown?.length >= 5 &&
    score.breakdown.reduce((s, c) => s + c.points, 0) === score.total;
  recordGate(
    'ats',
    'ATS works',
    pipeline.pass && audit.pass && live,
    live ? `score=${score.total}` : 'no live score',
    cmds
  );
}

async function gateCoverLetter() {
  const cmds = ['qa:cover-letter-engine', 'qa:letter-pipeline'];
  const engine = runScript('qa:cover-letter-engine');
  const pipeline = runScript('qa:letter-pipeline');

  const resumeData = {
    identity: { name: 'Marie Dupont', title: 'Product Designer', email: 'marie@example.com' },
    summary: 'Designer with 8 years experience.',
    experiences: [{ role: 'Lead Designer', company: 'Acme', dates: '2020–Present', bullets: ['Shipped features'] }],
    skills: ['Figma', 'UX'],
    tools: ['Photoshop'],
    languages: ['French'],
    education: ['Master Design'],
    clients: [],
    projects: [],
    unsorted: [],
    meta: {},
  };

  const cv = {
    name: 'Marie Dupont',
    title: 'Product Designer',
    email: 'marie@example.com',
    summary: resumeData.summary,
    experience: ['Lead Designer — Acme — 2020–Present: Shipped features'],
    skills: resumeData.skills,
    tools: resumeData.tools,
    languages: resumeData.languages,
    education: resumeData.education,
  };
  const letterOpts = {
    jobTitle: 'Product Designer',
    companyName: 'Acme Corp',
    mode: 'formal',
  };
  const validation = validateCoverLetterInputs(cv, letterOpts);
  const draft = buildCoverLetterFromResumeData(resumeData, letterOpts);
  const rendered = renderCoverLetter(cv, letterOpts);
  const live =
    validation.ok &&
    (draft?.text || '').length > 80 &&
    rendered?.html?.length > 100;

  recordGate(
    'cover_letter',
    'Cover letter works',
    engine.pass && pipeline.pass && live,
    live
      ? `${(draft?.text || '').length} chars, html=${rendered?.html?.length || 0}`
      : `letter failed validation=${validation.ok} draft=${(draft?.text || '').length} html=${rendered?.html?.length || 0}`,
    cmds
  );
}

async function main() {
  console.log('HIRELY BETA READINESS — architecture frozen, full QA\n');
  await gateImport();
  await gateDocx();
  await gatePdf();
  await gatePaste();
  await gateTemplates();
  await gatePdfExport();
  await gateAts();
  await gateCoverLetter();

  const pass = gates.every((g) => g.pass);
  const failed = gates.filter((g) => !g.pass);

  console.log('\n---');
  console.log(pass ? 'BETA READINESS: PASS' : `BETA READINESS: FAIL (${failed.length} gates)`);
  if (!pass) {
    for (const g of failed) console.log(`  ✗ ${g.name}: ${g.detail}`);
  }

  const reportPath = path.join(root, 'BETA_READINESS_REPORT.md');
  const lines = [
    '# Hirely Beta Readiness Report',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Beta lock',
    '',
    'Architecture frozen — no new features. Full QA gate verification only.',
    '',
    '## Gates',
    '',
    '| Gate | Status | Detail |',
    '|------|--------|--------|',
    ...gates.map((g) => `| ${g.name} | ${g.pass ? 'PASS' : 'FAIL'} | ${String(g.detail || '').replace(/\|/g, '\\|')} |`),
    '',
    '## QA commands',
    '',
    '```bash',
    'npm run qa:beta-readiness',
    'npm run beta-readiness-report',
    '```',
    '',
    '## Per-gate scripts',
    '',
    ...gates.flatMap((g) => [
      `### ${g.name}`,
      '',
      ...(g.commands || []).map((c) => `- \`npm run ${c}\``),
      '',
    ]),
  ];

  if (!pass) {
    lines.push('## Failed gates', '', ...failed.map((g) => `- **${g.name}**: ${g.detail}`), '');
  }

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(`Wrote ${reportPath}`);

  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('BETA READINESS CRASH:', e);
  process.exit(1);
});
