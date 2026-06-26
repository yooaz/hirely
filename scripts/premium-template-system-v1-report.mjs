#!/usr/bin/env node
/**
 * Premium Template System V1 report → PREMIUM_TEMPLATE_SYSTEM_V1.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  PREMIUM_TEMPLATE_SYSTEM_V1_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
  TEMPLATE_SYSTEM_VERSION,
} from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PREMIUM_TEMPLATE_SYSTEM_V1.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/premium-template-system-v1/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-premium-template-system-v1.mjs', { cwd: ROOT, stdio: 'pipe' });
  qaPass = true;
} catch {
  qaPass = false;
}

if (fs.existsSync(REPORT_JSON)) {
  report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
}

const checks = report?.checks || [];
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;

const LAYOUT_BRIEFS = {
  'ats-elite': 'Dense ATS mono-column · elite contact rail',
  'swiss-editorial': 'Masthead + 2-column Swiss grid',
  'creative-director': 'Editorial hero · clients · projects · timeline',
  'art-director-portfolio': 'Dark hero · awards · press · platform links',
  'executive-luxury': 'Leadership hierarchy · impact metrics',
  'visual-timeline': 'Vertical career spine · connected work branches',
  'tech-structured': 'Skills rail split · engineering density',
  'startup-builder': 'Venture hero · traction strip · impact split',
  'agency-designer': 'Dark band header · studio split rail',
  'editorial-magazine': 'Kinfolk cover · 3-column editorial spread',
};

const templateRows = PREMIUM_TEMPLATE_SYSTEM_V1_IDS.map((id, i) => {
  const css = `cv-templates-${id}.css`;
  const exists = fs.existsSync(path.join(ROOT, 'src/ui/templates', css));
  return `| ${i + 1} | ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]} | \`${id}\` | ${LAYOUT_BRIEFS[id] || '—'} | ${exists ? css : 'pack fallback'} |`;
}).join('\n');

const md = `# Premium Template System V1

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**System version:** \`${TEMPLATE_SYSTEM_VERSION}\`  
**Template count:** ${PREMIUM_TEMPLATE_SYSTEM_V1_IDS.length}

## Scope

Ten intentionally different premium layouts — not color variations. Each template has dedicated CSS, unique layout markers, real-data rendering, A4-safe PDF export, and duplicate-section guards.

## Requirements

| Requirement | Status |
|-------------|--------|
| Fully responsive | CSS breakpoints per template |
| Real PDF export | Playwright vector export per template |
| No placeholder data | QA rejects placeholder copy |
| No duplicated sections | Section title + slug dedupe checks |
| Auto-pagination | A4 pages engine + density CSS |
| A4 safe | \`cv-a4-pages.css\` + PDF margins |
| ATS compatible where applicable | ATS Elite · Tech Structured · Startup Builder · Swiss Editorial |

## V1 catalog

| # | Name | ID | Layout family | Dedicated CSS |
|---|------|----|---------------|---------------|
${templateRows}

## Implementation map

| Layer | Path |
|-------|------|
| Layout engine | \`src/ui/templates/cv-templates.js\` |
| Production IDs | \`src/ui/templates/production-template-ids.mjs\` |
| V2 registry | \`src/ui/templates/v2/registry.js\` |
| Gallery metadata | \`src/ui/templates/premium-template-gallery.mjs\` |
| PDF stack | \`src/tests/lib/pdf-export-playwright.mjs\` |
| Picker | \`index.html\` \`FEATURED_TEMPLATE_IDS\` |

## QA

\`\`\`bash
npm run qa:premium-template-system-v1
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## PDF artifacts

\`tests/output/premium-template-system-v1/{template-id}.pdf\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
