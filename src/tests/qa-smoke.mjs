#!/usr/bin/env node
/**
 * QA smoke — canonical Hirely (index.html stack only).
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  PRODUCTION_TEMPLATE_IDS,
  FEATURED_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_COUNT,
} from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const PLACEHOLDER_PATTERNS = [
  /Candidate\s*Name/i,
  /email@example\.com/i,
  /Jane\s+Doe/i,
  /John\s+Doe/i,
  /professionally\s+positioned/i,
  /\[add\s+metric\]/i,
];

const SAMPLE = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  portfolio: 'https://portfolio.example',
  linkedin: 'https://linkedin.com/in/example',
  location: 'Paris, France',
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling.',
  experience: [
    'Freelance Illustrator / Graphic Designer — 2011–Present',
    'Collaborated with Nike, Louis Vuitton, Marvel.',
  ],
  education: ['LISAA — Web & Motion Design'],
  skills: ['Illustration', 'Graphic Design', 'Visual Identity'],
  tools: ['Photoshop', 'Illustrator', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Louis Vuitton', 'Marvel'],
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console, document: undefined };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const deps = {
    esc,
    sectionLabel: (k) => k,
    cvBlock: (title, html) => (html ? `<section><h3>${title}</h3>${html}</section>` : ''),
    cvSkillsHtml: (skills) => skills.map((s) => esc(s)).join(', '),
    getPhotoHtml: () => '',
  };
  sandbox.initHirelyTemplates(deps);
  return sandbox.HirelyTemplates;
}

function parseFeaturedIdsFromIndex(html) {
  const m = html.match(/FEATURED_TEMPLATE_IDS\s*=\s*\[([^\]]+)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function checkIndexCanonical() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const errs = [];
  if (!html.includes('src/ui/templates/cv-templates.js')) {
    errs.push('index.html must load src/ui/templates/cv-templates.js');
  }
  if (html.includes('public/lib/')) errs.push('index.html must not reference public/lib/');
  if (!html.includes('src/core/index.js') && !html.includes("import(spec)")) {
    errs.push('index.html should load src/core/index.js (see getHirelyCore)');
  }
  if (!html.includes('isPro()') || !html.includes('requirePro')) errs.push('Pro gating missing');
  if (!html.includes('heroPipeline') || !html.includes('trustPrivate')) errs.push('hero layout / trust row missing');
  if (!html.includes('wsProduct') || !html.includes('templatePickerBar')) errs.push('CV-centric workspace layout missing');
  if (!html.includes('cvExportBar') || !html.includes('resultFlow')) errs.push('result flow UI missing');
  if (!html.includes('id="workspaceGrid"') || !html.includes('initHirelyApp')) errs.push('canonical workspace / init missing');
  if (html.includes('extractionResultPanel')) errs.push('duplicate extractionResultPanel must be removed');
  if (!html.includes('FEATURED_TEMPLATE_IDS')) errs.push('featured template ordering missing');
  if (!html.includes('production-template-ids')) {
    errs.push('index.html should reference production-template-ids sync comment');
  }
  if (!html.includes('normalizeCvData') || !html.includes('hasValidInput')) errs.push('core flow helpers missing');
  if (!html.includes('renderMini')) errs.push('template mini previews missing (cv-templates.js)');
  if (html.includes('heroLogosRow') || html.includes('Google</span><span>Adobe')) {
    errs.push('fake client logos must be removed');
  }
  if (!html.includes('LOCALE_EXTRA')) errs.push('i18n LOCALE_EXTRA missing');
  if (!html.includes('FREE_TEMPLATE_ID')) errs.push('FREE_TEMPLATE_ID missing');

  const featured = parseFeaturedIdsFromIndex(html);
  if (featured.length !== FEATURED_TEMPLATE_IDS.length) {
    errs.push(
      `FEATURED_TEMPLATE_IDS length ${featured.length} !== production-template-ids.mjs (${FEATURED_TEMPLATE_IDS.length})`
    );
  }
  for (const id of FEATURED_TEMPLATE_IDS) {
    if (!featured.includes(id)) errs.push(`index.html FEATURED missing ${id}`);
  }
  return errs;
}

function main() {
  let failed = 0;
  const indexErrs = checkIndexCanonical();
  if (indexErrs.length) {
    console.error('index.html:', indexErrs.join('; '));
    failed++;
  } else console.log('OK index.html canonical references');

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts?.dev?.includes('3000')) {
    console.error('package.json dev must use port 3000');
    failed++;
  } else console.log('OK package.json dev → port 3000');

  if (PRODUCTION_TEMPLATE_COUNT !== PRODUCTION_TEMPLATE_IDS.length) {
    console.error('PRODUCTION_TEMPLATE_COUNT mismatch');
    failed++;
  }

  const HirelyTemplates = loadTemplates();
  const registryIds = HirelyTemplates.list.map((t) => t.id);
  const count = registryIds.length;

  if (count !== PRODUCTION_TEMPLATE_COUNT) {
    console.error(
      `Template registry: expected ${PRODUCTION_TEMPLATE_COUNT} production templates, got ${count} (update production-template-ids.mjs and cv-templates.js)`
    );
    failed++;
  } else console.log(`OK ${count} production templates registered`);

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    if (!registryIds.includes(id)) {
      console.error(`Missing production template in cv-templates.js: ${id}`);
      failed++;
    }
  }

  const extra = registryIds.filter((id) => !PRODUCTION_TEMPLATE_IDS.includes(id));
  if (extra.length) {
    console.error(`Unexpected templates in registry (add to production-template-ids.mjs): ${extra.join(', ')}`);
    failed++;
  }

  const free = HirelyTemplates.list.filter((t) => t.tier === 'free');
  if (free.length !== PRODUCTION_TEMPLATE_COUNT) {
    console.error(`All ${PRODUCTION_TEMPLATE_COUNT} premium templates should be tier free`);
    failed++;
  }

  for (const t of HirelyTemplates.list) {
    const html = HirelyTemplates.render(SAMPLE, t.id);
    const mini = HirelyTemplates.renderMini(t.id);
    if (!html || html.length < 200) {
      console.error(`Empty render: ${t.id}`);
      failed++;
      continue;
    }
    if (!mini || mini.length < 80 || !mini.includes(`tplMiniWrap--${t.id}`)) {
      console.error(`Bad mini preview: ${t.id}`);
      failed++;
      continue;
    }
    for (const re of PLACEHOLDER_PATTERNS) {
      if (re.test(html)) {
        console.error(`Placeholder in ${t.name}: ${re}`);
        failed++;
      }
    }
  }
  if (!failed) console.log(`OK all ${PRODUCTION_TEMPLATE_COUNT} templates render + mini previews`);

  try {
    execSync('node src/tests/extraction-test.mjs', { cwd: root, stdio: 'pipe' });
    console.log('OK extraction pipeline regression');
  } catch {
    console.error('extraction-test.mjs failed — run npm run qa:extraction');
    failed++;
  }

  try {
    execSync('node src/tests/core-flow-test.mjs', { cwd: root, stdio: 'pipe' });
    console.log('OK core flow hardening');
  } catch {
    console.error('core-flow-test.mjs failed — run npm run qa:core-flow');
    failed++;
  }

  process.exit(failed ? 1 : 0);
}

main();
