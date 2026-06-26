#!/usr/bin/env node
/**
 * Generates EXPERIENCE_EDUCATION_RELIABILITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPERIENCE_EDUCATION_RELIABILITY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/experience-education-reliability/report.json');

function run(script) {
  const res = spawnSync('node', [script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: 180000,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const suites = [
  ['qa-experience-education-reliability', 'src/tests/qa-experience-education-reliability.mjs'],
  ['qa-no-fake-data-policy', 'src/tests/qa-no-fake-data-policy.mjs'],
  ['stop-fake-cv-report', 'scripts/stop-fake-cv-generation-report.mjs'],
];

const qa = {};
for (const [name, script] of suites) {
  qa[name] =
    process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : run(script);
}

const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const allPass =
  report?.pass === true &&
  Object.values(qa).every((q) => q.pass === true || q.pass === null);

const acc = report?.acceptance || {};

const lines = [
  '# Experience Education Reliability Report (P0)',
  '',
  `**Status:** ${allPass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'EXPERIENCE_EDUCATION_RELIABILITY_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Stop fake experience generation. Wrong rows forbidden; low confidence → reviewQueue, not preview.',
  '',
  '## Acceptance',
  '',
  '| Criterion | Status |',
  '| --- | --- |',
  `| No fake "Designer — Internship — 2010-Present" | ${acc.no_fake_internship_present ? '**PASS**' : 'FAIL'} |`,
  `| No "Profil!" in preview | ${acc.no_profil_in_preview ? '**PASS**' : 'FAIL'} |`,
  `| No "{Internship}" rows | ${acc.no_brace_internship ? '**PASS**' : 'FAIL'} |`,
  `| No random company promoted to job | ${acc.no_company_promoted ? '**PASS**' : 'FAIL'} |`,
  `| Real jobs + education kept | ${acc.real_jobs_kept ? '**PASS**' : 'FAIL'} |`,
  '',
  '## Experience rules',
  '',
  '| Requirement | Enforcement |',
  '| --- | --- |',
  '| Role OR activity | `experienceHasRoleOrActivity` |',
  '| Company / project OR context | `experienceHasCompanyOrContext` |',
  '| Explicit date OR current marker in source | `experienceHasExplicitDateOrCurrent` |',
  '| No invented Present | `experienceHasGuessedPresent` + source grounding |',
  '| No duplicated date ranges | `experienceDateDedupeKey` |',
  '| No section/profile lines as jobs | `auditFakeExperience` + `PROFILE_SUMMARY_AS_JOB_RE` |',
  '| No company-only rows | `company_only_row` + `invented-experience-guard` |',
  '',
  '## Education rules',
  '',
  '| Requirement | Enforcement |',
  '| --- | --- |',
  '| School or degree signal | `validatesEducationLine` |',
  '| Date optional | `scoreEducationConfidence` year match |',
  '| Low confidence → reviewQueue | `enforceEducationReliability` strips from preview |',
  '',
  '## QA suites',
  '',
  '| Suite | Result |',
  '| --- | --- |',
];

for (const [name] of suites) {
  const q = qa[name];
  lines.push(`| \`${name}\` | ${q.pass === true ? 'PASS' : q.pass === false ? 'FAIL' : 'skipped'} |`);
}

lines.push('', '## Unit checks', '', '| Check | Status |', '| --- | --- |');

if (report?.checks?.length) {
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }
} else {
  lines.push('| _not run_ | FAIL |');
}

lines.push(
  '',
  '## Implementation',
  '',
  '| Module | Role |',
  '| --- | --- |',
  '| `experience-education-reliability.js` | Contract audit + enforce + review emission |',
  '| `fake-experience-gate.js` | Section labels, guessed Present, generic roles |',
  '| `invented-experience-guard.js` | Client-only / invented bullet rows |',
  '| `classification-fixes.js` | `parseInternshipLine` — no guessed dates |',
  '| `final-resume-contract.js` | Dual gate before preview commit |',
  '',
  '## Verify',
  '',
  '```bash',
  'npm run qa:experience-education-reliability',
  'npm run experience-education-reliability-report',
  'npm run stop-fake-cv-report',
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
process.exit(allPass ? 0 : 1);
