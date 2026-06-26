#!/usr/bin/env node
/**
 * P1 — Real premium templates acceptance.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import {
  PREMIUM_TEMPLATE_BRIEFS,
  PREMIUM_TEMPLATE_NAMES,
  TEMPLATE_SYSTEM_PREMIUM,
} from '../ui/templates/template-system-premium.mjs';
import { H20_TEMPLATE_FINGERPRINTS } from '../ui/templates/template-system-h20.mjs';
import { scoreAllTemplatesLock } from '../ui/templates/template-completeness.js';
import { normalizeCvDataForTemplate, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/real-premium-templates/report.json');

const RICH_FINAL_RESUME = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Lead Illustrator',
    email: 'yohann@example.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris, France',
  },
  summary:
    'Senior illustrator and art director with fifteen years across luxury, entertainment, and technology clients worldwide.',
  experiences: [
    { role: 'Lead Illustrator', company: 'McCann Paris', dates: '2018–Present' },
    { role: 'Freelance', company: 'Nike, Apple', dates: '2012–2018' },
  ],
  education: [{ degree: 'MA Illustration', school: 'ENSAD', dates: '2010' }],
  skills: ['Illustration', 'Branding', 'Art direction', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Apple', 'Louis Vuitton'],
  projects: ['Brand campaign — 2024', 'Editorial series — Vogue'],
};

const REQUIRED_NAMES = [
  'ATS Clean',
  'Creative Portfolio',
  'Executive Minimal',
  'Tech Resume',
  'Editorial Modern',
];

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function loadTemplates() {
  const code = read('src/ui/templates/cv-templates.js');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
        profile: 'Profile',
      }[k] || k),
    cvBlock: (title, html) =>
      html
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills, chips) =>
      chips
        ? skills.map((s) => `<span class="cvChip">${esc(s)}</span>`).join('')
        : `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function mapFinalResumeToCvDataLike(frd) {
  const shaped = {
    identity: { ...(frd.identity || {}) },
    summary: String(frd.summary || '').trim(),
    experiences: Array.isArray(frd.experiences) ? frd.experiences : [],
    education: Array.isArray(frd.education) ? frd.education : [],
    skills: Array.isArray(frd.skills) ? frd.skills : [],
    tools: Array.isArray(frd.tools) ? frd.tools : [],
    languages: Array.isArray(frd.languages) ? frd.languages : [],
    clients: Array.isArray(frd.clients) ? frd.clients : [],
    projects: Array.isArray(frd.projects) ? frd.projects : [],
    unsorted: [],
    meta: {},
  };
  return normalizeCvDataForTemplate({
    ...resumeDataToCvData(shaped, { skipNormalize: true }),
    _fromFinalResumeData: true,
  });
}

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

check('five production templates', PRODUCTION_TEMPLATE_IDS.length === 5);
for (const name of REQUIRED_NAMES) {
  check(`premium lineup includes ${name}`, PREMIUM_TEMPLATE_NAMES.includes(name));
}

const tplSrc = read('src/ui/templates/cv-templates.js');
for (const name of REQUIRED_NAMES) {
  check(`cv-templates defines ${name}`, tplSrc.includes(`name: '${name}'`));
}

check('no parser stage imports in templates', !/from ['"].*parsing/.test(tplSrc));
check('production hides toClassify sections', tplSrc.includes('if (productionTemplateMode()) return \'\';'));
check('render uses finalResume flag', tplSrc.includes('_fromFinalResumeData'));

const h20 = read('src/ui/templates/cv-templates-h20.css');
const pdf = read('src/ui/templates/cv-pdf-export.css');
const index = read('index.html');

check('IBM Plex font loaded', /IBM\+Plex\+Sans/.test(index));
check('Playfair font loaded', /Playfair\+Display/.test(index));
check('JetBrains Mono font loaded', /JetBrains\+Mono/.test(index));
check('creative client chips css', h20.includes('cvClientChip'));
check('tech dark rail css', /--h20-rail:\s*#0f172a/.test(h20));
check('pdf overflow visible', pdf.includes('overflow: visible'));
check('pdf per-template grids', pdf.includes('cvTpl-h20-editorial'));

const grids = new Set(Object.values(H20_TEMPLATE_FINGERPRINTS).map((f) => f.grid));
check('five unique layout grids', grids.size === 5, [...grids].join(' | '));

const T = loadTemplates();
const cv = mapFinalResumeToCvDataLike(RICH_FINAL_RESUME);
const renders = {};
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const html = T.render(cv, id);
  renders[id] = html;
  check(`${id} renders premium html`, html.length > 400);
  check(`${id} has h20 skin class`, html.includes(`cvTpl-h20-${id}`));
  check(`${id} no parser pending UI`, !html.includes('cvSection--pending'));
  check(`${id} no hidden overflow in markup`, !/overflow:\s*hidden/i.test(html));
}

const lock = scoreAllTemplatesLock(renders, RICH_FINAL_RESUME);
for (const id of PRODUCTION_TEMPLATE_IDS) {
  check(`${id} content visibility 100%`, lock.templates[id]?.pass === true);
}

check('creative big-name + client chips', /cvClientChip/.test(renders.creative));
check('tech skills sidebar sections', /cvSection--skills/.test(renders['modern-two-column']));
check('editorial asymmetric body', /cvBody--editorial/.test(renders.editorial));
check('executive centered head', /cvHead--executive-minimal/.test(renders['executive-minimal']));
check('ats recruiter layout', /cvLayout-h20-ats/.test(renders.ats));

const pass = checks.every((c) => c.ok);
const report = {
  version: TEMPLATE_SYSTEM_PREMIUM,
  pass,
  verdict: pass ? 'PASS' : 'FAIL',
  templates: PRODUCTION_TEMPLATE_IDS.map((id) => ({
    id,
    ...PREMIUM_TEMPLATE_BRIEFS[id],
    visibilityScore: lock.templates[id]?.score ?? 0,
    visibilityPass: lock.templates[id]?.pass ?? false,
  })),
  checks,
  auditedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(pass ? '\nPASS real-premium-templates' : '\nFAIL real-premium-templates');
process.exit(pass ? 0 : 1);
