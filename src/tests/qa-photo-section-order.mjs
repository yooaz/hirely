#!/usr/bin/env node
/**
 * P1 — Photo + section order system acceptance.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  PHOTO_SECTION_ORDER_VERSION,
  isSectionVisible,
  setSectionVisible,
  resolveVisibleSectionOrder,
} from '../ui/pro/section-order-system.mjs';
import {
  PHOTO_SYSTEM_V2,
  PHOTO_SUPPORTED_TEMPLATE_IDS,
  buildPhotoImgHtml,
  isPhotoActive,
  hidePhotoOnTemplate,
  removePhotoFromState,
  getPhotoHtmlFromState,
} from '../ui/pro/photo-system.mjs';
import { TEMPLATE_FAMILY_V2_IDS } from '../ui/templates/template-families-v2.mjs';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/photo-section-order');
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
};

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadEngine(getPhotoHtml) {
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
        clients: 'Clients',
        projects: 'Projects',
        profile: 'Profile',
      }[k] || k),
    cvBlock: (title, html) =>
      html ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>` : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: getPhotoHtml || (() => ''),
  });
  return sandbox.HirelyTemplates;
}

function sectionOrder(html) {
  const re = /cvSection--([a-z0-9-]+)/gi;
  const order = [];
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (slug.includes('experience') || slug === 'leadership') order.push('experience');
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

fs.mkdirSync(OUT_DIR, { recursive: true });

record('version', PHOTO_SECTION_ORDER_VERSION === 'PHOTO_SECTION_ORDER_V1');
record('photo_module', PHOTO_SYSTEM_V2 === 'PHOTO_SYSTEM_V2');

const photoHtml = buildPhotoImgHtml(PHOTO_DATA, { zoom: 1.4, x: 35, y: 65 });
record('photo_upload_markup', photoHtml.includes('cvPhoto') && photoHtml.includes(PHOTO_DATA));
record('photo_scale', photoHtml.includes('scale(1.4)'));
record('photo_reposition', photoHtml.includes('object-position:35% 65%'));

const state = {
  photo: PHOTO_DATA,
  includePhoto: true,
  photoCrop: { zoom: 1, x: 50, y: 50 },
  photoPerTemplate: { 'creative-director-portfolio': true },
  sectionOrder: ['skills', 'experience', 'summary', 'clients', 'projects', 'education', 'tools', 'languages', 'portfolio'],
  sectionHidden: {},
};

record('photo_active', isPhotoActive({ ...state, photoPerTemplate: { 'luxury-executive': true } }, 'luxury-executive'));
const hideState = { ...state, photoPerTemplate: { 'luxury-executive': true } };
hidePhotoOnTemplate(hideState, 'luxury-executive');
record('photo_hide', !hideState.includePhoto);
const removeState = { ...state };
removePhotoFromState(removeState);
record('photo_remove', !removeState.photo);

setSectionVisible(state, 'clients', false);
record('section_hide_state', state.sectionHidden.clients === true);
record('section_visible_api', !isSectionVisible(state, 'clients'));
const visibleOrder = resolveVisibleSectionOrder(state);
record('section_order_respects_hidden', !visibleOrder.includes('clients'));

const getPhoto = () =>
  getPhotoHtmlFromState(
    { photo: PHOTO_DATA, includePhoto: true, photoPerTemplate: { 'luxury-executive': true }, photoCrop: { zoom: 1.2, x: 40, y: 60 } },
    'luxury-executive'
  );
const HT = loadEngine(getPhoto);

const reordered = HT.render({ ...SAMPLE_CV, sectionOrder: state.sectionOrder, sectionHidden: state.sectionHidden }, 'ats-recruiter');
const order = sectionOrder(reordered);
record('section_reorder', order.indexOf('skills') < order.indexOf('experience'));
record('section_hidden_render', !reordered.includes('Chanel') && !reordered.includes('Hermès'));

const fullHtml = HT.render({ ...SAMPLE_CV, sectionOrder: state.sectionOrder, sectionHidden: {} }, 'classic-corporate');
const hiddenTools = HT.render({ ...SAMPLE_CV, sectionHidden: { tools: true } }, 'classic-corporate');
record('hide_tools', fullHtml.includes('Figma') && !hiddenTools.includes('Figma'));

const defaultCount = (fullHtml.match(/<section class="cvSection/gi) || []).length;
const hiddenCount = (hiddenTools.match(/<section class="cvSection/gi) || []).length;
record('no_section_duplication', hiddenCount <= defaultCount);

for (const id of ['creative-director-portfolio', 'luxury-executive', 'classic-corporate']) {
  const on = loadEngine(() => getPhotoHtmlFromState({ photo: PHOTO_DATA, includePhoto: true, photoPerTemplate: { [id]: true } }, id)).render(
    SAMPLE_CV,
    id
  );
  record(`photo_template_${id}`, on.includes('cvPhoto'));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  const pdfHtml = loadEngine(getPhoto).render(
    { ...SAMPLE_CV, sectionOrder: state.sectionOrder, sectionHidden: state.sectionHidden },
    'luxury-executive'
  );
  const pdfPath = path.join(OUT_DIR, 'with-photo.pdf');
  await exportCvPdfPlaywright(page, pdfHtml, 'luxury-executive', pdfPath);
  const bytes = fs.readFileSync(pdfPath);
  const analysis = await analyzePdfBytes(bytes);
  record('pdf_export', bytes.length > 800 && (analysis.pageCount || 0) >= 1);
  record('pdf_no_overflow_signal', bytes.length < 500000);
} finally {
  await browser.close();
}

record('v2_photo_support', TEMPLATE_FAMILY_V2_IDS.every((id) => PHOTO_SUPPORTED_TEMPLATE_IDS.includes(id)));

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
record('index_photo_wiring', indexHtml.includes('getPhotoHtml') && indexHtml.includes('photoEditorDialog'));
record('index_section_state', indexHtml.includes('sectionHidden') && indexHtml.includes('proCvSectionOrder'));

const report = {
  version: PHOTO_SECTION_ORDER_VERSION,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
};

fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
console.log(`\n═══ Photo + Section Order: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
