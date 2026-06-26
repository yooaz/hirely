#!/usr/bin/env node
/**
 * Premium Template System V1 — 10 templates, unique layouts, PDF export, no duplicate sections.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { requireImportStabilityForTemplates } from '../ui/templates/template-import-gate.mjs';
import { resumeDataToTemplateView } from '../ui/templates/v2/view-model.js';
import {
  PREMIUM_TEMPLATE_SYSTEM_V1_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
  TEMPLATE_SYSTEM_VERSION,
} from '../ui/templates/production-template-ids.mjs';
import {
  TEN_PREMIUM_LAYOUT_MARKERS,
  TEN_PREMIUM_DEDICATED_CSS,
  TEN_PREMIUM_TEMPLATES_VERSION,
} from '../ui/templates/ten-premium-templates.mjs';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/premium-template-system-v1');

const SAMPLE_RESUME = {
  identity: {
    name: 'Alex Morgan',
    title: 'Product Lead',
    email: 'alex@venture.example',
    phone: '+1 415 555 0100',
    location: 'San Francisco, CA',
    portfolio: 'https://alexmorgan.dev',
  },
  summary:
    'Operator and product leader scaling venture-backed teams from zero to Series B with measurable revenue and retention outcomes.',
  experiences: [
    {
      role: 'Co-Founder & CEO',
      company: 'Northline',
      dates: '2021–Present',
      bullets: ['Grew ARR from $0 to $4.2M in 28 months.', 'Raised $8M Series A with 3x YoY retention.'],
    },
    {
      role: 'Head of Product',
      company: 'Stripe',
      dates: '2017–2021',
      bullets: ['Led onboarding used by 14M merchants.', 'Shipped billing APIs adopted by 120+ partners.'],
    },
  ],
  education: ['Stanford GSB — MBA', 'MIT — BS Computer Science'],
  skills: ['Product strategy', 'Go-to-market', 'Team building', 'Fundraising'],
  tools: ['Figma', 'Notion', 'Linear', 'SQL'],
  languages: ['English — native', 'French — professional'],
  clients: ['Nike', 'Adobe', 'Apple'],
  projects: ['Payments platform relaunch — 2023', 'Creator economy suite — 2022'],
  achievements: ['TechCrunch Disrupt finalist · 2024', 'Forbes 30 Under 30 · 2023'],
  awards: ['Webby Awards — Product · 2022'],
  portfolioLinks: ['https://linkedin.com/in/alexmorgan', 'https://alexmorgan.dev'],
  unsorted: [],
  meta: {},
};

const LAYOUT_SIGNATURES = TEN_PREMIUM_LAYOUT_MARKERS;
const DEDICATED_CSS = TEN_PREMIUM_DEDICATED_CSS;

let failed = 0;
const results = [];
const renders = {};

function ok(cond, msg) {
  const pass = !!cond;
  if (!pass) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
  results.push({ check: msg, pass });
  return pass;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        tools: 'Tools',
        languages: 'Languages',
        clients: 'Clients',
        projects: 'Projects',
        profile: 'Profile',
      }[k] || k),
    cvBlock: (title, html) =>
      html ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>` : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function duplicateSectionTitles(html) {
  const titles = [...html.matchAll(/<h3 class="cvSectionTitle"[^>]*>([^<]+)/g)].map((m) =>
    m[1].replace(/&amp;/g, '&').trim()
  );
  const seen = new Set();
  const dups = [];
  for (const t of titles) {
    if (seen.has(t)) dups.push(t);
    seen.add(t);
  }
  return dups;
}

function duplicateSectionSlugs(html) {
  const MODIFIERS = new Set([
    'swiss-side',
    'director-meta',
    'vt-meta',
    'startup-side',
    'compact',
    'startup',
    'traction',
    'startup-impact',
    'clients-director',
    'projects-director',
    'adp-links',
    'leadership',
    'timeline',
    'visual-timeline',
    'swiss-summary',
    'elite',
    'agency-band',
    'editorial',
    'editorial-feature',
  ]);
  const slugs = [...html.matchAll(/cvSection--([a-z0-9-]+)/g)].map((m) => m[1]);
  const counts = {};
  for (const s of slugs) {
    if (MODIFIERS.has(s)) continue;
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).filter(([, n]) => n > 1).map(([s]) => s);
}

requireImportStabilityForTemplates(ROOT);

ok(PREMIUM_TEMPLATE_SYSTEM_V1_IDS.length === 8, 'showcase has exactly 8 templates');
ok(TEMPLATE_SYSTEM_VERSION === TEN_PREMIUM_TEMPLATES_VERSION, 'template system version lock');

const HT = loadTemplates();
const view = resumeDataToTemplateView(SAMPLE_RESUME, { skipFinalGate: true });
const textByTpl = {};

for (const id of PREMIUM_TEMPLATE_SYSTEM_V1_IDS) {
  const tpl = HT.resolve(id);
  ok(tpl.id === id, `resolve ${id}`);
  ok(tpl.name === PRODUCTION_TEMPLATE_DISPLAY_NAMES[id], `display name ${id}`);

  const html = HT.render(view, id);
  renders[id] = html;
  textByTpl[id] = stripHtml(html);

  ok(textByTpl[id].includes('Alex Morgan'), `${id} renders name`);
  ok(textByTpl[id].includes('Stanford') || textByTpl[id].includes('MIT'), `${id} renders education`);
  ok(!/placeholder|lorem ipsum|TODO|FIXME/i.test(html), `${id} no placeholder copy`);

  const sig = LAYOUT_SIGNATURES[id] || [];
  for (const marker of sig) ok(html.includes(marker), `${id} layout marker ${marker}`);

  const dups = duplicateSectionTitles(html);
  ok(dups.length === 0, `${id} no duplicate section titles (${dups.join(', ') || 'none'})`);

  const slugDups = duplicateSectionSlugs(html);
  ok(slugDups.length === 0, `${id} no duplicate section slugs (${slugDups.join(', ') || 'none'})`);

  const cssFile = path.join(ROOT, 'src/ui/templates', DEDICATED_CSS[id]);
  ok(fs.existsSync(cssFile), `${id} dedicated CSS file`);

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(indexHtml.includes(DEDICATED_CSS[id]), `index links ${DEDICATED_CSS[id]}`);
}

const signatures = PREMIUM_TEMPLATE_SYSTEM_V1_IDS.map((id) => (LAYOUT_SIGNATURES[id] || [])[0]);
ok(new Set(signatures).size === signatures.length, 'all V1 layout families are unique');

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const id of PREMIUM_TEMPLATE_SYSTEM_V1_IDS) {
  const html = renders[id];
  fs.writeFileSync(path.join(OUT_DIR, `${id}.html`), html);
  const pdfPath = path.join(OUT_DIR, `${id}.pdf`);
  try {
    await exportCvPdfPlaywright(page, html, id, pdfPath);
    const pdfBuf = fs.readFileSync(pdfPath);
    const analysis = await analyzePdfBytes(pdfBuf);
    ok(pdfBuf.length > 2000, `${id} PDF bytes (${pdfBuf.length})`);
    ok((analysis.pageCount || 0) >= 1, `${id} PDF pages (${analysis.pageCount})`);
  } catch (e) {
    ok(false, `${id} PDF export: ${e?.message || e}`);
  }
}

await browser.close();

fs.writeFileSync(
  path.join(OUT_DIR, 'report.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      systemVersion: TEMPLATE_SYSTEM_VERSION,
      templateIds: PREMIUM_TEMPLATE_SYSTEM_V1_IDS,
      checks: results,
      pass: failed === 0,
    },
    null,
    2
  )
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-premium-template-system-v1: PASS');
}
