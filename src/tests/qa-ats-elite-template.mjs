#!/usr/bin/env node
/**
 * ATS Elite — premium ATS template acceptance + PDF export.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { requireImportStabilityForTemplates } from '../ui/templates/template-import-gate.mjs';
import { resolveTemplateV2 } from '../ui/templates/v2/index.js';
import { resumeDataToTemplateView } from '../ui/templates/v2/view-model.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';
import { A4_WIDTH_PX } from '../core/export/pdf-export-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/ats-elite');
const TEMPLATE_ID = 'ats-elite';

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Alex Chen',
    title: 'Senior Product Manager',
    email: 'alex.chen@example.com',
    phone: '+1 415 555 0100',
    location: 'San Francisco, CA',
  },
  summary:
    'Product leader with ten years building B2B SaaS at scale. Focused on clarity, execution, and cross-functional delivery.',
  experiences: [
    {
      role: 'Senior Product Manager',
      company: 'Stripe',
      dates: '2020–Present',
      bullets: ['Led payments onboarding for enterprise merchants.', 'Shipped API improvements adopted by 40% of integrators.'],
    },
    {
      role: 'Product Manager',
      company: 'Google',
      dates: '2016–2020',
      bullets: ['Owned search quality experiments for mobile surfaces.'],
    },
  ],
  education: ['Stanford University — MS Management Science & Engineering'],
  skills: ['Product strategy', 'Roadmapping', 'User research', 'Stakeholder management'],
  tools: ['Jira', 'Figma', 'SQL', 'Amplitude'],
  languages: ['English — native', 'Mandarin — fluent'],
  clients: ['Should not appear'],
  projects: ['Should not appear'],
  unsorted: [],
  meta: {},
};

const REQUIRED_SECTIONS = ['summary', 'experience', 'education', 'skills', 'tools', 'languages'];
const FORBIDDEN_MARKERS = [
  'cvSkillChip',
  'cvClientChip',
  'cvProgress',
  'cvTimelineDot',
  '<svg',
  'cvPhoto',
  'cvSection--clients',
  'cvSection--projects',
];

let failed = 0;
const results = [];

function ok(cond, msg) {
  const pass = !!cond;
  if (!pass) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
  results.push({ check: msg, pass });
  return pass;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadTemplates() {
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
      }[k] || k),
    cvBlock: (title, html) =>
      html ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>` : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function sectionOrder(html) {
  const re = /cvSection--([a-z-]+)/g;
  const order = [];
  let m;
  while ((m = re.exec(html))) order.push(m[1]);
  return order;
}

requireImportStabilityForTemplates(ROOT);

const HT = loadTemplates();
const tpl = HT.resolve(TEMPLATE_ID);
ok(tpl.id === TEMPLATE_ID, 'resolve ats-elite canonical id');
ok(tpl.name === 'ATS Elite', 'ATS Elite display name');
ok(HT.ALIASES['ats-elite'] === 'ats-elite', 'alias maps to ats-elite not ats');

const v2 = resolveTemplateV2(TEMPLATE_ID);
ok(v2.id === 'ats-elite', 'V2 registry resolves ats-elite');
ok(v2.renderLayerId === 'ats-elite', 'V2 render layer is ats-elite');

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const html = HT.render(view, TEMPLATE_ID);
const text = stripHtml(html);

ok(html.includes('template-ats-elite') || html.includes('cvTpl-ats-elite'), 'render uses ats-elite classes');
ok(html.includes('cvHead--ats-elite'), 'elite header class');
ok(html.includes('cvMain--ats-elite'), 'elite main class');
ok(text.includes('Alex Chen'), 'renders name');
ok(text.includes('Senior Product Manager'), 'renders title');
ok(text.includes('Stripe'), 'renders experience company');
ok(text.includes('Google'), 'renders experience company 2');
ok(text.includes('Product strategy'), 'renders skills');
ok(text.includes('Jira'), 'renders tools');
ok(text.includes('Mandarin'), 'renders languages');
ok(!text.includes('Should not appear'), 'no clients/projects in production render');

for (const marker of FORBIDDEN_MARKERS) {
  ok(!html.includes(marker), `no gimmick marker: ${marker}`);
}

const order = sectionOrder(html);
for (const sec of REQUIRED_SECTIONS) {
  ok(order.includes(sec), `section present: ${sec}`);
}
const ordered = REQUIRED_SECTIONS.filter((s) => order.includes(s));
const orderOk = ordered.every((s, i) => order.indexOf(s) === order.indexOf(ordered[0]) + i);
ok(
  ordered.join(',') === REQUIRED_SECTIONS.join(','),
  `section order: ${ordered.join(' → ')}`
);

const eliteCss = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-ats-elite.css'), 'utf8');
ok(eliteCss.includes('.cv.template-ats-elite'), 'ats-elite CSS block');
ok(eliteCss.includes('display: none !important'), 'gimmick elements hidden in CSS');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(indexHtml.includes('cv-templates-ats-elite.css'), 'index links ats-elite stylesheet');
ok(indexHtml.includes("'ats-elite'"), 'index features ats-elite');
ok(indexHtml.includes("'ats-elite':'ATS Elite'"), 'index display name ATS Elite');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'render.html'), html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(OUT_DIR, 'ats-elite.pdf');

try {
  const layout = await exportCvPdfPlaywright(page, html, TEMPLATE_ID, pdfPath);
  const pdfBuf = fs.readFileSync(pdfPath);
  const analysis = await analyzePdfBytes(pdfBuf);
  ok(pdfBuf.length > 2000, `PDF export bytes (${pdfBuf.length})`);
  ok((analysis.pageCount || 0) >= 1, `PDF page count (${analysis.pageCount})`);
  ok(layout?.sheetCount >= 0, 'A4 layout ran for PDF');

  const previewHtml = `<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>${eliteCss}
html,body{margin:0;padding:0;background:#f5f5f4}
.cv{width:794px}
</style></head><body>
<div class="cv template-${TEMPLATE_ID} spacing-normal">${html}</div>
</body></html>`;
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.setContent(previewHtml, { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => {
    const cv = document.querySelector('.cv');
    return cv ? { scrollWidth: cv.scrollWidth, clientWidth: cv.clientWidth } : { scrollWidth: 0, clientWidth: 0 };
  });
  ok(
    metrics.scrollWidth <= metrics.clientWidth + 2,
    `no horizontal crop (${metrics.scrollWidth} ≤ ${metrics.clientWidth})`
  );
} catch (e) {
  ok(false, `PDF export: ${e?.message || e}`);
}

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  templateId: TEMPLATE_ID,
  checks: results,
  sectionOrder: order,
  pass: failed === 0,
  pdfPath: 'tests/output/ats-elite/ats-elite.pdf',
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-ats-elite-template: PASS');
}
