#!/usr/bin/env node
/**
 * P0 — Generate REVIEW_BEFORE_TEMPLATE_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REVIEW_BEFORE_TEMPLATE_LOCK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/review-before-template-lock/report.json');

function runQa(script) {
  const res = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  return { pass: res.status === 0 };
}

const suites = [
  { name: 'qa-review-before-template-lock', ...runQa('src/tests/qa-review-before-template-lock.mjs') },
  { name: 'qa-review-flow', ...runQa('src/tests/qa-review-flow.mjs') },
  { name: 'qa-final-preview-sanity-check', ...runQa('src/tests/qa-final-preview-sanity-check.mjs') },
];

const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const pass = report?.pass === true && suites.every((s) => s.pass);

const lines = [
  '# Review Before Template Lock Report (P0)',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'REVIEW_BEFORE_TEMPLATE_LOCK_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Templates must only appear after review data is safe. Flow: **Import → Review → Choose template → Export**.',
  '',
  '## Acceptance',
  '',
  '| Criterion | Status |',
  '| --- | --- |',
  `| No corrupted data reaches template | **${report?.acceptance?.no_corrupted_template_data ? 'PASS' : 'FAIL'}** |`,
  `| Template locked while critical review pending | **${report?.acceptance?.template_locked_with_critical ? 'PASS' : 'FAIL'}** |`,
  `| Template unlocks when critical items resolved | **${report?.acceptance?.template_unlocks_when_clear ? 'PASS' : 'FAIL'}** |`,
  `| OCR fallback blocks template step | **${report?.acceptance?.ocr_fallback_blocks ? 'PASS' : 'FAIL'}** |`,
  '',
  '## Critical review items',
  '',
  '| Kind | Blocks template | User actions |',
  '| --- | --- | --- |',
  '| Uncertain name | Yes | Accept · Edit · Reject |',
  '| Uncertain email | Yes | Accept · Edit · Reject |',
  '| Uncertain phone | Yes | Accept · Edit · Reject |',
  '| Fake / low-confidence experience | Yes | Accept · Edit · Reject |',
  '| OCR fallback required | Yes | Paste CV text |',
  '',
  '## UI gates',
  '',
  '| Step | Gate |',
  '| --- | --- |',
  '| Choose template | `isTemplateReady()` |',
  '| Export | `isExportReady()` (template + readiness) |',
  '| Progress nav | Style/export disabled while locked |',
  '| Primary CTA | Disabled on Review when critical items remain |',
  '',
  '## Modules',
  '',
  '| Module | Role |',
  '| --- | --- |',
  '| `review-before-template-lock.js` | Classify critical items + lock report |',
  '| `review-queue.js` | Accept / edit / reject resolution |',
  '| `final-resume-contract.js` | Sanitized `finalResumeData` only |',
  '| `index.html` | `setDocStep` + CTA + progress nav gates |',
  '',
  '## QA suites',
  '',
  '| Suite | Result |',
  '| --- | --- |',
  ...suites.map((s) => `| \`${s.name}\` | ${s.pass ? 'PASS' : 'FAIL'} |`),
  '',
  `**Unit checks:** ${report ? `${report.summary.pass}/${report.summary.total}` : 'not run'}`,
  '',
];

if (report?.checks?.length) {
  lines.push('## Unit checks', '', '| Check | Status |', '| --- | --- |');
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');
}

lines.push(
  '## Verify',
  '',
  '```bash',
  'npm run qa:review-before-template-lock',
  'npm run review-before-template-lock-report',
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
