#!/usr/bin/env node
/**
 * PDF Export Pro QA — 1-page, 2-page, creative portfolio CVs.
 * Playwright print PDF (vector, embedded fonts) + html2pdf smoke in browser.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  exportCvPdfPlaywright,
  analyzePdfBytes,
  PRINTABLE_HEIGHT_PX,
} from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const OUT_DIR = path.join(root, 'tests/output/pdf-export-qa');
const REPORT_PATH = path.join(OUT_DIR, 'report.json');

const SCENARIOS = [
  {
    id: 'one-page',
    label: '1 page CV',
    templateId: 'agencyportfolio',
    expectPages: { min: 1, max: 1 },
    cv: {
      name: 'Alex Martin',
      title: 'Product Designer',
      email: 'alex@example.com',
      phone: '+33 6 11 22 33 44',
      location: 'Paris',
      summary: 'Product designer focused on clarity and systems.',
      experience: ['Product Designer — Studio A — Paris — 2022–Present'],
      education: ['BDes — ENSAD'],
      skills: ['UX', 'UI', 'Prototyping'],
      tools: ['Figma', 'Photoshop'],
      languages: ['French', 'English'],
      clients: ['Acme'],
      projects: [],
    },
  },
  {
    id: 'two-page',
    label: '2 page CV',
    templateId: 'executive',
    expectPages: { min: 2, max: 3 },
    expectContentMinPx: 1050,
    cv: {
      name: 'Thomas Renard',
      title: 'Senior Program Director',
      email: 'thomas@example.com',
      phone: '+33 6 99 88 77 66',
      location: 'Paris, France',
      summary:
        'Executive leader with fifteen years delivering transformation programs across finance, retail, and technology. Known for building high-performing teams, board-level stakeholder alignment, and measurable EBITDA impact across multi-country portfolios.',
      experience: Array.from({ length: 16 }, (_, i) => {
        const y = 2006 + i;
        const region = ['EMEA', 'Americas', 'APAC'][i % 3];
        return `VP Strategy & Operations — Global Corp ${String.fromCharCode(65 + (i % 26))} — Paris / ${region} — ${y}–${y + 1}. Owned P&L for ${4 + (i % 4)} business units (~€${35 + i * 3}M). Led post-merger integration, operating model redesign, and cost programs delivering ${8 + (i % 5)}% margin uplift. Managed ${70 + i * 8} FTE; presented quarterly to board and investors.`;
      }),
      education: [
        'HEC Paris — MBA, Strategy & Finance — 2008',
        'École Polytechnique — MSc Engineering — 2004',
        'Sciences Po — Executive Certificate — 2016',
      ],
      skills: ['Strategy', 'P&L', 'Transformation', 'M&A', 'Governance', 'PMO', 'Change'],
      tools: ['Excel', 'PowerPoint', 'Jira', 'SAP'],
      languages: ['French (native)', 'English (fluent)', 'German (professional)'],
      clients: ['Fortune 500 clients', 'PE portfolio companies', 'Listed industrials'],
      projects: [
        'Group-wide digital transformation — €120M program — 2022–2024',
        'Carve-out & TSA exit — industrial group — 2020–2021',
      ],
    },
  },
  {
    id: 'creative-portfolio',
    label: 'Creative portfolio CV',
    templateId: 'creativedirector',
    expectPages: { min: 1, max: 4 },
    cv: {
      name: 'Yohann Azancot',
      title: 'Graphic Designer & Illustrator',
      email: 'yoaz@hotmail.fr',
      phone: '+33 6 49 43 48 39',
      location: 'Paris',
      summary:
        'Creative professional specializing in illustration, graphic design and visual storytelling for cultural and commercial brands.',
      experience: [
        'Freelance Illustrator / Graphic Designer — Independent — 2011–Present',
        'Senior Designer — Studio Nova — 2016–2020',
        'Junior Designer — Agency Blue — 2013–2016',
      ],
      education: ['LISAA — Web & Motion', 'Créapole — Visual Communication'],
      skills: ['Illustration', 'Brand identity', 'Art direction', 'Typography'],
      tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
      languages: ['French (native)', 'English (fluent)'],
      clients: ['Nike', 'Louis Vuitton', 'Marvel', 'Adobe', 'Pantone', 'Arte'],
      projects: [
        'Poster series — Arte — 2024',
        'Packaging — Luxury beauty — 2023',
        'Brand campaign — Global sportswear — 2022',
        'Editorial — Cultural institution — 2021',
      ],
    },
  },
];

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

function auditHtml(html, scenario) {
  const issues = [];
  if (html.includes('overflow:hidden') && !html.includes('export-pdf')) {
    /* template inline only */
  }
  if (!html.includes(scenario.cv.name.split(' ')[0])) issues.push('missing_name');
  if (scenario.cv.projects?.length && !/cvSection--projects|Projects/i.test(html)) {
    issues.push('missing_projects_section');
  }
  const estPages = Math.ceil((html.length / 50) * 0.02); /* rough */
  return { issues, htmlBytes: html.length };
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const T = loadTemplates();
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

