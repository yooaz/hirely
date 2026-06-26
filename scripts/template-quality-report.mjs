#!/usr/bin/env node
/**
 * HIRELY Template V1 Quality Reset — audit six production templates.
 * Generates TEMPLATE_QUALITY_REPORT.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  TEMPLATE_V1_VERSION,
  TEMPLATE_V1_IDS,
  TEMPLATE_V1_NAMES,
  TEMPLATE_V1_ARCHITECTURE,
  TEMPLATE_V1_ALIASES,
  resolveTemplateV1Id,
} from '../src/ui/templates/template-v1-catalog.mjs';
import {
  PRODUCTION_TEMPLATE_IDS,
  FEATURED_TEMPLATE_IDS,
} from '../src/ui/templates/production-template-ids.mjs';
import { PREMIUM_TEMPLATE_GALLERY_META } from '../src/ui/templates/premium-template-gallery.mjs';
import { loadHirelyTemplates } from '../src/tests/lib/pdf-hardening-suite.mjs';
import { buildPdfExportHtml, layoutCvForExport } from '../src/tests/lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'TEMPLATE_QUALITY_REPORT.md');
const INDEX_HTML = path.join(ROOT, 'index.html');
const CV_TEMPLATES_JS = path.join(ROOT, 'src/ui/templates/cv-templates.js');
const STYLE_CSS = path.join(ROOT, 'src/ui/studio/style-step-layout.css');
const GALLERY_CSS = path.join(ROOT, 'src/ui/templates/premium-template-gallery.css');

const REMOVED_DUPLICATE_IDS = [
  'creative-director',
  'creative-director-portfolio',
  'premium-ats',
  'ats-recruiter',
  'google-style',
  'apple-style',
  'consulting-elite',
  'startup-founder',
  'senior-engineer',
  'executive-board',
  'luxury-editorial',
];

const SAMPLE_CV = {
  name: 'Alex Martin',
  title: 'Product Designer',
  email: 'alex@studio.com',
  phone: '+33 6 00 00 00 00',
  linkedin: 'linkedin.com/in/alexmartin',
  portfolio: 'alexmartin.design',
  location: 'Paris',
  summary: 'Designer crafting visual systems for global clients across brand and product.',
  experience: [
    'Lead Designer — Studio A — 2020 — 2025',
    'Senior Designer — Agency B — 2016 — 2020',
  ],
  education: ['École — Design visuel — 2014 — 2016'],
  skills: ['Brand design', 'UI systems', 'Typography'],
  tools: ['Figma', 'Illustrator'],
  languages: ['Français — natif', 'Anglais — courant'],
  clients: ['Marque A', 'Marque B', 'Marque C'],
  projects: ['Projet éditorial', 'Campagne packaging'],
};

const checks = [];
const templateRows = [];

function ok(name, detail = '') {
  checks.push({ name, ok: true, detail });
}
function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

const indexHtml = fs.readFileSync(INDEX_HTML, 'utf8');
const cvJs = fs.readFileSync(CV_TEMPLATES_JS, 'utf8');
const styleCss = fs.readFileSync(STYLE_CSS, 'utf8');
const galleryCss = fs.readFileSync(GALLERY_CSS, 'utf8');

// —— Catalog sync ——
if (PRODUCTION_TEMPLATE_IDS.length === 6) ok('Production catalog count', '6 templates');
else fail('Production catalog count', `expected 6, got ${PRODUCTION_TEMPLATE_IDS.length}`);

if (JSON.stringify([...PRODUCTION_TEMPLATE_IDS]) === JSON.stringify([...TEMPLATE_V1_IDS])) {
  ok('Production IDs match V1 catalog');
} else {
  fail('Production IDs match V1 catalog', `${PRODUCTION_TEMPLATE_IDS.join(', ')}`);
}

if (JSON.stringify([...FEATURED_TEMPLATE_IDS]) === JSON.stringify([...TEMPLATE_V1_IDS])) {
  ok('Featured gallery IDs match V1 catalog');
} else {
  fail('Featured gallery IDs match V1 catalog');
}

for (const id of TEMPLATE_V1_IDS) {
  if (indexHtml.includes(`'${id}'`) || indexHtml.includes(`"${id}"`)) {
    ok(`index.html references ${id}`);
  } else {
    fail(`index.html references ${id}`, 'missing from FEATURED_TEMPLATE_IDS block');
  }
}

for (const dup of REMOVED_DUPLICATE_IDS) {
  const featuredRe = new RegExp(`FEATURED_TEMPLATE_IDS=\\[[^\\]]*['"]${dup}['"]`);
  if (featuredRe.test(indexHtml)) {
    fail(`Removed duplicate in gallery: ${dup}`, 'still in FEATURED_TEMPLATE_IDS');
  } else {
    ok(`Removed duplicate not in gallery: ${dup}`);
  }
}

// —— Unique architecture fingerprints ——
const layoutFamilies = new Set();
const typographyKeys = new Set();
for (const id of TEMPLATE_V1_IDS) {
  const arch = TEMPLATE_V1_ARCHITECTURE[id];
  if (!arch) {
    fail(`${id} architecture metadata`, 'missing');
    continue;
  }
  layoutFamilies.add(arch.layoutFamily);
  typographyKeys.add(arch.typography);
  if (PREMIUM_TEMPLATE_GALLERY_META[id]) ok(`${id} gallery meta`);
  else fail(`${id} gallery meta`, 'missing from PREMIUM_TEMPLATE_GALLERY_META');
}
if (layoutFamilies.size === 6) ok('Unique layout families', '6 distinct layoutFamily values');
else fail('Unique layout families', `${layoutFamilies.size}/6`);

if (typographyKeys.size === 6) ok('Unique typography descriptors', '6 distinct typography strings');
else fail('Unique typography descriptors', `${typographyKeys.size}/6`);

// —— Registry + render ——
const T = loadHirelyTemplates();
const prodMatch = cvJs.match(/const PRODUCTION_TEMPLATE_IDS = \[([\s\S]*?)\];/);
const registryIds = prodMatch
  ? [...prodMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  : [];

if (JSON.stringify(registryIds) === JSON.stringify([...TEMPLATE_V1_IDS])) {
  ok('cv-templates.js PRODUCTION_TEMPLATE_IDS');
} else {
  fail('cv-templates.js PRODUCTION_TEMPLATE_IDS', registryIds.join(', '));
}

for (const id of TEMPLATE_V1_IDS) {
  const tpl = T.resolve(id);
  if (tpl?.id === id) ok(`Registry resolve ${id}`);
  else fail(`Registry resolve ${id}`, `resolved to ${tpl?.id}`);

  const html = T.render(SAMPLE_CV, id);
  if (html && html.length > 400) ok(`${id} renders HTML`, `${html.length} chars`);
  else fail(`${id} renders HTML`, 'empty or too short');

  const arch = TEMPLATE_V1_ARCHITECTURE[id];
  const markerHit = arch.layoutMarkers.some((m) => html.includes(m));
  if (markerHit) ok(`${id} layout marker`, arch.layoutMarkers.find((m) => html.includes(m)));
  else fail(`${id} layout marker`, `expected one of ${arch.layoutMarkers.join(', ')}`);

  const mini = T.renderMini(id);
  if (mini && mini.includes('tplMiniWrap')) ok(`${id} mini preview`);
  else fail(`${id} mini preview`, 'missing tplMiniWrap');

  templateRows.push({
    id,
    name: TEMPLATE_V1_NAMES[id],
    layoutFamily: arch.layoutFamily,
    typography: arch.typography,
    spacing: arch.spacing,
    hierarchy: arch.hierarchy,
    htmlLen: html.length,
    marker: arch.layoutMarkers.find((m) => html.includes(m)) || '—',
  });
}

// —— Alias consolidation ——
for (const dup of REMOVED_DUPLICATE_IDS) {
  const canonical = resolveTemplateV1Id(dup);
  if (TEMPLATE_V1_IDS.includes(canonical)) {
    ok(`Alias ${dup} → ${canonical}`);
  } else {
    fail(`Alias ${dup}`, `resolves to ${canonical}`);
  }
}

// —— Thumbnail readability (CSS scale floors) ——
const styleScale = styleCss.match(/docStep-style[\s\S]*?scale\(([\d.]+)\)/);
const galleryScale = galleryCss.match(/premiumTplPreview \.tplMini[\s\S]*?scale\(([\d.]+)\)/);
const styleWrapH = styleCss.match(/docStep-style[\s\S]*?tplMiniWrap[\s\S]*?height:\s*(\d+)px/);

if (styleScale && Number(styleScale[1]) >= 0.14) {
  ok('Style-step thumbnail scale', styleScale[1]);
} else {
  fail('Style-step thumbnail scale', styleScale ? styleScale[1] : 'not found — min 0.14');
}

if (styleWrapH && Number(styleWrapH[1]) >= 80) {
  ok('Style-step thumbnail height', `${styleWrapH[1]}px`);
} else {
  fail('Style-step thumbnail height', styleWrapH ? `${styleWrapH[1]}px` : 'not found — min 80px');
}

if (galleryScale && Number(galleryScale[1]) >= 0.2) {
  ok('Gallery thumbnail scale', galleryScale[1]);
} else {
  fail('Gallery thumbnail scale', galleryScale ? galleryScale[1] : 'not found');
}

// —— A4 preview smoke (Playwright) ——
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

for (const id of TEMPLATE_V1_IDS) {
  const inner = T.render(SAMPLE_CV, id);
  const html = buildPdfExportHtml(inner, id);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await layoutCvForExport(page);

  const metrics = await page.evaluate(() => {
    const sheet = document.querySelector('.cvA4Sheet') || document.querySelector('.cv');
    const text = (sheet?.innerText || '').replace(/\s+/g, ' ').trim();
    const rootFont = sheet ? parseFloat(getComputedStyle(sheet).fontSize) : 0;
    const bodyMin = Math.min(
      ...[...document.querySelectorAll('.cvBody, .cvMain, .cvInner, p, li')]
        .map((el) => parseFloat(getComputedStyle(el).fontSize))
        .filter((n) => n > 0)
    );
    return {
      textLen: text.length,
      rootFontPx: rootFont,
      minBodyFontPx: Number.isFinite(bodyMin) ? bodyMin : rootFont,
      hasA4: !!document.querySelector('.cvA4Sheet, .cvPage, .cv'),
    };
  });

  if (metrics.hasA4) ok(`${id} A4 preview shell`);
  else fail(`${id} A4 preview shell`, 'no cvA4Sheet/cvPage');

  if (metrics.textLen >= 120) ok(`${id} A4 readable text`, `${metrics.textLen} chars`);
  else fail(`${id} A4 readable text`, `${metrics.textLen} chars`);

  if (metrics.minBodyFontPx >= 9) ok(`${id} min font size`, `${metrics.minBodyFontPx}px`);
  else fail(`${id} min font size`, `${metrics.minBodyFontPx}px — below 9px floor`);
}

await browser.close();

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);
const status = failed.length === 0 ? 'PASS' : 'FAIL';
const now = new Date().toISOString();

const md = `# TEMPLATE QUALITY REPORT

**Status:** ${status}
**Version:** ${TEMPLATE_V1_VERSION}
**Generated:** ${now}
**Checks:** ${passed}/${checks.length} passed

## V1 production templates (6)

| # | ID | Display name | Layout family | Typography |
|---|-----|--------------|---------------|------------|
${templateRows
  .map(
    (r, i) =>
      `| ${i + 1} | \`${r.id}\` | ${r.name} | ${r.layoutFamily} | ${r.typography.split('·')[0].trim()} |`
  )
  .join('\n')}

## Section hierarchy

${templateRows.map((r) => `- **${r.name}:** ${r.hierarchy}`).join('\n')}

## Spacing rhythm

${templateRows.map((r) => `- **${r.name}:** ${r.spacing}`).join('\n')}

## Removed duplicates (aliased, not in gallery)

${REMOVED_DUPLICATE_IDS.map((id) => `- \`${id}\` → \`${resolveTemplateV1Id(id)}\``).join('\n')}

## Check results

${checks
  .map((c) => `- ${c.ok ? '✅' : '❌'} **${c.name}**${c.detail ? ` — ${c.detail}` : ''}`)
  .join('\n')}

${
  failed.length
    ? `## Failures

${failed.map((c) => `- **${c.name}:** ${c.detail}`).join('\n')}
`
    : ''
}
## Acceptance

- [${status === 'PASS' ? 'x' : ' '}] Exactly 6 templates in production gallery
- [${failed.every((f) => !f.name.includes('duplicate')) ? 'x' : ' '}] No duplicate Creative Director / Marketing / repeated ATS cards in gallery
- [${failed.every((f) => !f.name.includes('typography') && !f.name.includes('layout')) ? 'x' : ' '}] Unique typography, spacing, and hierarchy per template
- [${failed.every((f) => !f.name.includes('A4') && !f.name.includes('font')) ? 'x' : ' '}] Clean A4 preview with readable font sizes
- [${failed.every((f) => !f.name.includes('thumbnail')) ? 'x' : ' '}] Gallery thumbnails above minimum scale (not tiny unreadable)
`;

fs.writeFileSync(REPORT_PATH, md);
console.log(`Wrote ${REPORT_PATH}`);
console.log(`Status: ${status} (${passed}/${checks.length})`);
process.exit(failed.length ? 1 : 0);
