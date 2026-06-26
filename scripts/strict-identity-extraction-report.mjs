#!/usr/bin/env node
/**
 * Generates STRICT_IDENTITY_EXTRACTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'STRICT_IDENTITY_EXTRACTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/strict-identity-extraction/report.json');

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
  ['qa-strict-identity-extraction', 'src/tests/qa-strict-identity-extraction.mjs'],
  ['qa-identity-lock', 'src/tests/qa-identity-lock.mjs'],
  ['qa-identity-contact-strictness', 'src/tests/qa-identity-contact-strictness.mjs'],
  ['qa-email-strictness', 'src/tests/qa-email-strictness.mjs'],
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
  '# Strict Identity Extraction Report (P0)',
  '',
  `**Status:** ${allPass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'STRICT_IDENTITY_EXTRACTION_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Correct name / email / phone — or leave empty. Missing is better than wrong.',
  '',
  '## Acceptance',
  '',
  '| Criterion | Status |',
  '| --- | --- |',
  `| No company as name | ${acc.no_company_as_name ? '**PASS**' : 'FAIL'} |`,
  `| No corrupted email | ${acc.no_corrupted_email ? '**PASS**' : 'FAIL'} |`,
  `| No fake phone | ${acc.no_fake_phone ? '**PASS**' : 'FAIL'} |`,
  `| Missing is better than wrong | ${acc.missing_better_than_wrong ? '**PASS**' : 'FAIL'} |`,
  `| Low confidence → reviewQueue | ${acc.low_confidence_review_queue ? '**PASS**' : 'FAIL'} |`,
  '',
  '## Rules',
  '',
  '### Name',
  '',
  '- Must be person-like (2–4 capitalized tokens)',
  '- Cannot be company, agency, school, client, project',
  '- Cannot contain digits, `@`, URL, internship, profile',
  '- Employer collision rejected',
  '',
  '### Email',
  '',
  '- Exact source only — grounded in raw/cleaned text',
  '- Never mutate local part (no added letters)',
  '- No guessed correction beyond reversible OCR domain spacing',
  '',
  '### Phone',
  '',
  '- Valid international or local format',
  '- Never merge with years, page numbers, postcodes',
  '- OCR char fixes only inside phone context (`phone-normalize.js`)',
  '',
  '### Low confidence',
  '',
  '- Name / email / phone below 90% → stripped from CV + `reviewQueue` item',
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

lines.push(
  '',
  '## Unit checks',
  '',
  '| Check | Status |',
  '| --- | --- |'
);

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
  '| `identity-extraction.js` | `extractLockedIdentity`, `rejectAsPersonName`, header-only candidates |',
  '| `identity-lock.js` | 90% confidence floor; empty display on failure |',
  '| `identity-contact-strictness.js` | Enforce + reviewQueue emission |',
  '| `email-strictness.js` | Source-grounded email; no local-part mutation |',
  '| `phone-normalize.js` | Strict phone; year/page pollution guard |',
  '| `sanitize-resume-display.js` | Final identity gate before preview/export |',
  '',
  '## Verify',
  '',
  '```bash',
  'npm run qa:strict-identity-extraction',
  'npm run strict-identity-extraction-report',
  'npm run qa:identity-lock',
  'npm run qa:identity-contact-strictness',
  'npm run qa:email-strictness',
  '```',
  ''
);

const fails = report?.checks?.filter((c) => !c.pass) || [];
if (fails.length) {
  lines.push('## Failures', '');
  for (const c of fails) {
    lines.push(`- **${c.id}**: ${c.detail || 'failed'}`);
  }
  lines.push('');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
process.exit(allPass ? 0 : 1);
