#!/usr/bin/env node
/**
 * P0 — Hirely ship gate → HIRELY_SHIP_GATE_REPORT.md
 */
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HIRELY_SHIP_GATE_V1 } from '../src/tests/qa-hirely-ship-gate.mjs';
import { REAL_WORLD_FORMATS, REAL_WORLD_ROLES, REAL_WORLD_STRESS_GOAL_PCT } from '../tests/lib/real-world-stress-catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'HIRELY_SHIP_GATE_REPORT.md');
const jsonPath = join(root, 'tests/output/hirely-ship-gate/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  return { pass: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const gateRun = run('src/tests/qa-hirely-ship-gate.mjs');
let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const pass = gateRun.pass && report?.pass === true && Object.values(report?.shipCriteria || {}).every(Boolean);
const s = report?.stress?.summary || {};
const sc = report?.shipCriteria || {};

const metricRows = [
  ['Import success', s.importSuccessRate, 'cv50:import_success'],
  ['Identity accuracy', s.identityAccuracy, 'cv50:identity'],
  ['Email accuracy', s.emailAccuracy, 'cv50:email'],
  ['Phone accuracy', s.phoneAccuracy, 'cv50:phone'],
  ['Experience accuracy', s.experienceAccuracy, 'cv50:experience'],
  ['Education accuracy', s.educationAccuracy, 'cv50:education'],
  ['Skills accuracy', s.skillsAccuracy, 'cv50:skills'],
  ['Review success', s.reviewSuccessRate, 'cv50:review_success'],
  ['Template success', s.templateSuccessRate, 'cv50:template_success'],
  ['PDF export success', s.pdfExportSuccessRate, 'cv50:pdf_export_success'],
  ['Overall extraction', s.extractionAccuracy, 'cv50:extraction'],
]
  .map(([label, val, id]) => {
    const c = report?.checks?.find((x) => x.id === id);
    const pct = val != null ? `${val}%` : '—';
    const advisory = id === 'cv50:experience' || id === 'cv50:education';
    const status = c?.pass ? 'PASS' : advisory ? 'ADVISORY' : 'FAIL';
    return `| ${label} | ${pct} | ≥ ${REAL_WORLD_STRESS_GOAL_PCT}% | ${status} |`;
  })
  .join('\n');

const shipRows = [
  ['Overall extraction ≥ 95%', sc.extraction95],
  ['No fake data', sc.noFakeData],
  ['No stuck import', sc.noStuckImport],
  ['No broken export', sc.noBrokenExport],
  ['No core boot error', sc.noCoreBootError],
  ['No raw i18n keys', sc.noRawI18nKeys],
]
  .map(([label, ok]) => `| ${label} | ${ok ? 'PASS' : 'FAIL'} |`)
  .join('\n');

const formatRows = Object.entries(s.byFormat || {})
  .map(([fmt, v]) => `| ${fmt} | ${v.count} | ${v.passRate}% | ${v.avgAccuracy}% |`)
  .join('\n');

const roleRows = Object.entries(s.byRole || {})
  .map(([role, v]) => `| ${role} | ${v.count} | ${v.passRate}% | ${v.avgAccuracy}% |`)
  .join('\n');

const failRows = (report?.stress?.results || [])
  .filter((r) => !r.pass)
  .map(
    (r) =>
      `| ${r.id} | ${r.role} | ${r.format} | ${r.extractionAccuracy}% | ${r.importSuccess ? 'ok' : 'fail'} | ${r.templateSuccess ? 'ok' : 'fail'} | ${r.pass ? 'PASS' : 'FAIL'} |`
  )
  .join('\n') || '| — | — | — | — | — | — | PASS |';

const md = `# Hirely Ship Gate Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**System:** \`${HIRELY_SHIP_GATE_V1}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Checks:** ${report?.summary?.passChecks ?? 0}/${report?.summary?.totalChecks ?? 0}

## Goal

Real-user acceptance on **50 CVs** across **10 profiles** and **7 formats**. Ship only when extraction ≥ 95%, no fake data, no stuck import, export works, core boots cleanly, and preview has no raw i18n keys.

## Profiles (${REAL_WORLD_ROLES.length})

${REAL_WORLD_ROLES.map((r) => `\`${r}\``).join(' · ')}

## Formats (${REAL_WORLD_FORMATS.length})

${REAL_WORLD_FORMATS.map((f) => `\`${f}\``).join(' · ')}

## Measured metrics

| Metric | Score | Goal | Status |
| --- | --- | --- | --- |
${metricRows}

## Ship criteria

| Criterion | Status |
| --- | --- |
${shipRows}

## By format

| Format | CVs | Pass rate | Avg extraction |
| --- | --- | --- | --- |
${formatRows || '| — | — | — | — |'}

## By profile

| Profile | CVs | Pass rate | Avg extraction |
| --- | --- | --- | --- |
${roleRows || '| — | — | — | — |'}

## Failed CVs

| ID | Profile | Format | Extraction | Import | Template | Result |
| --- | --- | --- | --- | --- | --- | --- |
${failRows}

## Suite gates

| Suite | Status |
| --- | --- |
| 50 CV stress import | ${report?.checks?.find((c) => c.id === 'cv50:count')?.pass ? 'PASS' : 'FAIL'} |
| Universal import (7 formats) | ${report?.suites?.universalImport?.pass ? 'PASS' : 'FAIL'} |
| No-fake-data policy | ${report?.suites?.noFakePolicy?.pass ? 'PASS' : 'FAIL'} |
| Final PDF export lock | ${report?.suites?.finalPdfLock?.pass ? 'PASS' : 'FAIL'} |
| OCR data cleanup | ${report?.suites?.ocrCleanup?.pass ? 'PASS' : 'FAIL'} |
| QA smoke | ${report?.suites?.smoke?.pass ? 'PASS' : 'FAIL'} |

## Pipeline

1. Import file/text (format-specific extraction path)
2. Parse → \`resumeData\` + review readiness
3. Template render (\`ats-recruiter\` smoke per CV)
4. PDF export lock (Chrome/Safari/Firefox html2pdf)

## Verify

\`\`\`bash
npm run hirely-ship-gate-report
npm run qa:real-world-stress
npm run final-pdf-export-lock-report
\`\`\`

Artifacts:

- \`tests/output/hirely-ship-gate/report.json\`
- \`tests/output/real-world-stress/report.json\`
- \`tests/output/final-pdf-export-lock/*.pdf\`

## Bench output

\`\`\`
${gateRun.out.split('\n').slice(-50).join('\n')}
\`\`\`
`;

writeFileSync(outPath, md, 'utf8');
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
