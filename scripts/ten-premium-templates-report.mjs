#!/usr/bin/env node
/**
 * P0 — Ten Premium Templates report → TEN_PREMIUM_TEMPLATES_REPORT.md
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  TEN_PREMIUM_TEMPLATE_IDS,
  TEN_PREMIUM_TEMPLATE_NAMES,
  TEN_PREMIUM_LAYOUT_BRIEFS,
  TEN_PREMIUM_DEDICATED_CSS,
  TEN_PREMIUM_TEMPLATES_VERSION,
} from '../src/ui/templates/ten-premium-templates.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'TEN_PREMIUM_TEMPLATES_REPORT.md');
const jsonPath = join(root, 'tests/output/ten-premium-templates/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-ten-premium-templates.mjs']);
const v1 = run('node', ['src/tests/qa-premium-template-system-v1.mjs']);
const pass = bench.code === 0 && v1.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const templateRows = TEN_PREMIUM_TEMPLATE_IDS.map((id, i) => {
  const row = (report?.templates || []).find((t) => t.id === id) || {};
  const css = TEN_PREMIUM_DEDICATED_CSS[id];
  const cssExists = (() => {
    try {
      return readFileSync(join(root, 'src/ui/templates', css), 'utf8').length > 40;
    } catch {
      return false;
    }
  })();
  return `| ${i + 1} | ${TEN_PREMIUM_TEMPLATE_NAMES[id]} | \`${id}\` | ${TEN_PREMIUM_LAYOUT_BRIEFS[id] || '—'} | ${cssExists ? css : 'missing'} | ${row.page1Ok ? '✓' : '✗'} | ${row.emptySections ?? '—'} |`;
}).join('\n');

const checkRows = (report?.checks || [])
  .map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const md = `# Ten Premium Templates Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**Engine:** \`${TEN_PREMIUM_TEMPLATES_VERSION}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Score:** ${report?.passCount ?? 0}/${report?.checks?.length ?? 0}

## Mission

Professional redesign of the Hirely template gallery — ten real premium layouts that look hire-ready, not amateur or empty.

All templates consume the **same \`finalResumeData\`** surface. Render-only — no parser or OCR logic in templates.

## Catalog

| # | Display name | ID | Layout brief | CSS | Page-1 useful | Empty sections |
|---|--------------|-----|--------------|-----|---------------|----------------|
${templateRows}

## Rules

| Rule | Enforcement |
|------|-------------|
| Same finalResumeData | \`resumeDataToTemplateView\` → \`HirelyTemplates.render\` |
| No fake placeholder text | QA rejects lorem / john doe / TODO |
| Empty sections hidden | JS early-return + \`:empty\` CSS + completeness lock |
| No huge empty first page | \`passesFirstPageFillGate\` + major-section gate |
| First page useful content | Identity + summary/experience on page 1 |
| PDF-safe | Playwright vector export per template |
| A4-safe | \`cv-a4-pages.css\` + \`cv-pdf-export.css\` |
| Free preview for all | \`isTemplatePreviewAllowedForFreeUser\` (preview never paywalled) |
| Export lock remains Pro | Unchanged — preview-only for free tier |

## QA checks

| Check | Result | Detail |
|-------|--------|--------|
${checkRows || '| — | — | Run qa first |'}

## Implementation

- \`src/ui/templates/ten-premium-templates.mjs\` — canonical 10-template registry + aliases
- \`src/ui/templates/production-template-ids.mjs\` — gallery IDs + display names
- \`src/ui/templates/cv-templates.js\` — layout functions + \`PRODUCTION_TEMPLATE_IDS\`
- \`src/ui/templates/cv-templates-ats-executive.css\` — **Executive Minimal** dedicated skin (new)
- \`index.html\` — featured gallery + CSS links

## Run

\`\`\`bash
npm run qa:ten-premium-templates
npm run ten-premium-templates-report
npm run qa:premium-template-system-v1
\`\`\`

## Bench output

\`\`\`
${bench.out || '(no output)'}

--- premium-template-system-v1 ---
${v1.out || '(no output)'}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
