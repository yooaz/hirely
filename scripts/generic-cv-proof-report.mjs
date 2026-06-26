#!/usr/bin/env node
/**
 * P0 — Generic CV proof report (20 non-Yoaz profiles).
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'GENERIC_CV_PROOF_REPORT.md');
const jsonPath = join(root, 'tests/output/generic-cv-proof/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-generic-cv-proof.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const profileRows = (report?.results || [])
  .map((r) => {
    const m = r.metrics || {};
    return `| ${r.id} | ${r.expected?.name || '—'} | ${m.name || '—'} | ${m.email || '—'} | ${m.phone || '—'} | ${m.experienceCount ?? '—'} | ${m.renderLen ?? '—'} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.failures?.join(', ') || '—'} |`;
  })
  .join('\n');

const passCriteria = [
  'Correct name extracted',
  'Correct email extracted',
  'Correct phone or absent / confirm label if unreadable',
  'No Yoaz demo data leak',
  'No fake data (no-fake policy audit)',
  'Preview render non-empty with candidate name',
].map((c) => `- ${c}`).join('\n');

const md = `# Generic CV Proof Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**Engine:** \`${report?.version || 'GENERIC_CV_PROOF_V1'}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Score:** ${report?.summary?.passCount ?? '—'}/${report?.summary?.count ?? 20} (${report?.summary?.passRate ?? '—'}%)

## Mission

Prove Hirely generalizes across 20 non-Yoaz professional profiles:

\`developer\`, \`teacher\`, \`nurse\`, \`sales\`, \`marketing\`, \`student\`, \`executive\`, \`consultant\`, \`designer\`, \`engineer\`, \`restaurant-manager\`, \`retail\`, \`finance\`, \`hr\`, \`project-manager\`, \`data-analyst\`, \`architect\`, \`photographer\`, \`lawyer\`, \`customer-support\`

Each corpus CV has a unique name, email, phone, companies, schools, and skills.

Pipeline per profile: **import → parse → preview**

## Pass criteria

${passCriteria}

## Results by profile

| Profile | Expected name | Parsed name | Email | Phone | Exp | Preview chars | Result | Failures |
|---------|---------------|-------------|-------|-------|-----|---------------|--------|----------|
${profileRows || '| — | — | — | — | — | — | — | — | — |'}

## Corpus location

\`tests/cv-corpus/<profile>.txt\`

## Run

\`\`\`bash
npm run qa:generic-cv-proof
npm run generic-cv-proof-report
\`\`\`

## Bench output

\`\`\`
${bench.out || '(no output)'}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
