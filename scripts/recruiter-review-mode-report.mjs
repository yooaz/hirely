#!/usr/bin/env node
/**
 * HIRELY H12 — Recruiter review mode report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'RECRUITER_REVIEW_MODE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/recruiter-review-mode/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, status: res.status ?? 1, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY H12 — Recruiter review mode\n');
  const qa = run('node', ['src/tests/qa-recruiter-review-mode.mjs']);
  console.log(qa.pass ? '  PASS qa-recruiter-review-mode' : '  FAIL qa-recruiter-review-mode');

  const semantic = run('node', ['src/tests/qa-semantic-classifier-v2.mjs']);
  console.log(semantic.pass ? '  PASS qa-semantic-classifier-v2 (no regression)' : '  FAIL qa-semantic-classifier-v2');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && semantic.pass && data?.pass;
  const lines = [
    '# HIRELY H12 — Recruiter Review Mode',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Principle',
    '',
    'When classification confidence is low or ambiguous, Hirely **never auto-places** content in CV sections.',
    'Instead, recruiter review cards show multiple hypotheses and the user chooses.',
    '',
    '## Card actions',
    '',
    '| Action | Behavior |',
    '|--------|----------|',
    '| **Accept** | Place using the top detected category |',
    '| **Move** | Place in the section selected in the picker |',
    '| **Edit** | Edit text, then place |',
    '| **Ignore** | Exclude from CV |',
    '',
    '## Example — ambiguous line',
    '',
    '```',
    'visual communication',
    '',
    'Detected as:',
    '- Skill 55%',
    '- Education 42%',
    '```',
    '',
    'User must choose before the line appears in skills or education.',
    '',
    '## Module',
    '',
    '- `src/core/parsing/recruiter-review-mode.js`',
    '- `src/core/parsing/semantic-classifier-v2.js` (multi-hypothesis alternatives)',
    '- Review UI: suggestions panel + verify review cards (`index.html`)',
    '',
    '## Regression — visual communication',
    '',
  ];

  if (data?.regression) {
    lines.push(`- Line: \`${data.regression.line}\``);
    lines.push(`- Needs review: **${data.regression.alternatives ? 'yes' : 'no'}**`);
    for (const alt of data.regression.alternatives || []) {
      const label = alt.type?.replace(/_/g, ' ') || alt.type;
      lines.push(`- ${label}: ${alt.confidence}%`);
    }
    lines.push(`- Auto-corruption blocked: **${data.regression.pass ? 'yes' : 'no'}**`);
  }

  lines.push('');
  lines.push('## P7 stress — low-confidence CV integrity');
  lines.push('');
  if (data?.stress) {
    lines.push(
      `**${data.stress.pass}/${data.stress.total}** CVs with zero pending review leakage into section arrays (${data.stress.rate})`
    );
    lines.push('');
    lines.push('| Fixture | Status | Pending | Issues |');
    lines.push('|---------|--------|---------|--------|');
    for (const row of data.stress.rows || []) {
      lines.push(
        `| ${row.id} | ${row.pass ? 'PASS' : 'FAIL'} | ${row.pending} | ${(row.issues || []).length} |`
      );
    }
  }

  lines.push('');
  lines.push('## Gates');
  lines.push('');
  lines.push(`| Gate | Status |`);
  lines.push(`|------|--------|`);
  lines.push(`| qa-recruiter-review-mode | ${qa.pass ? 'PASS' : 'FAIL'} |`);
  lines.push(`| qa-semantic-classifier-v2 (H11 lock) | ${semantic.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  if (!pass) {
    lines.push('## Blockers');
    lines.push('');
    if (!qa.pass) lines.push('- `qa-recruiter-review-mode` failed');
    if (!semantic.pass) lines.push('- H11 semantic regression failed');
    if (data && !data.pass) lines.push('- Stress audit: pending items leaked into CV sections');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nH12 PASS' : '\nH12 FAIL');
  process.exit(pass ? 0 : 1);
}

main();
