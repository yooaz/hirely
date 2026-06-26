#!/usr/bin/env node
/**
 * P0 — Real A4 pagination: multi-page stack, no overflow warning, no clip.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '../core/export/pdf-export-config.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  buildPdfExportHtml,
  layoutCvForExport,
  exportCvPdfPlaywright,
  auditExportDom,
  validatePdfHardening,
} from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/a4-pagination/report.json');

function buildLongExperience(count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const y = 2008 + i;
    lines.push(
      `Senior Designer — Studio ${String.fromCharCode(65 + (i % 26))} — Paris — ${y}–${y + 1}: Delivered brand systems · Led cross-functional teams · Improved conversion ${10 + (i % 20)}%`
    );
  }
  return lines;
}

const LONG_CV = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  location: 'Paris, France',
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling for global brands across sportswear, luxury, and technology.',
  education: [
    'Créapole — Visual Communication — 2008–2011',
    'LISAA — Web & Motion Design — 2011–2012',
    'Creative School Management — Product Design — 2007–2009',
  ],
  skills: ['Illustration', 'Brand identity', 'Art direction', 'Typography', 'Packaging', 'Editorial design'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma', 'After Effects'],
  languages: ['French (native)', 'English (fluent)', 'Spanish (conversational)'],
  clients: ['Nike', 'Adobe', 'Louis Vuitton', 'Marvel', 'Converse', 'Cadillac'],
  projects: ['Brand campaign — Global sportswear client · 2023', 'Editorial series — Luxury maison · 2022'],
  experience: buildLongExperience(14),
};

const SCENARIOS = [
  { id: 'long-creative', templateId: 'creative', minPages: 2 },
  { id: 'long-executive', templateId: 'executive-minimal', minPages: 2 },
  { id: 'long-ats', templateId: 'ats', minPages: 2 },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const audits = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const T = loadHirelyTemplates();

for (const scenario of SCENARIOS) {
  const inner = T.render(LONG_CV, scenario.templateId);
  const html = buildPdfExportHtml(inner, scenario.templateId);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(120);

  const layout = await layoutCvForExport(page);
  const dom = await page.evaluate((a4Height) => {
    const sheets = [...document.querySelectorAll('.cvA4Stack .cvA4Sheet')];
    const overflowSheets = sheets.filter((sheet) => {
      const innerEl = sheet.querySelector('.cvInner');
      return innerEl && innerEl.scrollHeight > a4Height + 2;
    });
    const blankSheets = sheets.filter((sheet) => {
      const text = (sheet.innerText || '').replace(/\s+/g, '').trim();
      return text.length < 8;
    });
    const warn = document.getElementById('a4OverflowWarn');
    const warnVisible = warn && !warn.classList.contains('hidden') && (warn.textContent || '').trim().length > 0;
    return {
      sheetCount: sheets.length,
      overflowSheets: overflowSheets.length,
      blankSheets: blankSheets.length,
      overflowPages: overflowSheets.map((s) => s.getAttribute('data-page')),
      warnVisible,
      warnText: warn?.textContent?.trim() || '',
      totalTextLen: (document.querySelector('.cv')?.innerText || '').length,
    };
  }, A4_HEIGHT_PX);

  const domAudit = await auditExportDom(page);
  const outPdf = path.join(ROOT, 'tests/output/a4-pagination', `${scenario.id}.pdf`);
  fs.mkdirSync(path.dirname(outPdf), { recursive: true });
  const exportResult = await exportCvPdfPlaywright(page, inner, scenario.templateId, outPdf);
  const pdfBytes = fs.readFileSync(outPdf);
  const hardening = await validatePdfHardening(pdfBytes, exportResult);

  ok(layout.laidOut, `${scenario.id} A4 layout applied`);
  ok(dom.sheetCount >= scenario.minPages, `${scenario.id} multi-page (${dom.sheetCount} sheets)`);
  ok(dom.overflowSheets === 0, `${scenario.id} no sheet overflow (${dom.overflowSheets})`);
  ok(dom.blankSheets === 0, `${scenario.id} no blank sheets (${dom.blankSheets})`);
  ok(!dom.warnVisible, `${scenario.id} no overflow warning (${dom.warnText || 'clean'})`);
  ok(domAudit.ok, `${scenario.id} export DOM audit (${domAudit.issues?.join(', ') || 'clean'})`);
  ok(hardening.checks.stablePagination, `${scenario.id} PDF pages match sheets (${hardening.pageCount}/${exportResult.sheetCount})`);
  ok(hardening.checks.noBlankPage, `${scenario.id} no blank PDF page`);
  ok(hardening.checks.noClipping, `${scenario.id} no clipping estimate`);

  audits.push({
    id: scenario.id,
    templateId: scenario.templateId,
    sheetCount: dom.sheetCount,
    pdfPages: hardening.pageCount,
    overflowSheets: dom.overflowSheets,
    blankSheets: dom.blankSheets,
    warnVisible: dom.warnVisible,
    domIssues: domAudit.issues || [],
    hardeningIssues: hardening.issues || [],
  });
}

await browser.close();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      a4: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
      audits,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL a4-pagination' : '\nPASS a4-pagination');
process.exit(failed ? 1 : 0);
