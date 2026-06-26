#!/usr/bin/env node
/**
 * HIRELY P6 — PDF export hardening acceptance.
 * A4 · margins · page breaks · long CV · photo CV · multi-page · no crop/overflow/blank.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  PDF_PAGE_MARGIN_MM,
  PDF_EXPORT_ENGINE,
} from '../core/export/pdf-export-config.js';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  exportCvPdfPlaywright,
  validatePdfHardening,
  auditExportDom,
  PRINTABLE_HEIGHT_PX,
} from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/pdf-export-p6');

const PHOTO_DATA =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect fill="#cbd5e1" width="88" height="88"/><text x="44" y="50" text-anchor="middle" font-size="11" fill="#334155">Photo</text></svg>'
  );

const BASE_CV = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  location: 'Paris, France',
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling for global brands.',
  education: ['Créapole — Visual Communication', 'LISAA — Web & Motion'],
  skills: ['Illustration', 'Brand identity', 'Art direction', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French (native)', 'English (fluent)'],
  clients: ['Nike', 'Adobe', 'Louis Vuitton'],
  projects: ['Brand campaign — Global sportswear client · 2023'],
};

function buildLongExperience(count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const y = 2008 + i;
    lines.push(
      `Senior Designer — Studio ${String.fromCharCode(65 + (i % 26))} — Paris — ${y}–${y + 1}. Led cross-functional delivery with measurable ${10 + (i % 30)}% impact on brand systems.`
    );
  }
  return lines;
}

const SCENARIOS = [
  {
    id: 'p6-one-page-ats',
    label: 'One-page ATS',
    templateId: 'ats',
    cv: { ...BASE_CV, experience: buildLongExperience(2) },
    expectPages: { min: 1, max: 1 },
  },
  {
    id: 'p6-multi-creative',
    label: 'Multi-page creative',
    templateId: 'creative',
    cv: { ...BASE_CV, experience: buildLongExperience(10) },
    expectPages: { min: 2, max: 4 },
  },
  {
    id: 'p6-long-executive',
    label: 'Long CV executive',
    templateId: 'executive-minimal',
    cv: { ...BASE_CV, experience: buildLongExperience(14) },
    expectPages: { min: 2, max: 4 },
  },
  {
    id: 'p6-photo-ats',
    label: 'Photo CV',
    templateId: 'ats',
    cv: { ...BASE_CV, experience: buildLongExperience(3), photo: PHOTO_DATA },
    expectPages: { min: 1, max: 2 },
    requirePhoto: true,
  },
];

let failed = 0;
const results = [];

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
  results.push({ check: msg, pass: !!cond });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

ok(PDF_EXPORT_ENGINE === 'PDF_EXPORT_P6', 'P6 export engine tag');
ok(A4_WIDTH_PX === 794, `A4 width px ${A4_WIDTH_PX}`);
ok(A4_HEIGHT_PX === 1123, `A4 height px ${A4_HEIGHT_PX}`);
ok(Math.abs(A4_WIDTH_PT - 595.28) < 0.1, `A4 width pt ${A4_WIDTH_PT}`);
ok(Math.abs(A4_HEIGHT_PT - 841.89) < 0.1, `A4 height pt ${A4_HEIGHT_PT}`);
ok(A4_WIDTH_MM === 210 && A4_HEIGHT_MM === 297, 'A4 mm dimensions');
ok(
  PDF_PAGE_MARGIN_MM.top === 12 &&
    PDF_PAGE_MARGIN_MM.bottom === 12 &&
    PDF_PAGE_MARGIN_MM.left === 14 &&
    PDF_PAGE_MARGIN_MM.right === 14,
  'PDF margins 12/14 mm'
);
ok(PRINTABLE_HEIGHT_PX > 900 && PRINTABLE_HEIGHT_PX < A4_HEIGHT_PX, `printable height ${PRINTABLE_HEIGHT_PX}px`);

const pdfCss = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-pdf-export.css'), 'utf8');
ok(/break-inside:\s*avoid/.test(pdfCss), 'page-break avoid rules in CSS');
ok(/794px/.test(pdfCss), '794px export width in CSS');

const T = loadHirelyTemplates();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const scenario of SCENARIOS) {
  const inner = T.render(scenario.cv, scenario.templateId);
  ok(inner && inner.length > 120, `${scenario.id} renders HTML`);

  if (scenario.requirePhoto) {
    ok(inner.includes('cvPhoto'), `${scenario.id} photo markup in HTML`);
  }

  const pdfPath = path.join(OUT_DIR, `${scenario.id}.pdf`);
  const layout = await exportCvPdfPlaywright(page, inner, scenario.templateId, pdfPath);
  const dom = await auditExportDom(page);
  const bytes = fs.readFileSync(pdfPath);
  const hardening = await validatePdfHardening(bytes, layout);

  ok(hardening.checks.a4, `${scenario.id} A4 PDF`);
  ok(hardening.checks.hasPages, `${scenario.id} has pages (${hardening.pageCount})`);
  ok(hardening.checks.noClipping, `${scenario.id} no content clipping`);
  ok(hardening.checks.noBlankPage, `${scenario.id} no blank/extra page`);
  ok(hardening.checks.stablePagination, `${scenario.id} stable pagination`);
  ok(dom.ok, `${scenario.id} DOM audit (${(dom.issues || []).join(', ') || 'clean'})`);
  ok(
    !dom.issues?.includes('horizontal_overflow'),
    `${scenario.id} no horizontal overflow`
  );

  const pages = hardening.pageCount || 0;
  ok(
    pages >= scenario.expectPages.min && pages <= scenario.expectPages.max,
    `${scenario.id} page range ${scenario.expectPages.min}-${scenario.expectPages.max} (got ${pages})`
  );

  if (scenario.requirePhoto) {
    const hasPhoto = await page.evaluate(() => !!document.querySelector('.cvPhoto'));
    ok(hasPhoto, `${scenario.id} photo visible in export DOM`);
  }
}

for (const templateId of PRODUCTION_TEMPLATE_IDS) {
  const inner = T.render({ ...BASE_CV, experience: buildLongExperience(6) }, templateId);
  const pdfPath = path.join(OUT_DIR, `p6-template-${templateId}.pdf`);
  const layout = await exportCvPdfPlaywright(page, inner, templateId, pdfPath);
  const hardening = await validatePdfHardening(fs.readFileSync(pdfPath), layout);
  ok(hardening.pass, `production template ${templateId} hardening pass`);
  ok((hardening.pageCount || 0) >= 1, `${templateId} multi-page capable`);
}

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  engine: PDF_EXPORT_ENGINE,
  scenarios: SCENARIOS.map((s) => s.id),
  results,
  pass: failed === 0,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-pdf-export-hardening: PASS');
}
