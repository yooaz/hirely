#!/usr/bin/env node
/**
 * P1 — Template density: sections render, A4 fill ≥55% when 5+ sections, pagination when long.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { A4_HEIGHT_PX } from '../core/export/pdf-export-config.js';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import {
  countPopulatedSections,
  DENSITY_MIN_FIRST_PAGE_FILL,
  DENSITY_MIN_SECTIONS_FOR_FILL,
  DENSITY_MIN_VISIBLE_TEXT,
  passesFirstPageFillGate,
} from '../ui/templates/template-density.mjs';
import { scoreTemplateCompletenessLock } from '../ui/templates/template-completeness.js';
import { normalizeCvDataForTemplate, resumeDataToCvData } from '../core/resume-data.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import { buildPdfExportHtml, layoutCvForExport } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/template-density/report.json');

const RICH_FINAL_RESUME = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Lead Illustrator',
    email: 'yohann@example.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris, France',
  },
  summary:
    'Senior illustrator and art director with fifteen years across luxury, entertainment, and technology clients worldwide.',
  experiences: [
    { role: 'Lead Illustrator', company: 'McCann Paris', dates: '2018–Present' },
    { role: 'Freelance', company: 'Nike, Apple', dates: '2012–2018' },
  ],
  education: [{ degree: 'MA Illustration', school: 'ENSAD', dates: '2010' }],
  skills: ['Illustration', 'Branding', 'Art direction', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Apple', 'Louis Vuitton'],
  projects: ['Brand campaign — 2024', 'Editorial series — Vogue'],
};

const SPARSE_CV = {
  name: 'Alex Martin',
  title: 'Graphic Designer',
  email: 'alex@example.com',
  summary: 'Designer focused on editorial and brand systems for cultural institutions.',
  experience: ['Freelance — Studio Nova — Paris — 2020–Present'],
};

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
  ...SPARSE_CV,
  education: ['ENSAD — Illustration — 2008–2011', 'LISAA — Motion — 2011–2012'],
  skills: ['Illustration', 'Brand identity', 'Art direction', 'Typography', 'Packaging', 'Editorial design'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma', 'After Effects'],
  languages: ['French (native)', 'English (fluent)', 'Spanish (conversational)'],
  clients: ['Nike', 'Adobe', 'Louis Vuitton', 'Marvel', 'Converse', 'Cadillac'],
  projects: ['Brand campaign — Global sportswear client · 2023', 'Editorial series — Luxury maison · 2022'],
  experience: buildLongExperience(14),
};

function mapFinalResumeToCvDataLike(frd) {
  const shaped = {
    identity: { ...(frd.identity || {}) },
    summary: String(frd.summary || '').trim(),
    experiences: Array.isArray(frd.experiences) ? frd.experiences : [],
    education: Array.isArray(frd.education) ? frd.education : [],
    skills: Array.isArray(frd.skills) ? frd.skills : [],
    tools: Array.isArray(frd.tools) ? frd.tools : [],
    languages: Array.isArray(frd.languages) ? frd.languages : [],
    clients: Array.isArray(frd.clients) ? frd.clients : [],
    projects: Array.isArray(frd.projects) ? frd.projects : [],
    unsorted: [],
    meta: {},
  };
  return normalizeCvDataForTemplate({
    ...resumeDataToCvData(shaped, { skipNormalize: true }),
    _fromFinalResumeData: true,
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const richSectionCount = countPopulatedSections(RICH_FINAL_RESUME);
ok(richSectionCount >= DENSITY_MIN_SECTIONS_FOR_FILL, `rich fixture has ${richSectionCount} sections (≥${DENSITY_MIN_SECTIONS_FOR_FILL})`);

const sparseSectionCount = countPopulatedSections(SPARSE_CV);
ok(sparseSectionCount < DENSITY_MIN_SECTIONS_FOR_FILL, `sparse fixture has ${sparseSectionCount} sections (<${DENSITY_MIN_SECTIONS_FOR_FILL})`);

const productionCv = mapFinalResumeToCvDataLike(RICH_FINAL_RESUME);
const T = loadHirelyTemplates();
const templateIds = ['ats', ...PRODUCTION_TEMPLATE_IDS];
const audits = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

for (const templateId of templateIds) {
  const inner = T.render(productionCv, templateId);
  ok(inner.includes('cvDensity--filled'), `${templateId} applies cvDensity--filled`);
  ok(inner.includes('data-section-count'), `${templateId} stamps section count`);

  const lock = scoreTemplateCompletenessLock(inner, RICH_FINAL_RESUME);
  ok(lock.pass, `${templateId} completeness lock (${lock.score}%)`);

  const html = buildPdfExportHtml(inner, templateId);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(120);

  const layout = await layoutCvForExport(page);
  const metrics = await page.evaluate((a4H) => {
    const sheet = document.querySelector('.cvA4Sheet[data-page="1"]') || document.querySelector('.cvA4Sheet');
    const innerEl = sheet?.querySelector('.cvInner');
    const contentPx = innerEl ? Math.max(innerEl.scrollHeight, innerEl.offsetHeight) : 0;
    const fillPct = sheet ? parseFloat(sheet.getAttribute('data-fill-pct') || '0') : 0;
    const sectionCount = innerEl ? parseInt(innerEl.getAttribute('data-section-count') || '0', 10) : 0;
    const textLen = (sheet?.innerText || '').replace(/\s+/g, ' ').trim().length;
    const sheets = document.querySelectorAll('.cvA4Stack .cvA4Sheet').length;
    const hasEmptyState = !!document.querySelector('.cvEmptyState');
    return { contentPx, fillPct, fillRatio: contentPx / a4H, sectionCount, textLen, sheets, hasEmptyState, laidOut: !!sheet };
  }, A4_HEIGHT_PX);

  ok(layout.laidOut, `${templateId} A4 layout`);
  ok(!metrics.hasEmptyState, `${templateId} no empty state when data exists`);
  ok(metrics.textLen >= DENSITY_MIN_VISIBLE_TEXT, `${templateId} visible text (${metrics.textLen} chars)`);
  const gateSections = metrics.sectionCount || richSectionCount;
  ok(
    passesFirstPageFillGate(gateSections, metrics.fillRatio),
    `${templateId} first-page fill ${(metrics.fillRatio * 100).toFixed(1)}% (≥${DENSITY_MIN_FIRST_PAGE_FILL * 100}% for ${gateSections} sections)`
  );

  audits.push({
    templateId,
    sectionCount: metrics.sectionCount,
    fillPct: Math.round(metrics.fillRatio * 1000) / 10,
    contentPx: metrics.contentPx,
    textLen: metrics.textLen,
    sheets: metrics.sheets,
    completenessScore: lock.score,
    completenessPass: lock.pass,
  });
}

// Sparse CV — must render content, not look empty
{
  const inner = T.render(SPARSE_CV, 'ats');
  ok(inner.includes('cvDensity--sparse'), 'sparse CV uses cvDensity--sparse');
  const html = buildPdfExportHtml(inner, 'ats');
  await page.setContent(html, { waitUntil: 'networkidle' });
  await layoutCvForExport(page);
  const sparseMetrics = await page.evaluate(() => {
    const sheet = document.querySelector('.cvA4Sheet');
    const textLen = (sheet?.innerText || '').replace(/\s+/g, ' ').trim().length;
    return { textLen, hasEmptyState: !!document.querySelector('.cvEmptyState') };
  });
  ok(!sparseMetrics.hasEmptyState, 'sparse CV no empty state');
  ok(sparseMetrics.textLen >= DENSITY_MIN_VISIBLE_TEXT, `sparse CV visible text (${sparseMetrics.textLen})`);
  audits.push({ scenario: 'sparse-ats', ...sparseMetrics, sectionCount: sparseSectionCount });
}

// Long CV — paginate to page 2+
{
  const inner = T.render(LONG_CV, 'creative-portfolio');
  const html = buildPdfExportHtml(inner, 'creative-portfolio');
  await page.setContent(html, { waitUntil: 'networkidle' });
  await layoutCvForExport(page);
  const longMetrics = await page.evaluate(() => ({
    sheets: document.querySelectorAll('.cvA4Stack .cvA4Sheet').length,
    textLen: (document.querySelector('.cv')?.innerText || '').replace(/\s+/g, ' ').trim().length,
  }));
  ok(longMetrics.sheets >= 2, `long CV paginates (${longMetrics.sheets} sheets)`);
  audits.push({ scenario: 'long-creative-portfolio', ...longMetrics, sectionCount: countPopulatedSections(LONG_CV) });
}

await browser.close();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      gates: {
        minSectionsForFill: DENSITY_MIN_SECTIONS_FOR_FILL,
        minFirstPageFill: DENSITY_MIN_FIRST_PAGE_FILL,
        minVisibleText: DENSITY_MIN_VISIBLE_TEXT,
      },
      richSectionCount,
      sparseSectionCount,
      audits,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(`\nReport: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
