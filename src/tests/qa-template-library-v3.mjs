#!/usr/bin/env node
/**
 * HIRELY Template Library V3 QA — 10 differentiated templates.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  TEMPLATE_LIBRARY_V3_VERSION,
  TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_FAMILY_V3_NAMES,
  TEMPLATE_FAMILY_V3_ARCHITECTURE,
  resolveTemplateFamilyV3Id,
} from '../ui/templates/template-families-v3.mjs';
import { TEN_PREMIUM_TEMPLATE_IDS } from '../ui/templates/ten-premium-templates.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const v3Css = readFileSync(join(ROOT, 'src/ui/templates/cv-templates-v3-families.css'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const SAMPLE = {
  name: 'Alex Morgan',
  title: 'Product Lead',
  email: 'alex@example.com',
  phone: '+1 415 555 0100',
  location: 'San Francisco',
  summary: 'Operator scaling venture-backed teams.',
  experience: [
    { role: 'CEO', company: 'Northline', dates: '2021–Present', bullets: ['Grew ARR to $4.2M'] },
    { role: 'Head of Product', company: 'Stripe', dates: '2017–2021', bullets: ['Led onboarding for 14M merchants'] },
  ],
  education: ['MIT — BS Computer Science'],
  skills: ['Product', 'GTM', 'Fundraising'],
  tools: ['Figma', 'Linear'],
  languages: ['English — native'],
  clients: ['Nike', 'Adobe'],
  projects: ['Payments relaunch', 'Creator suite'],
  publications: ['Paper on distributed systems — 2022'],
  awards: ['Best Thesis Award — 2016'],
};

ok(TEMPLATE_LIBRARY_V3_VERSION === 'TEMPLATE_LIBRARY_V3', 'version constant');
ok(TEMPLATE_FAMILY_V3_IDS.length === 10, 'ten V3 template IDs');
ok(TEN_PREMIUM_TEMPLATE_IDS.length === 10, 'production catalog synced to V3');

const requiredNames = [
  'Consulting Elite',
  'Apple Style',
  'Google Style',
  'Startup Founder',
  'Creative Director',
  'Senior Engineer',
  'Executive Board',
  'Minimal ATS',
  'Academic',
  'Luxury Editorial',
];
for (const name of requiredNames) {
  ok(Object.values(TEMPLATE_FAMILY_V3_NAMES).includes(name), `display name ${name}`);
}

for (const id of TEMPLATE_FAMILY_V3_IDS) {
  const arch = TEMPLATE_FAMILY_V3_ARCHITECTURE[id];
  ok(arch?.grid, `${id} grid spec`);
  ok(arch?.hierarchy, `${id} hierarchy spec`);
  ok(arch?.typography, `${id} typography spec`);
  ok(arch?.spacing, `${id} spacing spec`);
  ok(arch?.layoutFamily, `${id} layout family`);
  ok(v3Css.includes(`.cv.template-${id}`), `CSS block for ${id}`);
}

ok(resolveTemplateFamilyV3Id('mckinsey-consulting') === 'consulting-elite', 'V2 alias → consulting-elite');
ok(resolveTemplateFamilyV3Id('apple-minimal') === 'apple-style', 'V2 alias → apple-style');
ok(resolveTemplateFamilyV3Id('tech-engineer') === 'google-style', 'V2 alias → google-style');
ok(resolveTemplateFamilyV3Id('ats-recruiter') === 'minimal-ats', 'V2 alias → minimal-ats');

ok(indexHtml.includes('cv-templates-v3-families.css'), 'index.html loads V3 CSS');
ok(indexHtml.includes('consulting-elite'), 'index.html featured V3 IDs');

const T = await loadHirelyTemplates();
for (const id of TEMPLATE_FAMILY_V3_IDS) {
  const html = T.render(SAMPLE, id);
  ok(html && html.length > 200, `${id} renders HTML`);
  ok(html.includes('cvLayout-v3') || html.includes(`cvTpl-v3-${id}`), `${id} uses V3 wrapper`);
  ok(!html.includes('undefined'), `${id} no undefined tokens`);
  const resolved = T.resolve(id);
  ok(resolved.id === id, `${id} resolves to canonical`);
}

for (const id of TEMPLATE_FAMILY_V3_IDS) {
  const mini = T.renderMini(id);
  ok(mini && mini.includes(`template-${id}`), `${id} mini preview`);
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll Template Library V3 QA checks passed.');
