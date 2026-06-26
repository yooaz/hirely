#!/usr/bin/env node
/**
 * Generate DATE_NORMALIZER_REPORT.md from qa-date-normalizer.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'DATE_NORMALIZER_REPORT.md');

const run = spawnSync('node', ['src/tests/qa-date-normalizer.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const pass = run.status === 0;
const stdout = (run.stdout || '').trim();
const stderr = (run.stderr || '').trim();

const lines = [
  '# Date Normalizer — QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'P1 date normalization: clamp impossible future end years and flag long durations.',
  '',
  '## Problem',
  '',
  'Impossible date ranges appeared in CV output, e.g. `2008–2032`.',
  '',
  '## Rules',
  '',
  '- Current year max = **2026**',
  '- If end year > 2026 → replace with **Present**',
  '- If duration > 20 years → flag **review**',
  '',
  '## Acceptance',
  '',
  '| Check | Status |',
  '|-------|--------|',
  '| No future dates beyond 2026 | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| 2008–2032 → 2008–Present | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Long duration flagged for review | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '',
  '## Implementation',
  '',
  '- `src/core/parsing/date-normalizer.js` — `DATE_NORMALIZER`',
  '- `normalizeYearRange()` — core year clamp + review flag',
  '- `applyDateNormalizationToCvData()` — wired into `normalizeCvData()`',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:date-normalizer',
  '```',
  '',
  '## Console output',
  '',
  '```',
  stdout || '(no stdout)',
  '```',
];

if (!pass && stderr) {
  lines.push('', '## Errors', '', '```', stderr, '```');
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${reportPath}`);
process.exit(pass ? 0 : 1);
