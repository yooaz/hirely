#!/usr/bin/env node
/**
 * Creative Director — luxury editorial portfolio template acceptance + PDF export.
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
const OUT_DIR = path.join(ROOT, 'tests/output/creative-director');
const TEMPLATE_ID = 'creative-director';

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Creative Director & Illustrator',
    email: 'yoaz@example.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris, France',
    portfolio: 'https://yoaz.studio',
  },
  summary:
    'Creative director and illustrator shaping visual identities for global culture, sport, and technology brands.',
  experiences: [
    {
      role: 'Creative Director',
      company: 'Studio Yoaz',
      dates: '2020–Present',
      bullets: ['Art direction for Nike, Adobe, and Louis Vuitton campaigns.'],
    },
    {
      role: 'Lead Illustrator',
      company: 'McCann Paris',
      dates: '2014–2020',
      bullets: ['Editorial illustration systems for luxury and lifestyle brands.'],
    },
  ],
  education: ['ENSAD — MA Illustration'],
  skills: ['Art direction', 'Brand identity', 'Illustration', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Adobe', 'Apple', 'Louis Vuitton'],
  projects: [
    'Global Sport Campaign — Nike · 2024',
    'Product Storytelling — Adobe · 2023',
    'Luxury Editorial Series — Apple · 2022',
  ],
  clientLogos: [
    { name: 'Nike', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg' },
    { name: 'Adobe', url: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Adobe_Corporate_logo.svg' },
  ],
  unsorted: [],
  meta: {},
};

const REQUIRED_SECTIONS = ['clients', 'projects', 'experience', 'skills', 'tools', 'education'];
const SECTION_ORDER = ['clients', 'projects', 'experience', 'skills', 'tools', 'education'];

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
        clients: 'Clients',
        projects: 'Projects',
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
  while ((m = re.exec(html))) {
    const slug = m[1].replace(/-director$/, '').replace(/-meta$/, '');
    if (!order.includes(slug) && ['clients', 'projects', 'experience', 'skills', 'tools', 'education', 'languages'].includes(slug)) {
      order.push(slug);
    }
  }
  return order;
}

requireImportStabilityForTemplates(ROOT);

const HT = loadTemplates();
const tpl = HT.resolve(TEMPLATE_ID);
ok(tpl.id === TEMPLATE_ID, 'resolve creative-director canonical id');
ok(tpl.name === 'Creative Director', 'Creative Director display name');
ok(HT.ALIASES['creative-director'] === 'creative-director', 'alias maps to creative-director');
ok(HT.ALIASES.creativedirector === 'creative-director', 'creativedirector alias');

const v2 = resolveTemplateV2(TEMPLATE_ID);
ok(v2.id === 'creative-director', 'V2 registry resolves creative-director');
ok(v2.renderLayerId === 'creative-director', 'V2 render layer is creative-director');

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const html = HT.render(view, TEMPLATE_ID);
const text = stripHtml(html);

ok(html.includes('cvHead--director'), 'director header');
ok(html.includes('cvMain--director'), 'director main');
ok(html.includes('Selected Clients'), 'selected clients title');
ok(html.includes('Selected Projects'), 'selected projects title');
ok(html.includes('cvDirectorProject'), 'project highlight cards');
ok(html.includes('cvTimeline'), 'experience timeline');
ok(html.includes('cvDirectorClientLogo'), 'optional client logos render');
ok(text.includes('Yohann Azancot'), 'renders name');
ok(text.includes('Creative Director'), 'renders title');
ok(text.includes('Nike'), 'renders client');
ok(text.includes('Adobe'), 'renders client 2');
ok(text.includes('Global Sport Campaign'), 'renders project highlight');
ok(text.includes('McCann Paris'), 'renders timeline experience');
ok(text.includes('Art direction'), 'renders skills');
ok(text.includes('Photoshop'), 'renders tools');
ok(text.includes('ENSAD'), 'renders education');
ok(!html.includes('cvClientChip'), 'no client chips');
ok(!html.includes('cvSkillChip'), 'no skill chips');

const order = sectionOrder(html);
for (const sec of REQUIRED_SECTIONS) {
  ok(order.includes(sec), `section present: ${sec}`);
}
ok(order.join(',') === SECTION_ORDER.join(','), `section order: ${order.join(' → ')}`);

const css = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-creative-director.css'), 'utf8');
ok(css.includes('Cormorant Garamond'), 'editorial display font');
ok(css.includes('cvDirectorClientLogo'), 'client logo styles');
ok(css.includes('cvDirectorProject'), 'project highlight styles');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(indexHtml.includes('cv-templates-creative-director.css'), 'index links creative-director stylesheet');
ok(indexHtml.includes("'creative-director'"), 'index features creative-director');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'render.html'), html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(OUT_DIR, 'creative-director.pdf');

try {
  const layout = await exportCvPdfPlaywright(page, html, TEMPLATE_ID, pdfPath);
  const pdfBuf = fs.readFileSync(pdfPath);
  const analysis = await analyzePdfBytes(pdfBuf);
  ok(pdfBuf.length > 2000, `PDF export bytes (${pdfBuf.length})`);
  ok((analysis.pageCount || 0) >= 1, `PDF page count (${analysis.pageCount})`);
  ok(layout?.sheetCount >= 0, 'A4 layout ran for PDF');

  const previewHtml = `<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${css}
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
  pdfPath: 'tests/output/creative-director/creative-director.pdf',
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-creative-director-template: PASS');
}
