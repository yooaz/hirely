#!/usr/bin/env node
/**
 * HIRELY P1 — Premium template direction QA (ATS Clean · Creative Portfolio · Executive Minimal).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_DISPLAY_NAMES } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const PREMIUM_P1_IDS = ['ats', 'creative', 'executive-minimal'];
const PREMIUM_P1_NAMES = {
  ats: 'ATS Clean',
  creative: 'Creative Portfolio',
  'executive-minimal': 'Executive Minimal',
};

let fail = 0;
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else {
    console.error(`FAIL ${msg}`);
    fail += 1;
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
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
      }[k] || k),
    cvBlock: (title, html) => (html ? `<section class="cvSection"><h3>${title}</h3>${html}</section>` : ''),
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  };
  sandbox.initHirelyTemplates(deps);
  return sandbox.HirelyTemplates;
}

const SAMPLE = {
  name: 'Marie Dupont',
  title: 'Product Manager',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  location: 'Paris',
  summary: 'B2B SaaS product leader with eight years of delivery experience.',
  experience: ['Senior PM — Acme — 2019–Present', 'Product Owner — Beta — 2016–2019'],
  education: ['HEC Paris — MBA'],
  skills: ['Roadmap', 'Agile', 'SQL'],
  tools: ['Jira', 'Figma'],
  languages: ['French — native'],
  clients: ['Acme', 'Beta'],
  projects: ['Mobile app redesign — 2023'],
};

const profCss = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates-professional.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const T = loadTemplates();

for (const id of PREMIUM_P1_IDS) {
  ok(PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] === PREMIUM_P1_NAMES[id], `display name ${id}`);
  ok(T.resolve(id).name === PREMIUM_P1_NAMES[id], `cv-templates name ${id}`);
  ok(new RegExp(`\\.cv\\.template-${id.replace(/-/g, '\\-')}`).test(profCss), `CSS block ${id}`);
  ok(/max-width:\s*794px/.test(profCss), `A4 width token in CSS (${id} section)`);

  const html = T.render(SAMPLE, id);
  ok(html.includes(esc(SAMPLE.name)), `${id} renders name`);
  ok(html.includes('Senior PM'), `${id} renders experience`);
  ok(!/cvSkillBars|cvSkillBarFill|cvTimelineDot|cvClientsRibbon|cvScore|cvDecor/.test(html), `${id} no decorative markup`);
  ok(!/<img/i.test(html), `${id} no images`);
  ok(!/ATS safe|ATS OK|badge|scoreCard/i.test(html), `${id} no ATS badge copy in render`);
}

ok(/ATS Clean/.test(indexHtml), 'index references ATS Clean');
ok(/Executive Minimal/.test(indexHtml), 'index references Executive Minimal');
ok(/Creative Portfolio/.test(indexHtml), 'index references Creative Portfolio');
ok(/const debugMeta=DEBUG_MODE/.test(indexHtml), 'picker omits ATS badges outside debug mode');
ok(/@media print/.test(profCss), 'print rules in professional CSS');
ok(/template-ats[\s\S]*Apple/.test(profCss) || /1 ATS Clean/.test(profCss), 'ATS Clean research note in CSS');

if (fail) {
  console.error(`\n${fail} check(s) failed`);
  process.exit(1);
}
console.log('\nPREMIUM_TEMPLATE_DIRECTION_QA_OK');
