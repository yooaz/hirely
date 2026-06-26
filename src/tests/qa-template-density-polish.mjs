#!/usr/bin/env node
/**
 * P0 — Template density polish: page-1 major sections, compact meta, no empty blocks.
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
  DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1,
  MAJOR_SECTION_CLASS_HINTS,
  passesFirstPageFillGate,
  passesMajorSectionsPage1Gate,
} from '../ui/templates/template-density.mjs';
import { scoreTemplateCompletenessLock } from '../ui/templates/template-completeness.js';
import { normalizeCvDataForTemplate, resumeDataToCvData } from '../core/resume-data.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import { buildPdfExportHtml, layoutCvForExport } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/template-density-polish/report.json');

const MAJOR_SELECTOR = MAJOR_SECTION_CLASS_HINTS.map((c) => `.${c}`).join(', ');

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

const MINIMAL_SPARSE_CV = {
  name: 'Alex Martin',
  title: 'Graphic Designer',
  email: 'alex@example.com',
  summary: 'Designer focused on editorial and brand systems for cultural institutions.',
  experience: ['Freelance — Studio Nova — Paris — 2020–Present'],
};

const SPARSE_CV = {
  ...MINIMAL_SPARSE_CV,
  education: ['ENSAD — Illustration — 2008–2011'],
  skills: ['Typography', 'Brand systems', 'Editorial design'],
  tools: ['Figma', 'InDesign'],
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
ok(richSectionCount >= DENSITY_MIN_SECTIONS_FOR_FILL, `rich fixture ${richSectionCount} sections`);

const productionCv = mapFinalResumeToCvDataLike(RICH_FINAL_RESUME);
const T = loadHirelyTemplates();
const templateIds = ['ats', ...PRODUCTION_TEMPLATE_IDS];
const audits = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

for (const templateId of templateIds) {
  const inner = T.render(productionCv, templateId);
  ok(inner.includes('cvDensity--filled'), `${templateId} cvDensity--filled`);
  ok(inner.includes('cvSection--primary'), `${templateId} experience primary section`);
  ok(inner.includes('cvSection--compact'), `${templateId} compact section classes`);
  ok(!inner.includes('cvSection--software"></section>'), `${templateId} no empty software shell`);

  const lock = scoreTemplateCompletenessLock(inner, RICH_FINAL_RESUME);
  ok(lock.pass, `${templateId} completeness (${lock.score}%)`);

  const html = buildPdfExportHtml(inner, templateId);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(120);
  await layoutCvForExport(page);

  const metrics = await page.evaluate(
    ({ majorSel, a4H, minMajor }) => {
      const sheet = document.querySelector('.cvA4Sheet[data-page="1"]') || document.querySelector('.cvA4Sheet');
      const innerEl = sheet?.querySelector('.cvInner');
      const hasIdentity = !!sheet?.querySelector('.cvHead, .cvName');
      const majorSections = sheet ? sheet.querySelectorAll(majorSel).length : 0;
      const contentPx = innerEl ? Math.max(innerEl.scrollHeight, innerEl.offsetHeight) : 0;
      const fillRatio = contentPx / a4H;
      const sectionCount = innerEl ? parseInt(innerEl.getAttribute('data-section-count') || '0', 10) : 0;
      const textLen = (sheet?.innerText || '').replace(/\s+/g, ' ').trim().length;
      const emptySections = sheet
        ? [...sheet.querySelectorAll('.cvSection')].filter((s) => {
            const body = s.querySelector('.cvSectionBody');
            return body && !String(body.textContent || '').trim();
          }).length
        : 0;
      const hasExpRole = !!sheet?.querySelector('.cvExpRole');
      const hasCompactTools = !!sheet?.querySelector('.cvToolsLine, .cvSection--tools, .cvSection--software');
      const blankTailRatio = sheet
        ? (() => {
            const rect = sheet.getBoundingClientRect();
            const last = sheet.querySelector('.cvSection:last-of-type, .cvMetaFooter:last-of-type, .cvHead');
            if (!last || !rect.height) return 0;
            const lb = last.getBoundingClientRect();
            return Math.max(0, (rect.bottom - lb.bottom) / rect.height);
          })()
        : 1;
      return {
        hasIdentity,
        majorSections,
        majorPass: hasIdentity && majorSections >= minMajor,
        contentPx,
        fillRatio,
        sectionCount,
        textLen,
        emptySections,
        hasExpRole,
        hasCompactTools,
        blankTailRatio,
      };
    },
    { majorSel: MAJOR_SELECTOR, a4H: A4_HEIGHT_PX, minMajor: DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1 }
  );

  ok(metrics.majorPass, `${templateId} page-1 identity + ${metrics.majorSections} major sections (≥${DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1})`);
  ok(metrics.emptySections === 0, `${templateId} no empty rendered sections`);
  ok(metrics.hasExpRole, `${templateId} experience role hierarchy`);
  ok(metrics.hasCompactTools, `${templateId} compact tools row`);
  ok(metrics.textLen >= DENSITY_MIN_VISIBLE_TEXT, `${templateId} visible text (${metrics.textLen})`);
  ok(
    passesFirstPageFillGate(metrics.sectionCount || richSectionCount, metrics.fillRatio),
    `${templateId} fill ${(metrics.fillRatio * 100).toFixed(1)}%`
  );
  ok(
    metrics.blankTailRatio < 0.42 || metrics.fillRatio >= DENSITY_MIN_FIRST_PAGE_FILL,
    `${templateId} no giant blank tail (${(metrics.blankTailRatio * 100).toFixed(0)}% below last block)`
  );

  audits.push({
    templateId,
    ...metrics,
    fillPct: Math.round(metrics.fillRatio * 1000) / 10,
    completenessScore: lock.score,
    completenessPass: lock.pass,
  });
}

// Minimal sparse CV — density class
{
  const innerMinimal = T.render(MINIMAL_SPARSE_CV, 'ats');
  ok(innerMinimal.includes('cvDensity--sparse'), 'minimal sparse CV density class');
}

// Sparse CV — still packs identity + available major sections on page 1
{
  const inner = T.render(SPARSE_CV, 'ats');
  ok(inner.includes('cvDensity--filled') || inner.includes('cvDensity--sparse'), 'sparse fixture density class');
  const html = buildPdfExportHtml(inner, 'ats');
  await page.setContent(html, { waitUntil: 'networkidle' });
  await layoutCvForExport(page);
  const sparse = await page.evaluate(
    ({ majorSel, minMajor }) => {
      const sheet = document.querySelector('.cvA4Sheet');
      const hasIdentity = !!sheet?.querySelector('.cvHead, .cvName');
      const majorSections = sheet ? sheet.querySelectorAll(majorSel).length : 0;
      return { hasIdentity, majorSections, majorPass: hasIdentity && majorSections >= minMajor };
    },
    { majorSel: MAJOR_SELECTOR, minMajor: DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1 }
  );
  ok(sparse.majorPass, `sparse ATS page-1 major sections (${sparse.majorSections})`);
  audits.push({ scenario: 'sparse-ats', ...sparse, sectionCount: countPopulatedSections(SPARSE_CV) });
}

await browser.close();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      gates: {
        minMajorSectionsPage1: DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1,
        minSectionsForFill: DENSITY_MIN_SECTIONS_FOR_FILL,
        minFirstPageFill: DENSITY_MIN_FIRST_PAGE_FILL,
        minVisibleText: DENSITY_MIN_VISIBLE_TEXT,
      },
      richSectionCount,
      audits,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(`\nReport: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
