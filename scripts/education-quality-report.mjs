#!/usr/bin/env node
/**
 * Generate EDUCATION_QUALITY_REPORT.md from P3 education quality QA.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EDUCATION_QUALITY_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/education-quality-engine/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

console.log('Running qa:education-quality-engine…');
const qa = spawnSync('node', ['src/tests/qa-education-quality-engine.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const data = readJson(JSON_PATH);
const pass = qa.status === 0 && data?.pass !== false;
const failed = (data?.results || []).filter((r) => !r.pass);

const lines = [];
lines.push('# EDUCATION_QUALITY_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
lines.push(`Checks: **${data?.passed ?? '?'}/${data?.total ?? '?'}**`);
lines.push('');

lines.push('## P3 — Education Quality Engine');
lines.push('');
lines.push('Produces clean structured education entries:');
lines.push('');
lines.push('```json');
lines.push('{ "school": "", "degree": "", "startYear": "", "endYear": "" }');
lines.push('```');
lines.push('');
lines.push('### Reject');
lines.push('- Social links (`instagram`, `linkedin`, `behance`, etc.)');
lines.push('- URLs (`http`, `www`)');
lines.push('- Phone numbers');
lines.push('- Emails');
lines.push('- OCR garbage fragments');
lines.push('');
lines.push('### Validate');
lines.push('- `startYear <= endYear`');
lines.push('- `endYear <= currentYear + 1`');
lines.push('- Duration `<= 10` years');
lines.push('');

lines.push('## Acceptance criteria');
lines.push('');
const criteria = [
  ['no-corrupted-batch', 'No corrupted education entries in batch'],
  ['normalize-clean', 'normalizeCvData keeps only clean education'],
  ['lisaa-clean', 'Contact leaks stripped from valid rows'],
  ['meta-shape', 'Structured school/degree/startYear/endYear metadata'],
  ['reject-future-entry', 'Impossible future dates rejected'],
];
for (const [id, label] of criteria) {
  const row = (data?.results || []).find((r) => r.id === id);
  const mark = row?.pass ? '✓' : '✗';
  lines.push(`- ${mark} ${label}`);
}
lines.push('');

if (failed.length) {
  lines.push('## Failed checks');
  lines.push('');
  for (const f of failed) {
    lines.push(`- **${f.label}** (${f.id})${f.detail ? `: ${f.detail}` : ''}`);
  }
  lines.push('');
}

lines.push('## Module');
lines.push('');
lines.push('- `src/core/parsing/education-quality-engine.js`');
lines.push('- Wired into `normalizeAllEducation()` and `normalizeCvData()`');
lines.push('');

lines.push('## Run');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:education-quality-engine');
lines.push('npm run education-quality-report');
lines.push('npm run qa:education-normalization');
lines.push('```');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
