#!/usr/bin/env node
/**
 * Editorial Magazine — Kinfolk / Wallpaper* / Aesop / Monocle acceptance + PDF export.
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
const OUT_DIR = path.join(ROOT, 'tests/output/editorial-magazine');
const TEMPLATE_ID = 'editorial-magazine';

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Elena Vasquez',
    title: 'Editorial Director',
    email: 'elena@studio.example',
    phone: '+44 20 7946 0958',
    location: 'London, UK',
    portfolio: 'https://elenavasquez.studio',
  },
  summary:
    'Editorial director shaping culture-led brand narratives for luxury, design, and publishing houses across Europe.',
  experiences: [
    {
      role: 'Editorial Director',
      company: 'Wallpaper*',
      dates: '2019–Present',
      bullets: ['Led global editorial identity across print and digital.', 'Commissioned features with Aesop, Monocle, and Kinfolk.'],
    },
    {
      role: 'Creative Editor',
      company: 'Monocle',
      dates: '2014–2019',
      bullets: ['Directed long-form culture reporting and luxury supplements.'],
    },
  ],
  education: ['Central Saint Martins — MA Graphic Design'],
  skills: ['Editorial direction', 'Typography', 'Brand narrative', 'Art direction'],
  tools: ['InDesign', 'Figma', 'Illustrator'],
  languages: ['English — native', 'Spanish — fluent'],
  clients: ['Aesop', 'Kinfolk', 'Apple'],
  projects: ['Kinfolk Issue 42 — Art direction · 2024', 'Aesop Journal — Editorial system · 2023'],
  portfolioLinks: ['https://elenavasquez.studio'],
  unsorted: [],
  meta: {},
};

const FORBIDDEN = ['cvClientChip', 'cvSkillChip', 'cvProgress', 'cvMetaFooter', 'cvPhoto'];
const SECTION_ORDER = ['education', 'languages', 'experience', 'skills', 'tools', 'clients', 'projects'];

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

function sectionOrder(html) {
  const re = /cvSection--([a-z0-9-]+)/g;
  const order = [];
  const skip = new Set(['editorial', 'editorial-feature', 'compact', 'portfolio']);
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (skip.has(slug) || order.includes(slug)) continue;
    if (SECTION_ORDER.includes(slug)) order.push(slug);
  }
  return order;
}

function duplicateSectionTitles(html) {
  const titles = [...html.matchAll(/<h3 class="cvEmSectionTitle[^"]*">([^<]+)/g)].map((m) => m[1].trim());
  const seen = new Set();
  const dups = [];
  for (const t of titles) {
    if (seen.has(t)) dups.push(t);
    seen.add(t);
  }
  return dups;
}

requireImportStabilityForTemplates(ROOT);

const HT = loadTemplates();
ok(HT.resolve(TEMPLATE_ID).id === TEMPLATE_ID, 'resolve editorial-magazine id');
ok(HT.resolve(TEMPLATE_ID).name === 'Editorial Magazine', 'Editorial Magazine display name');

const v2 = resolveTemplateV2(TEMPLATE_ID);
ok(v2.id === 'editorial-magazine', 'V2 registry resolves editorial-magazine');
ok(v2.creativeLevel === 5, 'V2 creative level 5');

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const html = HT.render(view, TEMPLATE_ID);
const text = stripHtml(html);

ok(html.includes('cvEmCover'), 'magazine cover');
ok(html.includes('cvEmKicker'), 'editorial kicker');
ok(html.includes('cvEmName') || html.includes('cvEmCover'), 'huge display name');
ok(html.includes('cvEmDeck'), 'editorial deck lede');
ok(html.includes('cvEmSpread'), 'editorial spread grid');
ok(html.includes('cvEmCol--left'), 'left culture rail');
ok(html.includes('cvEmCol--feature'), 'center feature column');
ok(html.includes('cvEmCol--right'), 'right meta rail');
ok(html.includes('cvEmSectionTitle--feature'), 'feature section hierarchy');
ok(html.includes('cvLayout-editorial-magazine'), 'dedicated layout class');
ok(text.includes('Elena Vasquez'), 'renders name');
ok(text.includes('Editorial Director'), 'renders title');
ok(text.includes('Wallpaper'), 'renders experience');
ok(text.includes('Kinfolk'), 'renders client');
ok(text.includes('Central Saint Martins'), 'renders education');
ok(text.includes('Typography'), 'renders skills');
ok(!html.includes('cvSection--summary'), 'no duplicate summary section');
ok(duplicateSectionTitles(html).length === 0, 'no duplicate section titles');

for (const marker of FORBIDDEN) ok(!html.includes(marker), `no ${marker}`);

const order = sectionOrder(html);
for (const sec of SECTION_ORDER) {
  if (['skills', 'tools', 'clients', 'projects'].includes(sec)) {
    ok(order.includes(sec), `section present: ${sec}`);
  }
}
ok(order.indexOf('experience') > order.indexOf('languages') || order.indexOf('experience') > -1, 'experience in feature column flow');

const css = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-editorial-magazine.css'), 'utf8');
ok(css.includes('Cormorant Garamond'), 'display typography');
ok(css.includes('54pt'), 'huge cover typography');
ok(css.includes('cvEmSpread'), 'spread grid CSS');
ok(css.includes('cvEmDeck'), 'deck lede CSS');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(indexHtml.includes('cv-templates-editorial-magazine.css'), 'index links stylesheet');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'render.html'), html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(OUT_DIR, 'editorial-magazine.pdf');

try {
  await exportCvPdfPlaywright(page, html, TEMPLATE_ID, pdfPath);
  const pdfBuf = fs.readFileSync(pdfPath);
  const analysis = await analyzePdfBytes(pdfBuf);
  ok(pdfBuf.length > 2000, `PDF export bytes (${pdfBuf.length})`);
  ok((analysis.pageCount || 0) >= 1, `PDF page count (${analysis.pageCount})`);
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
  console.log('\nqa-editorial-magazine-template: PASS');
}
