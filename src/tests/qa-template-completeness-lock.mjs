#!/usr/bin/env node
/**
 * HIRELY P0 — Template completeness LOCK (100% source vs DOM counts).
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
import { requireImportStabilityForTemplates } from '../ui/templates/template-import-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/template-completeness-lock/report.json');

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

const RICH_RENDER_PROFILE = {
  _fromFinalResumeData: true,
  _templateMeta: { source: 'resumeData' },
  name: RICH_FINAL_RESUME.identity.name,
  title: RICH_FINAL_RESUME.identity.title,
  email: RICH_FINAL_RESUME.identity.email,
  phone: RICH_FINAL_RESUME.identity.phone,
  location: RICH_FINAL_RESUME.identity.location,
  summary: RICH_FINAL_RESUME.summary,
  experience: RICH_FINAL_RESUME.experiences.map(
    (e) => `${e.role} — ${e.company} — ${e.dates}`
  ),
  education: RICH_FINAL_RESUME.education.map((e) => `${e.degree} — ${e.school} — ${e.dates}`),
  skills: RICH_FINAL_RESUME.skills,
  tools: RICH_FINAL_RESUME.tools,
  languages: RICH_FINAL_RESUME.languages,
  clients: RICH_FINAL_RESUME.clients,
  projects: RICH_FINAL_RESUME.projects,
  sectionConfidence: { tools: 35, skills: 42, languages: 55, projects: 40 },
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

requireImportStabilityForTemplates(ROOT);

const source = countSourceSections(RICH_FINAL_RESUME);
ok(source.counts.projects === 2, 'fixture has 2 projects');
ok(source.counts.experiences === 2, 'fixture has 2 experiences');

const T = loadTemplates();
const renders = {};
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const html = T.render(RICH_RENDER_PROFILE, id);
  renders[id] = html;
  ok(html && html.length > 400, `${id} renders HTML`);
  ok(!/lorem ipsum|needs review/i.test(html), `${id} no blocked placeholder`);
}

const batch = scoreAllTemplatesLock(renders, RICH_FINAL_RESUME);
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const r = batch.templates[id];
  ok(r.pass, `${id} lock ${r.score}%`);
  for (const key of LOCK_SECTIONS) {
    const sec = r.sections[key];
    if (sec?.skipped) {
      ok(sec.domBlocks === 0, `${id} ${key} empty → no DOM block`);
      continue;
    }
    ok(
      sec.sourceCount === sec.domCount && sec.domCount === sec.visible,
      `${id} ${key} source=${sec.sourceCount} dom=${sec.domCount} (${sec.pct}%)`
    );
    if (!['summary', 'skills', 'tools', 'languages'].includes(key)) {
      ok(sec.domBlocks >= 1 || sec.structural, `${id} ${key} rendered in DOM`);
    }
  }
}

const sparse = {
  identity: { name: 'Alex Martin', title: 'Designer', email: '', phone: '' },
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  tools: [],
  languages: [],
  clients: [],
  projects: [],
};
const sparseRender = {
  _fromFinalResumeData: true,
  name: 'Alex Martin',
  title: 'Designer',
};
const sparseHtml = T.render(sparseRender, 'ats');
const sparseScore = scoreTemplateCompletenessLock(sparseHtml, sparse);
ok(sparseScore.sections.summary?.skipped && sparseScore.sections.summary.domBlocks === 0, 'empty summary hidden');
ok(sparseScore.sections.experiences?.skipped && sparseScore.sections.experiences.domBlocks === 0, 'empty experiences hidden');
ok(sparseScore.sections.projects?.skipped && sparseScore.sections.projects.domBlocks === 0, 'empty projects hidden');

const lowConf = {
  ...RICH_RENDER_PROFILE,
  sectionConfidence: { tools: 5, skills: 5, languages: 5, projects: 5 },
};
const lowHtml = T.render(lowConf, 'executive-minimal');
const lowLock = scoreTemplateCompletenessLock(lowHtml, RICH_FINAL_RESUME);
ok(lowLock.pass, 'low confidence does not strip final resume sections');

const report = {
  feature: 'TEMPLATE_COMPLETENESS_LOCK',
  generatedAt: new Date().toISOString(),
  lockSections: LOCK_SECTIONS,
  sourceCounts: source.counts,
  finalResumeData: RICH_FINAL_RESUME,
  templates: batch.templates,
  pass: failed === 0,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL template-completeness-lock' : '\nPASS template-completeness-lock');
process.exit(failed ? 1 : 0);
