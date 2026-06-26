#!/usr/bin/env node
/**
 * P0 — Template quality gate → TEMPLATE_QUALITY_GATE_REPORT.md
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  TEN_PREMIUM_TEMPLATE_IDS,
  TEN_PREMIUM_TEMPLATE_NAMES,
} from '../src/ui/templates/ten-premium-templates.mjs';
import {
  TEMPLATE_QUALITY_GATE_V1,
  TEMPLATE_QUALITY_RULES,
} from '../src/ui/templates/template-quality-gate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'TEMPLATE_QUALITY_GATE_REPORT.md');
const jsonPath = join(root, 'tests/output/template-quality-gate/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-template-quality-gate.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const templateRows = TEN_PREMIUM_TEMPLATE_IDS.map((id) => {
  const row = (report?.templates || []).find((t) => t.id === id) || {};
  const status = row.pass ? 'PASS' : 'FAIL';
  const fails = (row.failures || []).join(', ') || '—';
  return `| ${TEN_PREMIUM_TEMPLATE_NAMES[id]} | \`${id}\` | ${row.fillPct ?? '—'}% | ${row.blankTailPct ?? '—'}% | ${status} | ${fails} |`;
}).join('\n');

const ruleRows = TEMPLATE_QUALITY_RULES.map((rule) => {
  const related = (report?.checks || []).filter((c) => c.id.endsWith(`:${rule}`));
  const allPass = related.length ? related.every((c) => c.pass) : true;
  return `| ${rule} | ${allPass ? 'PASS' : 'FAIL'} |`;
}).join('\n');

const checkRows = (report?.checks || [])
  .map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const md = `# Template Quality Gate Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**Engine:** \`${TEMPLATE_QUALITY_GATE_V1}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Score:** ${report?.passCount ?? 0}/${report?.checks?.length ?? 0}

**First-page density floor:** ${Math.round((report?.minFirstPageDensity ?? 0.55) * 100)}%

## Mission

Every production template must render hire-ready output: no clipping, no overflow, no fake or parser artifacts, correct identity fields, readable at 100% zoom, and a printable A4 PDF with useful first-page density.

## Per-template summary

| Display name | ID | Page-1 fill | Blank tail | Verdict | Failed rules |
|--------------|-----|-------------|------------|---------|--------------|
${templateRows}

## Rules (all templates)

| Rule | Result |
|------|--------|
${ruleRows}

## Rule definitions

| Rule | What it checks |
|------|----------------|
| no_cropped_text | No overflow-hidden nodes with scrollHeight > clientHeight on headers/bodies |
| no_excessive_blank_space | Blank tail below last block ≤ ${(report?.maxBlankTail ?? 0.42) * 100}% when fill is low |
| no_text_overflow | No horizontal scroll / client_crop on export DOM |
| no_fake_content | No lorem, placeholder, john/jane doe, TODO |
| no_parser_labels | No debug labels, undetected copy, or À classer leakage |
| no_wrong_email | Rendered email matches fixture; no mutated local-part |
| no_company_as_name | \`cvName\` passes \`isAcceptableDisplayName\` |
| readable_at_100 | No sub-8px body text; no scale-down transform on \`.cv\` |
| printable_pdf | Playwright A4 PDF + \`validatePdfHardening\` |
| first_page_density_55 | Page-1 content fill ≥ **55%** when 4+ sections populated |

## All checks

| Check | Result | Detail |
|-------|--------|--------|
${checkRows}

## Fixture

Rich \`finalResumeData\` (Alex Morgan — product lead) via \`resumeDataToTemplateView\` → \`HirelyTemplates.render\`.

## Run

\`\`\`bash
npm run qa:template-quality-gate
npm run template-quality-gate-report
\`\`\`

## Bench output

\`\`\`
${bench.out}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
