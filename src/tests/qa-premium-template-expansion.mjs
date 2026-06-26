#!/usr/bin/env node
/**
 * P1 — Premium template expansion QA (10 distinct templates, full content, multipage-ready).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../ui/templates/production-template-ids.mjs';
import { CREATIVE_PACK_BRIEFS } from '../ui/templates/creative-template-pack.mjs';
import { scoreAllTemplatesLock } from '../ui/templates/template-completeness.js';
import { normalizeCvDataForTemplate, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/premium-template-expansion/report.json');

const RICH_CV = {
  identity: {
    name: 'Yuki Tanaka',
    title: 'Art Director',
    email: 'yuki@studio.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris, France',
  },
  summary: 'Art director and illustrator across luxury, entertainment, and technology brands.',
  experiences: [
    { role: 'Art Director', company: 'McCann Paris', dates: '2018–Present', bullets: ['Led global campaigns', 'Directed photo shoots'] },
    { role: 'Senior Designer', company: 'Freelance', dates: '2012–2018', bullets: ['Nike', 'Apple', 'Marvel'] },
    { role: 'Designer', company: 'Studio A', dates: '2010–2012', bullets: ['Packaging systems'] },
    { role: 'Junior Designer', company: 'Agency B', dates: '2008–2010', bullets: ['Editorial layouts'] },
  ],
  education: [{ degree: 'MA Visual Communication', school: 'ENSAD', dates: '2010' }],
  skills: ['Art direction', 'Branding', 'Illustration', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent', 'Japanese — fluent'],
  clients: ['Nike', 'Apple', 'PlayStation', 'Marvel'],
  projects: [
    'God of War Poster — PlayStation',
    'Max Campaign — Adobe · 2023',
    'Black Panther Poster — Marvel · 2021',
    'FIFA Campaign — Visa · 2022',
  ],
  portfolioLinks: [
    'Behance — https://behance.net/yuki',
    'Dribbble — https://dribbble.com/yuki',
    'Instagram — https://instagram.com/yuki',
  ],
};

const REQUIRED_TEMPLATES = [
  'Creative Portfolio',
  'Editorial Magazine',
  'Luxury Minimal',
  'Agency Designer',
  'Visual Timeline',
  'Tech Structured',
  'Art Director Portfolio',
];

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
        portfolio: 'Portfolio',
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

function toCvData(frd) {
  const shaped = {
    identity: { ...(frd.identity || {}) },
    summary: String(frd.summary || '').trim(),
    experiences: frd.experiences || [],
    education: frd.education || [],
    skills: frd.skills || [],
    tools: frd.tools || [],
    languages: frd.languages || [],
    clients: frd.clients || [],
    projects: frd.projects || [],
    portfolioLinks: frd.portfolioLinks || [],
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
  } else console.log('OK', msg);
}

const cv = toCvData(RICH_CV);
const T = loadTemplates();
const packCss = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-pack.css'), 'utf8');
const a4Css = fs.readFileSync(path.join(ROOT, 'src/ui/export/cv-a4-pages.css'), 'utf8');

ok(PRODUCTION_TEMPLATE_IDS.length === 7, 'seven premium templates');
ok(
  REQUIRED_TEMPLATES.every((name, i) => PRODUCTION_TEMPLATE_DISPLAY_NAMES[PRODUCTION_TEMPLATE_IDS[i]] === name),
  'template names match expansion spec'
);

const renders = {};
const layoutClasses = new Set();

for (const id of PRODUCTION_TEMPLATE_IDS) {
  const html = T.render(cv, id);
  renders[id] = html;
  ok(html && html.length > 800, `${id} renders rich CV (${html.length} chars)`);
  ok(html.includes('cvSection--clients'), `${id} has clients section`);
  ok(html.includes('cvSection--projects'), `${id} has projects section`);
  ok(html.includes('cvSection--portfolio'), `${id} has portfolio links section`);
  ok(html.includes('cvSection--experience') || html.includes('cvTimeline'), `${id} has experience`);
  ok(html.includes('cvInner'), `${id} multipage-ready cvInner root`);
  ok(packCss.includes(`cvTpl-h20-${id}`), `${id} distinct pack CSS skin`);
  const layoutMatch = html.match(/cvLayout-[a-z0-9-]+/g) || [];
  layoutClasses.add(layoutMatch.find((c) => c.startsWith('cvLayout-') && c !== 'cvLayout-professional') || id);
}

ok(layoutClasses.size >= 7, `distinct layout classes (${layoutClasses.size})`);
ok(a4Css.includes('cvA4Sheet'), 'A4 multipage stylesheet present');
ok(a4Css.includes('page-break'), 'A4 page-break rules present');

const lock = scoreAllTemplatesLock(renders, RICH_CV);
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const r = lock.templates[id];
  ok(r.pass, `${id} content lock ${r.score}%`);
}

for (const id of ['portfolio-artist', 'magazine-editorial', 'minimal-swiss', 'art-director', 'tech']) {
  ok(T.resolve(id).id !== id, `legacy alias ${id} resolves to canonical template`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      feature: 'PREMIUM_TEMPLATE_EXPANSION',
      generatedAt: new Date().toISOString(),
      templateIds: PRODUCTION_TEMPLATE_IDS,
      names: PRODUCTION_TEMPLATE_IDS.map((id) => PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]),
      briefs: CREATIVE_PACK_BRIEFS,
      lock: lock.templates,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL premium-template-expansion' : '\nPASS premium-template-expansion');
process.exit(failed ? 1 : 0);
