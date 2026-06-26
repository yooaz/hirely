#!/usr/bin/env node
/**
 * QA — P2 Photo System
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  PHOTO_SYSTEM_V2,
  PHOTO_SUPPORTED_TEMPLATE_IDS,
  PHOTO_HIDDEN_BY_DEFAULT_IDS,
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

const PHOTO_DATA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC';

const SAMPLE = {
  name: 'Camille Laurent',
  title: 'Creative Director',
  email: 'camille@example.com',
  experience: ['Creative Director — Studio — 2020–Present'],
  skills: ['Brand', 'Design'],
};

let pass = 0;
let fail = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
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
    sectionLabel: (k) => k,
    cvBlock: (t, h) => (h ? `<section>${t}${h}</section>` : ''),
    cvSkillsHtml: (s) => `<p>${s.join(' · ')}</p>`,
    getPhotoHtml: getPhotoHtml || (() => ''),
  });
  return sandbox.HirelyTemplates;
}

const state = {
  photo: PHOTO_DATA,
  includePhoto: true,
  photoCrop: { zoom: 1.2, x: 40, y: 60 },
  photoPerTemplate: {},
  template: 'kinfolk-editorial',
};

assert('version', PHOTO_SYSTEM_V2 === 'PHOTO_SYSTEM_V2');
assert('v2 templates supported', TEMPLATE_FAMILY_V2_IDS.every((id) => PHOTO_SUPPORTED_TEMPLATE_IDS.includes(id)));

const htmlOn = buildPhotoImgHtml(PHOTO_DATA, { zoom: 1.5, x: 30, y: 70 });
assert('upload markup', htmlOn.includes('cvPhotoWrap--safe') && htmlOn.includes(PHOTO_DATA));
assert('no transform scale in markup', !htmlOn.includes('transform:scale'));
assert('position in style', htmlOn.includes('object-position:30% 70%'));

assert('photo active kinfolk', isPhotoActive({ ...state, photoPerTemplate: { 'kinfolk-editorial': true } }, 'kinfolk-editorial'));
assert('photo hidden ats default', !isPhotoActive({ ...state, template: 'ats-recruiter' }, 'ats-recruiter'));
assert('hidden by default list', PHOTO_HIDDEN_BY_DEFAULT_IDS.includes('ats-recruiter'));

const hideState = { ...state, photoPerTemplate: { 'kinfolk-editorial': true } };
hidePhotoOnTemplate(hideState, 'kinfolk-editorial');
assert('hide photo', !hideState.includePhoto && hideState.photoPerTemplate['kinfolk-editorial'] === false);

const removeState = { ...state };
removePhotoFromState(removeState);
assert('remove photo', !removeState.photo && !removeState.includePhoto);

const getPhoto = () => getPhotoHtmlFromState({ ...state, photoPerTemplate: { 'luxury-executive': true }, includePhoto: true }, 'luxury-executive');
const HT = loadEngine(getPhoto);

for (const id of TEMPLATE_FAMILY_V2_IDS) {
  const onState = { photo: PHOTO_DATA, includePhoto: true, photoPerTemplate: { [id]: true }, photoCrop: { zoom: 1, x: 50, y: 50 } };
  const onHtml = HT.render(SAMPLE, id);
  const withPhoto = loadEngine(() => getPhotoHtmlFromState(onState, id));
  const onHtml2 = withPhoto.render(SAMPLE, id);
  assert(`photo on ${id}`, onHtml2.includes('cvPhoto'));
  const offHtml = withPhoto.render(SAMPLE, id);
  hidePhotoOnTemplate(onState, id);
  const offHtml2 = loadEngine(() => getPhotoHtmlFromState(onState, id)).render(SAMPLE, id);
  assert(`photo off ${id}`, !offHtml2.includes('cvPhoto'));
}

const pdfHtml = loadEngine(getPhoto).render(SAMPLE, 'luxury-executive');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pdfPath = path.join(ROOT, 'tests/output/photo-system/export.pdf');
fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
try {
  await exportCvPdfPlaywright(page, pdfHtml, 'luxury-executive', pdfPath);
  const bytes = fs.readFileSync(pdfPath);
  const analysis = await analyzePdfBytes(bytes);
  assert('pdf export bytes', bytes.length > 800);
  assert('pdf pages', analysis.pageCount >= 1);
} finally {
  await browser.close();
}

console.log(`\nqa-photo-system: ${fail === 0 ? 'PASS' : 'FAIL'} (${pass} pass / ${fail} fail)`);
process.exit(fail > 0 ? 1 : 0);
