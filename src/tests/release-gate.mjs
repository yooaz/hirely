#!/usr/bin/env node
/**
 * HIRELY RELEASE GATE — final validation before release.
 * Checks: Import, OCR, Parser, Review Queue, Templates, PDF Export.
 * Writes RELEASE_REPORT.md + tests/output/release-gate/report.json
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { loadHirelyParse } from './load-hirely-parse.mjs';
import {
  evaluateExtraction,
  evaluateYoazFixture,
  hasOcrGarbageInStructured,
  missingCriticalFields,
} from '../../tests/lib/quality-gate.mjs';
import {
  REVIEW_QUEUE_THRESHOLD,
  buildReviewQueue,
  applyReviewQueueToCvData,
  resolveReviewItem,
  pendingReviewItems,
} from '../core/parsing/review-queue.js';
import { postProcessOcrText } from '../core/parsing/ocr-postprocess.js';
import { analyzeLineCorruption } from '../core/parsing/corruption-detector.js';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const OUT_DIR = path.join(root, 'tests/output/release-gate');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');
const RELEASE_MD = path.join(root, 'RELEASE_REPORT.md');
const YOAZ_FIXTURE = path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt');

const FAIL_STRINGS = ['Ce Frei Re', 'A>o', "N'$ak"];
/** OCR corruption line — must be detected, not exported. */
const OCR_CORRUPT_LINE = "C e   F r e i   R e";

/** Clean OCR sample for pipeline (name + experience must survive post-process). */
const OCR_PIPELINE_FIXTURE = `Yohann Azancot
Graphic Designer
yoaz@hotmail.fr
+33 6 49 43 48 39
Experience
Lead Illustrator — Independent — 2011–Present
Nike, Adobe, Louis Vuitton
Education
LISAA — Web & Motion Design
Skills
Illustration, Graphic Design`;

const IMPORT_HARD_FAIL = new Set([
  'blank CV',
  'no name',
  'no experience',
  'OCR garbage in final structuredResume',
  'email inside summary',
  'phone/email inside education',
]);

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
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
        profile: 'Profile',
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
      })[k] || k,
    cvBlock: (title, html) =>
      html
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
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

function auditTemplateRender(html, cv) {
  const issues = [];
  const text = visibleText(html);
  if (!text || text.length < 40) issues.push('template_render_empty');
  if (!String(cv.name || '').split(' ')[0] || !text.includes(String(cv.name).split(' ')[0])) {
    issues.push('template_missing_name');
  }
  if (!/experience/i.test(html) && (cv.experience || []).length) {
    issues.push('template_missing_experience_section');
  }
  for (const s of FAIL_STRINGS) {
    if (text.includes(s)) issues.push(`template_corrupted_text:${s}`);
  }
  if (/<section class="cvSection[^"]*">\s*<h3[^>]*>[^<]+<\/h3>\s*<div class="cvSectionBody">\s*<\/div>/i.test(html)) {
    issues.push('template_empty_section');
  }
  return issues;
}

function runNodeScript(relPath, label) {
  const full = path.join(root, relPath);
  const started = Date.now();
  try {
    const stdout = execSync(`node "${full}"`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
      maxBuffer: 4 * 1024 * 1024,
    });
    return {
      id: label,
      pass: true,
      durationMs: Date.now() - started,
      exitCode: 0,
      tail: stdout.trim().split('\n').slice(-8).join('\n'),
    };
  } catch (e) {
    const combined = `${e.stdout || ''}\n${e.stderr || ''}`.trim();
    return {
      id: label,
      pass: false,
      durationMs: Date.now() - started,
      exitCode: e.status ?? 1,
      tail: combined.split('\n').slice(-12).join('\n'),
    };
  }
}

async function waitForServer(url, ms = 12000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}

function sectionResult(id, label, pass, details = {}) {
  return { id, label, pass, ...details };
}

