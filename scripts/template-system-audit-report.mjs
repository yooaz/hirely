#!/usr/bin/env node
/**
 * Premium Template System Audit — screenshots + TEMPLATE_SYSTEM_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_FAMILY_V3_NAMES,
  TEMPLATE_FAMILY_V3_CATEGORIES,
  TEMPLATE_FAMILY_V3_ARCHITECTURE,
  TEMPLATE_LIBRARY_V3_VERSION,
} from '../src/ui/templates/template-families-v3.mjs';
import { resumeDataToTemplateView } from '../src/ui/templates/v2/view-model.js';
import { loadHirelyTemplates } from '../src/tests/lib/pdf-hardening-suite.mjs';
import {
  passesFirstPageFillGate,
  passesMajorSectionsPage1Gate,
  countPopulatedSections,
  MAJOR_SECTION_CLASS_HINTS,
} from '../src/ui/templates/template-density.mjs';
import { scoreTemplateCompletenessLock } from '../src/ui/templates/template-completeness.js';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '../src/core/export/pdf-export-config.js';
import { buildPdfExportHtml, layoutCvForExport } from '../src/tests/lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'TEMPLATE_SYSTEM_AUDIT.md');
const SHOT_DIR = path.join(ROOT, '.qa-screenshots', 'template-system-audit');
const JSON_OUT = path.join(ROOT, 'tests/output/template-system-audit/report.json');

/** Shared cvData source — same payload for every template. */
const SHARED_RESUME = {
  identity: {
    name: 'Alex Morgan',
    title: 'Senior Product Lead',
    email: 'alex@venture.example',
    phone: '+1 415 555 0100',
    location: 'San Francisco, CA',
    portfolio: 'https://alexmorgan.dev',
    linkedin: 'https://linkedin.com/in/alexmorgan',
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
    {
      role: 'Product Manager',
      company: 'Google',
      dates: '2014–2017',
      bullets: ['Launched Workspace features used by 2M teams.', 'Reduced churn 18% via onboarding redesign.'],
    },
  ],
  education: ['Stanford GSB — MBA', 'MIT — BS Computer Science'],
  skills: ['Product strategy', 'Go-to-market', 'Team building', 'Fundraising', 'Analytics'],
  tools: ['Figma', 'Notion', 'Linear', 'SQL', 'Amplitude'],
  languages: ['English — native', 'French — professional'],
  clients: ['Nike', 'Adobe', 'Apple'],
  projects: ['Payments platform relaunch — 2023', 'Creator economy suite — 2022'],
  unsorted: [],
  meta: {},
};

