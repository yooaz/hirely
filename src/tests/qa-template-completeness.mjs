#!/usr/bin/env node
/**
 * HIRELY P0 — Template completeness QA (100% content visibility).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import {
  REQUIRED_CONTENT_SECTIONS,
  scoreAllTemplates,
  scoreTemplateCompleteness,
} from '../ui/templates/template-completeness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/template-completeness/report.json');

/** Rich profile — every required section populated; low confidence must not hide content. */
const RICH_PROFILE = {
  _fromFinalResumeData: true,
  _templateMeta: { source: 'resumeData' },
  name: 'Yohann Azancot',
  title: 'Lead Illustrator',
  email: 'yohann@example.com',
  phone: '+33 6 12 34 56 78',
  location: 'Paris, France',
  summary:
    'Senior illustrator and art director with fifteen years across luxury, entertainment, and technology clients worldwide.',
  experience: [
    'Lead Illustrator — McCann Paris — 2018–Present',
    'Freelance — Nike, Apple — 2012–2018',
  ],
  education: ['MA Illustration — ENSAD — 2010'],
  skills: ['Illustration', 'Branding', 'Art direction', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Apple', 'Louis Vuitton'],
  projects: ['Brand campaign — 2024'],
  sectionConfidence: { tools: 35, skills: 42, languages: 55 },
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
  const deps = {
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
        exhibitions: 'Exhibitions',
        awards: 'Awards',
        publications: 'Publications',
        portfolio: 'Portfolio',
      }[k] || k),
    cvBlock: (title, html) =>
      html ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>` : '',
    cvSkillsHtml: (skills) =>
      `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  };
  sandbox.initHirelyTemplates(deps);
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

const profCss = fs.readFileSync(
  path.join(ROOT, 'src/ui/templates/cv-templates-professional.css'),
  'utf8'
);
ok(!/overflow-x:\s*hidden/.test(profCss), 'no overflow-x:hidden on template shells');
ok(/overflow:\s*visible/.test(profCss), 'template shells use overflow:visible');

const T = loadTemplates();
const renders = {};
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const html = T.render(RICH_PROFILE, id);
  renders[id] = html;
  ok(html && html.length > 400, `${id} renders HTML`);
  ok(!/lorem ipsum|missing experience|needs review/i.test(html), `${id} no blocked placeholder text`);
}

const batch = scoreAllTemplates(renders, RICH_PROFILE);
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const r = batch.templates[id];
  ok(r.pass, `${id} completeness ${r.score}%`);
  for (const key of REQUIRED_CONTENT_SECTIONS) {
    const sec = r.sections[key];
    if (sec?.skipped) continue;
    ok(sec.pass, `${id} section ${key} ${sec.pct}% (${sec.visible}/${sec.expected})`);
  }
}

const lowConf = { ...RICH_PROFILE, sectionConfidence: { tools: 10, skills: 10, languages: 10 } };
const lowHtml = T.render(lowConf, 'executive-minimal');
const lowScore = scoreTemplateCompleteness(lowHtml, lowConf);
ok(
  lowScore.sections.tools?.pct === 100 && lowScore.sections.skills?.pct === 100,
  'low confidence does not hide final resume content'
);

const report = {
  feature: 'TEMPLATE_COMPLETENESS',
  generatedAt: new Date().toISOString(),
  requiredSections: REQUIRED_CONTENT_SECTIONS,
  profile: RICH_PROFILE,
  templates: batch.templates,
  pass: failed === 0,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL template-completeness' : '\nPASS template-completeness');
process.exit(failed ? 1 : 0);
