#!/usr/bin/env node
/**
 * P0 — Yoaz bias removal report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'YOAZ_BIAS_REMOVAL_REPORT.md');
const jsonPath = join(root, 'tests/output/yoaz-bias-removal/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-yoaz-bias-removal.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const checkRows = (report?.checks || [])
  .map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const prodRows =
  report?.productionAudit?.length > 0
    ? report.productionAudit
        .map((h) => `| \`${h.literal}\` | ${h.files.join(', ')} |`)
        .join('\n')
    : '| — | No forbidden literals in \`src/core\`, \`src/ui\`, \`index.html\` |';

const corpusRows = (report?.corpusRows || [])
  .map((r) => `| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.yoazLeak ? 'Yoaz leak' : 'clean'} |`)
  .join('\n');

const md = `# Yoaz Bias Removal Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**Engine:** \`${report?.version || 'YOAZ_BIAS_GUARD_V1'}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

## Mission

Remove Yoaz-specific production bias so Hirely generalizes to any CV.

Forbidden in production code (allowed only in fixtures/tests/samples):

- Yoaz / Yohann / Azancot / yoaz@
- LISAA / Créapole / McCann / Nike / Marvel / Pantone / Adobe / Converse / 38 Impressions as **hardcoded fallbacks**
- Dictionary entries remain valid — they must not inject when extraction is uncertain

## Uncertain extraction labels

| Field | Label |
|-------|-------|
| Name | **${report?.confirmLabels?.name || 'Nom à confirmer'}** |
| Email | **${report?.confirmLabels?.email || 'Email à confirmer'}** |
| Phone | **${report?.confirmLabels?.phone || 'Téléphone à confirmer'}** |

Never invent identity or contact data.

## Production code scan

| Literal | Files |
|---------|-------|
${prodRows}

## QA checks

| Check | Result | Detail |
|-------|--------|--------|
${checkRows || '| — | — | — |'}

## Generalization corpus (no Yoaz leak)

| Corpus ID | Result | Notes |
|-----------|--------|-------|
${corpusRows || '| — | — | — |'}

## Changes

- \`src/core/validation/yoaz-bias-guard.js\` — strips Yoaz demo markers unless present in source text
- \`src/core/display/undetected-label.js\` — field-specific confirm labels
- \`src/core/parsing/parser-recovery.js\` — \`NAME_UNCERTAIN_LABEL\` → Nom à confirmer
- \`src/core/parsing/ocr-classification-rules.js\` — blocks yoaz/yohann email local-part name hints
- \`src/core/validation/sanitize-resume-display.js\` — Yoaz bias guard at final sanitize
- \`src/core/validation/final-resume-contract.js\` — confirm labels on \`finalResumeData\` identity
- \`src/ui/templates/cv-templates.js\` — template placeholders for name/email/phone

## Run

\`\`\`bash
npm run qa:yoaz-bias-removal
npm run yoaz-bias-removal-report
\`\`\`

## Bench output

\`\`\`
${bench.out || '(no output)'}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
