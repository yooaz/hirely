#!/usr/bin/env node
/**
 * Premium templates — HTML structure for html2pdf + short/long content smoke.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const PREMIUM_IDS = ['apple', 'pentagram', 'luxuryportfolio', 'motiondesigner', 'artdirector', 'agencyportfolio'];

const SHORT_CV = {
  name: 'Léa Bernard',
  title: 'Chef de projet',
  email: 'lea@example.com',
  experience: ['Chef de projet — Studio A — 2022–Present'],
  skills: ['Agile', 'Roadmap'],
};

const LONG_CV = {
  name: 'Thomas Renard',
  title: 'Directeur artistique',
  email: 'thomas@example.com',
  phone: '+33 6 11 22 33 44',
  location: 'Lyon, France',
  summary:
    'Direction artistique et identités de marque pour secteurs culturel et retail, avec une approche éditoriale et digitale.',
  experience: Array.from({ length: 8 }, (_, i) => `Rôle senior — Agence ${i + 1} — 201${i}–202${i + 1}`),
  education: ['École des Arts Décoratifs', 'Master Design — 2014'],
  skills: ['Direction artistique', 'Identité', 'Typographie', 'Packaging', 'Print', 'Digital', 'Motion'],
  tools: ['Figma', 'Photoshop', 'Illustrator'],
  languages: ['Français — natif', 'Anglais — courant'],
  clients: ['Maison A', 'Maison B', 'Maison C'],
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
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({ experience: 'Experience', education: 'Education', skills: 'Skills', clients: 'Clients', tools: 'Tools', languages: 'Languages' }[k] || k),
    cvBlock: (title, html) => (html ? `<section><h3>${title}</h3>${html}</section>` : ''),
    cvSkillsHtml: (skills) => `<p>${skills.map(esc).join(', ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const premiumCss = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates-premium.css'), 'utf8');
ok(/body\.export-pdf \.cv\.template-premium-luxe/.test(premiumCss), 'PDF export rules for premium-luxe');
ok(/\.cvSkillBars/.test(premiumCss), 'skill bar styles for html2pdf');

const T = loadTemplates();
const forbidden = /mckinsey|bain\b|bcg\b/i;

for (const id of PREMIUM_IDS) {
  for (const [label, sample] of [
    ['short', SHORT_CV],
    ['long', LONG_CV],
  ]) {
    const html = T.render(sample, id);
    ok(html.length > 200, `${id} ${label} renders (${html.length} bytes)`);
    ok(!forbidden.test(html), `${id} ${label} has no forbidden brand names`);
    ok(html.includes(esc(sample.name)), `${id} ${label} includes name as text`);
    ok(/cvSection|cvTimeline|cvSkillBar/i.test(html), `${id} ${label} has premium structure`);
  }
}

const tplSrc = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
const miniBlock = tplSrc.match(/const MINI_CV = \{[\s\S]*?\n    \};/)?.[0] || '';
ok(!/McCann|McKinsey/i.test(miniBlock), 'MINI_CV preview has no forbidden brand names');

process.exit(failed ? 1 : 0);
