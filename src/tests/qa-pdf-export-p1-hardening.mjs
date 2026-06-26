#!/usr/bin/env node
/**
 * P1 — PDF export hardening: preview vs exported PDF parity.
 * Same content · same page count · same sections · no clip/overflow.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { chromium } from 'playwright';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  exportCvPdfPlaywright,
  validatePdfHardening,
  auditExportDom,
  auditPreviewPdfParity,
  buildPdfExportHtml,
  layoutCvForExport,
  analyzePdfBytes,
  PRINTABLE_HEIGHT_PX,
} from './lib/pdf-export-playwright.mjs';
import { A4_WIDTH_PX, A4_HEIGHT_PX } from '../core/export/pdf-export-config.js';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { getDocument, GlobalWorkerOptions } = pdfjs;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/pdf-export-p1');

GlobalWorkerOptions.workerSrc = path.join(ROOT, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js');

const RICH_CV = {
  name: 'Yuki Tanaka',
  title: 'Art Director',
  email: 'yuki@studio.com',
  phone: '+33 6 12 34 56 78',
  location: 'Paris, France',
  summary: 'Art director and illustrator across luxury, entertainment, and technology brands.',
  experience: [
    'Art Director — McCann Paris — 2018–Present — Led global campaigns',
    'Senior Designer — Freelance — 2012–2018 — Nike, Apple, Marvel',
    'Designer — Studio A — 2010–2012 — Packaging systems',
    'Junior Designer — Agency B — 2008–2010 — Editorial layouts',
    'Intern — Print House — 2006–2008 — Production assist',
    'Freelance — Independent — 2004–2006 — Illustration commissions',
  ],
  education: ['MA Visual Communication — ENSAD — 2010', 'BA Design — LISAA — 2006'],
  skills: ['Art direction', 'Branding', 'Illustration', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent', 'Japanese — fluent'],
  clients: ['Nike', 'Apple', 'PlayStation', 'Marvel'],
  projects: [
    'God of War Poster — PlayStation',
    'Max Campaign — Adobe · 2023',
    'Black Panther Poster — Marvel · 2021',
  ],
  portfolioLinks: [
    'Behance — https://behance.net/yuki',
    'Dribbble — https://dribbble.com/yuki',
  ],
};

function buildLongCv(extra = 0) {
  const exp = [...RICH_CV.experience];
  for (let i = 0; i < extra; i++) {
    exp.push(
      `Designer — Studio ${String.fromCharCode(65 + (i % 26))} — Paris — ${2000 + i}–${2001 + i} — Brand systems delivery.`
    );
  }
  return { ...RICH_CV, experience: exp };
}

async function extractPdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await getDocument({ data }).promise;
  const parts = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    parts.push(content.items.map((it) => it.str).join(' '));
  }
  return parts.join('\n');
}

let failed = 0;
const audits = [];

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const T = loadHirelyTemplates();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const SCENARIOS = [
  { id: 'p1-rich-single', templateId: 'portfolio-artist', cv: RICH_CV, pages: { min: 1, max: 3 } },
  { id: 'p1-rich-long', templateId: 'creative-director', cv: buildLongCv(8), pages: { min: 2, max: 5 } },
  { id: 'p1-swiss-long', templateId: 'minimal-swiss', cv: buildLongCv(10), pages: { min: 2, max: 5 } },
];

for (const scenario of SCENARIOS) {
  const inner = T.render(scenario.cv, scenario.templateId);
  const pdfPath = path.join(OUT_DIR, `${scenario.id}.pdf`);
  const layout = await exportCvPdfPlaywright(page, inner, scenario.templateId, pdfPath);
  const pdfText = await extractPdfText(pdfPath);
  const analysis = await analyzePdfBytes(fs.readFileSync(pdfPath));
  const dom = await auditExportDom(page);
  const parity = await auditPreviewPdfParity(page, scenario.cv, pdfText, {
    ...layout,
    pdfPageCount: analysis.pageCount,
  });
  const hardening = await validatePdfHardening(fs.readFileSync(pdfPath), layout);

  ok(inner.length > 500, `${scenario.id} renders HTML`);
  ok(dom.ok, `${scenario.id} export DOM clean`);
  ok(!dom.issues?.includes('horizontal_overflow'), `${scenario.id} no horizontal overflow`);
  ok(!dom.issues?.includes('overflow_hidden'), `${scenario.id} no overflow hidden on cv`);
  ok(parity.pageCountMatch, `${scenario.id} page count preview=${parity.previewSheets} pdf=${parity.pdfPages}`);
  ok(parity.identityOk, `${scenario.id} identity in PDF`);
  ok(parity.pass, `${scenario.id} preview/pdf parity (${parity.issues.join('; ') || 'clean'})`);
  ok(hardening.checks.noClipping, `${scenario.id} no clipping estimate`);
  ok(hardening.checks.stablePagination, `${scenario.id} stable pagination`);
  ok(
    (analysis.pageCount || 0) >= scenario.pages.min && (analysis.pageCount || 0) <= scenario.pages.max,
    `${scenario.id} pages ${scenario.pages.min}-${scenario.pages.max} (got ${analysis.pageCount})`
  );

  for (const sec of parity.sectionChecks) {
    ok(sec.pass, `${scenario.id} section ${sec.key} preview+pdf`);
  }

  audits.push({
    id: scenario.id,
    templateId: scenario.templateId,
    parity,
    dom,
    hardening: hardening.checks,
    pdfPages: analysis.pageCount,
    previewSheets: parity.previewSheets,
  });
}

for (const templateId of PRODUCTION_TEMPLATE_IDS) {
  const cv = buildLongCv(4);
  const inner = T.render(cv, templateId);
  const pdfPath = path.join(OUT_DIR, `p1-template-${templateId}.pdf`);
  const layout = await exportCvPdfPlaywright(page, inner, templateId, pdfPath);
  const pdfText = await extractPdfText(pdfPath);
  const analysis = await analyzePdfBytes(fs.readFileSync(pdfPath));
  const dom = await auditExportDom(page);
  const parity = await auditPreviewPdfParity(page, cv, pdfText, {
    ...layout,
    pdfPageCount: analysis.pageCount,
  });

  ok(dom.ok, `template ${templateId} DOM audit`);
  ok(parity.pageCountMatch, `template ${templateId} page parity ${parity.previewSheets}/${parity.pdfPages}`);
  ok(parity.sectionChecks.every((s) => s.pass), `template ${templateId} all sections in preview+pdf`);
  ok(!parity.preview.clipped?.length, `template ${templateId} no clipped nodes`);

  audits.push({ id: `template-${templateId}`, templateId, parity, dom, pdfPages: analysis.pageCount });
}

await browser.close();

const report = {
  feature: 'PDF_EXPORT_HARDENING_P1',
  generatedAt: new Date().toISOString(),
  a4: { widthPx: A4_WIDTH_PX, heightPx: A4_HEIGHT_PX, printableHeightPx: PRINTABLE_HEIGHT_PX },
  scenarios: audits,
  pass: failed === 0,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL pdf-export-p1-hardening' : '\nPASS pdf-export-p1-hardening');
process.exit(failed ? 1 : 0);
