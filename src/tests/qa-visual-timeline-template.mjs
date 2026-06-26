#!/usr/bin/env node
/**
 * Visual Timeline — premium vertical career timeline acceptance + PDF export.
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
const OUT_DIR = path.join(ROOT, 'tests/output/visual-timeline');
const TEMPLATE_ID = 'visual-timeline';

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Marcus Chen',
    title: 'Product Design Lead',
    email: 'marcus@example.com',
    phone: '+1 408 555 0101',
    location: 'Cupertino, CA',
  },
  summary: 'Design leader building keynote-quality product experiences for global technology brands.',
  experiences: [
    {
      role: 'Product Design Lead',
      company: 'Apple',
      dates: '2019–Present',
      bullets: ['Led vision prototypes for flagship hardware launches.', 'Scaled design system to 40+ product teams.'],
    },
    {
      role: 'Senior Designer',
      company: 'Adobe',
      dates: '2015–2019',
      bullets: ['Shipped Creative Cloud onboarding used by 12M users.'],
    },
  ],
  education: ['Stanford University — MS Design'],
  skills: ['Product design', 'Design systems', 'Keynote storytelling'],
  tools: ['Figma', 'Keynote', 'After Effects'],
  languages: ['English — native', 'Mandarin — fluent'],
  clients: ['Nike', 'Adobe', 'Apple'],
  projects: ['Vision Pro launch narrative — 2024', 'Creative Cloud redesign — 2018'],
  unsorted: [],
  meta: {},
};

const FORBIDDEN = ['cvSkillChip', 'cvClientChip', 'cvProgress', 'cvPhoto'];

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

requireImportStabilityForTemplates(ROOT);

const HT = loadTemplates();
ok(HT.resolve(TEMPLATE_ID).id === TEMPLATE_ID, 'resolve visual-timeline id');
ok(HT.resolve(TEMPLATE_ID).name === 'Visual Timeline', 'Visual Timeline display name');
ok(HT.ALIASES.timeline === 'visual-timeline', 'timeline alias');

const v2 = resolveTemplateV2(TEMPLATE_ID);
ok(v2.id === 'visual-timeline', 'V2 registry resolves visual-timeline');

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const html = HT.render(view, TEMPLATE_ID);
const text = stripHtml(html);

ok(html.includes('cvHead--visual-timeline'), 'visual timeline header');
ok(html.includes('Career Timeline'), 'career timeline title');
ok(html.includes('cvVtRail'), 'vertical timeline rail');
ok(html.includes('cvVtNode'), 'timeline nodes');
ok(html.includes('cvVtRole'), 'role per position');
ok(html.includes('cvVtCompany'), 'company per position');
ok(html.includes('cvVtYears'), 'years per position');
ok(html.includes('cvVtHighlights'), 'highlights per position');
ok(html.includes('Connected Work'), 'connected work section');
ok(html.includes('cvVtBranch'), 'visual branches');
ok(html.includes('cvVtBranchConnector'), 'branch connectors');
ok(text.includes('Marcus Chen'), 'renders name');
ok(text.includes('Apple'), 'renders timeline company');
ok(text.includes('Adobe'), 'renders timeline company 2');
ok(text.includes('Nike'), 'renders connected client');
ok(text.includes('Vision Pro'), 'renders connected project');
ok(text.includes('Product design'), 'renders skills');

for (const marker of FORBIDDEN) ok(!html.includes(marker), `no ${marker}`);

const css = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-visual-timeline.css'), 'utf8');
ok(css.includes('cvVtRail'), 'timeline rail CSS');
ok(css.includes('#0071e3'), 'Apple-style accent');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(indexHtml.includes('cv-templates-visual-timeline.css'), 'index links stylesheet');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'render.html'), html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(OUT_DIR, 'visual-timeline.pdf');

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
  console.log('\nqa-visual-timeline-template: PASS');
}
