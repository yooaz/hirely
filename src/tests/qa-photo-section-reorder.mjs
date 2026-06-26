#!/usr/bin/env node
/**
 * Pro features — profile photo + section reordering acceptance.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/photo-section-reorder');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

const PHOTO_DATA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC';

const SAMPLE_CV = {
  name: 'Camille Laurent',
  title: 'Creative Director',
  email: 'camille@example.com',
  phone: '+33 6 12 34 56 78',
  summary: 'Brand and design leader across luxury and culture.',
  experience: [
    'Creative Director — Maison Lumière — 2020–Present',
    'Art Director — Atelier Nord — 2016–2020',
  ],
  clients: ['Chanel', 'Hermès', 'Aesop'],
  projects: ['Brand system — Lumière', 'Campaign — Atelier Nord'],
  education: ['ENSAD Paris — Master Design'],
  skills: ['Creative direction', 'Brand strategy', 'Team leadership'],
  tools: ['Figma', 'After Effects', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  portfolioLinks: ['https://camille.example.com'],
};

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

function loadTemplates(getPhotoHtml) {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const proCode = fs.readFileSync(path.join(ROOT, 'src/ui/pro/pro-cv-features.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
  vm.runInContext(proCode, sandbox, { filename: 'pro-cv-features.js' });
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
        clients: 'Clients',
        projects: 'Projects',
      }[k] || k),
    cvBlock: (title, html) =>
      html ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>` : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: getPhotoHtml || (() => ''),
  });
  const state = {
    photo: PHOTO_DATA,
    includePhoto: true,
    photoCrop: { zoom: 1, x: 50, y: 50 },
    photoPerTemplate: { 'creative-director': true, 'ats-elite': false, 'editorial-magazine': true },
    template: 'creative-director',
    sectionOrder: [
      'skills',
      'experience',
      'summary',
      'clients',
      'projects',
      'education',
      'tools',
      'languages',
      'portfolio',
    ],
  };
  sandbox.initProCvFeatures({
    state,
    $: () => null,
    esc,
    requirePro: () => true,
    renderCV: () => {},
    resolveTemplateId: (id) => id,
    t: (k) => k,
  });
  return { HT: sandbox.HirelyTemplates, state, pro: sandbox.HirelyProCvFeatures };
}

function sectionOrder(html) {
  const re = /cvSection--([a-z0-9-]+)/gi;
  const order = [];
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (slug === 'leadership' || slug.includes('experience')) order.push('experience');
    else if (slug.includes('summary')) order.push('summary');
    else if (slug === 'software') order.push('tools');
    else if (
      ['summary', 'experience', 'clients', 'projects', 'education', 'skills', 'tools', 'languages', 'portfolio'].includes(
        slug
      )
    ) {
      order.push(slug);
    }
  }
  return order;
}

function countSections(html) {
  return (html.match(/<section class="cvSection/gi) || []).length;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const { HT, state, pro } = loadTemplates(() => {
  if (!pro.isPhotoActive(state, state.template)) return '';
  return `<div class="cvPhotoWrap"><img class="cvPhoto" src="${PHOTO_DATA}" alt=""></div>`;
});

ok(HT && typeof HT.render === 'function', 'HirelyTemplates boot');
ok(pro?.templateSupportsPhoto('creative-director'), 'creative-director supports photo');
ok(pro?.templateSupportsPhoto('editorial-magazine'), 'editorial-magazine supports photo');
ok(!pro.isPhotoActive({ ...state, template: 'ats-elite' }, 'ats-elite'), 'ATS Elite photo hidden by default');

state.template = 'creative-director';
const creativeHtml = HT.render({ ...SAMPLE_CV, sectionOrder: state.sectionOrder }, 'creative-director');
ok(creativeHtml.includes('cvPhoto'), 'photo visible in creative-director');
ok(creativeHtml.includes('Chanel'), 'creative template retains clients data');

state.template = 'ats-elite';
state.photoPerTemplate['ats-elite'] = false;
const atsHtml = HT.render(SAMPLE_CV, 'ats-elite');
ok(!atsHtml.includes('cvPhoto'), 'photo hidden in ATS when disabled');

const reorderedHtml = HT.render({ ...SAMPLE_CV, sectionOrder: state.sectionOrder }, 'ats-elite');
const order = sectionOrder(reorderedHtml);
const skillsIdx = order.indexOf('skills');
const expIdx = order.indexOf('experience');
ok(skillsIdx >= 0 && expIdx >= 0 && skillsIdx < expIdx, 'custom section order applied (skills before experience)');

const defaultHtml = HT.render(SAMPLE_CV, 'executive-luxury');
const defaultCount = countSections(defaultHtml);
const reorderedCount = countSections(
  HT.render({ ...SAMPLE_CV, sectionOrder: state.sectionOrder }, 'executive-luxury')
);
ok(defaultCount === reorderedCount, 'no section duplication after reorder');

state.template = 'editorial-magazine';
state.photoPerTemplate['editorial-magazine'] = true;
const editorialHtml = HT.render(
  { ...SAMPLE_CV, sectionOrder: state.sectionOrder },
  'editorial-magazine'
);
ok(editorialHtml.includes('cvPhoto'), 'photo visible in editorial-magazine when enabled');

const warn = pro.atsOrderWarning(state.sectionOrder);
ok(warn.includes('expérience avant les compétences'), 'ATS order warning when skills before experience');

async function pdfChecks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    state.template = 'creative-director';
    state.photoPerTemplate['creative-director'] = true;
    const inner = HT.render(
      { ...SAMPLE_CV, sectionOrder: state.sectionOrder },
      'creative-director'
    );
    const pdfPath = path.join(OUT_DIR, 'creative-with-photo.pdf');
    await exportCvPdfPlaywright(page, inner, 'creative-director', pdfPath, { withPhoto: true });
    ok(fs.existsSync(pdfPath), 'PDF export file created');
    const bytes = fs.readFileSync(pdfPath);
    const analysis = await analyzePdfBytes(bytes);
    ok(analysis.pageCount >= 1, 'PDF has at least one page');
    ok(bytes.length > 8000, 'PDF export non-trivial size (includes layout)');
  } finally {
    await browser.close();
  }
}

await pdfChecks();

const report = {
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  failed,
  checks: results,
};

fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
console.log('\nPhoto + section reorder QA:', failed === 0 ? 'PASS' : `FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
