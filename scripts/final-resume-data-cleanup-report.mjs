#!/usr/bin/env node
/**
 * Generate FINAL_RESUME_DATA_CLEANUP_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildFinalResumeData } from '../src/core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../src/core/resume-data.js';
import { FINAL_RESUME_DATA_CLEANUP } from '../src/core/validation/final-resume-data-cleanup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-final-resume-data-cleanup.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const gateOk = gate.status === 0;

const prodGate = spawnSync('node', ['src/tests/qa-production-cleanup.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const prodOk = prodGate.status === 0;

const sample = buildFinalResumeData(
  normalizeResumeData({
    identity: {
      name: 'Yohann Azancot',
      title: 'Graphic Designer / Illustrator',
      email: 'yoaz@hotmail.fr',
      location: 'Paris',
    },
    summary: 'Illustrator and graphic designer.',
    experiences: [
      {
        role: 'Freelance - Independent / Freelance - Independent / Freelance',
        company: '',
        dates: '2011–2022',
        bullets: ['Posters, packaging, logos'],
      },
      {
        role: 'Freelance',
        company: 'Independent / Freelance',
        dates: '2011–2022',
        bullets: [],
      },
      { role: 'Designer', company: 'McCann G. Agency', dates: '2011–2014', bullets: ['Campaigns'] },
    ],
    education: [
      'Créapole — Visual Communication — 2008–2011',
      'Créapole - Visual Communication 2008-2011',
      'LISAA — Web & Motion Design — 2011–2012',
      'instagram.com/school',
      'Creative School Management',
    ],
    skills: ['Illustration', 'Graphic Design'],
    tools: ['Adobe Illustrator'],
    languages: ['French — native'],
    clients: ['Nike'],
    projects: [],
    unsorted: [],
    meta: {},
  })
);

const fr = sample.finalResumeData || {};
const expCount = (fr.experiences || []).length;
const eduCount = (fr.education || []).length;
const freelance = (fr.experiences || []).find((e) => /freelance/i.test(e.role));
const serialized = JSON.stringify(fr);

const checks = {
  noDuplicateExperience: (fr.experiences || []).filter((e) =>
    /freelance|independent/i.test(`${e.role} ${e.company}`)
  ).length <= 1,
  noDuplicateEducation:
    (fr.education || []).filter((l) => /cr[ée]apole/i.test(l) && /visual communication/i.test(l)).length <= 1,
  noOcrGarbage: !/\b(incision|wustrator|mustrator|gradric)\b/i.test(serialized),
  noParserTokens: !/\bid\s*=|\bhref\s*=|\butm_|instagram\.com/i.test(serialized),
  noUrlsInEducation: !(fr.education || []).some((l) => /https?:\/\/|www\.|instagram|href=/i.test(l)),
  cleanupMarker: fr.metaSafe?.finalResumeDataCleanup === FINAL_RESUME_DATA_CLEANUP,
};

const allPass = gateOk && Object.values(checks).every(Boolean);
const blockers = [];
if (!gateOk) blockers.push('qa-final-resume-data-cleanup gate failed');
if (!checks.noDuplicateExperience) blockers.push('duplicate experience remains');
if (!checks.noDuplicateEducation) blockers.push('duplicate education remains');
if (!checks.noParserTokens) blockers.push('parser garbage tokens remain');
if (!checks.noUrlsInEducation) blockers.push('URLs in education');

const lines = [];
lines.push('# Final Resume Data Cleanup Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Cleanup layer:** \`${FINAL_RESUME_DATA_CLEANUP}\``);
lines.push(`**Gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Production cleanup (regression):** ${prodOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Verdict:** ${allPass ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Scope');
lines.push('');
lines.push('- **In:** `finalResumeData` quality only (duplicates, parser garbage, education URLs)');
lines.push('- **Out:** OCR, PDF routing, templates, import pipeline');
lines.push('');
lines.push('## Acceptance');
lines.push('');
lines.push('| Check | Result |');
lines.push('|-------|--------|');
for (const [k, v] of Object.entries(checks)) {
  lines.push(`| ${k} | ${v ? 'PASS' : 'FAIL'} |`);
}
lines.push('');
lines.push('## Sample output (Yoaz fixture)');
lines.push('');
lines.push(`- Experience rows: **${expCount}**`);
lines.push(`- Education rows: **${eduCount}**`);
if (freelance) {
  lines.push(`- Freelance hero: **${freelance.role}** @ ${freelance.company} (${freelance.dates})`);
}
lines.push('');
lines.push('### Education');
lines.push('');
for (const e of fr.education || []) lines.push(`- ${e}`);
lines.push('');
lines.push('### Experience');
lines.push('');
for (const e of fr.experiences || []) {
  lines.push(`- **${e.role}** — ${e.company || '—'} (${e.dates || '—'})`);
}
lines.push('');
lines.push('## Pipeline hook');
lines.push('');
lines.push('```');
lines.push('buildFinalResumeData()');
lines.push('  → dedupeFinalResumeData(toFinalResumeDisplay(rd))');
lines.push('  → applyFinalResumeDataCleanup()  // readability + garbage strip + semantic dedupe');
lines.push('```');
lines.push('');
lines.push('## Files');
lines.push('');
lines.push('- `src/core/validation/final-resume-data-cleanup.js` — `applyFinalResumeDataCleanup()`');
lines.push('- `src/core/validation/final-resume-contract.js` — pipeline hook');
lines.push('- `src/tests/qa-final-resume-data-cleanup.mjs` — gate');
lines.push('');
if (blockers.length) {
  lines.push('## Blockers');
  lines.push('');
  for (const b of blockers) lines.push(`- ${b}`);
  lines.push('');
}
lines.push('## Commands');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:final-resume-data-cleanup');
lines.push('npm run final-resume-data-cleanup-report');
lines.push('```');

writeFileSync(join(root, 'FINAL_RESUME_DATA_CLEANUP_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote FINAL_RESUME_DATA_CLEANUP_REPORT.md (${allPass ? 'PASS' : 'FAIL'})`);
process.exit(allPass ? 0 : 1);
