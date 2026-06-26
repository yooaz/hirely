#!/usr/bin/env node
/**
 * Template Showcase V8 — screenshots + TEMPLATE_SHOWCASE.md
 * Run: node scripts/template-showcase.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import {
  TEMPLATE_FAMILY_V2_IDS,
  TEMPLATE_FAMILY_V2_NAMES,
  TEMPLATE_BRAND_INSPIRATION,
  TEMPLATE_FAMILY_V2_ARCHITECTURE,
  TEMPLATE_SHOWCASE_VERSION,
} from '../src/ui/templates/template-families-v2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.qa-screenshots', 'template-showcase-v8');
const REPORT = path.join(ROOT, 'TEMPLATE_SHOWCASE.md');

const SAMPLE = {
  name: 'Yohann Azancot',
  title: 'Senior Product Designer',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  linkedin: 'linkedin.com/in/yoaz',
  portfolio: 'yoaz.com',
  location: 'Paris, France',
  summary:
    'Creative professional with 12+ years across Nike, Louis Vuitton, and Adobe — brand systems, illustration, and visual storytelling.',
  experience: [
    {
      role: 'Lead Designer',
      company: 'Nike',
      dates: '2020 – Present',
      bullets: ['Led retail campaigns across EMEA', 'Directed illustration for seasonal drops'],
    },
    {
      role: 'Senior Designer',
      company: 'Studio Nova',
      dates: '2016 – 2020',
      bullets: ['Packaging systems for luxury beauty'],
    },
  ],
  experiences: [
    {
      role: 'Lead Designer',
      company: 'Nike',
      dates: '2020 – Present',
      bullets: ['Led retail campaigns across EMEA'],
    },
    {
      role: 'Senior Designer',
      company: 'Studio Nova',
      dates: '2016 – 2020',
      bullets: ['Packaging systems for luxury beauty'],
    },
  ],
  education: ['LISAA — Web & Motion Design', 'Créapole — Visual Communication'],
  skills: ['Brand identity', 'Art direction', 'Illustration', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Louis Vuitton', 'Marvel', 'Adobe', 'Pantone'],
  projects: ['Poster series — Arte · 2024', 'Packaging — Luxury beauty · 2023'],
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        profile: 'Profile',
        summary: 'Summary',
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
      })[k] || k,
    cvBlock: (title, html) =>
      html
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function buildScreenshotHtml(id, inner) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-design-tokens.css"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-templates-professional.css"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-templates-v2-families.css"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-templates-showcase-v8.css"/>
<link rel="stylesheet" href="../../src/ui/templates/cv-template-density.css"/>
<style>
body{margin:0;padding:24px;background:#e8e8e4;display:flex;justify-content:center}
.cv{width:794px;max-width:794px;min-height:1123px;box-shadow:0 12px 40px rgba(15,23,42,.12);background:#fff}
</style>
</head><body>
<div class="cv cv-page template-${id} spacing-normal cv--live">${inner}</div>
</body></html>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const T = loadTemplates();
  const shots = [];

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });

  for (let i = 0; i < TEMPLATE_FAMILY_V2_IDS.length; i++) {
    const id = TEMPLATE_FAMILY_V2_IDS[i];
    const num = String(i + 1).padStart(2, '0');
    const html = T.render(SAMPLE, id);
    const shotName = `${num}-${id}.png`;
    const shotPath = path.join(OUT_DIR, shotName);

    const doc = buildScreenshotHtml(id, html);
    const tmp = path.join(OUT_DIR, `_tmp-${id}.html`);
    fs.writeFileSync(tmp, doc);
    await page.goto(`file://${tmp}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: shotPath, fullPage: false });
    fs.unlinkSync(tmp);

    shots.push({
      id,
      num,
      name: TEMPLATE_FAMILY_V2_NAMES[id],
      brand: TEMPLATE_BRAND_INSPIRATION[id],
      file: `.qa-screenshots/template-showcase-v8/${shotName}`,
      arch: TEMPLATE_FAMILY_V2_ARCHITECTURE[id],
    });
    console.log(`OK ${shotName}`);
  }

  await browser.close();

  const rows = shots
    .map(
      (s) =>
        `| ${s.num} | ${s.name} | ${s.brand} | ${s.arch?.layoutFamily || '—'} | high |`
    )
    .join('\n');

  const gallery = shots
    .map(
      (s) => `### ${s.num} ${s.name} — inspired by ${s.brand}

![${s.name}](${s.file})

| Spec | Value |
|------|-------|
| Template ID | \`${s.id}\` |
| Grid | ${s.arch?.grid || '—'} |
| Typography | ${s.arch?.typography || '—'} |
| Spacing | ${s.arch?.spacing || '—'} |
| Emphasis | ${s.arch?.emphasis || '—'} |
`
    )
    .join('\n');

  const md = `# TEMPLATE_SHOWCASE

**Version:** \`${TEMPLATE_SHOWCASE_VERSION}\`  
**Generated:** ${new Date().toISOString()}  
**Templates:** 8 recruiter-grade · ATS-compatible · A4 794×1123px

## Lineup

| # | Template | Inspiration | Layout | ATS |
|---|----------|-------------|--------|-----|
${rows}

## Design principles

- **ATS compatible** — text skills, semantic sections, no forbidden markup (bars, dots, ribbons)
- **Perfect A4** — 794×1123px preview = PDF export dimensions
- **No overlap** — \`break-inside: avoid\`, boxed grids, overflow hidden
- **Premium typography** — brand-specific font stacks per template
- **Professional spacing** — tuned vertical rhythm per family
- **Export = preview** — print CSS + \`print-color-adjust: exact\`

## Brand inspiration map

| Brand | Template | Design language |
|-------|----------|-----------------|
| Apple | 01 Executive | Monument identity, hairline rules, keynote restraint |
| McKinsey | 02 Consulting | Navy authority, 4/8 split, impact matrix |
| Airbnb | 03 Creative | Coral warmth, client grid, hospitality polish |
| Linear | 04 Startup | Purple accent, traction metrics, sharp UI |
| Google | 05 Tech | Multi-color bar, skills rail, systems focus |
| Tesla | 06 Corporate | Minimal red accent, uppercase discipline |
| Notion | 07 Minimal | Warm gray document, subtle borders |
| Stripe | 08 Premium ATS | Indigo precision, dense recruiter grid |

## Screenshots

${gallery}

## Files

| File | Role |
|------|------|
| \`src/ui/templates/template-families-v2.mjs\` | 8-template catalog + brand metadata |
| \`src/ui/templates/cv-templates.js\` | Layout render functions |
| \`src/ui/templates/cv-templates-v2-families.css\` | Base V2 family styles |
| \`src/ui/templates/cv-templates-showcase-v8.css\` | Brand polish layer |
| \`scripts/template-showcase.mjs\` | Screenshot + report generator |

## Regenerate

\`\`\`bash
node scripts/template-showcase.mjs
npm run template:showcase
\`\`\`
`;

  fs.writeFileSync(REPORT, md);
  console.log(`\nReport → ${REPORT}`);
  console.log(`Screenshots → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
