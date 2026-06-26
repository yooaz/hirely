#!/usr/bin/env node
/**
 * Generate DATA_SANITIZATION_REPORT.md
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'DATA_SANITIZATION_REPORT.md');

const run = spawnSync('node', ['src/tests/qa-data-sanitization.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const pass = run.status === 0;
const stdout = (run.stdout || '').trim();
const stderr = (run.stderr || '').trim();

const lines = [
  '# Data Sanitization Layer — QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Purpose',
  '',
  'Final sanitation pass before template rendering.',
  '',
  '## Rules',
  '',
  '### Forbidden in header',
  '',
  '- EDUCATION',
  '- FORMATION',
  '- COMPETENCES',
  '- LANGUES',
  '- CLIENTS',
  '',
  '### Forbidden in education',
  '',
  '- instagram',
  '- linkedin',
  '- http',
  '- www',
  '- @',
  '',
  '### Dates',
  '',
  '- Future dates beyond **2026** are forbidden',
  '',
  '## Acceptance',
  '',
  '| Check | Status |',
  '|-------|--------|',
  '| Header free of section titles | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Education free of social/contact URLs | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| No future dates > 2026 | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Wired before template render | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '',
  '## Implementation',
  '',
  '- `src/core/validation/data-sanitization-layer.js` — `DATA_SANITIZATION_LAYER`',
  '- `applyDataSanitizationLayer()` — header cleaner + education sanitizer + date normalizer',
  '- Wired into `resumeDataToCvData()` and `normalizeCvData()`',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:data-sanitization',
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
