#!/usr/bin/env node
/**
 * P1 — Graphic template pack (8 templates, no content loss, visually distinct).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import {
  PRODUCTION_TEMPLATE_IDS,
  FEATURED_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../ui/templates/production-template-ids.mjs';
import {
  GRAPHIC_PACK_BRIEFS,
  GRAPHIC_PACK_NAMES,
  CREATIVE_TEMPLATE_PACK,
} from '../ui/templates/creative-template-pack.mjs';
import { scoreAllTemplatesLock } from '../ui/templates/template-completeness.js';
import { normalizeCvDataForTemplate, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/graphic-template-pack/report.json');

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
  portfolioLinks: ['Behance — https://behance.net/yohann', 'Dribbble — https://dribbble.com/yohann'],
};

const REQUIRED_NAMES = [
  'ATS Clean',
  'Creative Portfolio',
  'Editorial Magazine',
  'Luxury Minimal',
  'Agency Designer',
  'Visual Timeline',
  'Tech Structured',
  'Art Director Portfolio',
];

const LAYOUT_SIGNATURES = {
  ats: 'cvLayout-h20-ats',
  'creative-portfolio': 'cvLayout-h20-creative-portfolio',
  'editorial-magazine': 'cvLayout-h20-editorial-magazine',
  'luxury-minimal': 'cvLayout-h20-luxury-minimal',
  'agency-designer': 'cvLayout-h20-agency-designer',
  'visual-timeline': 'cvLayout-h20-visual-timeline',
  'tech-structured': 'cvLayout-h20-tech-structured',
  'art-director-portfolio': 'cvLayout-h20-art-director-portfolio',
};

const GALLERY_IDS = FEATURED_TEMPLATE_IDS;
const CREATIVE_SECTION_MARKERS = ['cvSection--clients', 'cvSection--projects', 'cvSection--portfolio'];

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
    portfolioLinks: Array.isArray(frd.portfolioLinks) ? frd.portfolioLinks : [],
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

fs.mkdirSync(path.dirname(OUT), { recursive: true });

ok(GALLERY_IDS.length === 8, 'eight gallery templates');
ok(PRODUCTION_TEMPLATE_IDS.length === 7, 'seven pro templates');
ok(GRAPHIC_PACK_NAMES.join('|') === REQUIRED_NAMES.join('|'), 'pack names match spec');

const packCss = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-pack.css'), 'utf8');
for (const id of GALLERY_IDS) {
  if (id === 'ats') continue;
  ok(packCss.includes(`cvTpl-h20-${id}`), `pack CSS for ${id}`);
}

const productionCv = mapFinalResumeToCvDataLike(RICH_FINAL_RESUME);
const T = loadTemplates();
ok(T.PRODUCTION_TEMPLATE_IDS.length === 7, 'runtime lists 7 pro templates');

const renders = {};
const signatures = new Set();
for (const id of GALLERY_IDS) {
  const html = T.render(productionCv, id);
  renders[id] = html;
  const sig = LAYOUT_SIGNATURES[id];
  ok(html && html.length > 500, `${id} renders (${html.length} chars)`);
  ok(html.includes(sig), `${id} layout signature ${sig}`);
  signatures.add(sig);
  if (id !== 'ats') {
    ok(PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] === GRAPHIC_PACK_BRIEFS[id]?.name, `${id} display name`);
    for (const marker of CREATIVE_SECTION_MARKERS) {
      ok(html.includes(marker), `${id} renders ${marker}`);
    }
  } else {
    ok(html.includes('cvSection--clients') || html.includes('cvClientLine'), `${id} renders clients`);
    ok(html.includes('cvSection--projects'), `${id} renders projects`);
  }
}

ok(signatures.size === 8, 'all 8 layout signatures unique');

const lock = scoreAllTemplatesLock(renders, RICH_FINAL_RESUME);
for (const id of GALLERY_IDS) {
  const r = lock.templates[id];
  ok(r.pass, `${id} content lock ${r.score}%`);
}

ok(renders['visual-timeline'].includes('cvTimeline'), 'timeline template has timeline rail');
ok(renders['editorial-magazine'].includes('cvBody--magazine'), 'editorial magazine 3-column body');
ok(renders['luxury-minimal'].includes('cvMain--luxury-minimal'), 'luxury minimal layout');
ok(renders['tech-structured'].includes('cvMain--tech-structured'), 'tech structured layout');
ok(renders['art-director-portfolio'].includes('cvMain--art-director'), 'art director portfolio layout');
ok(renders['creative-portfolio'].includes('cvMain--portfolio'), 'creative portfolio layout');
ok(renders.ats.includes('cvLayout-h20-ats'), 'ats clean layout');

const a4Css = fs.readFileSync(path.join(ROOT, 'src/ui/export/cv-a4-pages.css'), 'utf8');
ok(a4Css.includes('cvA4Sheet'), 'multipage A4 CSS present');
const pdfCss = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-pdf-export.css'), 'utf8');
ok(pdfCss.length > 200, 'PDF export CSS present');

const report = {
  feature: CREATIVE_TEMPLATE_PACK,
  generatedAt: new Date().toISOString(),
  galleryIds: GALLERY_IDS,
  templateIds: PRODUCTION_TEMPLATE_IDS,
  names: GRAPHIC_PACK_NAMES,
  briefs: GRAPHIC_PACK_BRIEFS,
  lock: lock.templates,
  signatures: LAYOUT_SIGNATURES,
  allPass: lock.pass && failed === 0,
  pass: failed === 0,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL graphic-template-pack' : '\nPASS graphic-template-pack');
process.exit(failed ? 1 : 0);
