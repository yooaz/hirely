#!/usr/bin/env node
/**
 * H20 — Real template system acceptance checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  H20_TEMPLATE_FINGERPRINTS,
  H20_PRODUCTION_NAMES,
  TEMPLATE_SYSTEM_H20,
} from '../ui/templates/template-system-h20.mjs';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/h20-real-template-system');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const REQUIRED_NAMES = [
  'ATS Clean',
  'Executive Minimal',
  'Creative Portfolio',
  'Editorial Modern',
  'Tech Resume',
];

// Five production templates
check('five production template ids', PRODUCTION_TEMPLATE_IDS.length === 5);
for (const name of REQUIRED_NAMES) {
  check(`production includes ${name}`, H20_PRODUCTION_NAMES.includes(name));
}

// cv-templates.js definitions
{
  const tpl = read('src/ui/templates/cv-templates.js');
  for (const name of REQUIRED_NAMES) {
    check(`cv-templates defines ${name}`, tpl.includes(`name: '${name}'`));
  }
  check('H20 layout class ats', tpl.includes('cvLayout-h20-ats'));
  check('H20 layout class executive', tpl.includes('cvLayout-h20-executive'));
  check('H20 layout class creative', tpl.includes('cvLayout-h20-creative'));
  check('H20 layout class editorial', tpl.includes('cvLayout-h20-editorial'));
  check('H20 layout class tech', tpl.includes('cvLayout-h20-tech'));
  check('wrap adds cvTpl-h20-* class', tpl.includes('cvTpl-h20-${tplId}'));
}

// Distinct layout families
{
  const tpl = read('src/ui/templates/cv-templates.js');
  const layouts = [
    'cvLayout-h20-ats',
    'cvLayout-h20-executive',
    'cvLayout-h20-creative',
    'cvLayout-h20-editorial',
    'cvLayout-h20-tech',
  ];
  const unique = new Set(layouts.filter((l) => tpl.includes(l)));
  check('five distinct H20 layout classes', unique.size === 5);
}

// H20 CSS differentiation
{
  const css = read('src/ui/templates/cv-templates-h20.css');
  check('h20 css linked in index', read('index.html').includes('cv-templates-h20.css'));
  check('ats IBM Plex typography', /IBM Plex Sans/.test(css));
  check('executive Cormorant typography', /Cormorant Garamond/.test(css));
  check('creative Playfair typography', /Playfair Display/.test(css));
  check('editorial Helvetica typography', /Helvetica Neue/.test(css));
  check('tech JetBrains typography', /JetBrains Mono/.test(css));
  check('tech dark rail', /--h20-rail:\s*#0f172a/.test(css));
  check('editorial asymmetric grid', /--h20-grid:\s*34% 1fr/.test(css));
  check('ats single column grid var', /\.cv\.template-ats[\s\S]*--h20-grid:\s*1fr/.test(css));
  check('executive centered hierarchy', /text-align:\s*center/.test(css));
  check('creative section reorder', /\.cvSection--clients/.test(css));
}

// PDF per-template output
{
  const pdf = read('src/ui/templates/cv-pdf-export.css');
  check('pdf ats h20 rules', pdf.includes('cvTpl-h20-ats'));
  check('pdf executive h20 rules', pdf.includes('cvTpl-h20-executive-minimal'));
  check('pdf creative h20 rules', pdf.includes('cvTpl-h20-creative'));
  check('pdf editorial h20 rules', pdf.includes('cvTpl-h20-editorial'));
  check('pdf tech h20 dark rail', pdf.includes('cvTpl-h20-modern-two-column'));
}

// Fingerprints unique
{
  const grids = new Set(Object.values(H20_TEMPLATE_FINGERPRINTS).map((f) => f.grid));
  const typos = new Set(Object.values(H20_TEMPLATE_FINGERPRINTS).map((f) => f.typography));
  check('unique grid fingerprints', grids.size === 5, [...grids].join(' | '));
  check('unique typography fingerprints', typos.size === 5, [...typos].join(' | '));
}

const pass = checks.every((c) => c.ok);
const report = {
  version: TEMPLATE_SYSTEM_H20,
  pass,
  verdict: pass ? 'PASS' : 'FAIL',
  templates: listFromFingerprints(),
  checks,
  auditedAt: new Date().toISOString(),
};

function listFromFingerprints() {
  return PRODUCTION_TEMPLATE_IDS.map((id) => ({
    id,
    displayName: H20_PRODUCTION_NAMES[PRODUCTION_TEMPLATE_IDS.indexOf(id)],
    ...H20_TEMPLATE_FINGERPRINTS[id],
  }));
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nH20 real template system: ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
