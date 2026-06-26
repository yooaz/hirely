#!/usr/bin/env node
/**
 * Art Director Portfolio — luxury portfolio document acceptance + PDF export.
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
const OUT_DIR = path.join(ROOT, 'tests/output/art-director-portfolio');
const TEMPLATE_ID = 'art-director-portfolio';

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Elena Marchetti',
    title: 'Art Director',
    email: 'elena@studio.example',
    phone: '+39 02 555 0101',
    location: 'Milan, Italy',
    portfolio: 'https://elenamarchetti.com',
  },
  summary:
    'Art director crafting luxury campaigns and editorial systems for fashion, culture, and technology brands.',
  experiences: [
    {
      role: 'Senior Art Director',
      company: 'Studio Marchetti',
      dates: '2018–Present',
      bullets: ['Led visual identity for global luxury and sport campaigns.'],
    },
    {
      role: 'Art Director',
      company: 'Wieden+Kennedy',
      dates: '2013–2018',
      bullets: ['Campaign art direction for Nike and Apple launches.'],
    },
  ],
  education: ['IED Milano — MA Visual Communication'],
  clients: ['Gucci', 'Nike', 'Apple', 'Vogue Italia'],
  projects: [
    'Luxury Campaign System — Gucci · 2024',
    'Global Sport Launch — Nike · 2023',
    'Editorial Identity — Vogue Italia · 2022',
  ],
  awards: ['Cannes Lions — Gold Craft · 2023', 'D&AD Pencil — Branding · 2021'],
  publications: ['Wallpaper* — Milan creative scene · 2024'],
  press: ['It\'s Nice That — Studio profile · 2023'],
  portfolioLinks: [
    'https://behance.net/elenamarchetti',
    'https://instagram.com/elenamarchetti',
    'https://dribbble.com/elenamarchetti',
    'https://elenamarchetti.com',
  ],
  unsorted: [],
  meta: {},
};

const REQUIRED_SECTIONS = ['clients', 'projects', 'awards', 'press', 'experience', 'education', 'portfolio'];
const SECTION_ORDER = ['clients', 'projects', 'awards', 'press', 'experience', 'education', 'portfolio'];
const FORBIDDEN = ['cvClientChip', 'cvSkillChip', 'cvProgress', 'cvPhoto'];

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
  const map = {
    'clients-director': 'clients',
    'projects-director': 'projects',
    'adp-links': 'portfolio',
  };
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1];
    const slug = map[raw] || raw;
    if (!order.includes(slug) && REQUIRED_SECTIONS.includes(slug)) {
      order.push(slug);
    }
  }
  return order;
}

requireImportStabilityForTemplates(ROOT);

const HT = loadTemplates();
ok(HT.resolve(TEMPLATE_ID).id === TEMPLATE_ID, 'resolve art-director-portfolio id');
ok(HT.resolve(TEMPLATE_ID).name === 'Art Director Portfolio', 'Art Director Portfolio display name');
ok(HT.ALIASES.artdirector === 'art-director-portfolio', 'artdirector alias');
ok(HT.ALIASES['art-director'] === 'art-director-portfolio', 'art-director alias');

const v2 = resolveTemplateV2(TEMPLATE_ID);
ok(v2.id === 'art-director-portfolio', 'V2 registry resolves art-director-portfolio');
ok(v2.renderLayerId === 'art-director-portfolio', 'V2 render layer is art-director-portfolio');

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const html = HT.render(view, TEMPLATE_ID);
const text = stripHtml(html);

ok(html.includes('cvHead--art-director-portfolio'), 'hero header');
ok(html.includes('cvAdpHero'), 'hero section');
ok(html.includes('cvMain--art-director-portfolio'), 'portfolio main');
ok(html.includes('Selected Clients'), 'selected clients title');
ok(html.includes('Selected Projects'), 'selected projects title');
ok(html.includes('cvDirectorClientGrid'), 'client grid');
ok(html.includes('cvDirectorProject'), 'project highlights');
ok(html.includes('cvSection--awards'), 'awards section');
ok(html.includes('cvSection--press'), 'press section');
ok(html.includes('cvAdpAward'), 'award entries');
ok(html.includes('cvAdpPress'), 'press entries');
ok(html.includes('cvSection--adp-links'), 'portfolio links section');
ok(html.includes('cvAdpLinkRow'), 'portfolio link rows');
ok(html.includes('cvAdpLinkLabel'), 'portfolio link labels');
ok(text.includes('Elena Marchetti'), 'renders name');
ok(text.includes('Art Director'), 'renders title');
ok(text.includes('Gucci'), 'renders client');
ok(text.includes('Luxury Campaign System'), 'renders project');
ok(text.includes('Cannes Lions'), 'renders award');
ok(text.includes('Wallpaper'), 'renders publication');
ok(text.includes('Nice That'), 'renders press');
ok(text.includes('Wieden+Kennedy'), 'renders experience');
ok(text.includes('IED Milano'), 'renders education');
ok(text.includes('Behance'), 'renders Behance label');
ok(text.includes('Instagram'), 'renders Instagram label');
ok(text.includes('Dribbble'), 'renders Dribbble label');
ok(text.includes('Website'), 'renders Website label');
ok(!html.includes('cvSection--skills'), 'no skills section (portfolio doc)');
ok(!html.includes('cvSection--tools'), 'no tools section (portfolio doc)');

for (const marker of FORBIDDEN) ok(!html.includes(marker), `no ${marker}`);

const order = sectionOrder(html);
for (const sec of REQUIRED_SECTIONS) {
  ok(order.includes(sec), `section present: ${sec}`);
}
ok(order.join(',') === SECTION_ORDER.join(','), `section order: ${order.join(' → ')}`);

const css = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-art-director-portfolio.css'), 'utf8');
ok(css.includes('cvAdpHero'), 'hero CSS');
ok(css.includes('Instrument Serif'), 'luxury display font');
ok(css.includes('#8b7355'), 'bronze accent');
ok(css.includes('cvAdpLinkRow'), 'portfolio link styles');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(indexHtml.includes('cv-templates-art-director-portfolio.css'), 'index links stylesheet');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'render.html'), html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(OUT_DIR, 'art-director-portfolio.pdf');

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
  console.log('\nqa-art-director-portfolio-template: PASS');
}
