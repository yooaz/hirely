#!/usr/bin/env node
/**
 * Executive Luxury — premium leadership template acceptance + PDF export.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/executive-luxury');
const TEMPLATE_ID = 'executive-luxury';

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Sarah Mitchell',
    title: 'Managing Director',
    email: 'sarah.mitchell@example.com',
    phone: '+1 212 555 0142',
    location: 'New York, NY',
  },
  summary:
    'Operating executive with 18 years leading strategy, P&L, and global teams across financial services and hospitality.',
  experiences: [
    {
      role: 'Managing Director',
      company: 'Goldman Sachs',
      dates: '2019–Present',
      revenue: '$420M annual revenue portfolio',
      teamSize: '140-person global team',
      result: '32% YoY growth in advisory revenue',
      achievement: 'Promoted to MD after turnaround of underperforming division',
      bullets: [
        'Led cross-border M&A advisory for Fortune 100 clients.',
        'Built operating model reducing deal cycle time by 24%.',
      ],
    },
    {
      role: 'Partner',
      company: 'McKinsey & Company',
      dates: '2012–2019',
      revenue: '$85M client impact',
      teamSize: '22 consultants',
      result: '18% margin improvement',
      achievement: 'Launched hospitality practice vertical',
      bullets: ['Advised C-suite on portfolio strategy and cost transformation.'],
    },
  ],
  education: ['Harvard Business School — MBA', 'Yale University — BA Economics'],
  skills: ['P&L ownership', 'Corporate strategy', 'M&A', 'Board communication'],
  languages: ['English — native', 'French — professional'],
  achievements: [
    'Named Top 40 Under 40 in Financial Services — 2021',
    'Led $2.1B hospitality merger integration — 2023',
  ],
  clients: ['Should not appear'],
  projects: ['Should not appear'],
  unsorted: [],
  meta: {},
};

const SECTION_ORDER = ['summary', 'experience', 'achievements', 'education', 'skills', 'languages'];
const FORBIDDEN = ['cvClientChip', 'cvSkillChip', 'cvSection--clients', 'cvSection--projects'];

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
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
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
  while ((m = re.exec(html))) {
    const slug = m[1].replace(/-executive-summary$/, 'summary').replace(/-leadership$/, 'experience');
    if (!order.includes(slug) && SECTION_ORDER.includes(slug)) order.push(slug);
  }
  return order;
}

requireImportStabilityForTemplates(ROOT);

const HT = loadTemplates();
ok(HT.resolve(TEMPLATE_ID).id === TEMPLATE_ID, 'resolve executive-luxury id');
ok(HT.resolve(TEMPLATE_ID).name === 'Executive Luxury', 'Executive Luxury display name');
ok(HT.ALIASES['executive-luxury'] === 'executive-luxury', 'alias maps to executive-luxury');

const v2 = resolveTemplateV2(TEMPLATE_ID);
ok(v2.id === 'executive-luxury', 'V2 registry resolves executive-luxury');

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const html = HT.render(view, TEMPLATE_ID);
const text = stripHtml(html);

ok(html.includes('cvHead--executive-luxury'), 'executive luxury header');
ok(html.includes('Executive Summary'), 'executive summary title');
ok(html.includes('Leadership Experience'), 'leadership experience title');
ok(html.includes('Achievements'), 'achievements section');
ok(html.includes('cvLuxuryImpact'), 'impact metrics row');
ok(html.includes('cvLuxuryImpactLabel'), 'impact labels');
ok(text.includes('Sarah Mitchell'), 'renders name');
ok(text.includes('Managing Director'), 'renders title');
ok(text.includes('Goldman Sachs'), 'renders leadership role');
ok(text.includes('McKinsey'), 'renders leadership role 2');
ok(text.includes('420M'), 'renders revenue impact');
ok(text.includes('140-person'), 'renders team size');
ok(text.includes('32%'), 'renders result');
ok(text.includes('Top 40 Under 40'), 'renders achievements');
ok(text.includes('Harvard'), 'renders education');
ok(text.includes('P&L ownership'), 'renders skills');
ok(text.includes('French'), 'renders languages');
ok(!text.includes('Should not appear'), 'no clients/projects');

for (const marker of FORBIDDEN) ok(!html.includes(marker), `no ${marker}`);

const order = sectionOrder(html);
ok(order.join(',') === SECTION_ORDER.join(','), `section order: ${order.join(' → ')}`);

const css = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-executive-luxury.css'), 'utf8');
ok(css.includes('cvLuxuryImpact'), 'impact grid CSS');
ok(css.includes('Source Serif 4'), 'elegant heading font');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(indexHtml.includes('cv-templates-executive-luxury.css'), 'index links stylesheet');
ok(indexHtml.includes("'executive-luxury'"), 'index features executive-luxury');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'render.html'), html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(OUT_DIR, 'executive-luxury.pdf');

try {
  const layout = await exportCvPdfPlaywright(page, html, TEMPLATE_ID, pdfPath);
  const pdfBuf = fs.readFileSync(pdfPath);
  const analysis = await analyzePdfBytes(pdfBuf);
  ok(pdfBuf.length > 2000, `PDF export bytes (${pdfBuf.length})`);
  ok((analysis.pageCount || 0) >= 1, `PDF page count (${analysis.pageCount})`);
  ok(layout?.sheetCount >= 0, 'A4 layout ran');
} catch (e) {
  ok(false, `PDF export: ${e?.message || e}`);
}

await browser.close();

fs.writeFileSync(
  path.join(OUT_DIR, 'report.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), templateId: TEMPLATE_ID, checks: results, sectionOrder: order, pass: failed === 0 }, null, 2)
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-executive-luxury-template: PASS');
}
