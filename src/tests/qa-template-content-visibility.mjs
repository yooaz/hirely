#!/usr/bin/env node
/**
 * HIRELY P0 — Template content visibility (production normalize path + all templates).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import {
  LOCK_SECTIONS,
  countSourceSections,
  scoreAllTemplatesLock,
  scoreTemplateCompletenessLock,
} from '../ui/templates/template-completeness.js';
import { normalizeCvDataForTemplate, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/template-content-visibility/report.json');

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

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
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
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

/** Mirrors index.html mapFinalResumeToCvData → normalizeCvData production path. */
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

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const source = countSourceSections(RICH_FINAL_RESUME);
const productionCv = mapFinalResumeToCvDataLike(RICH_FINAL_RESUME);

ok(productionCv._fromFinalResumeData === true, 'normalize preserves _fromFinalResumeData');
ok((productionCv.experience || []).length >= 2, 'production cvData keeps experiences');
ok((productionCv.clients || []).length >= 3, 'production cvData keeps clients');
ok((productionCv.education || []).length >= 1, 'production cvData keeps education');

const T = loadTemplates();
const switchRenders = {};
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const html = T.render(productionCv, id);
  switchRenders[id] = html;
  ok(html && html.length > 400, `${id} renders from production-normalized cvData`);
}

const batch = scoreAllTemplatesLock(switchRenders, RICH_FINAL_RESUME);
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const r = batch.templates[id];
  ok(r.pass, `${id} visibility lock ${r.score}%`);
}

const editorialHtml = switchRenders['editorial-magazine'] || T.render(productionCv, 'editorial') || '';
ok(/cvSection--experience/.test(editorialHtml), 'editorial shows experience section');
ok(/McCann Paris|Lead Illustrator/.test(editorialHtml), 'editorial shows experience content');
ok(/cvSection--clients/.test(editorialHtml), 'editorial shows clients section');
ok(/cvSection--education/.test(editorialHtml), 'editorial shows education section');
ok(/Photoshop|cvToolsLine/.test(editorialHtml), 'editorial shows tools content');
ok(/French|cvLangLine/.test(editorialHtml), 'editorial shows languages content');

const lowConfCv = normalizeCvDataForTemplate({
  ...productionCv,
  sectionConfidence: { experience: 5, clients: 5, education: 5, tools: 5, skills: 5, languages: 5 },
});
const lowHtml = T.render(lowConfCv, 'editorial');
const lowLock = scoreTemplateCompletenessLock(lowHtml, RICH_FINAL_RESUME);
ok(lowLock.pass, 'low confidence does not strip sections in production');

const parity = {};
for (const id of PRODUCTION_TEMPLATE_IDS) {
  parity[id] = batch.templates[id]?.score ?? 0;
}
const minScore = Math.min(...Object.values(parity));
ok(minScore === 100, `all templates 100% visibility (min=${minScore}%)`);

const report = {
  feature: 'TEMPLATE_CONTENT_VISIBILITY',
  generatedAt: new Date().toISOString(),
  lockSections: LOCK_SECTIONS,
  sourceCounts: source.counts,
  productionFlags: {
    _fromFinalResumeData: productionCv._fromFinalResumeData === true,
    _fromResumeData: productionCv._fromResumeData === true,
  },
  templateSwitchScores: parity,
  templates: batch.templates,
  editorialChecks: {
    experienceSection: /cvSection--experience/.test(editorialHtml),
    clientsSection: /cvSection--clients/.test(editorialHtml),
    educationSection: /cvSection--education/.test(editorialHtml),
    toolsContent: /Photoshop|cvToolsLine/.test(editorialHtml),
    languagesContent: /French|cvLangLine/.test(editorialHtml),
  },
  pass: failed === 0,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL template-content-visibility' : '\nPASS template-content-visibility');
process.exit(failed ? 1 : 0);
