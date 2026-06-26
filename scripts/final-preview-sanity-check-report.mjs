#!/usr/bin/env node
/**
 * P0 — Generate FINAL_PREVIEW_SANITY_CHECK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  FINAL_PREVIEW_SANITY_CHECK_V1,
  PREVIEW_SANITY_RULES,
} from '../src/core/validation/final-preview-sanity-check.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'FINAL_PREVIEW_SANITY_CHECK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/final-preview-sanity-check/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-final-preview-sanity-check.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const fails = (report?.checks || []).filter((c) => !c.pass);

const lines = [
  '# FINAL_PREVIEW_SANITY_CHECK_REPORT',
  '',
  `**Status:** ${qa.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Run a last-mile sanity gate before CV preview render. Any line that fails a rule is removed from preview and moved to `reviewQueue`.',
  '',
  '## Rules',
  '',
];

for (const rule of PREVIEW_SANITY_RULES) {
  const label = {
    no_fake_phone: 'No fake or polluted phone numbers in identity',
    no_company_as_name: 'No company/agency used as person name',
    no_partial_language: 'No partial or polluted language lines (e.g. "Native am")',
    no_ocr_fragments: 'No isolated OCR micro-fragments (am, co, @, etc.)',
    no_empty_sections: 'No empty section entries in preview payload',
    no_duplicated_sections: 'No duplicate lines within a section',
    no_parser_labels: 'No parser section labels as CV body content',
  }[rule];
  lines.push(`- **${rule}** — ${label || rule}`);
}

lines.push(
  '',
  '## Implementation',
  '',
  '| Area | Change |',
  '|------|--------|',
  '| `final-preview-sanity-check.js` | `applyFinalPreviewSanityCheck()` + `auditFinalPreviewSanity()` |',
  '| `final-resume-contract.js` | Runs sanity check after density/OCR cleanup, before contract commit |',
  '| `index.html` | `buildFinalResumeData` review items merged into `state.reviewQueue` on commit |',
  '',
  '## QA summary',
  '',
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Policy | ${FINAL_PREVIEW_SANITY_CHECK_V1} |`,
  `| Checks run | ${(report?.checks || []).length} |`,
  `| Failures | ${fails.length} |`,
  `| Pipeline review items | ${report?.pipeline?.reviewCount ?? '—'} |`,
  `| Preview lines (OCR fixture) | ${report?.pipeline?.previewLineCount ?? '—'} |`,
  ''
);

if (fails.length) {
  lines.push('## Failures', '');
  for (const f of fails) {
    lines.push(`- **${f.id}**${f.detail ? `: ${f.detail}` : ''}`);
  }
  lines.push('');
}

if (!qa.pass && qa.out) {
  lines.push('## QA log (tail)', '', '```', qa.out.split('\n').slice(-30).join('\n'), '```', '');
}

lines.push('## Verify', '', '```bash', 'npm run qa:final-preview-sanity-check', 'npm run final-preview-sanity-check-report', '```', '');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass ? 0 : 1);
