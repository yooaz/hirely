#!/usr/bin/env node
/**
 * HIRELY H11 — Semantic classification V2 report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SEMANTIC_CLASSIFICATION_V2_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/semantic-v2/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, status: res.status ?? 1, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY H11 — Semantic classification V2\n');
  const qa = run('node', ['src/tests/qa-semantic-classifier-v2.mjs']);
  console.log(qa.pass ? '  PASS qa-semantic-classifier-v2' : '  FAIL qa-semantic-classifier-v2');

  const stress = run('npm', ['run', 'qa:p7-stress-test']);
  console.log(stress.pass ? '  PASS qa:p7-stress-test' : '  FAIL qa:p7-stress-test');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && stress.pass && data?.pass;
  const lines = [
    '# HIRELY H11 — Semantic Classification V2',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Engine',
    '',
    '- Module: `src/core/parsing/semantic-classifier-v2.js`',
    `- Auto-place threshold: confidence > ${data?.confidenceMin ?? 80}`,
    '- Below threshold → review queue (`UNKNOWN` / `unsorted`)',
    '',
    '## Semantic types',
    '',
    '| Type | Auto-place when |',
    '|------|-----------------|',
    '| PERSON_NAME | Valid person name, not section/portfolio/title |',
    '| JOB_TITLE | Role line with dictionary/role signals |',
    '| SUMMARY | Long prose only (never company/school/program) |',
    '| EXPERIENCE | Dated role/employment lines |',
    '| COMPANY / CLIENT | Agencies, brands (McCann, JB Impressions, …) |',
    '| EDUCATION | Schools (LISAA, Parsons, MIT) + program lines |',
    '| SKILL / TOOL / LANGUAGE | Specialty V2 with contracts |',
    '| LINK | Email, phone, portfolio URLs |',
    '',
    '## Regression cases (H11 examples)',
    '',
    '| Case | Line | Result | Status |',
    '|------|------|--------|--------|',
  ];

  for (const r of data?.regression || []) {
    lines.push(`| ${r.id} | ${r.line} | ${r.semanticType} (${r.confidence}) | ${r.pass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');
  lines.push('## P7 stress suite — semantic audit');
  lines.push('');
  if (data?.stress) {
    lines.push(`**${data.stress.pass}/${data.stress.total}** CVs with zero semantic misclassification (${data.stress.rate}%)`);
    lines.push('');
    lines.push('| Fixture | Status | Issues |');
    lines.push('|---------|--------|--------|');
    for (const row of data.stress.rows) {
      const issues = row.issues?.length
        ? row.issues.map((i) => `${i.id}:${i.value}`).join('; ')
        : '—';
      lines.push(`| ${row.id} | ${row.pass ? 'PASS' : 'FAIL'} | ${issues} |`);
    }
  } else {
    lines.push('_Stress audit JSON missing — run qa-semantic-classifier-v2 first._');
  }

  lines.push('');
  lines.push('## Acceptance rules');
  lines.push('');
  lines.push('- No title becomes candidate name');
  lines.push('- No company becomes summary');
  lines.push('- No school/program becomes skill');
  lines.push('- No portfolio/agency label becomes education');
  lines.push('');
  lines.push('## Command gates');
  lines.push('');
  lines.push(`| Command | Status |`);
  lines.push(`|---------|--------|`);
  lines.push(`| \`node src/tests/qa-semantic-classifier-v2.mjs\` | ${qa.pass ? 'PASS' : 'FAIL'} |`);
  lines.push(`| \`npm run qa:p7-stress-test\` | ${stress.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('## Remaining blockers');
  lines.push('');
  if (pass) {
    lines.push('_None — semantic V2 ready._');
  } else {
    const blockers = [];
    if (!qa.pass) blockers.push('Semantic V2 regression or stress audit failed');
    if (!stress.pass) blockers.push('P7 stress pipeline regression');
    if (data && !data.pass) {
      for (const r of data.stress?.rows?.filter((x) => !x.pass) || []) {
        blockers.push(`${r.id}: ${(r.issues || []).map((i) => i.id).join(', ')}`);
      }
    }
    lines.push(blockers.map((b) => `- ${b}`).join('\n'));
  }
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run semantic-classification-v2-report');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(`\nH11 SEMANTIC CLASSIFICATION: ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}

main();
