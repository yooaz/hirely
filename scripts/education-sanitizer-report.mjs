#!/usr/bin/env node
/**
 * Generate EDUCATION_SANITIZER_REPORT.md from qa-education-sanitizer.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'EDUCATION_SANITIZER_REPORT.md');

const run = spawnSync('node', ['src/tests/qa-education-sanitizer.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const pass = run.status === 0;
const stdout = (run.stdout || '').trim();
const stderr = (run.stderr || '').trim();

const lines = [
  '# Education Sanitizer — QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'P1 education sanitizer: reject contaminated education rows and require school or degree.',
  '',
  '## Problem',
  '',
  'Instagram URLs, emails, phone numbers, and client lists were appearing inside education.',
  '',
  '## Rules',
  '',
  'Reject education rows containing:',
  '',
  '- `@`',
  '- `http`',
  '- `www`',
  '- `instagram`',
  '- `linkedin`',
  '- email addresses',
  '- phone numbers',
  '- client brand lists',
  '',
  'Rejected rows are moved to `rejectedLines`.',
  '',
  'Education requires **school OR degree**.',
  '',
  '## Acceptance',
  '',
  '| Check | Status |',
  '|-------|--------|',
  '| Instagram never appears in education | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Contaminated rows → rejectedLines | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Valid school/degree rows kept | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '',
  '## Implementation',
  '',
  '- `src/core/parsing/education-sanitizer.js` — `EDUCATION_SANITIZER`',
  '- `sanitizeEducationRows()` — pre-filter before quality engine',
  '- Wired into `applyEducationQuality()` and `normalizeCvData()`',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:education-sanitizer',
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
