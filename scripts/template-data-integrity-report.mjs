#!/usr/bin/env node
/**
 * P0 — Template data integrity report → TEMPLATE_DATA_INTEGRITY_REPORT.md
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  DATA_INTEGRITY_TENETS,
  DATA_INTEGRITY_TENET_LINES,
  NO_FAKE_DATA_POLICY_V1,
} from '../src/core/validation/no-fake-data-policy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'TEMPLATE_DATA_INTEGRITY_REPORT.md');
const jsonPath = join(root, 'tests/output/template-data-integrity/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-template-data-integrity.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const tenetRows = DATA_INTEGRITY_TENET_LINES.map(
  (line) => `| ${line} | Enforced in pipeline + template render |`
).join('\n');

const templateRows = (report?.templates || [])
  .map((t) => {
    const scenarioPass = (t.scenarios || []).every((s) => s.pass);
    const status = scenarioPass && t.miniClean ? 'PASS' : 'FAIL';
    const fails = (t.scenarios || []).filter((s) => !s.pass).map((s) => s.id);
    if (!t.miniClean) fails.push('mini_labels');
    return `| ${t.name} | \`${t.id}\` | ${status} | ${fails.length ? fails.join(', ') : '—'} |`;
  })
  .join('\n');

const md = `# Template Data Integrity Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**Policy:** \`${NO_FAKE_DATA_POLICY_V1}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Score:** ${report?.passCount ?? 0}/${report?.checks?.length ?? 0}

## Tenets

| Principle | Enforcement |
|-----------|-------------|
${tenetRows}

## Implementation

| Layer | Behavior |
|-------|----------|
| Pipeline | Uncertain identity → review queue, not preview |
| \`final-cv-placeholder-guard\` | Strips confirm labels before commit |
| \`normalizeProfile()\` | Empty name/email when missing or corrupt; no employer-as-name |
| \`identityPlaceholdersEnabled()\` | **Off** in production — no injected confirm labels |
| \`MINI_CV\` | Gallery thumbs use empty fields, not undetected copy |
| \`resolve()\` | Unknown template id → free **ATS** (generic over fake premium) |

## Per-template (4 integrity scenarios)

| Display name | ID | Verdict | Failed |
|--------------|-----|---------|--------|
${templateRows}

Scenarios per template: **sparse** (missing name/email), **corrupted_email**, **company_as_name**, **uncertain_labels**, plus **mini** gallery thumb.

## Run

\`\`\`bash
npm run qa:template-data-integrity
npm run template-data-integrity-report
\`\`\`

## Bench output

\`\`\`
${bench.out}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
