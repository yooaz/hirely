#!/usr/bin/env node
/**
 * Generate PRODUCTION_CLEANUP_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildFinalResumeData } from '../src/core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../src/core/resume-data.js';
import { FORBIDDEN_TEMPLATE_CV_KEYS } from '../src/core/pipeline/hirely-flow-lock.js';
import { resolveChecklistProfile } from '../src/core/validation/recruiter-checklist-source.js';
import { computeRecruiterScoreV2 } from '../src/core/validation/recruiter-score-v2.js';
import { validateConsumerDataSource } from '../src/core/validation/resume-data-contract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-production-cleanup.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const rwGate = spawnSync('node', ['scripts/real-world-cv-qa-lock.mjs'], { cwd: root, encoding: 'utf8' });
const rwOk = rwGate.status === 0;

const yoaz = buildFinalResumeData(
  normalizeResumeData({
    identity: {
      name: 'Yohann Azancot',
      title: 'Graphic Designer / Illustrator',
      email: 'yoaz@hotmail.fr',
      phone: '+33 6 49 43 48 39',
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
      { role: 'Designer', company: 'McCann G. Agency', dates: '2011–2014', bullets: ['Campaigns'] },
    ],
    education: [
      'Créapole - Creative School Management',
      'Creative School Management',
      'Créapole — Visual Communication — 2008–2011',
      'LISAA — Web & Motion Design — 2011–2012',
    ],
    skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
    tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
    languages: ['French — native', 'English — fluent'],
    clients: ['Nike'],
    projects: [],
    unsorted: [],
    meta: {},
  })
);

const fr = yoaz.finalResumeData || {};
const cv = yoaz.cvData || {};
const profile = resolveChecklistProfile({ finalResumeData: fr, cvData: cv });
const score = computeRecruiterScoreV2(profile);
const consumer = validateConsumerDataSource(cv, 'TEMPLATE', { silent: true });
const forbiddenCv = FORBIDDEN_TEMPLATE_CV_KEYS.filter((k) => k in cv);
const forbiddenViolations = consumer.violations.filter((v) => /FORBIDDEN_CV_KEY/.test(v));

const expPreview = (fr.experiences || [])
  .map((e) => [e.role, e.company, e.dates, ...(e.bullets || [])].filter(Boolean).join('\n'))
  .join('\n\n');

const lines = [];
lines.push('# Production Cleanup Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Real-world lock:** ${rwOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Verdict:** ${gateOk && rwOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Scope');
lines.push('');
lines.push('Final production cleanup on **finalResumeData** only — no OCR, import, or template changes.');
lines.push('');
lines.push('## Issues addressed');
lines.push('');
lines.push('1. Experience duplicates → canonical freelance + employer heroes');
lines.push('2. Education duplicates → drop Creative School Management; single Créapole program line');
lines.push('3. Forbidden parser keys stripped before template cvData');
lines.push('4. ATS scoring rewards complete email / phone / experience / education / skills / tools / languages');
lines.push('');
lines.push('## Acceptance');
lines.push('');
lines.push('| Check | Result |');
lines.push('|-------|--------|');
lines.push(`| No TEMPLATE_FORBIDDEN_CV_KEY | ${forbiddenViolations.length ? 'FAIL' : 'PASS'} |`);
lines.push(`| cvData forbidden keys | ${forbiddenCv.length ? forbiddenCv.join(', ') : 'none'} |`);
lines.push(
  `| Duplicate freelance rows | ${(fr.experiences || []).filter((e) => /freelance|independent/i.test(`${e.role} ${e.company}`)).length} (expected 1) |`
);
lines.push(
  `| Creative School Management | ${(fr.education || []).some((l) => /creative school management/i.test(l)) ? 'present' : 'absent'} |`
);
lines.push(`| ATS score | ${score?.total ?? '—'} (target 88–92) |`);
lines.push(`| Real-world CV lock | ${rwOk ? 'PASS' : 'FAIL'} |`);
lines.push('');
lines.push('## finalResumeData — Experience');
lines.push('');
lines.push('```');
lines.push(expPreview || '(empty)');
lines.push('```');
lines.push('');
lines.push('## finalResumeData — Education');
lines.push('');
lines.push('```');
lines.push((fr.education || []).join('\n') || '(empty)');
lines.push('```');
lines.push('');
lines.push('## Pipeline hooks');
lines.push('');
lines.push('- `src/core/validation/final-cv-readability.js`');
lines.push('- `src/core/validation/final-resume-contract.js` — `normalizeCvDataForTemplate` on cvData');
lines.push('- `src/core/validation/recruiter-checklist-source.js` — score-safe experience lines');
lines.push('- `src/core/validation/recruiter-score-v2.js` — completeness bonus');
lines.push('');
lines.push('## QA');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:production-cleanup');
lines.push('npm run production-cleanup-report');
lines.push('npm run qa:real-world-cv-lock');
lines.push('```');
lines.push('');
if (!gateOk) {
  lines.push('## Gate output');
  lines.push('');
  lines.push('```');
  lines.push((gate.stdout || gate.stderr || '').trim());
  lines.push('```');
}

writeFileSync(join(root, 'PRODUCTION_CLEANUP_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote ${join(root, 'PRODUCTION_CLEANUP_REPORT.md')}`);
process.exit(gateOk && rwOk ? 0 : 1);
