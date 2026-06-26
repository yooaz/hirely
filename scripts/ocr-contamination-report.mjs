#!/usr/bin/env node
/**
 * Generate OCR_CONTAMINATION_REPORT.md from P1 firewall QA.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'OCR_CONTAMINATION_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/ocr-contamination-firewall/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

console.log('Running qa:ocr-contamination-firewall…');
const qa = spawnSync('node', ['src/tests/qa-ocr-contamination-firewall.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const data = readJson(JSON_PATH);
const pass = qa.status === 0 && data?.pass !== false;
const failed = (data?.results || []).filter((r) => !r.pass);

const lines = [];
lines.push('# OCR_CONTAMINATION_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
lines.push(`Checks: **${data?.passed ?? '?'}/${data?.total ?? '?'}**`);
lines.push('');

lines.push('## P1 — OCR Contamination Firewall');
lines.push('');
lines.push('Normalization-only guards. No boot, template, or PDF changes.');
lines.push('');
lines.push('### Header fields (`name`, `title`, `email`, `phone`)');
lines.push('- Reject section anchors: EDUCATION, FORMATION, EXPERIENCE, SKILLS, TOOLS, LANGUAGES, CLIENTS');
lines.push('');
lines.push('### Education');
lines.push('- Reject `http`, `www`, `instagram`, `linkedin`, `behance`');
lines.push('- Reject years before 1950 or after current year + 1');
lines.push('- Reject education spans longer than 10 years');
lines.push('');
lines.push('### Experience');
lines.push('- Split merged lines on new date ranges, company boundaries, internship keywords');
lines.push('- Separate internships from freelance roles');
lines.push('');
lines.push('### Clients');
lines.push('- Only comma/bullet lists with recognized brand dictionary matches');
lines.push('- Never infer clients from summary, skills, or education prose');
lines.push('');

lines.push('## Acceptance criteria');
lines.push('');
const criteria = [
  ['header-no-education', 'No EDUCATION in header'],
  ['education-no-urls', 'No URLs in education'],
  ['education-no-bad-years', 'No future or impossible dates'],
  ['clients-no-infer', 'No hallucinated clients'],
  ['exp-separated', 'Internships separated from freelance roles'],
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
lines.push('- `src/core/parsing/ocr-contamination-firewall.js`');
lines.push('- Wired at end of `normalizeCvData()` in `rich-parser.js`');
lines.push('');

lines.push('## Run');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:ocr-contamination-firewall');
lines.push('npm run ocr-contamination-report');
lines.push('```');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
