#!/usr/bin/env node
/**
 * HIRELY P1 — Generate SUGGESTION_CLASSIFICATION_FIX_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SUGGESTION_CLASSIFICATION_FIX_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/suggestion-classification-fix/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P1 — Suggestion classification fix\n');
  const qa = run('node', ['src/tests/qa-suggestion-classification-fix.mjs']);
  console.log(qa.pass ? '  PASS qa-suggestion-classification-fix' : '  FAIL qa-suggestion-classification-fix');

  const v2 = run('node', ['src/tests/qa-classification-engine-v2.mjs']);
  console.log(v2.pass ? '  PASS qa-classification-engine-v2' : '  FAIL qa-classification-engine-v2');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && data?.pass;

  const lines = [
    '# HIRELY P1 — Suggestion Classification Fix',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Review suggestions misclassified employment and discipline lines:',
    '',
    '| Line | Was | Should be |',
    '|------|-----|-----------|',
    '| Independent / Freelance | Compétences | Expérience |',
    '| Company à confirmer | Compétences | Expérience (review) |',
    '| Marketing | Identité | Compétence (unless full title) |',
    '| Visual communication | Mixed | Formation or Compétence by context |',
    '',
    '## Rules',
    '',
    '- Employment / freelance lines never surface as **skill**.',
    '- `Company à confirmer` → experience, confidence &lt; 80 → **À valider** (no auto-place).',
    '- Standalone `Marketing` → skill, not identity title.',
    '- `Visual communication` alone → skill @ 72% (review); with school → education.',
    '- Confidence &lt; 80 → category `unknown`, `needsReview: true`.',
    '',
    '## Implementation',
    '',
    '| Module | Role |',
    '|--------|------|',
    '| `src/core/parsing/suggestion-classification-fix.js` | P1 rules + `resolveSuggestionCategory()` |',
    '| `src/core/parsing/classification-engine-v2.js` | `scoreEmploymentStrict`, removed bare `identity` skill marker |',
    '| `src/core/parsing/semantic-classifier-v2.js` | Block standalone disciplines from `JOB_TITLE` |',
    '| `src/core/parsing/review-queue-categories.js` | Employment lines: experience/client only |',
    '| `index.html` | Suggestion panel uses `resolveSuggestionCategory` |',
    '',
    '## QA',
    '',
    '```bash',
    'npm run test:suggestion-classification-fix',
    '```',
    '',
    '## Case results',
    '',
    '| Line | V2 type | Predicted | Category shown |',
    '|------|---------|-----------|----------------|',
  ];

  for (const row of data?.cases || []) {
    const r = row.resolved || {};
    lines.push(
      `| ${row.line} | ${row.v2 || '—'} | ${r.predictedCategory || '—'} | ${r.category || '—'} |`
    );
  }

  lines.push(
    '',
    '## Acceptance',
    '',
    `- [${pass ? 'x' : ' '}] No company/freelance line suggested as skill`,
    `- [${qa.pass ? 'x' : ' '}] P1 QA suite`,
    `- [${v2.pass ? 'x' : ' '}] Classification engine v2 regression (informational)`,
    ''
  );

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
