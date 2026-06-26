#!/usr/bin/env node
/**
 * UX P3 templates — render HTML, ATS text, export hooks.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS, PRODUCTION_TEMPLATE_COUNT } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

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

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
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
      ({ experience: 'Experience', education: 'Education', skills: 'Skills', clients: 'Clients', tools: 'Tools', languages: 'Languages', projects: 'Projects', profile: 'Profile' }[k] || k),
    cvBlock: (title, html) => (html ? `<section class="cvSection"><h3>${title}</h3>${html}</section>` : ''),
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
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
  } else console.log('OK', msg);
}

const profCss = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates-professional.css'), 'utf8');
for (const id of PRODUCTION_TEMPLATE_IDS) {
  ok(new RegExp(`template-${id.replace(/-/g, '\\-')}`).test(profCss), `professional CSS ${id}`);
}
ok(!/template-consultingelite|template-apple|template-pentagram/.test(profCss), 'retired templates removed from CSS');

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/cv-templates-professional\.css/.test(indexHtml), 'professional stylesheet linked');
ok(/ATS Clean/.test(indexHtml), 'index displays ATS Clean');
ok(/Modern Two Column/.test(indexHtml), 'index displays Modern Two Column');
ok(/Editorial Premium/.test(indexHtml), 'index displays Editorial Premium');

const T = loadTemplates();
ok(T.PRODUCTION_TEMPLATE_IDS.length === PRODUCTION_TEMPLATE_COUNT, `HirelyTemplates exposes ${PRODUCTION_TEMPLATE_COUNT} templates`);
ok(T.resolve('ats').name === 'ATS Clean', 'ATS Clean display name');
ok(T.resolve('editorial').id === 'editorial', 'editorial resolves');
ok(T.resolve('modern-two-column').id === 'modern-two-column', 'modern-two-column resolves');

for (const id of PRODUCTION_TEMPLATE_IDS) {
  const tpl = T.resolve(id);
  ok(tpl && (tpl.id === id || T.ALIASES[id] === tpl.id), `template ${id} registered`);
  const html = T.render(SAMPLE, id);
  ok(html.includes(esc(SAMPLE.name)), `${id} renders name`);
  ok(html.includes('Senior PM'), `${id} renders experience`);
  ok(!/cvSkillBars|cvSkillBarFill|cvTimelineDot|cvClientsRibbon|cvScore/.test(html), `${id} no decorative markup`);
  ok(!/<img/i.test(html), `${id} no images`);
  console.log(`RENDER ${id} bytes=${html.length}`);
}

const tplJs = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
ok(/5 premium CV templates|UX P3 — 5 premium/.test(tplJs), 'template module header declares UX P3');
ok(T.list.length === PRODUCTION_TEMPLATE_COUNT, `cv-templates registers exactly ${PRODUCTION_TEMPLATE_COUNT} templates`);
ok(T.listProduction().length === PRODUCTION_TEMPLATE_COUNT, `listProduction returns ${PRODUCTION_TEMPLATE_COUNT} templates`);

if (failed) process.exit(1);
console.log('\nqa-template-export: PASS');
