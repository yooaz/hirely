#!/usr/bin/env node
/**
 * HIRELY P0 — Generate REVIEW_CONSISTENCY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REVIEW_CONSISTENCY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/review-consistency/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Review panel consistency\n');
  const qa = run('node', ['src/tests/qa-review-consistency.mjs']);
  console.log(qa.pass ? '  PASS qa-review-consistency' : '  FAIL qa-review-consistency');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && data?.pass;
  const snap = data?.browser || {};
  const counts = snap.counts || {};

  const lines = [
    '# HIRELY P0 — Review Panel Consistency',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Rule',
    '',
    'The review panel must read from **`finalResumeData` only** — never contradict the live CV preview.',
    '',
    '| Section | Checklist OK when |',
    '|---------|-------------------|',
    '| Formation / Education | `education.length > 0` |',
    '| Expérience | `experiences.length > 0` |',
    '| Compétences | `skills` or `tools` present |',
    '| Langues | `languages` present (row shown only if data exists) |',
    '',
    'Suggestions must exclude text already rendered in the CV.',
    '',
    '## Browser snapshot',
    '',
    '| Check | Value |',
    '|-------|-------|',
    `| Preview text length | ${snap.cvTextLen ?? '—'} |`,
    `| finalResumeData education | ${counts.education ?? '—'} |`,
    `| finalResumeData experiences | ${counts.experiences ?? '—'} |`,
    `| finalResumeData skills | ${counts.skills ?? '—'} |`,
    `| finalResumeData tools | ${counts.tools ?? '—'} |`,
    `| finalResumeData languages | ${counts.languages ?? '—'} |`,
    '',
    '## Implementation',
    '',
    '| Change | Location |',
    '|--------|----------|',
    '| `buildReviewChecklistFromFinalResume` | `src/core/validation/review-consistency.js` |',
    '| Education object lines in checklist profile | `recruiter-checklist-source.js` |',
    '| Trusted review uses `_resumeCounts` | `trusted-cv-review-engine.js` |',
    '| Product checklist from finalResumeData | `buildProductChecklist()` in `index.html` |',
    '| Suggestions filter rendered content | `collectProductSuggestions()` + `suggestion-confidence-score.js` |',
    '',
    '## Gate',
    '',
    '```bash',
    'npm run test:review-consistency',
    '```',
    '',
    '## QA output',
    '',
    '```',
    qa.out?.slice(0, 8000) || '(no output)',
    '```',
    '',
  ];

  if (!pass) {
    lines.push('## Blockers');
    lines.push('');
    lines.push('- Review panel still contradicts preview — see QA output above.');
    lines.push('');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nREVIEW CONSISTENCY PASS' : '\nREVIEW CONSISTENCY FAIL');
  process.exit(pass ? 0 : 1);
}

main();
