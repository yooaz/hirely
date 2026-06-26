#!/usr/bin/env node
/**
 * Template rebuild audit — structure rules + PNG screenshots per template.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS, PRODUCTION_TEMPLATE_DISPLAY_NAMES } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const OUT_DIR = path.join(root, 'tests/output/template-screenshots');
const REPORT_PATH = path.join(root, 'tests/output/template-audit/report.json');

const FORBIDDEN_MARKUP = [
  'cvSkillBars',
  'cvSkillBarFill',
  'cvTimelineDot',
  'cvClientsRibbon',
  'cvClientTags',
  'cvScore',
  'cvDecor',
];

const SAMPLE = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  linkedin: 'linkedin.com/in/yoaz',
  portfolio: 'yoaz.com',
  location: 'Paris, France',
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling for cultural and commercial brands.',
  experience: [
    'Freelance Illustrator / Graphic Designer — Independent · 2011–Present',
    'Senior Designer — Studio Nova — Paris — 2016–2020',
  ],
  education: ['LISAA — Web & Motion', 'Créapole — Visual Communication'],
  skills: ['Illustration', 'Brand identity', 'Art direction'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French (native)', 'English (fluent)'],
  clients: ['Nike', 'Louis Vuitton', 'Marvel', 'Adobe', 'Pantone'],
  projects: ['Poster series — Arte · 2024', 'Packaging — Luxury beauty · 2023'],
};

const SPARSE = {
  name: 'Alex Martin',
  title: 'Designer',
  experience: ['Designer — Studio A — 2022–Present'],
};

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

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
    getPhotoHtml: () => '<div class="cvPhotoWrap"><img class="cvPhoto" src="x" alt=""></div>',
  });
  return sandbox.HirelyTemplates;
}

function auditHtml(id, html, profileLabel) {
  const issues = [];
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  for (const token of FORBIDDEN_MARKUP) {
    if (html.includes(token)) issues.push(`forbidden_markup:${token}`);
  }
  if (/<img/i.test(html)) issues.push('photo_placeholder_present');
  if (/class="chip"/.test(html)) issues.push('skill_chips_present');

  const emptySections = [
    ...html.matchAll(
      /<section class="cvSection[^"]*">\s*<h3[^>]*>[^<]+<\/h3>\s*<div class="cvSectionBody">\s*<\/div>/gi
    ),
  ];
  if (emptySections.length) issues.push(`empty_sections:${emptySections.length}`);

  return {
    templateId: id,
    displayName: PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id,
    profile: profileLabel,
    htmlBytes: html.length,
    plainTextChars: plain.length,
    hasPhoto: /<img/i.test(html),
    hasExperience: /cvSection--experience|Experience/i.test(html),
    hasProjects: /cvSection--projects|Projects/i.test(html),
    sectionCount: (html.match(/<section class="cvSection/g) || []).length,
    issues,
    pass: issues.length === 0,
  };
}

function buildScreenshotHtml(id, inner) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-design-tokens.css"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-templates-professional.css"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-templates-v2-families.css"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-templates-showcase-v8.css"/>
<style>
body{margin:0;padding:24px;background:#e8e8e4;display:flex;justify-content:center}
.cv{width:794px;max-width:794px;min-height:1123px;box-shadow:0 12px 40px rgba(15,23,42,.12)}
</style>
</head><body>
<div class="cv template-${id} spacing-normal cv--live">${inner}</div>
</body></html>`;
}

async function captureScreenshots(T) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.warn('SKIP screenshots — run: npx playwright install chromium');
    return PRODUCTION_TEMPLATE_IDS.map((id) => ({ templateId: id, screenshot: null, screenshotSkipped: true }));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true });
  const results = [];

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const inner = T.render(SAMPLE, id);
    const htmlPath = path.join(OUT_DIR, `${id}.html`);
    const pngPath = path.join(OUT_DIR, `${id}.png`);
    fs.writeFileSync(htmlPath, buildScreenshotHtml(id, inner), 'utf8');

    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    await page.locator('.cv').screenshot({ path: pngPath, type: 'png' });
    await page.close();
    results.push({
      templateId: id,
      screenshot: path.relative(root, pngPath),
      html: path.relative(root, htmlPath),
    });
    console.log('SCREENSHOT', pngPath);
  }

  await browser.close();
  return results;
}

const T = loadTemplates();
const audits = [];

ok(T.PRODUCTION_TEMPLATE_IDS.length === 8, 'eight showcase production templates');

for (const id of PRODUCTION_TEMPLATE_IDS) {
  ok(T.resolve(id).id === id, `resolve ${id}`);
  const full = T.render(SAMPLE, id);
  const sparse = T.render(SPARSE, id);
  audits.push(auditHtml(id, full, 'full'));
  audits.push(auditHtml(id, sparse, 'sparse'));
  ok(!/<img/i.test(full), `${id} no photo in full render`);
  ok(!FORBIDDEN_MARKUP.some((t) => full.includes(t)), `${id} no forbidden markup`);
}

const screenshots = await captureScreenshots(T);

const report = {
  generatedAt: new Date().toISOString(),
  engine: 'hirely-template-audit-v1',
  templates: PRODUCTION_TEMPLATE_IDS.map((id) => ({
    id,
    name: PRODUCTION_TEMPLATE_DISPLAY_NAMES[id],
    audits: audits.filter((a) => a.templateId === id),
    screenshot: screenshots.find((s) => s.templateId === id)?.screenshot || null,
  })),
  rules: {
    noEmptySections: true,
    noPhotoPlaceholders: true,
    noSkillBars: true,
    noFakeScores: true,
    noDecorativeNonsense: true,
    allowedFields: ['name', 'title', 'summary', 'experience', 'projects', 'clients', 'education', 'skills', 'tools', 'languages'],
  },
  summary: {
    templateCount: PRODUCTION_TEMPLATE_IDS.length,
    auditRuns: audits.length,
    passed: audits.filter((a) => a.pass).length,
    failed: audits.filter((a) => !a.pass).length,
    screenshots: screenshots.filter((s) => s.screenshot).length,
  },
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

console.log('\n═══ HIRELY Template Audit ═══');
for (const t of report.templates) {
  const full = t.audits.find((a) => a.profile === 'full');
  const status = full?.pass ? 'PASS' : 'FAIL';
  console.log(`  ${status}  ${t.name} (${t.id}) — sections: ${full?.sectionCount}, shot: ${t.screenshot || '—'}`);
  if (full?.issues?.length) console.log(`       issues: ${full.issues.join(', ')}`);
}
console.log(`Report: ${path.relative(root, REPORT_PATH)}`);
console.log(`Screenshots: ${path.relative(root, OUT_DIR)}/`);

process.exit(failed || report.summary.failed ? 1 : 0);
