#!/usr/bin/env node
/**
 * P0 — Review screen guarantee report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REVIEW_SCREEN_GUARANTEE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/review-screen-guarantee/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Review screen guarantee\n');
  const qa = run('node', ['src/tests/qa-review-screen-guarantee.mjs']);
  console.log(qa.pass ? '  PASS qa-review-screen-guarantee' : '  FAIL qa-review-screen-guarantee');

  const browser = run('node', ['scripts/real-browser-qa-lock.mjs']);
  console.log(browser.pass ? '  PASS real-browser-qa-lock' : '  FAIL real-browser-qa-lock');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && browser.pass && data?.pass;
  const lines = [
    '# HIRELY P0 — Review Screen Guarantee',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Rule',
    '',
    'If `finalResumeData` contains **any** of: name, email, phone, experience, education, skills →',
    '',
    '- `REVIEW_SCREEN_VISIBLE` must fire',
    '- User never returns to import screen',
    '- Weak data shows warnings only — **never blocks**',
    '',
    '## Implementation',
    '',
    '| Piece | Location |',
    '|-------|----------|',
    '| Guarantee check | `src/core/validation/review-screen-guarantee.js` → `finalResumeDataMeetsReviewGuarantee()` |',
    '| Weak warnings | `buildReviewGuaranteeWarnings()` → review score desc + import warn |',
    '| Review orchestration | `ensureImportReviewVisible()` in `index.html` |',
    '| Import pipeline bypass | `handleFileImport` — guarantee paths before paste fallback |',
    '| Extraction gate bypass | `applyCvPipeline` — poor quality + guarantee → review with warn |',
    '',
    '## Trigger fields',
    '',
    '| Field | Condition |',
    '|-------|-----------|',
    '| name | `identity.name` length > 1 |',
    '| email | `identity.email` length > 3 |',
    '| phone | ≥ 8 digits |',
    '| experience | `experiences.length > 0` |',
    '| education | `education.length > 0` |',
    '| skills | `skills.length > 0` |',
    '',
    '## QA checks',
    '',
    '| Check | Status |',
    '|-------|--------|',
  ];

  for (const c of data?.checks || []) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');
  lines.push('## Gates');
  lines.push('');
  lines.push('| Command | Status |');
  lines.push('|---------|--------|');
  lines.push(`| \`npm run test:review-screen-guarantee\` | ${qa.pass ? 'PASS' : 'FAIL'} |`);
  lines.push(`| \`npm run test:real-browser-qa-lock\` | ${browser.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:review-screen-guarantee');
  lines.push('```');

  if (!pass) {
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    if (!qa.pass) lines.push('- `qa-review-screen-guarantee` failed');
    if (!browser.pass) lines.push('- `real-browser-qa-lock` failed (review not visible)');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nREVIEW SCREEN GUARANTEE PASS' : '\nREVIEW SCREEN GUARANTEE FAIL');
  process.exit(pass ? 0 : 1);
}

main();
