#!/usr/bin/env node
/**
 * Template safety — no broken sections, debug labels, or OCR fragments in export HTML.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

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
      ({
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        toClassify: 'À classer',
        unsorted: 'Additional information',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
        profile: 'Profile',
      }[k] || k),
    cvBlock: (title, html) => (html ? `<section class="cvSection"><h3>${title}</h3>${html}</section>` : ''),
    cvSkillsHtml: (skills) => `<p>${skills.map(esc).join(', ')}</p>`,
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

const T = loadTemplates();
const tplId = PRODUCTION_TEMPLATE_IDS[0] || 'swiss';

const BLOCKED_SNIPPETS = [
  'missing experience',
  'low confidence',
  'confidence: 42%',
  'needs review',
  'unknown experience',
  '[body]',
  'debug parser',
];

function assertNoBlocked(html, label) {
  const lower = html.toLowerCase();
  for (const frag of BLOCKED_SNIPPETS) {
    ok(!lower.includes(frag), `${label} hides "${frag}"`);
  }
}

const classifyOnly = {
  name: 'Alex Martin',
  title: 'Consultant',
  experience: [],
  toClassify: ['Lead PM — Studio Nova — 2020–2024', 'missing experience'],
  education: [],
  skills: [],
};

const htmlClassify = T.render(classifyOnly, tplId);
ok(htmlClassify.includes('À classer'), 'no experience → À classer section');
ok(htmlClassify.includes('Lead PM'), 'À classer shows safe career line');
ok(!/cvSection--experience/.test(htmlClassify), 'no empty Experience section');
assertNoBlocked(htmlClassify, 'classify-only');

const minimal = {
  name: 'Sam Lee',
  title: 'Designer',
  experience: ['Art Director — Maison — 2018–Present'],
  education: [],
  skills: [],
  toClassify: ['Should not appear when experience exists'],
};

const htmlExp = T.render(minimal, tplId);
ok(htmlExp.includes('Art Director'), 'experience section renders');
ok(!htmlExp.includes('Should not appear'), 'toClassify hidden when experience present');
ok(!/cvSection--education/.test(htmlExp), 'empty education hidden');
assertNoBlocked(htmlExp, 'experience-only');

const dirty = {
  name: 'Pat Dupont',
  title: 'Engineer',
  experience: [],
  unknownExperience: ['Product Owner — Beta — 2016–2019'],
  toClassify: ['low confidence block'],
  unsorted: ['@@@###garbage', 'Accepted note about relocation to Lyon'],
};

const htmlDirty = T.render(dirty, tplId);
ok(htmlDirty.includes('Product Owner'), 'unknownExperience merged into À classer');
ok(!htmlDirty.includes('low confidence'), 'blocked label not rendered');
ok(!htmlDirty.includes('@@@'), 'OCR fragment not rendered');
assertNoBlocked(htmlDirty, 'dirty-input');

const structured = {
  name: '',
  experience: [],
  structuredResume: {
    identity: { name: 'Yohann Azancot', title: 'Creative Director' },
    experiences: [{ role: 'CD', company: 'YOAZ', dates: '2020–2024', bullets: ['Brand systems'] }],
    education: ['ENSAD — Design'],
    skills: ['Figma', 'After Effects'],
  },
};

const htmlStruct = T.render(structured, tplId);
ok(htmlStruct.includes('Yohann Azancot'), 'structuredResume identity merged');
ok(htmlStruct.includes('YOAZ') || htmlStruct.includes('CD'), 'structured experiences merged');
ok(htmlStruct.includes('ENSAD'), 'structured education merged');
assertNoBlocked(htmlStruct, 'structured-resume');

for (const id of PRODUCTION_TEMPLATE_IDS.slice(0, 3)) {
  const html = T.render(classifyOnly, id);
  ok(html.includes('À classer'), `${id} supports À classer fallback`);
}

process.exit(failed ? 1 : 0);