async function checkImport(Parse) {
  const failures = [];
  const reviews = [];
  if (!fs.existsSync(YOAZ_FIXTURE)) {
    return sectionResult('import', 'Import', false, {
      failures: ['yoaz fixture missing: tests/fixtures/yoaz-cv/fixture.txt'],
    });
  }
  const raw = fs.readFileSync(YOAZ_FIXTURE, 'utf8');
  const pipe = await Parse.runExtractionPipeline(raw, { extractionMethod: 'paste-text' });
  const cv = pipe.validatedCVData || {};
  const gate = evaluateExtraction({ cv, audit: pipe.audit });
  const yoazWarns = evaluateYoazFixture(cv, pipe.cleanedText || '');

  const hardFails = gate.failures.filter((f) => IMPORT_HARD_FAIL.has(f));
  failures.push(...hardFails);
  reviews.push(
    ...gate.failures.filter((f) => !IMPORT_HARD_FAIL.has(f)).map((f) => `review: ${f}`),
    ...gate.reviews,
    ...yoazWarns.map((w) => `yoaz: ${w}`)
  );

  const readable =
    String(cv.name || '').trim().length > 0 &&
    (cv.experience || []).length > 0 &&
    !hasOcrGarbageInStructured(cv);

  if (!readable) {
    if (!String(cv.name || '').trim()) failures.push('no name');
    if (!(cv.experience || []).length) failures.push('no experience');
    if (hasOcrGarbageInStructured(cv)) failures.push('corrupted text in CV');
  }

  return sectionResult('import', 'Import', failures.length === 0 && readable, {
    failures: [...new Set(failures)],
    reviews,
    cvReadable: readable,
    completeness: gate.completeness,
    name: cv.name,
    experienceCount: (cv.experience || []).length,
    canGenerate: !!pipe.canGenerate,
  });
}

async function checkOcr(Parse) {
  const failures = [];
  const SECTION_HDR = /exp[eéèêë]rience|EXPÉRIENCE|experience/i;

  const fixed = postProcessOcrText(OCR_PIPELINE_FIXTURE, { ocr: true });
  if (!/yohann|azancot/i.test(fixed)) failures.push('OCR post-process lost name');
  if (!SECTION_HDR.test(fixed)) failures.push('OCR section header not normalized');

  for (const line of ["A>o N'$ak6.f", 'Ce Frei Re', OCR_CORRUPT_LINE]) {
    const a = analyzeLineCorruption(line);
    if (!a.corrupted) failures.push(`corruption detector missed: ${line.slice(0, 24)}`);
  }

  const pipe = await Parse.runExtractionPipeline(fixed, {
    extractionMethod: 'pdf-ocr',
    trusted: true,
  });
  const cv = pipe.validatedCVData || {};
  if (!(cv.experience || []).length) failures.push('OCR pipeline: no experience');
  const identityOk =
    String(cv.name || '').trim().length > 0 ||
    (/yoaz@|yohann|azancot/i.test(String(cv.email || '')) && (cv.experience || []).length >= 1);
  if (!identityOk) failures.push('OCR pipeline: no name or identity');
  if (hasOcrGarbageInStructured(cv)) failures.push('corrupted text leaked into structured CV');

  const corruptPipe = await Parse.runExtractionPipeline(
    `${OCR_PIPELINE_FIXTURE.split('\n')[0]}\n${OCR_CORRUPT_LINE}\n${OCR_PIPELINE_FIXTURE.split('\n').slice(1).join('\n')}`,
    { extractionMethod: 'pdf-ocr', trusted: true }
  );
  const corruptCv = corruptPipe.validatedCVData || {};
  const expBlob = (corruptCv.experience || []).join(' ');
  if (/Ce Frei Re|A>o/i.test(expBlob)) failures.push('corrupted line leaked into experience');

  const subprocess = runNodeScript('src/tests/qa-ocr-pipeline.mjs', 'qa-ocr-pipeline');
  const corruption = runNodeScript('src/tests/qa-corruption-detector.mjs', 'qa-corruption-detector');
  if (!subprocess.pass) failures.push('qa-ocr-pipeline subprocess failed');
  if (!corruption.pass) failures.push('qa-corruption-detector subprocess failed');

  return sectionResult('ocr', 'OCR', failures.length === 0, {
    failures,
    subprocess: { pipeline: subprocess, corruption },
  });
}

function checkParser() {
  const failures = [];
  const subprocess = runNodeScript('src/tests/qa-parser-sections.mjs', 'qa-parser-sections');
  if (!subprocess.pass) failures.push('qa-parser-sections subprocess failed');
  return sectionResult('parser', 'Parser', failures.length === 0, {
    failures,
    subprocess,
  });
}

