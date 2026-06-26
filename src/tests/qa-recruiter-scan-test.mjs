#!/usr/bin/env node
/**
 * HIRELY Recruiter Scan Test — audit every V3 template for 6–10s first-scan visibility.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { A4_WIDTH_PX } from '../core/export/pdf-export-config.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import { buildRecruiterScanHtml } from './lib/recruiter-scan-playwright.mjs';
import {
  RECRUITER_SCAN_TEST_V1,
  SCAN_ZONE_PX,
  SCAN_ZONE_SECONDS_MIN,
  SCAN_ZONE_SECONDS_MAX,
  SCAN_FIELDS,
  SCAN_FIELD_WEIGHTS,
  scoreScanField,
  computeScanScore,
  rankScanResults,
  SCAN_DOM_MEASURE_SCRIPT,
} from '../core/validation/recruiter-scan-test.js';
import {
  TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_FAMILY_V3_NAMES,
} from '../ui/templates/template-families-v3.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const OUT_DIR = join(ROOT, 'tests/output/recruiter-scan-test');

const FIXTURE = {
  name: 'Alex Morgan',
  title: 'Senior Product Manager',
  email: 'alex.morgan@hirely.test',
  phone: '+1 415 555 0100',
  location: 'San Francisco, CA',
  summary: 'Operator scaling venture-backed teams with measurable revenue outcomes.',
  experience: [
    {
      role: 'Head of Product',
      company: 'Northline',
      dates: '2021–Present',
      bullets: ['Grew ARR from $0 to $4.2M in 28 months.', 'Raised $8M Series A.'],
    },
    {
      role: 'Product Lead',
      company: 'Stripe',
      dates: '2017–2021',
      bullets: ['Led onboarding for 14M merchants.'],
    },
  ],
  education: ['Stanford GSB — MBA', 'MIT — BS Computer Science'],
  skills: ['Product strategy', 'Go-to-market', 'Team building'],
  tools: ['Figma', 'Linear', 'SQL'],
  languages: ['English — native'],
  clients: ['Nike', 'Adobe'],
  projects: ['Payments relaunch — 2023'],
};

function textMatchesField(field, measureText, fixture) {
  const t = String(measureText || '').toLowerCase();
  if (!t) return false;
  if (field === 'name') return t.includes('alex') && t.includes('morgan');
  if (field === 'title') return t.includes('product') || t.includes('manager');
  if (field === 'experience') return t.includes('northline') || t.includes('stripe') || t.includes('head of product');
  if (field === 'skills') return t.includes('product') || t.includes('go-to-market') || t.includes('team');
  if (field === 'education') return t.includes('stanford') || t.includes('mit') || t.includes('mba');
  if (field === 'contact') {
    return t.includes('alex.morgan') || t.includes('415') || t.includes('san francisco');
  }
  return true;
}

function buildFieldResults(rawFields) {
  return SCAN_FIELDS.map((field) => {
    const m = rawFields[field];
    return scoreScanField(field, {
      topPx: m?.topPx ?? null,
      heightPx: m?.heightPx ?? null,
      hasText: !!m?.text,
      textMatch: m ? textMatchesField(field, m.text, FIXTURE) : false,
    });
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const T = loadHirelyTemplates();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: A4_WIDTH_PX + 48, height: 1200 } });

const rows = [];

for (const templateId of TEMPLATE_FAMILY_V3_IDS) {
  const inner = T.render(FIXTURE, templateId);
  ok(!!inner && inner.length > 100, `${templateId} renders`);

  const html = buildRecruiterScanHtml(inner, templateId);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);

  const measure = await page.evaluate(SCAN_DOM_MEASURE_SCRIPT);
  ok(measure?.ok, `${templateId} DOM measure`);

  const fields = buildFieldResults(measure?.fields || {});
  const scanScore = computeScanScore(fields);
  const inZone = fields.filter((f) => f.inScanZone).length;

  rows.push({
    templateId,
    displayName: TEMPLATE_FAMILY_V3_NAMES[templateId] || templateId,
    scanScore,
    inZoneCount: inZone,
    fields,
    cvHeightPx: measure?.cvHeightPx ?? 0,
  });

  ok(scanScore >= 0, `${templateId} scan score computed (${scanScore})`);
  if (scanScore < 0.55) {
    console.warn(`WARN ${templateId} low scan score ${scanScore} — see SCAN_TEST_REPORT.md`);
  }
}

await browser.close();

const ranked = rankScanResults(rows);

writeFileSync(
  join(OUT_DIR, 'report.json'),
  JSON.stringify(
    {
      version: RECRUITER_SCAN_TEST_V1,
      generatedAt: new Date().toISOString(),
      scanZonePx: SCAN_ZONE_PX,
      scanZoneSeconds: `${SCAN_ZONE_SECONDS_MIN}-${SCAN_ZONE_SECONDS_MAX}`,
      fixture: FIXTURE,
      ranked: ranked.map((r, i) => ({ rank: i + 1, ...r })),
    },
    null,
    2
  ),
  'utf8'
);

ok(ranked.length === 10, 'all 10 templates audited');
ok(ranked[0].scanScore >= ranked[ranked.length - 1].scanScore, 'rank order valid');

console.log('\n--- Recruiter scan ranking (best → worst) ---');
ranked.forEach((r, i) => {
  const zone = r.fields.filter((f) => f.inScanZone).map((f) => f.field).join(', ');
  console.log(`${i + 1}. ${r.displayName} (${r.templateId}) — score ${r.scanScore} · zone: ${zone || '—'}`);
});

if (failed) {
  console.error(`\n${failed} recruiter scan check(s) failed`);
  process.exit(1);
}
console.log('\nAll recruiter scan tests passed.');
