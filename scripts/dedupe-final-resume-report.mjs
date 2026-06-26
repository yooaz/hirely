#!/usr/bin/env node
/**
 * Generate DEDUPE_FINAL_RESUME_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildFinalResumeData } from '../src/core/validation/final-resume-contract.js';
import { dedupeFinalResumeData } from '../src/core/validation/dedupe-final-resume.js';
import { normalizeResumeData } from '../src/core/resume-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-dedupe-final-resume.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const gateOk = gate.status === 0;

const sample = dedupeFinalResumeData({
  identity: { name: 'Sample' },
  education: ['Créapole', 'Créapole', 'Creative School Management', 'Creative School Management'],
  experiences: [
    { role: 'Freelance', company: '', dates: '2011–2022', bullets: [] },
    { role: 'Freelance', company: 'Independent', dates: '2011/2022', bullets: ['Work'] },
  ],
  skills: ['Figma', 'figma'],
  tools: ['Photoshop', 'photoshop'],
  languages: ['English', 'english'],
  clients: [],
  projects: [],
});

const built = buildFinalResumeData(
  normalizeResumeData({
    identity: { name: 'Sample', title: 'Designer', email: 's@test.com' },
    summary: 'Profile',
    experiences: sample.experiences,
    education: ['Créapole', 'Créapole', 'Creative School Management', 'Creative School Management'],
    skills: ['Figma', 'figma'],
    tools: ['Photoshop', 'photoshop'],
    languages: ['English', 'english'],
    clients: [],
    projects: [],
    unsorted: [],
    meta: {},
  })
);

const lines = [];
lines.push('# Dedupe Final Resume Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Engine:** DEDUPE_FINAL_RESUME_V1`);
lines.push(`**Result:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Scope');
lines.push('');
lines.push('Last-pass dedupe on **finalResumeData** only (after contract lock).');
lines.push('');
lines.push('## Normalize rules');
lines.push('');
lines.push('- Lowercase');
lines.push('- Remove punctuation');
lines.push('- Collapse extra spaces');
lines.push('- Accent-fold');
lines.push('- Normalize date separators (`–`, `—`, `/` → `to`)');
lines.push('');
lines.push('## Acceptance');
lines.push('');
lines.push('| Check | Result |');
lines.push('|-------|--------|');
lines.push(
  `| Créapole ×2 | ${(built.finalResumeData?.education || []).filter((l) => /créapole/i.test(l)).length} (expected 1) |`
);
lines.push(
  `| Creative School Management ×2 | ${(built.finalResumeData?.education || []).filter((l) => /creative school management/i.test(l)).length} (expected 1) |`
);
lines.push(
  `| Freelance / Independent ×2 | ${(built.finalResumeData?.experiences || []).filter((e) => /freelance|independent/i.test(`${e.role} ${e.company}`)).length} (expected 1) |`
);
lines.push(`| Skills case dupes | ${(built.finalResumeData?.skills || []).length} (expected 1) |`);
lines.push(`| Tools case dupes | ${(built.finalResumeData?.tools || []).length} (expected 1) |`);
lines.push(`| Languages case dupes | ${(built.finalResumeData?.languages || []).length} (expected 1) |`);
lines.push(`| CV renders | ${built.contract?.renderable ? 'yes' : 'no'} |`);
lines.push('');
lines.push('## Pipeline hook');
lines.push('');
lines.push('- `src/core/validation/dedupe-final-resume.js` — `dedupeFinalResumeData()`');
lines.push('- `src/core/validation/final-resume-contract.js` — `buildFinalResumeData()` final pass');
lines.push('');
lines.push('## QA');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:dedupe-final-resume');
lines.push('npm run dedupe-final-resume-report');
lines.push('```');
lines.push('');
if (!gateOk) {
  lines.push('## Gate output');
  lines.push('');
  lines.push('```');
  lines.push((gate.stdout || gate.stderr || '').trim());
  lines.push('```');
}

writeFileSync(join(root, 'DEDUPE_FINAL_RESUME_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote ${join(root, 'DEDUPE_FINAL_RESUME_REPORT.md')}`);
process.exit(gateOk ? 0 : 1);
