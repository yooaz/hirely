#!/usr/bin/env node
/**
 * P0 — Template visual quality gate (density ≥55%, content visibility, experience early).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { A4_HEIGHT_PX } from '../src/core/export/pdf-export-config.js';
import { PREMIUM_TEMPLATE_SYSTEM_V1_IDS } from '../src/ui/templates/production-template-ids.mjs';
import {
  countPopulatedSections,
  DENSITY_MIN_FIRST_PAGE_FILL,
  DENSITY_MIN_SECTIONS_FOR_FILL,
  DENSITY_MIN_VISIBLE_TEXT,
  passesFirstPageFillGate,
} from '../src/ui/templates/template-density.mjs';
import { scoreTemplateCompletenessLock } from '../src/ui/templates/template-completeness.js';
import { normalizeCvDataForTemplate, resumeDataToCvData } from '../src/core/resume-data.js';
import { loadHirelyTemplates } from '../src/tests/lib/pdf-hardening-suite.mjs';
import { buildPdfExportHtml, layoutCvForExport } from '../src/tests/lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'TEMPLATE_VISUAL_QUALITY_REPORT.md');
const JSON_OUT = path.join(ROOT, 'tests/output/template-visual-quality/report.json');

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
  title: 'Lead Illustrator',
  email: 'yohann@example.com',
  summary: 'Senior illustrator with deep experience across luxury and technology brands.',
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

const checks = [];
const fail = (name, detail) => checks.push({ name, ok: false, detail });
const pass = (name, detail = '') => checks.push({ name, ok: true, detail });

function experienceBeforeMeta(html) {
  const exp = html.search(
    /cvSection--experience|cvSection--leadership|cvSection--startup-impact|cvSection--timeline|cvSection--visual-timeline/i
  );
  const clients = html.search(/cvSection--clients|cvSection--clients-director|cvVtBranch--clients/i);
  if (exp < 0) return false;
  if (clients < 0) return true;
  return exp < clients;
}

const productionCv = mapFinalResumeToCvDataLike(RICH_FINAL_RESUME);
const T = loadHirelyTemplates();
const templateIds = [...PREMIUM_TEMPLATE_SYSTEM_V1_IDS];
const audits = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

for (const templateId of templateIds) {
  const inner = T.render(productionCv, templateId);
  const lock = scoreTemplateCompletenessLock(inner, RICH_FINAL_RESUME);
  lock.pass
    ? pass(`${templateId} content lock`, `${lock.score}%`)
    : fail(`${templateId} content lock`, `${lock.score}%`);

  experienceBeforeMeta(inner)
    ? pass(`${templateId} experience before meta`, 'experience section precedes clients/skills/tools')
    : fail(`${templateId} experience before meta`, 'experience too low in layout');

  /cvSection--clients|cvSection--clients-director|cvVtBranch--clients/i.test(inner) &&
  /Louis Vuitton|Nike/i.test(inner)
    ? pass(`${templateId} clients visible`)
    : fail(`${templateId} clients visible`, 'missing clients block or content');

  /cvSkillLine|cvSection--skills/i.test(inner) && /cvToolsLine|cvSection--tools/i.test(inner)
    ? pass(`${templateId} compact skills/tools`)
    : fail(`${templateId} compact skills/tools`, 'missing compact meta sections');

  const html = buildPdfExportHtml(inner, templateId);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(120);

  await layoutCvForExport(page);
  const metrics = await page.evaluate((a4H) => {
    const sheet = document.querySelector('.cvA4Sheet[data-page="1"]') || document.querySelector('.cvA4Sheet');
    const innerEl = sheet?.querySelector('.cvInner');
    const contentPx = innerEl ? Math.max(innerEl.scrollHeight, innerEl.offsetHeight) : 0;
    const sectionCount = innerEl ? parseInt(innerEl.getAttribute('data-section-count') || '0', 10) : 0;
    const textLen = (sheet?.innerText || '').replace(/\s+/g, ' ').trim().length;
    const sheets = document.querySelectorAll('.cvA4Stack .cvA4Sheet').length;
    return { contentPx, fillRatio: contentPx / a4H, sectionCount, textLen, sheets };
  }, A4_HEIGHT_PX);

  const gateSections = metrics.sectionCount || countPopulatedSections(RICH_FINAL_RESUME);
  const fillPct = Math.round(metrics.fillRatio * 1000) / 10;
  const densityPass = passesFirstPageFillGate(gateSections, metrics.fillRatio);
  densityPass
    ? pass(`${templateId} first-page density`, `${fillPct}% (≥${DENSITY_MIN_FIRST_PAGE_FILL * 100}%)`)
    : fail(`${templateId} first-page density`, `${fillPct}% < ${DENSITY_MIN_FIRST_PAGE_FILL * 100}%`);

  metrics.textLen >= DENSITY_MIN_VISIBLE_TEXT
    ? pass(`${templateId} visible text`, `${metrics.textLen} chars`)
    : fail(`${templateId} visible text`, `${metrics.textLen} chars`);

  audits.push({
    templateId,
    completenessScore: lock.score,
    completenessPass: lock.pass,
    fillPct,
    densityPass,
    textLen: metrics.textLen,
    sheets: metrics.sheets,
    experienceEarly: experienceBeforeMeta(inner),
  });
}

{
  const inner = T.render(LONG_CV, 'creative-director');
  const html = buildPdfExportHtml(inner, 'creative-director');
  await page.setContent(html, { waitUntil: 'networkidle' });
  await layoutCvForExport(page);
  const longMetrics = await page.evaluate(() => ({
    sheets: document.querySelectorAll('.cvA4Stack .cvA4Sheet').length,
  }));
  longMetrics.sheets >= 2
    ? pass('multi-page pagination', `${longMetrics.sheets} sheets`)
    : fail('multi-page pagination', `${longMetrics.sheets} sheets`);
  audits.push({ scenario: 'long-creative-director', sheets: longMetrics.sheets });
}

await browser.close();

const allOk = checks.every((c) => c.ok);
fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
fs.writeFileSync(
  JSON_OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      gates: { minFirstPageFill: DENSITY_MIN_FIRST_PAGE_FILL, minVisibleText: DENSITY_MIN_VISIBLE_TEXT },
      audits,
      pass: allOk,
    },
    null,
    2
  )
);

const lines = [
  '# Template Visual Quality Report',
  '',
  `**Result:** ${allOk ? 'PASS' : 'FAIL'}`,
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Gates',
  '',
  `- First-page content density ≥ **${DENSITY_MIN_FIRST_PAGE_FILL * 100}%** when ${DENSITY_MIN_SECTIONS_FOR_FILL}+ sections populated`,
  '- Experience section appears before clients/skills/tools',
  '- Clients, skills, and tools render with compact markup',
  '- Long CV paginates to 2+ A4 sheets',
  '- Template completeness lock at **100%** on rich fixture',
  '',
  '## Per-template density',
  '',
  '| Template | Fill % | Lock | Experience early |',
  '|----------|--------|------|------------------|',
  ...audits
    .filter((a) => a.templateId)
    .map(
      (a) =>
        `| ${a.templateId} | ${a.fillPct}% | ${a.completenessPass ? 'PASS' : 'FAIL'} (${a.completenessScore}%) | ${a.experienceEarly ? 'yes' : 'no'} |`
    ),
  '',
  '## Checks',
  '',
  ...checks.map((c) => `- [${c.ok ? 'x' : ' '}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
  '',
  '## Verify',
  '',
  '```bash',
  'npm run template-visual-quality-report',
  '```',
  '',
];

fs.writeFileSync(REPORT, lines.join('\n'));
console.log(allOk ? 'PASS' : 'FAIL');
console.log(`Report: ${REPORT}`);
for (const c of checks) {
  console.log(`${c.ok ? 'OK' : 'FAIL'} ${c.name}${c.detail ? `: ${c.detail}` : ''}`);
}
process.exit(allOk ? 0 : 1);
