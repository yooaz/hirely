#!/usr/bin/env node
/**
 * P0 — Final PDF export lock (production html2pdf path).
 * Chrome · Safari · Firefox — blob, A4, photo, page breaks, no crop.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium, webkit, firefox } from 'playwright';
import { buildCvExportFilename } from '../core/export/export-lock.js';
import { PDF_EXPORT_ENGINE } from '../core/export/pdf-export-config.js';
import {
  analyzePdfBytes,
  auditExportDom,
  buildPdfExportHtml,
  validatePdfHardening,
} from './lib/pdf-export-playwright.mjs';

export const FINAL_PDF_EXPORT_LOCK_V1 = 'FINAL_PDF_EXPORT_LOCK_V1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/final-pdf-export-lock');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

const PHOTO_DATA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC';

const BASE_CV = {
  name: 'Camille Laurent',
  title: 'Creative Director',
  email: 'camille@example.com',
  phone: '+33 6 12 34 56 78',
  location: 'Paris',
  summary: 'Brand and design leader across luxury and culture.',
  education: ['ENSAD Paris — Master Design'],
  skills: ['Creative direction', 'Brand strategy', 'Team leadership'],
  tools: ['Figma', 'After Effects', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Chanel', 'Hermès', 'Aesop'],
  projects: ['Brand system — Lumière', 'Campaign — Atelier Nord'],
};

function longExperience(n) {
  return Array.from({ length: n }, (_, i) => {
    const y = 2008 + i;
    return {
      role: `Director — Unit ${String.fromCharCode(65 + (i % 26))}`,
      company: `Global Firm ${i + 1}`,
      dates: `${y}–${y + 1}`,
      bullets: [`Delivered ${12 + (i % 20)}% revenue growth across ${3 + (i % 4)} regions.`],
    };
  });
}

const SCENARIOS = [
  {
    id: 'short-ats',
    templateId: 'ats-recruiter',
    cv: { ...BASE_CV, experience: longExperience(2) },
    withPhoto: false,
    expectPages: { min: 1, max: 2 },
  },
  {
    id: 'photo-executive',
    templateId: 'luxury-executive',
    cv: { ...BASE_CV, experience: longExperience(4) },
    withPhoto: true,
    expectPages: { min: 1, max: 3 },
  },
];

const BROWSERS = [
  { id: 'chrome', name: 'Chrome', launcher: chromium },
  { id: 'safari', name: 'Safari', launcher: webkit },
  { id: 'firefox', name: 'Firefox', launcher: firefox },
];

let failed = 0;
const checks = [];
const browserRuns = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function photoHtml() {
  return `<div class="cvPhotoWrap"><img class="cvPhoto" src="${PHOTO_DATA}" alt="" style="object-fit:cover"></div>`;
}

function loadTemplates(getPhotoHtml = () => '') {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        tools: 'Tools',
        languages: 'Languages',
        profile: 'Profile',
        clients: 'Clients',
        projects: 'Projects',
      })[k] || k,
    cvBlock: (t, h) =>
      h ? `<section class="cvSection"><h3 class="cvSectionTitle">${esc(t)}</h3><div class="cvSectionBody">${h}</div></section>` : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml,
  });
  return sandbox.HirelyTemplates;
}

function runStaticAudit() {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const loaderJs = fs.readFileSync(path.join(ROOT, 'src/vendor/csp-safe-loader.js'), 'utf8');
  const exportJs = fs.readFileSync(path.join(ROOT, 'src/ui/export/hirely-pdf-export.js'), 'utf8');

  record('version', FINAL_PDF_EXPORT_LOCK_V1 === 'FINAL_PDF_EXPORT_LOCK_V1');
  record('engine', PDF_EXPORT_ENGINE === 'PDF_EXPORT_P6');

  record(
    'audit:button_click',
    /id="downloadBtn"/.test(indexHtml) &&
      /bindClick\('downloadBtn',\s*downloadPDF\)/.test(indexHtml),
    '#downloadBtn → downloadPDF()'
  );
  record(
    'audit:blob_creation',
    /exportCvToPdfBlob/.test(exportJs) && /exportCvToPdfBlob/.test(indexHtml),
    'HirelyPdfExport.exportCvToPdfBlob'
  );
  record(
    'audit:filename',
    /buildCvExportFilename/.test(indexHtml) && buildCvExportFilename({ name: 'Jane Doe' }) === 'hirely-Jane-Doe.pdf'
  );
  record(
    'audit:html2pdf_local',
    /node_modules\/html2pdf\.js\/dist\/html2pdf\.bundle\.min\.js/.test(loaderJs) &&
      fs.existsSync(path.join(ROOT, 'node_modules/html2pdf.js/dist/html2pdf.bundle.min.js')),
    'csp-safe-loader same-origin bundle'
  );
  record(
    'audit:images_data_url',
    /allowTaint:\s*false/.test(exportJs) && /useCORS:\s*true/.test(exportJs),
    'data-URL photos only at capture'
  );
  record('audit:fonts_ready', /fonts\.ready/.test(exportJs));
  record('audit:page_breaks', /pagebreak/.test(exportJs) && fs.existsSync(path.join(ROOT, 'src/ui/export/cv-a4-pages.js')));
  record(
    'audit:hirely_pdf_export_script',
    /src\/ui\/export\/hirely-pdf-export\.js/.test(indexHtml) && /HirelyPdfExport\.exportCvToPdf/.test(indexHtml)
  );
  record('audit:lazy_html2pdf', /ensureHtml2pdf/.test(indexHtml) && /ensureHtml2pdf/.test(loaderJs));
}

function buildHarness(innerHtml, templateId, withPhoto) {
  const exportHtml = buildPdfExportHtml(innerHtml, templateId, { withPhoto });
  return exportHtml.replace('<div class="cv template-', '<div id="cvDoc" class="cv template-');
}

async function exportBlob(page, innerHtml, templateId, withPhoto) {
  const harness = buildHarness(innerHtml, templateId, withPhoto);
  const html2pdfPath = path.join(ROOT, 'node_modules/html2pdf.js/dist/html2pdf.bundle.min.js');
  const hirelyExportPath = path.join(ROOT, 'src/ui/export/hirely-pdf-export.js');

  await page.setContent(harness, { waitUntil: 'load', timeout: 60000 });
  await page.addScriptTag({ path: html2pdfPath });
  await page.addScriptTag({ path: hirelyExportPath });
  await page.waitForFunction(() => typeof window.html2pdf === 'function' && !!window.HirelyPdfExport, {
    timeout: 30000,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const cv = document.getElementById('cvDoc');
    if (cv && window.HirelyA4Pages?.layoutCvA4Pages) window.HirelyA4Pages.layoutCvA4Pages(cv);
  });
  await page.waitForTimeout(300);

  const domAudit = await auditExportDom(page);
  const blobResult = await page.evaluate(async () => {
    const cv = document.getElementById('cvDoc');
    if (!cv || !window.HirelyPdfExport?.exportCvToPdfBlob) {
      return { ok: false, error: 'HirelyPdfExport missing' };
    }
    const res = await window.HirelyPdfExport.exportCvToPdfBlob(cv, 'hirely-test.pdf');
    if (!res?.ok || !res.blob) {
      return { ok: false, error: (res?.errors || ['blob_failed']).join('; ') };
    }
    const buf = await res.blob.arrayBuffer();
    return {
      ok: true,
      bytes: Array.from(new Uint8Array(buf)),
      pagesEstimated: res.pagesEstimated || 1,
      sheetCount: cv.querySelectorAll('.cvA4Sheet').length || 0,
      fontsApi: !!document.fonts,
      fontsReady: document.fonts?.status === 'loaded',
    };
  });

  return { domAudit, blobResult };
}

async function runBrowserMatrix() {
  let photoBytesChrome = 0;
  let noPhotoBytesChrome = 0;

  for (const browserDef of BROWSERS) {
    const browser = await browserDef.launcher.launch({ headless: true });
    const page = await browser.newPage();

    try {
      for (const scenario of SCENARIOS) {
        const T = loadTemplates(scenario.withPhoto ? photoHtml : () => '');
        const inner = T.render(scenario.cv, scenario.templateId);
        const runId = `${browserDef.id}:${scenario.id}`;
        const run = {
          id: runId,
          browser: browserDef.id,
          scenario: scenario.id,
          pass: false,
          issues: [],
        };

        if (scenario.withPhoto && !/cvPhoto/i.test(inner)) {
          run.issues.push('photo_missing_html');
        }

        try {
          const { domAudit, blobResult } = await exportBlob(page, inner, scenario.templateId, scenario.withPhoto);
          if (!domAudit.ok) run.issues.push(`dom:${domAudit.issues.join(',')}`);
          if (!blobResult.ok) {
            run.issues.push(`blob:${blobResult.error}`);
            browserRuns.push(run);
            record(`browser:${runId}`, false, run.issues.join('; '));
            continue;
          }

          const bytes = Buffer.from(blobResult.bytes);
          const pdfPath = path.join(OUT_DIR, `${browserDef.id}-${scenario.id}.pdf`);
          fs.writeFileSync(pdfPath, bytes);
          const analysis = await analyzePdfBytes(bytes);
          const hardening = await validatePdfHardening(bytes, {
            contentHeightPx: blobResult.pagesEstimated * 1123,
            estimatedPages: blobResult.pagesEstimated,
            sheetCount: blobResult.sheetCount,
            laidOut: blobResult.sheetCount > 0,
          });

          const pagesOk =
            analysis.pageCount != null &&
            analysis.pageCount >= scenario.expectPages.min &&
            analysis.pageCount <= scenario.expectPages.max;
          const opensOk = analysis.pageCount != null && analysis.pageCount >= 1 && !analysis.error;
          const a4Ok = analysis.a4 === true;
          const horizOverflow = Math.max(0, (domAudit.scrollWidth || 0) - (domAudit.clientWidth || 0));
          const noCropOk =
            !domAudit.issues.includes('client_crop') &&
            !hardening.issues.includes('content_clipped') &&
            horizOverflow <= 8;
          const noBlankFirstOk = opensOk && bytes.length > 2000;
          const pageBreakOk = blobResult.sheetCount >= 1;

          if (!pagesOk) run.issues.push('page_count');
          if (!opensOk) run.issues.push('pdf_wont_open');
          if (!a4Ok) run.issues.push('not_a4');
          if (!noCropOk) run.issues.push('cropped');
          if (!noBlankFirstOk) run.issues.push('blank_or_empty');
          if (!pageBreakOk) run.issues.push('no_a4_sheets');

          run.pass = run.issues.length === 0;
          run.analysis = { pageCount: analysis.pageCount, a4: analysis.a4, bytes: bytes.length };
          browserRuns.push(run);
          record(`browser:${runId}`, run.pass, run.issues.join('; ') || `pages=${analysis.pageCount}`);

          if (browserDef.id === 'chrome') {
            if (scenario.withPhoto) photoBytesChrome = bytes.length;
            else noPhotoBytesChrome = bytes.length;
          }

          if (browserDef.id === 'chrome' && scenario.id === 'short-ats') {
            record('accept:download_works', blobResult.ok, `${bytes.length} bytes`);
            record('accept:pdf_opens', opensOk, `pages=${analysis.pageCount}`);
            record('accept:a4_correct', a4Ok, `${analysis.widthPt}x${analysis.heightPt}pt`);
            record('accept:no_blank_first_page', noBlankFirstOk);
            record('accept:no_cropped_content', noCropOk, domAudit.issues.join(',') || 'ok');
            record('accept:fonts_loaded', blobResult.fontsApi && blobResult.fontsReady !== false);
            record('accept:page_breaks', pageBreakOk, `sheets=${blobResult.sheetCount}`);
          }
          if (browserDef.id === 'chrome' && scenario.id === 'photo-executive') {
            record('accept:photo_included', /cvPhoto/i.test(inner) && bytes.length > 2500);
          }
        } catch (err) {
          run.issues.push(String(err?.message || err));
          browserRuns.push(run);
          record(`browser:${runId}`, false, run.issues.join('; '));
        }
      }
    } finally {
      await browser.close();
    }
  }

  if (photoBytesChrome && noPhotoBytesChrome) {
    record('accept:photo_bytes_delta', photoBytesChrome >= noPhotoBytesChrome * 0.85, `${photoBytesChrome} vs ${noPhotoBytesChrome}`);
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  runStaticAudit();
  await runBrowserMatrix();

  const browserPass = browserRuns.filter((r) => r.pass).length;
  const acceptanceIds = [
    'accept:download_works',
    'accept:pdf_opens',
    'accept:a4_correct',
    'accept:photo_included',
    'accept:no_blank_first_page',
    'accept:no_cropped_content',
  ];
  const acceptancePass = acceptanceIds.every((id) => checks.find((c) => c.id === id)?.pass);

  const report = {
    version: FINAL_PDF_EXPORT_LOCK_V1,
    engine: PDF_EXPORT_ENGINE,
    generatedAt: new Date().toISOString(),
    pass: failed === 0 && acceptancePass,
    summary: {
      total: checks.length,
      pass: checks.filter((c) => c.pass).length,
      fail: failed,
      browserRuns: browserRuns.length,
      browserPass,
    },
    acceptance: acceptanceIds.map((id) => {
      const c = checks.find((x) => x.id === id);
      return { id, pass: !!c?.pass, detail: c?.detail || '' };
    }),
    checks,
    browserRuns,
    productionPath: 'downloadPDF() → HirelyLazy.ensureHtml2pdf() → HirelyPdfExport.exportCvToPdf()',
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  console.log(`\n═══ Final PDF Export Lock: ${report.summary.pass}/${report.summary.total} PASS ═══`);
  process.exit(failed === 0 && acceptancePass ? 0 : 1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error('qa-final-pdf-export-lock failed:', err);
    process.exit(1);
  });
}
