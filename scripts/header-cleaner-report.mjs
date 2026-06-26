#!/usr/bin/env node
/**
 * Generate HEADER_CLEANER_REPORT.md from qa-header-cleaner.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'HEADER_CLEANER_REPORT.md');

const run = spawnSync('node', ['src/tests/qa-header-cleaner.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const pass = run.status === 0;
const stdout = (run.stdout || '').trim();
const stderr = (run.stderr || '').trim();

const lines = [
  '# Header Cleaner — QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'P1 header cleaner: identity fields must not contain section titles or mixed OCR blobs.',
  '',
  '## Problem',
  '',
  'Header mixed contact info with section anchors:',
  '',
  '```',
  'email / phone / EDUCATION / FORMATION / COMPETENCES',
  '```',
  '',
  '## Rules',
  '',
  'Header may contain only:',
  '',
  '- name',
  '- title',
  '- email',
  '- phone',
  '- location',
  '',
  'Forbidden in header:',
  '',
  '- EDUCATION',
  '- FORMATION',
  '- COMPETENCES',
  '- LANGUES',
  '- CLIENTS',
  '',
  'Stripped section tokens are moved to `unsorted`.',
  '',
  '## Acceptance',
  '',
  '| Check | Status |',
  '|-------|--------|',
  '| Header never contains section titles | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Email/phone extracted from polluted fields | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Name/title/location preserved when valid | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '',
  '## Implementation',
  '',
  '- `src/core/parsing/header-cleaner.js` — `HEADER_CLEANER`',
  '- `applyHeaderCleaner()` wired into `normalizeCvData()`',
  '- `rejectHeaderField()` delegates to `cleanHeaderField()`',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:header-cleaner',
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