function checkReviewQueue() {
  const failures = [];
  try {
    if (REVIEW_QUEUE_THRESHOLD !== 70) failures.push('review threshold not 70');
    const queue = buildReviewQueue({
      parserReview: [
        {
          field: 'skills',
          detected: 'Illustrator CC',
          sourceText: 'Illustrator CC',
          confidence: 55,
          reason: 'Low parser confidence',
        },
      ],
      rejectedLines: ["A>o N'$ak6.f"],
    });
    if (queue.length < 2) failures.push('review queue too short');
    const cv = {
      name: 'Jane Doe',
      skills: ['Illustrator CC', 'Figma'],
      experience: ["A>o N'$ak6.f", 'Designer — Agency 2020–2024'],
    };
    const gated = applyReviewQueueToCvData(cv, queue);
    if (gated.skills.includes('Illustrator CC')) failures.push('low-confidence skill visible before accept');
    if (gated.experience.some((e) => e.includes("A>o"))) failures.push('corrupted line visible before review');
    if (!gated.experience.some((e) => /Designer/i.test(e))) failures.push('clean experience removed incorrectly');
    const skillIdx = queue.findIndex((i) => i.field === 'skills');
    const accept = resolveReviewItem(queue, skillIdx, 'accepted', cv);
    if (!accept.cvData.skills?.includes('Illustrator CC')) failures.push('accept did not merge skill');
    const corruptIdx = accept.queue.findIndex((i) => i.action === 'corruption');
    const ignore = resolveReviewItem(accept.queue, corruptIdx, 'ignored', accept.cvData);
    if (pendingReviewItems(ignore.queue).length > 0) failures.push('pending items remain after resolve');
  } catch (e) {
    failures.push(`review queue error: ${e.message}`);
  }

  const subprocess = runNodeScript('src/tests/qa-review-queue.mjs', 'qa-review-queue');
  if (!subprocess.pass) failures.push('qa-review-queue subprocess failed');

  return sectionResult('review-queue', 'Review Queue', failures.length === 0, {
    failures,
    subprocess,
    threshold: REVIEW_QUEUE_THRESHOLD,
  });
}

function checkTemplates() {
  const failures = [];
  const T = loadTemplates();
  const sample = {
    name: 'Yohann Azancot',
    title: 'Graphic Designer',
    email: 'yoaz@hotmail.fr',
    experience: ['Freelance Designer — Studio — 2020–Present'],
    education: ['LISAA'],
    skills: ['Illustration'],
  };

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    try {
      const html = T.render(sample, id);
      const issues = auditTemplateRender(html, sample);
      if (issues.length) failures.push(`${id}: ${issues.join(', ')}`);
    } catch (e) {
      failures.push(`${id}: render error ${e.message}`);
    }
  }

  const subprocess = runNodeScript('src/tests/template-audit.mjs', 'template-audit');
  if (!subprocess.pass) failures.push('template-audit subprocess failed');

  return sectionResult('templates', 'Templates', failures.length === 0, {
    failures,
    templateCount: PRODUCTION_TEMPLATE_IDS.length,
    subprocess,
  });
}

