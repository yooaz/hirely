#!/usr/bin/env node
/**
 * P1 — Ten Premium Template Rebuild → TEN_PREMIUM_TEMPLATE_REBUILD_REPORT.md
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  TEN_PREMIUM_TEMPLATE_IDS,
  TEN_PREMIUM_TEMPLATE_NAMES,
  TEN_PREMIUM_LAYOUT_BRIEFS,
  TEN_PREMIUM_TEMPLATE_REBUILD_VERSION,
} from '../src/ui/templates/ten-premium-templates.mjs';
import { TEMPLATE_FAMILY_V2_ARCHITECTURE } from '../src/ui/templates/template-families-v2.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'TEN_PREMIUM_TEMPLATE_REBUILD_REPORT.md');
const jsonPath = join(root, 'tests/output/ten-premium-templates/report.json');
const reviewJsonPath = join(root, 'tests/output/review-before-template-lock/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 180000 });
  return { pass: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const gates = {
  reviewBeforeTemplateLock: run('src/tests/qa-review-before-template-lock.mjs'),
  tenPremium: run('src/tests/qa-ten-premium-templates.mjs'),
  v2Families: run('src/tests/qa-template-system-v2-families.mjs'),
  freePreview: run('src/tests/qa-free-template-preview-mode.mjs'),
};

let report = null;
let reviewReport = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}
try {
  reviewReport = JSON.parse(readFileSync(reviewJsonPath, 'utf8'));
} catch {
  reviewReport = null;
}

const pass =
  gates.reviewBeforeTemplateLock.pass &&
  gates.tenPremium.pass &&
  gates.v2Families.pass &&
  gates.freePreview.pass &&
  report?.pass === true;

const catalog = [
  'ATS Recruiter',
  'McKinsey Consulting',
  'Apple Minimal',
  'Kinfolk Editorial',
  'Creative Director',
  'Luxury Executive',
  'Startup Founder',
  'Tech Engineer',
  'Art Director Portfolio',
  'Classic Corporate',
];

const templateRows = TEN_PREMIUM_TEMPLATE_IDS.map((id, i) => {
  const row = (report?.templates || []).find((t) => t.id === id) || {};
  const arch = TEMPLATE_FAMILY_V2_ARCHITECTURE[id];
  return `| ${i + 1} | ${catalog[i]} | \`${id}\` | ${arch?.layoutFamily || '—'} | ${TEN_PREMIUM_LAYOUT_BRIEFS[id] || '—'} | ${row.page1Ok ? 'PASS' : '—'} | ${row.emptySections ?? '—'} |`;
}).join('\n');

const gateRows = Object.entries(gates)
  .map(([k, v]) => `| \`${k}\` | ${v.pass ? 'PASS' : 'FAIL'} |`)
  .join('\n');

const md = `# Ten Premium Template Rebuild Report (P1)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**Rebuild:** \`${TEN_PREMIUM_TEMPLATE_REBUILD_VERSION}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Prerequisite:** Import + review gates must pass before template gallery unlocks.

**Review lock:** ${reviewReport?.pass ? 'PASS' : reviewReport ? 'FAIL' : 'not run'} (${reviewReport?.summary?.pass ?? '—'}/${reviewReport?.summary?.total ?? '—'} checks)

**Template QA:** ${report?.passCount ?? 0}/${report?.checks?.length ?? 0} checks

## Goal

Ten distinct premium templates — different **layouts**, not just fonts. Same \`finalResumeData\` for all. Free users can **preview and select** any template; **PDF export** remains Pro-only.

## Catalog

| # | Display name | ID | Layout family | Brief | Page-1 | Empty sections |
|---|--------------|-----|---------------|-------|--------|----------------|
${templateRows}

## Rules

| Rule | Status |
|------|--------|
| Same finalResumeData | \`resumeDataToTemplateView\` → \`HirelyTemplates.render\` |
| Different layouts (not fonts only) | ${gates.v2Families.pass ? 'PASS' : 'FAIL'} — ≥8 layout families |
| No fake content | QA rejects lorem / placeholders |
| Empty sections hidden | Early-return + completeness lock |
| A4 safe | 794×1123 px sheets |
| PDF safe | Playwright vector export per template |
| Readable at 100% | Density + page-1 fill gates |
| First page not empty | Identity + major sections on page 1 |
| Free preview all templates | ${gates.freePreview.pass ? 'PASS' : 'FAIL'} |
| Export Pro lock only | \`requirePro()\` on download — preview never paywalled |

## Gate suites

| Suite | Result |
|-------|--------|
${gateRows}

## Modules

| Module | Role |
|--------|------|
| \`template-families-v2.mjs\` | Canonical 10 IDs, names, architecture |
| \`cv-templates.js\` | Layout functions (\`layoutClassicCorporate\`, etc.) |
| \`cv-templates-v2-families.css\` | Per-family structural CSS |
| \`review-before-template-lock.js\` | Blocks template step until review safe |
| \`free-template-preview-mode.js\` | Preview all · export Pro |

## Run

\`\`\`bash
npm run qa:review-before-template-lock
npm run qa:ten-premium-templates
npm run qa:template-system-v2-families
npm run ten-premium-template-rebuild-report
\`\`\`

## Bench output

\`\`\`
--- review-before-template-lock ---
${gates.reviewBeforeTemplateLock.out || '(no output)'}

--- ten-premium-templates ---
${gates.tenPremium.out || '(no output)'}

--- template-system-v2-families ---
${gates.v2Families.out || '(no output)'}

--- free-template-preview-mode ---
${gates.freePreview.out || '(no output)'}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