for (const scenario of SCENARIOS) {
  const inner = T.render(scenario.cv, scenario.templateId);
  const htmlAudit = auditHtml(inner, scenario);
  ok(htmlAudit.issues.length === 0, `${scenario.id} HTML audit`);

  const pdfPath = path.join(OUT_DIR, `${scenario.id}.pdf`);
  const layout = await exportCvPdfPlaywright(page, inner, scenario.templateId, pdfPath);
  const bytes = fs.readFileSync(pdfPath);
  const analysis = await analyzePdfBytes(bytes);

  const pagesOk =
    analysis.pageCount != null &&
    analysis.pageCount >= scenario.expectPages.min &&
    analysis.pageCount <= scenario.expectPages.max;

  const contentOk =
    !scenario.expectContentMinPx || layout.contentHeightPx >= scenario.expectContentMinPx;

  const paginationOk =
    !scenario.expectPages.min ||
    scenario.expectPages.min <= 1 ||
    layout.estimatedPages >= scenario.expectPages.min ||
    analysis.pageCount >= scenario.expectPages.min;

  ok(analysis.a4 !== false, `${scenario.id} A4 page size (${analysis.widthPt}×${analysis.heightPt} pt)`);
  ok(pagesOk, `${scenario.id} page count ${analysis.pageCount} (expected ${scenario.expectPages.min}-${scenario.expectPages.max})`);
  ok(contentOk, `${scenario.id} content height ${layout.contentHeightPx}px (printable ${PRINTABLE_HEIGHT_PX}px)`);
  ok(paginationOk, `${scenario.id} estimated pages ${layout.estimatedPages} vs PDF ${analysis.pageCount}`);
  ok(bytes.length > 2000, `${scenario.id} PDF size ${bytes.length} bytes`);

  results.push({
    id: scenario.id,
    label: scenario.label,
    templateId: scenario.templateId,
    method: 'playwright-print',
    pdfPath: path.relative(root, pdfPath),
    htmlBytes: inner.length,
    layout,
    analysis,
    expectPages: scenario.expectPages,
    pagesOk,
    contentOk,
    paginationOk,
    a4Ok: analysis.a4 !== false,
    embeddedFonts: 'playwright-chromium-print',
    widowOrphan: 'css-break-inside-avoid',
    issues: [
      ...htmlAudit.issues,
      ...(pagesOk ? [] : ['page_count_out_of_range']),
      ...(contentOk ? [] : ['content_too_short_for_multipage']),
      ...(paginationOk ? [] : ['pdf_pages_below_content_estimate']),
      ...(analysis.a4 === false ? ['not_a4_dimensions'] : []),
    ],
    pass:
      pagesOk &&
      contentOk &&
      paginationOk &&
      analysis.a4 !== false &&
      htmlAudit.issues.length === 0,
  });

  console.log(
    `PDF ${scenario.id}: ${analysis.pageCount} page(s), ${Math.round(bytes.length / 1024)} KB, A4=${analysis.a4}`
  );
}

/* html2pdf browser smoke on live app */
const appPage = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const port = process.env.HIRELY_PORT || '3456';
const base = process.env.HIRELY_BASE || `http://127.0.0.1:${port}/index.html`;

let html2pdfResult = { ok: false, skipped: true, reason: 'server unreachable' };
try {
  await appPage.goto(base, { waitUntil: 'domcontentloaded', timeout: 8000 });
  await appPage.waitForFunction(() => window.HirelyLazy?.ensureHtml2pdf, { timeout: 8000 });
  await appPage.evaluate(() => window.HirelyLazy.ensureHtml2pdf());
  await appPage.waitForFunction(() => typeof window.html2pdf === 'function', { timeout: 15000 });

  const blobOk = await appPage.evaluate(async () => {
    const cv = document.getElementById('cvDoc');
    if (!cv || !window.html2pdf) return { ok: false };
    document.body.classList.add('export-pdf');
    cv.classList.add('cv--pdf-export');
    cv.style.width = '794px';
    cv.style.overflow = 'visible';
    if (document.fonts?.ready) await document.fonts.ready;
    try {
      const blob = await window
        .html2pdf()
        .set({
          margin: 0,
          filename: 'qa.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: {
            scale: 2,
            width: 794,
            windowWidth: 794,
            windowHeight: cv.scrollHeight + 40,
            useCORS: true,
            backgroundColor: '#ffffff',
            letterRendering: true,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['.cvSection', '.cvHead', '.cvExpEntry'] },
        })
        .from(cv)
        .outputPdf('blob');
      document.body.classList.remove('export-pdf');
      return { ok: blob && blob.size > 1500, size: blob?.size || 0 };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  html2pdfResult = { ok: blobOk.ok, size: blobOk.size, skipped: false, method: 'html2pdf' };
  ok(blobOk.ok, 'html2pdf blob export in browser');
} catch (e) {
  html2pdfResult = { ok: false, skipped: true, reason: String(e.message || e) };
  console.warn('SKIP html2pdf browser test — start server: npm run dev');
}

await appPage.close();
await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  engine: 'hirely-pdf-export-qa-v1',
  requirements: {
    format: 'A4',
    multiPage: true,
    pageBreaks: 'css-avoid + playwright-print',
    widowOrphan: 'orphans/widows + break-inside-avoid',
    embeddedFonts: 'playwright-print (Chromium); html2pdf uses rasterized canvas',
    noClipping: 'overflow:visible on export-pdf',
    noOverflow: '210mm / 794px fixed width',
  },
  scenarios: results,
  html2pdfBrowser: html2pdfResult,
  summary: {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
  },
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

console.log('\n═══ HIRELY PDF Export Pro — QA Report ═══');
for (const r of results) {
  console.log(
    `  ${r.pass ? 'PASS' : 'FAIL'}  ${r.label} — ${r.analysis.pageCount} pg, A4=${r.analysis.a4}, ${r.pdfPath}`
  );
  if (r.issues.length) console.log(`       issues: ${r.issues.join(', ')}`);
}
console.log(`Report: ${path.relative(root, REPORT_PATH)}`);
console.log(`PDFs: ${path.relative(root, OUT_DIR)}/`);

process.exit(failed || report.summary.failed ? 1 : 0);