function buildPreviewDoc(templateId, innerHtml) {
  const cssLinks = [
    'src/ui/templates/cv-design-tokens.css',
    'src/ui/templates/cv-templates-professional.css',
    'src/ui/templates/cv-template-density.css',
    'src/ui/templates/cv-templates-v3-families.css',
    'src/ui/templates/cv-a4-pages.css',
    'src/ui/templates/cv-pdf-export.css',
  ]
    .map((href) => `<link rel="stylesheet" href="../../${href}"/>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
${cssLinks}
<style>
  body{margin:0;padding:24px;background:#ececec;display:flex;justify-content:center}
  .cv{width:${A4_WIDTH_PX}px;max-width:${A4_WIDTH_PX}px;min-height:${A4_HEIGHT_PX}px;background:#fff;box-shadow:0 10px 32px rgba(15,23,42,.12);overflow:hidden}
  .cvInner{overflow:hidden}
</style>
</head><body>
<div class="cv cv-page template-${templateId} spacing-normal cv--live"><div class="cvInner cvLayout-v3">${innerHtml}</div></div>
</body></html>`;
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });

  const HT = loadHirelyTemplates();
  const view = resumeDataToTemplateView(SHARED_RESUME, { skipFinalGate: true });
  const sectionCount = countPopulatedSections(view);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 920, height: 1280 } });

  const rows = [];
  let failed = 0;

  const majorSel = MAJOR_SECTION_CLASS_HINTS.map((c) => `.${c}`).join(', ');

  for (let i = 0; i < TEMPLATE_FAMILY_V3_IDS.length; i++) {
    const id = TEMPLATE_FAMILY_V3_IDS[i];
    const num = String(i + 1).padStart(2, '0');
    const html = String(HT.render(view, id) || '');
    const shotRel = `.qa-screenshots/template-system-audit/${num}-${id}.png`;
    const shotPath = path.join(ROOT, shotRel);

    const exportHtml = buildPdfExportHtml(html, id);
    await page.setContent(exportHtml, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.waitForTimeout(120);
    await layoutCvForExport(page);

    const metrics = await page.evaluate(
      ({ majorSelector, a4W, a4H }) => {
        const sheet = document.querySelector('.cvA4Sheet[data-page="1"]') || document.querySelector('.cvA4Sheet');
        const inner = sheet?.querySelector('.cvInner');
        const emptySections = sheet
          ? [...sheet.querySelectorAll('.cvSection')].filter((s) => {
              const body = s.querySelector('.cvSectionBody');
              return body && !String(body.textContent || '').trim();
            }).length
          : 0;
        const hasIdentity = !!(sheet?.querySelector('.cvName')?.textContent || '').trim();
        const majorSections = sheet ? sheet.querySelectorAll(majorSelector).length : 0;
        const contentPx = inner ? Math.max(inner.scrollHeight, inner.offsetHeight) : 0;
        const horizOverflow = inner ? inner.scrollWidth > inner.clientWidth + 2 : false;
        return {
          emptySections,
          hasIdentity,
          majorSections,
          fillRatio: contentPx / a4H,
          width: sheet?.offsetWidth || 0,
          horizOverflow,
        };
      },
      { majorSelector: majorSel, a4W: A4_WIDTH_PX, a4H: A4_HEIGHT_PX }
    );

    const sheet = page.locator('.cvA4Sheet[data-page="1"], .cvA4Sheet').first();
    await sheet.screenshot({ path: shotPath });

    const completeness = scoreTemplateCompletenessLock(html, SHARED_RESUME);
    const page1Ok =
      passesMajorSectionsPage1Gate(metrics.majorSections, metrics.hasIdentity) &&
      passesFirstPageFillGate(sectionCount, metrics.fillRatio);
    const a4Ok = metrics.width === A4_WIDTH_PX && !metrics.horizOverflow;
    const noEmpty = metrics.emptySections === 0;
    const pass = page1Ok && a4Ok && noEmpty && (completeness.pass || completeness.score >= 88);

    if (!pass) failed += 1;

    rows.push({
      id,
      num,
      name: TEMPLATE_FAMILY_V3_NAMES[id],
      category: TEMPLATE_FAMILY_V3_CATEGORIES[id],
      screenshot: shotRel,
      architecture: TEMPLATE_FAMILY_V3_ARCHITECTURE[id],
      metrics,
      completeness: completeness.score,
      page1Ok,
      a4Ok,
      noEmpty,
      pass,
    });

    console.log(`${pass ? 'PASS' : 'FAIL'} ${num} ${TEMPLATE_FAMILY_V3_NAMES[id]} (${id})`);
  }

  await browser.close();

  const passCount = rows.filter((r) => r.pass).length;
  const overallPass = failed === 0 && rows.length === 10;

  const catalogTable = rows
    .map(
      (r) =>
        `| ${r.num} | ${r.category} | ${r.name} | \`${r.id}\` | ${r.a4Ok ? '✓' : '✗'} | ${r.noEmpty ? '✓' : '✗'} | ${r.page1Ok ? '✓' : '✗'} | ${r.pass ? 'PASS' : 'FAIL'} |`
    )
    .join('\n');

  const gallery = rows
    .map(
      (r) => `### ${r.num} ${r.name} — ${r.category}

![${r.name}](${r.screenshot})

| Spec | Value |
|------|-------|
| Template ID | \`${r.id}\` |
| Grid | ${r.architecture?.grid || '—'} |
| Typography | ${r.architecture?.typography || '—'} |
| A4 width | ${r.metrics.width}px (target ${A4_WIDTH_PX}) |
| Page-1 fill | ${(r.metrics.fillRatio * 100).toFixed(1)}% |
| Empty sections | ${r.metrics.emptySections} |
| Completeness | ${r.completeness}/100 |
`
    )
    .join('\n');

  const md = `# Template System Audit

**Status:** ${overallPass ? 'PASS' : 'FAIL'}

**Engine:** \`${TEMPLATE_LIBRARY_V3_VERSION}\`

**Generated:** ${new Date().toISOString()}

**Score:** ${passCount}/${rows.length} templates pass A4 · no overflow · no empty sections · page-1 density

## Mission

Ten premium, role-specific CV templates that share one \`cvData\` / \`finalResumeData\` source. Each layout is structurally distinct — not a generic reskin.

## Requirements

| Requirement | Enforcement |
|-------------|-------------|
| Perfect A4 | ${A4_WIDTH_PX}×${A4_HEIGHT_PX}px preview = PDF export dimensions |
| No overflow | \`overflow:hidden\` + section \`break-inside:avoid\` + clip audit |
| No cut text | Completeness lock + empty-section gate |
| No layout jumps | Single render path · no post-render DOM mutation |
| Same cvData source | \`resumeDataToTemplateView(SHARED_RESUME)\` for all templates |

## Premium catalog (10)

| # | Category | Display name | ID | A4 | No empty | Page 1 | Result |
|---|----------|--------------|-----|:--:|:--------:|:------:|:------:|
${catalogTable}

## Data contract

All templates render from the same structured payload:

\`\`\`javascript
resumeDataToTemplateView(SHARED_RESUME) → HirelyTemplates.render(view, templateId)
\`\`\`

Fields consumed: identity, summary, experiences, education, skills, tools, languages, clients, projects.

## Screenshots

${gallery}

## Files

| File | Role |
|------|------|
| \`src/ui/templates/template-families-v3.mjs\` | 10-template catalog + categories |
| \`src/ui/templates/cv-templates.js\` | Layout render functions |
| \`src/ui/templates/cv-templates-v3-families.css\` | Per-template typography + grid |
| \`scripts/template-system-audit-report.mjs\` | Screenshot + audit generator |

## Regenerate

\`\`\`bash
npm run template-system-audit-report
npm run qa:ten-premium-templates
\`\`\`
`;

  fs.writeFileSync(OUT_MD, md);
  fs.writeFileSync(
    JSON_OUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), pass: overallPass, templates: rows }, null, 2)}\n`
  );

  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Screenshots → ${SHOT_DIR}`);
  console.log(`Status: ${overallPass ? 'PASS' : 'FAIL'} (${passCount}/${rows.length})`);
  process.exit(overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