function checkPdfExport(serverPort) {
  const failures = [];
  const env = { ...process.env, HIRELY_PORT: String(serverPort), HIRELY_BASE: `http://127.0.0.1:${serverPort}/index.html` };
  const full = path.join(root, 'src/tests/pdf-export-qa.mjs');
  const started = Date.now();
  try {
    execSync(`node "${full}"`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (e) {
    failures.push('pdf-export-qa subprocess failed');
    failures.push((e.stdout || e.stderr || '').trim().split('\n').slice(-6).join('\n'));
  }

  const reportPath = path.join(root, 'tests/output/pdf-export-qa/report.json');
  let pdfReport = null;
  if (fs.existsSync(reportPath)) {
    pdfReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    for (const s of pdfReport.scenarios || []) {
      if (!s.pass) failures.push(`PDF scenario ${s.id}: ${(s.issues || []).join(', ') || 'failed'}`);
      if (s.analysis?.a4 === false) failures.push(`PDF ${s.id}: not A4`);
      if (!s.analysis?.pageCount) failures.push(`PDF ${s.id}: broken or unreadable PDF`);
    }
    if (!pdfReport.html2pdfBrowser?.ok && !pdfReport.html2pdfBrowser?.skipped) {
      failures.push('html2pdf browser export failed');
    }
  } else if (!failures.length) {
    failures.push('pdf-export QA report missing');
  }

  return sectionResult('pdf-export', 'PDF Export', failures.length === 0, {
    failures,
    durationMs: Date.now() - started,
    pdfReport: pdfReport
      ? {
          summary: pdfReport.summary,
          scenarios: (pdfReport.scenarios || []).map((s) => ({
            id: s.id,
            pass: s.pass,
            pageCount: s.analysis?.pageCount,
            a4: s.analysis?.a4,
          })),
          html2pdf: pdfReport.html2pdfBrowser,
        }
      : null,
  });
}

function buildMarkdown(report) {
  const lines = [
    '# Hirely Release Gate Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Verdict:** ${report.pass ? '✅ PASS' : '❌ FAIL'}`,
    '',
    '## Summary',
    '',
    '| Check | Status | Notes |',
    '|-------|--------|-------|',
  ];

  for (const s of report.sections) {
    const status = s.pass ? 'PASS' : 'FAIL';
    const notes =
      s.failures?.length > 0
        ? s.failures.slice(0, 3).join('; ')
        : s.cvReadable === false
          ? 'CV not readable'
          : 'OK';
    lines.push(`| ${s.label} | ${status} | ${notes.replace(/\|/g, '/')} |`);
  }

  lines.push(
    '',
    '## Release criteria',
    '',
    'Pass only when:',
    '- CV is readable (name + experience, no corruption in export)',
    '- Import, OCR, and parser pipelines succeed',
    '- Review queue gates low-confidence and corrupted lines',
    '- All 12 production templates render without errors',
    '- PDF export produces valid A4 PDFs (1-page, 2-page, creative scenarios)',
    '',
    'Fail when:',
    '- Corrupted text in final CV or template',
    '- Empty CV, missing name, or missing experience',
    '- Broken PDF or template render error',
    '',
    '## Section details',
    ''
  );

  for (const s of report.sections) {
    lines.push(`### ${s.label} — ${s.pass ? 'PASS' : 'FAIL'}`);
    if (s.failures?.length) {
      lines.push('');
      lines.push('Failures:');
      for (const f of s.failures) lines.push(`- ${f}`);
    }
    if (s.reviews?.length) {
      lines.push('');
      lines.push('Reviews (non-blocking):');
      for (const r of s.reviews.slice(0, 8)) lines.push(`- ${r}`);
    }
    if (s.completeness) {
      lines.push('');
      lines.push(`Completeness: ${s.completeness.percent}% (${s.completeness.filled.join(', ')})`);
    }
    if (s.pdfReport?.scenarios) {
      lines.push('');
      lines.push('PDF scenarios:');
      for (const p of s.pdfReport.scenarios) {
        lines.push(`- ${p.id}: ${p.pass ? 'PASS' : 'FAIL'} (${p.pageCount} pg, A4=${p.a4})`);
      }
    }
    lines.push('');
  }

  lines.push(
    '## Commands',
    '',
    '```bash',
    'npm run release:gate',
    'npm run release:notify:dry   # preview Resend summary (no send)',
    '# Optional: RESEND_API_KEY, RESEND_FROM, HIRELY_RELEASE_NOTIFY_TO in .env.local',
    'npm run release:notify',
    '```',
    ''
  );
  lines.push(`Machine-readable: \`tests/output/release-gate/report.json\``);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const port = process.env.HIRELY_PORT || '3456';
  let serverProc = null;

  if (!process.env.HIRELY_SKIP_SERVER) {
    serverProc = spawn('python3', ['-m', 'http.server', port], {
      cwd: root,
      stdio: 'ignore',
    });
    await waitForServer(`http://127.0.0.1:${port}/`);
  }

  const Parse = await loadHirelyParse();
  const sections = [];

  /* OCR before Import — pipeline module retains state across yoaz fixture run */
  sections.push(await checkOcr(Parse));
  sections.push(await checkImport(Parse));
  sections.push(checkParser());
  sections.push(checkReviewQueue());
  sections.push(checkTemplates());
  sections.push(checkPdfExport(port));

  if (serverProc) serverProc.kill('SIGTERM');

  const pass = sections.every((s) => s.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    engine: 'hirely-release-gate-v1',
    pass,
    sections,
    summary: {
      total: sections.length,
      passed: sections.filter((s) => s.pass).length,
      failed: sections.filter((s) => !s.pass).length,
    },
    artifacts: {
      json: 'tests/output/release-gate/report.json',
      pdfQa: 'tests/output/pdf-export-qa/report.json',
      templateAudit: 'tests/output/template-audit/report.json',
    },
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(RELEASE_MD, buildMarkdown(report), 'utf8');

  console.log('\n══════════════════════════════════════════════════');
  console.log('HIRELY RELEASE GATE');
  console.log('══════════════════════════════════════════════════\n');
  for (const s of sections) {
    console.log(`  ${s.pass ? 'PASS' : 'FAIL'}  ${s.label}`);
    if (s.failures?.length) s.failures.forEach((f) => console.log(`         • ${f}`));
  }
  console.log(`\nVERDICT: ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`Report: ${path.relative(root, RELEASE_MD)}`);
  console.log(`JSON:   ${path.relative(root, REPORT_JSON)}`);

  if (process.env.HIRELY_RELEASE_NOTIFY_TO && process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    try {
      const { buildReleaseGateEmail, sendReleaseGateEmail } = await import(
        '../core/notify/release-gate-email.js'
      );
      const to = String(process.env.HIRELY_RELEASE_NOTIFY_TO)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const sent = await sendReleaseGateEmail({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM,
        to,
        email: buildReleaseGateEmail(report),
      });
      console.log(`Notify: email sent (${sent.id || 'ok'})`);
    } catch (e) {
      console.warn(`Notify: Resend failed — ${e.message}`);
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
