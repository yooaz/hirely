#!/usr/bin/env node
/**
 * Swiss Editorial — premium grid editorial template acceptance + PDF export.
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
const OUT_DIR = path.join(ROOT, 'tests/output/swiss-editorial');
const TEMPLATE_ID = 'swiss-editorial';

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Elena Vogel',
    title: 'Strategy Consultant',
    email: 'elena.vogel@example.com',
    phone: '+41 44 555 0198',
    location: 'Zürich, Switzerland',
  },
  summary:
    'Consultant and editor specializing in corporate strategy, editorial systems, and international brand communications.',
  experiences: [
    {
      role: 'Senior Consultant',
      company: 'BCG',
      dates: '2018–Present',
      bullets: ['Led transformation programs for European financial institutions.'],
    },
    {
      role: 'Editorial Strategist',
      company: 'Monocle',
      dates: '2014–2018',
      bullets: ['Directed print and digital editorial frameworks for global markets.'],
    },
  ],
  education: ['University of St. Gallens — MA Strategy'],
  skills: ['Corporate strategy', 'Editorial design', 'Stakeholder management'],
  tools: ['Excel', 'PowerPoint', 'Figma'],
  languages: ['German — native', 'English — fluent', 'French — professional'],
  clients: ['Should not appear'],
  projects: ['Should not appear'],
  unsorted: [],
  meta: {},
};

const FORBIDDEN = [
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
    .replace(/&amp;/g, '&')
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

requireImportStabilityForTemplates(ROOT);

const HT = loadTemplates();
ok(HT.resolve(TEMPLATE_ID).id === TEMPLATE_ID, 'resolve swiss-editorial id');
ok(HT.resolve(TEMPLATE_ID).name === 'Swiss Editorial', 'Swiss Editorial display name');
ok(HT.ALIASES['swiss-editorial'] === 'swiss-editorial', 'alias maps to swiss-editorial');
ok(HT.ALIASES.swiss === 'swiss-editorial', 'swiss alias maps to swiss-editorial');

const v2 = resolveTemplateV2(TEMPLATE_ID);
ok(v2.id === 'swiss-editorial', 'V2 registry resolves swiss-editorial');
ok(v2.renderLayerId === 'swiss-editorial', 'V2 render layer is swiss-editorial');

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const html = HT.render(view, TEMPLATE_ID);
const text = stripHtml(html);

ok(html.includes('cvHead--swiss-editorial'), 'swiss editorial header');
ok(html.includes('cvSwissMasthead'), 'masthead grid');
ok(html.includes('cvSwissGrid'), 'editorial body grid');
ok(html.includes('cvSwissCol--main'), 'main column');
ok(html.includes('cvSwissCol--side'), 'sidebar column');
ok(text.includes('Elena Vogel'), 'renders name');
ok(text.includes('Strategy Consultant'), 'renders title');
ok(text.includes('BCG'), 'renders experience');
ok(text.includes('Monocle'), 'renders experience 2');
ok(text.includes('Corporate strategy'), 'renders skills');
ok(text.includes('Excel'), 'renders tools');
ok(text.includes('German'), 'renders languages');
ok(text.includes('St. Gallens'), 'renders education');
ok(!text.includes('Should not appear'), 'no clients/projects');

for (const marker of FORBIDDEN) ok(!html.includes(marker), `no gimmick: ${marker}`);

const css = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-swiss-editorial.css'), 'utf8');
ok(css.includes('cvSwissGrid'), 'grid CSS');
ok(css.includes('IBM Plex Sans'), 'strong typography stack');
ok(css.includes('display: none !important'), 'gimmicks hidden');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(indexHtml.includes('cv-templates-swiss-editorial.css'), 'index links stylesheet');
ok(indexHtml.includes("'swiss-editorial'"), 'index features swiss-editorial');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'render.html'), html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(OUT_DIR, 'swiss-editorial.pdf');

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
  JSON.stringify({ generatedAt: new Date().toISOString(), templateId: TEMPLATE_ID, checks: results, pass: failed === 0 }, null, 2)
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-swiss-editorial-template: PASS');
}
