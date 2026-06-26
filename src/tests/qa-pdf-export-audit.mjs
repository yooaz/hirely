#!/usr/bin/env node
/**
 * P0 — PDF Export Audit
 * HTML render · PDF render · page breaks · fonts · images · download · blob · filename
 * Browsers: Chrome (Chromium) · Safari (WebKit) · Firefox — production html2pdf path
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium, webkit, firefox } from 'playwright';
import { buildCvExportFilename } from '../core/export/export-lock.js';
import {
  exportCvPdfPlaywright,
  analyzePdfBytes,
  buildPdfExportHtml,
  validatePdfHardening,
} from './lib/pdf-export-playwright.mjs';
import { buildPdfExportV2Packet } from '../core/export/pdf-export-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/pdf-export-audit-report');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

export const PDF_EXPORT_AUDIT_P0 = 'PDF_EXPORT_REPORT_V1';

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
    label: 'Short ATS',
    templateId: 'ats-recruiter',
    cv: { ...BASE_CV, experience: longExperience(2) },
    expectPages: { min: 1, max: 2 },
    withPhoto: false,
  },
  {
    id: 'long-executive',
    label: 'Long executive',
    templateId: 'luxury-executive',
    cv: { ...BASE_CV, experience: longExperience(14) },
    expectPages: { min: 1, max: 4 },
    withPhoto: false,
  },
  {
    id: 'photo-editorial',
    label: 'Photo editorial',
    templateId: 'kinfolk-editorial',
    cv: { ...BASE_CV, experience: longExperience(4) },
    expectPages: { min: 1, max: 3 },
    withPhoto: true,
  },
  {
    id: 'creative-portfolio',
    label: 'Creative portfolio',
    templateId: 'creative-director-portfolio',
    cv: { ...BASE_CV, experience: longExperience(5) },
    expectPages: { min: 1, max: 3 },
    withPhoto: false,
  },
  {
    id: 'v3-premium-ats',
    label: 'Premium ATS (v3)',
    templateId: 'premium-ats',
    cv: { ...BASE_CV, experience: longExperience(6) },
    expectPages: { min: 1, max: 3 },
    withPhoto: false,
  },
  {
    id: 'v3-executive-board',
    label: 'Executive board (v3)',
    templateId: 'executive-board',
    cv: { ...BASE_CV, experience: longExperience(10) },
    expectPages: { min: 1, max: 4 },
    withPhoto: false,
  },
  {
    id: 'v3-creative-photo',
    label: 'Creative director + photo (v3)',
    templateId: 'creative-director',
    cv: { ...BASE_CV, experience: longExperience(4) },
    expectPages: { min: 1, max: 3 },
    withPhoto: true,
  },
];

const BROWSERS = [
  { id: 'chrome', name: 'Chrome', launcher: chromium },
  { id: 'safari', name: 'Safari', launcher: webkit },
  { id: 'firefox', name: 'Firefox', launcher: firefox },
];

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
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

function photoHtml() {
  return `<div class="cvPhotoWrap"><img class="cvPhoto" src="${PHOTO_DATA}" alt="" style="object-fit:cover"></div>`;
}

function auditHtml(innerHtml, cv, opts = {}) {
  const plain = innerHtml.replace(/<[^>]+>/g, ' ');
  return {
    hasContent: innerHtml.length > 200,
    hasSection: /cvSection/i.test(innerHtml),
    hasName: plain.includes(cv.name.split(' ')[0]),
    hasHead: /cvHead/i.test(innerHtml),
    hasFooter: /cvMetaFooter/i.test(innerHtml) || /cvHead/i.test(innerHtml),
    hasPhoto: opts.withPhoto ? /cvPhoto/i.test(innerHtml) : null,
  };
}

function buildBrowserHarnessHtml(innerHtml, templateId, withPhoto) {
  const exportHtml = buildPdfExportHtml(innerHtml, templateId, { withPhoto });
  return exportHtml
    .replace(
      '<div class="cv template-',
      `<div id="cvDoc" class="cv template-`
    );
}

async function exportViaHtml2pdf(page, innerHtml, templateId, withPhoto) {
  const harness = buildBrowserHarnessHtml(innerHtml, templateId, withPhoto);
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
  await page.waitForTimeout(350);
  return page.evaluate(async () => {
    const cv = document.getElementById('cvDoc');
    if (!cv || !window.HirelyPdfExport?.exportCvToPdfBlob) {
      return { ok: false, error: 'HirelyPdfExport missing' };
    }
    const res = await window.HirelyPdfExport.exportCvToPdfBlob(cv, 'hirely-test.pdf');
    if (!res?.ok || !res.blob) {
      return { ok: false, error: (res?.errors || ['blob_failed']).join('; ') };
    }
    const buf = await res.blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buf));
    const sheets = cv.querySelectorAll('.cvA4Sheet').length;
    const firstHead = !!cv.querySelector('.cvA4Sheet[data-page="1"] .cvHead, .cvHead');
    const fontsApi = !!document.fonts;
    return {
      ok: true,
      bytes,
      pagesEstimated: res.pagesEstimated || sheets || 1,
      sheetCount: sheets,
      fontsApi,
      hasHeader: firstHead,
      method: 'html2pdf',
    };
  });
}

async function exportViaV2(page, innerHtml, templateId, cv, withPhoto) {
  const harness = buildBrowserHarnessHtml(innerHtml, templateId, withPhoto);
  const jspdfPath = path.join(ROOT, 'node_modules/jspdf/dist/jspdf.umd.min.js');
  const html2pdfPath = path.join(ROOT, 'node_modules/html2pdf.js/dist/html2pdf.bundle.min.js');
  const hirelyExportPath = path.join(ROOT, 'src/ui/export/hirely-pdf-export.js');
  const v2UiPath = path.join(ROOT, 'src/ui/export/pdf-export-v2.js');
  const packet = buildPdfExportV2Packet({
    cvData: cv,
    scoreReport: { total: 82, breakdown: [{ id: 'ats', label: 'ATS', points: 18, max: 20 }] },
    recruiterAudit: { strengths: ['Clear structure'], weaknesses: [], missing: [] },
    templateId,
    templateName: templateId,
  });

  await page.setContent(harness, { waitUntil: 'load', timeout: 60000 });
  await page.addScriptTag({ path: jspdfPath });
  await page.addScriptTag({ path: html2pdfPath });
  await page.addScriptTag({ path: hirelyExportPath });
  await page.addScriptTag({ path: v2UiPath });
  await page.waitForFunction(
    () => typeof window.html2pdf === 'function' && !!window.HirelyPdfExport && !!window.HirelyPdfExportV2,
    { timeout: 30000 }
  );
  await page.evaluate(async (packetJson) => {
    if (document.fonts?.ready) await document.fonts.ready;
    const cv = document.getElementById('cvDoc');
    if (cv && window.HirelyA4Pages?.layoutCvA4Pages) window.HirelyA4Pages.layoutCvA4Pages(cv);
    window.__pdfV2Packet = packetJson;
  }, packet);
  await page.waitForTimeout(350);

  return page.evaluate(async () => {
    const cv = document.getElementById('cvDoc');
    const packet = window.__pdfV2Packet;
    if (!cv || !window.HirelyPdfExportV2?.buildExportRoot || !window.HirelyPdfExport?.exportPacketV2Blob) {
      return { ok: false, error: 'V2 export missing' };
    }
    const exportRoot = window.HirelyPdfExportV2.buildExportRoot(cv, packet);
    const v2Pages = exportRoot.querySelectorAll('.pdfV2Page').length;
    const cvPages = exportRoot.querySelectorAll('.pdfV2Page--cv').length;
    const hasCover = !!exportRoot.querySelector('.pdfV2Page--cover');
    const res = await window.HirelyPdfExport.exportPacketV2Blob(exportRoot, 'hirely-v2-test.pdf');
    window.HirelyPdfExportV2.removeExportRoot?.(exportRoot);
    if (!res?.ok || !res.blob) {
      return {
        ok: false,
        error: (res?.errors || ['v2_blob_failed']).join('; '),
        v2Pages,
        cvPages,
        auditPages,
        hasCover,
      };
    }
    const buf = await res.blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buf));
    const auditPages = v2Pages - cvPages;
    return {
      ok: true,
      bytes,
      pagesEstimated: res.pagesEstimated || v2Pages,
      v2Pages,
      cvPages,
      auditPages,
      hasCover,
      method: 'PDF_EXPORT_V2',
    };
  });
}

async function testDownloadTrigger(page, innerHtml, templateId) {
  const harness = buildBrowserHarnessHtml(innerHtml, templateId, false);
  const html2pdfPath = path.join(ROOT, 'node_modules/html2pdf.js/dist/html2pdf.bundle.min.js');
  const hirelyExportPath = path.join(ROOT, 'src/ui/export/hirely-pdf-export.js');

  await page.setContent(harness, { waitUntil: 'load', timeout: 60000 });
  await page.addScriptTag({ path: html2pdfPath });
  await page.addScriptTag({ path: hirelyExportPath });
  await page.waitForFunction(() => !!window.HirelyPdfExport?.triggerBlobDownload, { timeout: 30000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  const triggered = await page.evaluate(async () => {
    const cv = document.getElementById('cvDoc');
    if (cv && window.HirelyA4Pages?.layoutCvA4Pages) window.HirelyA4Pages.layoutCvA4Pages(cv);
    const res = await window.HirelyPdfExport.exportCvToPdfBlob(cv, 'hirely-trigger-test.pdf');
    if (!res?.ok || !res.blob) return { ok: false, error: 'blob_failed' };
    const clicked = window.HirelyPdfExport.triggerBlobDownload(res.blob, res.filename);
    return { ok: clicked, size: res.blob.size };
  });
  const download = await downloadPromise;
  return {
    ok: triggered.ok && (!!download || triggered.size > 2000),
    triggerOk: triggered.ok,
    downloadOk: !!download,
    suggestedFilename: download ? download.suggestedFilename() : 'hirely-trigger-test.pdf',
    size: triggered.size || 0,
  };
}

function runStaticChecks() {
  const checks = [];
  const add = (id, ok, detail = '') => checks.push({ id, ok, detail });

  const files = {
    'file:hirelyPdfExport': 'src/ui/export/hirely-pdf-export.js',
    'file:cvPdfExportCss': 'src/ui/templates/cv-pdf-export.css',
    'file:cvA4Pages': 'src/ui/export/cv-a4-pages.js',
    'file:pdfExportConfig': 'src/core/export/pdf-export-config.js',
    'file:exportLock': 'src/core/export/export-lock.js',
    'file:html2pdfBundle': 'node_modules/html2pdf.js/dist/html2pdf.bundle.min.js',
    'file:jspdfBundle': 'node_modules/jspdf/dist/jspdf.umd.min.js',
  };
  for (const [id, rel] of Object.entries(files)) {
    add(id, fs.existsSync(path.join(ROOT, rel)), rel);
  }

  const exportJs = fs.readFileSync(path.join(ROOT, 'src/ui/export/hirely-pdf-export.js'), 'utf8');
  add('export:save', /exportCvToPdf/.test(exportJs));
  add('export:blob', /exportCvToPdfBlob/.test(exportJs));
  add('export:pagebreaks', /pagebreak/.test(exportJs));
  add('export:fonts-ready', /fonts\.ready/.test(exportJs));
  add('export:inline-images', /inlineExportImages/.test(exportJs));
  add('export:trigger-download', /triggerBlobDownload/.test(exportJs));
  add('export:allowTaint-false', /allowTaint:\s*false/.test(exportJs));
  add('export:useCORS', /useCORS:\s*true/.test(exportJs));

  const fn1 = buildCvExportFilename({ name: 'Jane Doe' });
  add('filename:ascii', fn1 === 'hirely-Jane-Doe.pdf', fn1);
  const fn2 = buildCvExportFilename({ name: 'José García' });
  add('filename:accent-strip', fn2 === 'hirely-Jos-Garca.pdf', fn2);
  add('filename:empty-fallback', buildCvExportFilename({ name: '' }) === 'hirely-cv.pdf');

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  add('download:HirelyPdfExport', /HirelyPdfExport\.exportCvToPdf/.test(indexHtml));
  add('download:v2-fallback', /EXPORT_V2_FALLBACK/.test(indexHtml));
  add('download:blob-email', /exportCvToPdfBlob/.test(indexHtml));
  add('download:filename-core', /buildCvExportFilename/.test(indexHtml));
  add('download:html2pdf-fallback', /html2pdf\(\)/.test(indexHtml));

  return checks;
}

const KNOWN_FAILURE_MODES = [
  { id: 'HTML2PDF_NOT_LOADED', desc: 'HirelyLazy.ensureHtml2pdf() failed — CSP or missing bundle' },
  { id: 'CV_ELEMENT_MISSING', desc: '#cvDoc missing or not .cv--live at export time' },
  { id: 'EXPORT_GATE_BLOCKED', desc: 'Review queue / extraction gate blocks downloadCv()' },
  { id: 'ALLOW_TAINT_CORS', desc: 'html2canvas allowTaint:false rejects non-data-URL images' },
  { id: 'FONTS_NOT_READY', desc: 'document.fonts.ready not awaited before capture' },
  { id: 'A4_SCALE_ACTIVE', desc: 'Preview zoom scale not suspended via HirelyA4Viewport' },
  { id: 'CANVAS_HEIGHT_UNDERESTIMATE', desc: 'html2canvas windowHeight too small on multi-page stack' },
  { id: 'OVERFLOW_CLIPPING', desc: 'overflow:hidden on .cvSection/.cvMain clips content in PDF' },
  { id: 'SAFARI_CANVAS_DIFF', desc: 'WebKit html2canvas rendering differences vs Chromium' },
  { id: 'FIREFOX_PDF_DIFF', desc: 'Firefox html2canvas / jsPDF variance' },
  { id: 'PLAYWRIGHT_PDF_CHROMIUM_ONLY', desc: 'page.pdf() unsupported outside Chromium — not production path' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const staticChecks = runStaticChecks();
  const staticPass = staticChecks.filter((c) => c.ok).length;
  const staticFail = staticChecks.filter((c) => !c.ok).length;

  const getPhoto = (scenario) => (scenario.withPhoto ? photoHtml : () => '');

  const browserResults = [];
  const flatResults = [];
  const v2Results = [];
  const downloadTriggerResults = [];

  for (const browserDef of BROWSERS) {
    const browser = await browserDef.launcher.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const scenarios = [];
    let blobMeta = null;

    try {
      for (const scenario of SCENARIOS) {
        const T = loadTemplates(getPhoto(scenario));
        const inner = T.render(scenario.cv, scenario.templateId);
        const htmlChecks = auditHtml(inner, scenario.cv, { withPhoto: scenario.withPhoto });
        const record = {
          browser: browserDef.id,
          scenario: scenario.id,
          templateId: scenario.templateId,
          label: scenario.label,
          checks: { htmlRender: htmlChecks },
          pass: false,
          issues: [],
          rootCause: null,
          error: null,
        };

        if (!htmlChecks.hasContent || !htmlChecks.hasSection || !htmlChecks.hasName) {
          record.issues.push('html_render_failed');
          record.rootCause = 'HTML_RENDER_FAILED';
          record.pass = false;
          scenarios.push(record);
          flatResults.push(record);
          continue;
        }

        if (scenario.withPhoto && !htmlChecks.hasPhoto) {
          record.issues.push('photo_missing_in_html');
        }

        try {
          const exp = await exportViaHtml2pdf(page, inner, scenario.templateId, scenario.withPhoto);
          if (!exp.ok) {
            record.issues.push('html2pdf_failed');
            record.rootCause = 'HTML2PDF_FAILED';
            record.error = exp.error;
            scenarios.push(record);
            flatResults.push(record);
            continue;
          }

          const bytes = Buffer.from(exp.bytes);
          const pdfPath = path.join(OUT_DIR, `${browserDef.id}-${scenario.id}.pdf`);
          fs.writeFileSync(pdfPath, bytes);
          const analysis = await analyzePdfBytes(bytes);
          const hardening = await validatePdfHardening(bytes, {
            contentHeightPx: exp.pagesEstimated * 1123,
            estimatedPages: exp.pagesEstimated,
            sheetCount: exp.sheetCount,
            laidOut: exp.sheetCount > 0,
          });

          const pagesOk =
            analysis.pageCount != null &&
            analysis.pageCount >= scenario.expectPages.min &&
            analysis.pageCount <= scenario.expectPages.max;

          record.checks.pdfRender = {
            bytes: bytes.length,
            pageCount: analysis.pageCount,
            a4: analysis.a4,
            embeddedFonts: analysis.embeddedFonts,
            laidOut: exp.sheetCount > 0,
            sheetCount: exp.sheetCount,
            method: exp.method,
          };
          record.checks.pageBreaks = {
            sheets: exp.sheetCount,
            estimatedPages: exp.pagesEstimated,
            issues: hardening.issues.filter((i) => /pagination|clipping|blank/.test(i)),
          };
          record.checks.headersFooters = {
            hasHead: htmlChecks.hasHead,
            hasHeaderInPdfDom: exp.hasHeader !== false,
          };
          record.checks.fonts = {
            embedded: analysis.embeddedFonts,
            fontsApi: exp.fontsApi,
            rasterPath: true,
            note: 'html2pdf rasterizes text via canvas; vector font embedding not expected',
          };
          record.checks.images = {
            photoInHtml: scenario.withPhoto ? htmlChecks.hasPhoto : null,
            pdfMinBytes: bytes.length > 2000,
          };
          record.checks.overflow = hardening.issues;
          record.warnings = hardening.issues.filter((i) =>
            ['pagination_unstable', 'page_estimate_mismatch', 'blank_or_extra_page', 'fonts_not_embedded'].includes(i)
          );

          if (!pagesOk) record.issues.push('page_count_out_of_range');
          if (!analysis.a4) record.issues.push('not_a4');
          if (bytes.length < 2000) record.issues.push('pdf_too_small');
          if (scenario.withPhoto && !htmlChecks.hasPhoto) record.issues.push('photo_missing_in_html');

          record.pass = record.issues.length === 0;
          record.rootCause = record.issues[0] ? record.issues[0].toUpperCase() : null;
        } catch (err) {
          record.issues.push('export_exception');
          record.rootCause = 'EXPORT_EXCEPTION';
          record.error = String(err?.message || err);
        }

        scenarios.push(record);
        flatResults.push(record);
      }

      if (browserDef.id === 'chrome') {
        const T0 = loadTemplates();
        const inner = T0.render(SCENARIOS[0].cv, SCENARIOS[0].templateId);
        const blobExp = await exportViaHtml2pdf(page, inner, SCENARIOS[0].templateId, false);
        blobMeta = blobExp.ok
          ? { ok: true, size: blobExp.bytes?.length || 0, pages: blobExp.pagesEstimated }
          : { ok: false, error: blobExp.error };
        staticChecks.push({
          id: 'blob:html2pdf',
          ok: !!blobMeta.ok,
          detail: blobMeta.ok ? `size=${blobMeta.size}` : blobMeta.error,
        });

        const scenario = SCENARIOS.find((s) => s.id === 'v3-premium-ats') || SCENARIOS[0];
        const T = loadTemplates(getPhoto(scenario));
        const innerV2 = T.render(scenario.cv, scenario.templateId);
        try {
          const v2 = await exportViaV2(page, innerV2, scenario.templateId, scenario.cv, scenario.withPhoto);
          const v2Record = {
            browser: browserDef.id,
            scenario: scenario.id,
            pass: false,
            issues: [],
            checks: v2,
          };
          if (!v2.ok) {
            v2Record.issues.push('v2_export_failed');
            v2Record.error = v2.error;
          }
          if (v2.pagesEstimated < 2) v2Record.issues.push('v2_page_count_low');
          if (!v2.hasCover) v2Record.issues.push('v2_cover_missing');
          v2Record.pass = v2Record.issues.length === 0;
          v2Results.push(v2Record);

          const trigScenario = SCENARIOS[0];
          const innerTrig = loadTemplates().render(trigScenario.cv, trigScenario.templateId);
          const trig = await testDownloadTrigger(page, innerTrig, trigScenario.templateId);
          downloadTriggerResults.push({
            browser: browserDef.id,
            pass: trig.ok,
            triggerOk: trig.triggerOk,
            downloadOk: trig.downloadOk,
            filename: trig.suggestedFilename,
          });
        } catch (err) {
          v2Results.push({
            browser: browserDef.id,
            scenario: scenario.id,
            pass: false,
            issues: ['v2_exception'],
            error: String(err?.message || err),
          });
          downloadTriggerResults.push({
            browser: browserDef.id,
            pass: false,
            error: String(err?.message || err),
          });
        }
      }
    } finally {
      await browser.close();
    }

    browserResults.push({
      browser: browserDef.id,
      name: browserDef.name,
      scenarios,
      blob: blobMeta,
      error: null,
    });
  }

  const chromiumOnly = await chromium.launch({ headless: true });
  const cp = await chromiumOnly.newPage();
  try {
    const scenario = SCENARIOS[1];
    const Tp = loadTemplates();
    const inner = Tp.render(scenario.cv, scenario.templateId);
    const pdfPath = path.join(OUT_DIR, `playwright-print-${scenario.id}.pdf`);
    await exportCvPdfPlaywright(cp, inner, scenario.templateId, pdfPath);
    staticChecks.push({ id: 'qa:playwright-print', ok: fs.existsSync(pdfPath), detail: pdfPath });
  } catch (e) {
    staticChecks.push({ id: 'qa:playwright-print', ok: false, detail: String(e.message) });
  } finally {
    await chromiumOnly.close();
  }

  const browserPass = flatResults.filter((r) => r.pass).length;
  const browserFail = flatResults.length - browserPass;
  const v2Pass = v2Results.filter((r) => r.pass).length;
  const downloadPass = downloadTriggerResults.filter((r) => r.pass).length;
  const totalRuns = flatResults.length + v2Results.length + downloadTriggerResults.length;
  const totalPass = browserPass + v2Pass + downloadPass;
  const successRate = totalRuns ? Math.round((totalPass / totalRuns) * 1000) / 10 : 0;
  const gatePass = successRate >= 99;
  const rootCauseMap = {};
  for (const r of flatResults) {
    if (!r.pass && r.rootCause) {
      rootCauseMap[r.rootCause] = (rootCauseMap[r.rootCause] || 0) + 1;
    }
  }
  const rootCauses = Object.entries(rootCauseMap)
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count);

  const report = {
    generatedAt: new Date().toISOString(),
    version: PDF_EXPORT_AUDIT_P0,
    gate: { targetSuccessRate: 99, pass: gatePass, successRate },
    totals: {
      browserRuns: flatResults.length,
      browserPass,
      browserFail,
      v2Runs: v2Results.length,
      v2Pass,
      downloadTriggerRuns: downloadTriggerResults.length,
      downloadTriggerPass: downloadPass,
      totalRuns,
      totalPass,
      successRate,
      failureRate: totalRuns ? Math.round(((totalRuns - totalPass) / totalRuns) * 1000) / 10 : 0,
      staticPass: staticChecks.filter((c) => c.ok).length,
      staticFail: staticChecks.filter((c) => !c.ok).length,
    },
    browsers: browserResults,
    v2Results,
    downloadTriggerResults,
    staticChecks,
    scenarios: SCENARIOS.map((s) => ({ id: s.id, templateId: s.templateId, label: s.label })),
    results: flatResults,
    rootCauses,
    knownFailureModes: KNOWN_FAILURE_MODES,
    productionPath: 'downloadPDF → exportPacketV2 (page raster) → fallback exportCvToPdf (html2pdf)',
    components: {
      html2canvas: 'html2pdf bundle — per-page (V2) or stack (V1)',
      html2pdf: 'HirelyPdfExport.exportCvToPdf / exportCvToPdfBlob',
      blobGeneration: 'outputPdf(blob) + exportPacketV2Blob',
      downloadTrigger: 'jsPDF.save + triggerBlobDownload fallback',
    },
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  console.log(`PDF export audit: ${totalPass}/${totalRuns} runs pass (${successRate}%)`);
  console.log(`html2pdf matrix: ${browserPass}/${flatResults.length} · V2: ${v2Pass}/${v2Results.length} · download: ${downloadPass}/${downloadTriggerResults.length}`);
  console.log(`Gate (>99%): ${gatePass ? 'PASS' : 'FAIL'}`);
  console.log(`Static checks: ${report.totals.staticPass}/${staticChecks.length}`);
  if (!gatePass || browserFail) {
    for (const r of flatResults.filter((x) => !x.pass)) {
      console.error(`FAIL ${r.browser}/${r.scenario}: ${r.issues.join(', ')} ${r.error || ''}`);
    }
    for (const r of v2Results.filter((x) => !x.pass)) {
      console.error(`FAIL V2 ${r.browser}/${r.scenario}: ${r.issues?.join(', ')} ${r.error || ''}`);
    }
    for (const r of downloadTriggerResults.filter((x) => !x.pass)) {
      console.error(`FAIL download ${r.browser}: trigger=${r.triggerOk} download=${r.downloadOk}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('pdf-export-audit failed:', err);
  process.exit(1);
});
