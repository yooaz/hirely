#!/usr/bin/env node
/**
 * QA — P2 Template System V2 families
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  TEMPLATE_FAMILY_V2_IDS,
  TEMPLATE_FAMILY_V2_NAMES,
  TEMPLATE_FAMILY_V2_ARCHITECTURE,
  resolveTemplateFamilyV2Id,
} from '../ui/templates/template-families-v2.mjs';
import { TEN_PREMIUM_TEMPLATE_IDS } from '../ui/templates/ten-premium-templates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let pass = 0;
let fail = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
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
};

const reg = await loadHirelyTemplates();
const cssPath = path.join(ROOT, 'src/ui/templates/cv-templates-v2-families.css');
assert('v2 css exists', fs.existsSync(cssPath));
assert('showcase sync', TEN_PREMIUM_TEMPLATE_IDS.length === 8);

const markers = new Set();
for (const id of TEMPLATE_FAMILY_V2_IDS) {
  const resolved = reg.resolve(id);
  assert(`resolve ${id}`, resolved.id === id, `got ${resolved.id}`);
  const html = reg.render(SAMPLE, id);
  assert(`render ${id}`, html.length > 200);
  assert(`wrapV2 ${id}`, html.includes('cvLayout-v2') || html.includes(`cvTpl-v2-${id}`), 'missing v2 wrapper');
  const arch = TEMPLATE_FAMILY_V2_ARCHITECTURE[id];
  if (arch.layoutFamily) markers.add(arch.layoutFamily);
}

assert('distinct layout families >= 8', markers.size >= 8, `only ${markers.size}`);
assert('alias ats-elite', resolveTemplateFamilyV2Id('ats-elite') === 'ats-recruiter');
assert('alias consulting', resolveTemplateFamilyV2Id('consulting') === 'mckinsey-consulting');
assert('display names', TEMPLATE_FAMILY_V2_NAMES['classic-corporate'] === 'Classic Corporate');

const corporate = reg.render(SAMPLE, 'classic-corporate');
assert('classic corporate grid', corporate.includes('cvCcGrid'));

const mck = reg.render(SAMPLE, 'mckinsey-consulting');
assert('mckinsey split html', mck.includes('cvMkBody'));

const ats = reg.render(SAMPLE, 'ats-recruiter');
assert('ats recruiter table', ats.includes('cvArExpTable'));

console.log(`\nqa-template-system-v2-families: ${fail === 0 ? 'PASS' : 'FAIL'} (${pass} pass / ${fail} fail)`);
process.exit(fail > 0 ? 1 : 0);
