#!/usr/bin/env node
/**
 * P0 — Ten Premium Templates professional redesign gate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { requireImportStabilityForTemplates } from '../ui/templates/template-import-gate.mjs';
import { resumeDataToTemplateView } from '../ui/templates/v2/view-model.js';
import {
  TEN_PREMIUM_TEMPLATE_IDS,
  TEN_PREMIUM_TEMPLATE_NAMES,
  TEN_PREMIUM_LAYOUT_BRIEFS,
  TEN_PREMIUM_TEMPLATES_VERSION,
  TEN_PREMIUM_TEMPLATE_REBUILD_VERSION,
} from '../ui/templates/ten-premium-templates.mjs';
import {
  passesFirstPageFillGate,
  passesMajorSectionsPage1Gate,
  countPopulatedSections,
  DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1,
  MAJOR_SECTION_CLASS_HINTS,
} from '../ui/templates/template-density.mjs';
import { scoreTemplateCompletenessLock } from '../ui/templates/template-completeness.js';
import {
  isTemplatePreviewAllowedForFreeUser,
  isTemplateExportProLocked,
} from '../ui/templates/free-template-preview-mode.js';
import { A4_HEIGHT_PX } from '../core/export/pdf-export-config.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  exportCvPdfPlaywright,
  analyzePdfBytes,
  buildPdfExportHtml,
  layoutCvForExport,
} from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/ten-premium-templates');

const SAMPLE_RESUME = {
  identity: {
    name: 'Alex Morgan',
    title: 'Product Lead',
    email: 'alex@venture.example',
    phone: '+1 415 555 0100',
    location: 'San Francisco, CA',
    portfolio: 'https://alexmorgan.dev',
  },
  summary:
    'Operator and product leader scaling venture-backed teams from zero to Series B with measurable revenue and retention outcomes.',
  experiences: [
    {
      role: 'Co-Founder & CEO',
      company: 'Northline',
      dates: '2021–Present',
      bullets: ['Grew ARR from $0 to $4.2M in 28 months.', 'Raised $8M Series A with 3x YoY retention.'],
    },
    {
      role: 'Head of Product',
      company: 'Stripe',
      dates: '2017–2021',
      bullets: ['Led onboarding used by 14M merchants.', 'Shipped billing APIs adopted by 120+ partners.'],
    },
  ],
  education: ['Stanford GSB — MBA', 'MIT — BS Computer Science'],
  skills: ['Product strategy', 'Go-to-market', 'Team building', 'Fundraising'],
  tools: ['Figma', 'Notion', 'Linear', 'SQL'],
  languages: ['English — native', 'French — professional'],
  clients: ['Nike', 'Adobe', 'Apple'],
  projects: ['Payments platform relaunch — 2023', 'Creator economy suite — 2022'],
  unsorted: [],
  meta: {},
};

const EXPECTED_NAMES = [
  'Executive',
  'Consulting',
  'Startup',
  'Designer',
  'Creative Director',
  'Engineer',
  'Product Manager',
  'Marketing',
  'Minimal ATS',
  'Premium ATS',
];

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

requireImportStabilityForTemplates(ROOT);
fs.mkdirSync(OUT_DIR, { recursive: true });

record('version', TEN_PREMIUM_TEMPLATE_REBUILD_VERSION === 'TEMPLATE_LIBRARY_V3_REBUILD');
record('engine_version', TEN_PREMIUM_TEMPLATES_VERSION === 'TEMPLATE_LIBRARY_V3');
record('count_10', TEN_PREMIUM_TEMPLATE_IDS.length === 10);
record('free_preview_mode', isTemplatePreviewAllowedForFreeUser());

const displayNames = TEN_PREMIUM_TEMPLATE_IDS.map((id) => TEN_PREMIUM_TEMPLATE_NAMES[id]);
record(
  'user_facing_names',
  EXPECTED_NAMES.every((n, i) => displayNames[i] === n),
  displayNames.join(', ')
);

const HT = loadHirelyTemplates();
const view = resumeDataToTemplateView(SAMPLE_RESUME, { skipFinalGate: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const rows = [];

const majorSel = MAJOR_SECTION_CLASS_HINTS.map((c) => `.${c}`).join(', ');

for (const id of TEN_PREMIUM_TEMPLATE_IDS) {
  const tpl = HT.resolve(id);
  const html = String(HT.render(view, id) || '');
  const text = stripHtml(html);
  const completeness = scoreTemplateCompletenessLock(html, SAMPLE_RESUME);
  const sectionCount = countPopulatedSections(view);

  record(`${id}:name`, tpl.name === TEN_PREMIUM_TEMPLATE_NAMES[id], tpl.name);
  record(`${id}:renders_identity`, text.includes('Alex Morgan'));
  record(`${id}:no_placeholder`, !/lorem ipsum|placeholder|TODO|FIXME|john doe|jane doe/i.test(html));
  record(`${id}:completeness_lock`, completeness.pass, `score=${completeness.score}`);

  const exportHtml = buildPdfExportHtml(html, id);
  await page.setContent(exportHtml, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(120);
  await layoutCvForExport(page);

  const metrics = await page.evaluate(
    ({ majorSelector, a4H, minMajor }) => {
      const sheet = document.querySelector('.cvA4Sheet[data-page="1"]') || document.querySelector('.cvA4Sheet');
      const innerEl = sheet?.querySelector('.cvInner');
      const hasIdentity = !!sheet?.querySelector('.cvHead, .cvName');
      const majorSections = sheet ? sheet.querySelectorAll(majorSelector).length : 0;
      const contentPx = innerEl ? Math.max(innerEl.scrollHeight, innerEl.offsetHeight) : 0;
      const fillRatio = contentPx / a4H;
      const emptySections = sheet
        ? [...sheet.querySelectorAll('.cvSection')].filter((s) => {
            const body = s.querySelector('.cvSectionBody');
            return body && !String(body.textContent || '').trim();
          }).length
        : 0;
      return { hasIdentity, majorSections, fillRatio, emptySections, textLen: (sheet?.innerText || '').replace(/\s+/g, ' ').trim().length };
    },
    { majorSelector: majorSel, a4H: A4_HEIGHT_PX, minMajor: DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1 }
  );

  const page1Ok =
    passesMajorSectionsPage1Gate(metrics.majorSections, metrics.hasIdentity) &&
    passesFirstPageFillGate(sectionCount, metrics.fillRatio);

  record(`${id}:no_empty_sections`, metrics.emptySections === 0, String(metrics.emptySections));
  record(`${id}:page1_useful`, page1Ok, `major=${metrics.majorSections} fill=${(metrics.fillRatio * 100).toFixed(1)}%`);
  record(`${id}:export_pro_locked`, isTemplateExportProLocked(tpl));

  const pdfPath = path.join(OUT_DIR, `${id}.pdf`);
  try {
    await exportCvPdfPlaywright(page, html, id, pdfPath);
    const pdfBuf = fs.readFileSync(pdfPath);
    const analysis = await analyzePdfBytes(pdfBuf);
    record(`${id}:pdf_safe`, pdfBuf.length > 2000 && (analysis.pageCount || 0) >= 1);
  } catch (e) {
    record(`${id}:pdf_safe`, false, e?.message || String(e));
  }

  rows.push({
    id,
    name: TEN_PREMIUM_TEMPLATE_NAMES[id],
    brief: TEN_PREMIUM_LAYOUT_BRIEFS[id],
    emptySections: metrics.emptySections,
    page1Ok,
    textLen: metrics.textLen,
    completenessScore: completeness.score,
  });
}

await browser.close();

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
record(
  'featured_gallery_sync',
  TEN_PREMIUM_TEMPLATE_IDS.every((id) => indexHtml.includes(`'${id}'`))
);

const report = {
  version: TEN_PREMIUM_TEMPLATES_VERSION,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  passCount: checks.filter((c) => c.pass).length,
  failCount: failed,
  checks,
  templates: rows,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`\n═══ Ten Premium Templates: ${report.passCount}/${checks.length} PASS ═══`);
process.exit(failed ? 1 : 0);
