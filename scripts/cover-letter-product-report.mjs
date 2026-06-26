#!/usr/bin/env node
/**
 * Generate COVER_LETTER_PRODUCT_REPORT.md from H5 cover letter QA.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'COVER_LETTER_PRODUCT_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/h5-cover-letter/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

console.log('Running qa:h5-cover-letter-product…');
const qa = spawnSync('node', ['src/tests/qa-h5-cover-letter-product.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const data = readJson(JSON_PATH);
const pass = qa.status === 0 && data?.pass !== false;
const failed = (data?.results || []).filter((r) => !r.pass);

const lines = [];
lines.push('# COVER_LETTER_PRODUCT_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
lines.push(`Checks: **${data?.passed ?? '?'}/${(data?.results || []).length}**`);
lines.push('');

lines.push('## Product scope (H5)');
lines.push('');
lines.push('- Visible after CV review (`Relire` step)');
lines.push('- Entry: **Lettre de motivation** (`#openLetterReviewBtn`)');
lines.push('- Editable target role + company');
lines.push('- Tone: Formal · Creative · Startup · Corporate');
lines.push('- Generation from `finalResumeData` only — no invented company, date, role, or experience');
lines.push('- Generic spontaneous letter when role/company empty');
lines.push('- Editable output, copy, PDF export');
lines.push('');

lines.push('## Acceptance');
lines.push('');
const acceptance = [
  ['Engine unit tests', 'engine_unit_pass'],
  ['CV import', 'import_cv'],
  ['Letter entry on review step', 'letter_entry_on_review'],
  ['Panel opens (no hidden click failure)', 'letter_open_no_hidden_click_fail'],
  ['Panel + generate button visible', 'panel_opens_with_controls'],
  ['Four tone modes', 'tone_selector_four_modes'],
  ['Generate click works', 'generate_click_visible'],
  ['Letter generated (targeted)', 'letter_generated_targeted'],
  ['Role + company in letter', 'targeted_mentions_role_company'],
  ['Output editable', 'letter_output_editable'],
  ['Copy works', 'copy_works'],
  ['PDF export works', 'pdf_export_works'],
  ['Generic letter (no job/company)', 'generic_letter_without_job_company'],
  ['No invented company/date', 'no_invented_company_or_date'],
  ['Uses CV identity from final data', 'letter_uses_final_cv_identity'],
  ['Creative tone applies', 'tone_creative_applies'],
];
lines.push('| Criterion | Status | Detail |');
lines.push('|-----------|--------|--------|');
for (const [label, id] of acceptance) {
  const r = (data?.results || []).find((x) => x.id === id);
  lines.push(`| ${label} | ${r?.pass ? '✅' : r ? '❌' : '—'} | ${r?.detail || ''} |`);
}
lines.push('');

if (failed.length) {
  lines.push('## Blockers');
  lines.push('');
  for (const r of failed) {
    lines.push(`- **${r.id}**: ${r.detail || 'failed'}`);
  }
  lines.push('');
}

lines.push('## Implementation notes');
lines.push('');
lines.push('- `#openLetterReviewBtn` in recruiter analysis sidebar opens `#coverLetterWorkspace` on the review step');
lines.push('- `#workspace.letter-panel-open` shows `docFooter` during `edit` (letter panel no longer export-only)');
lines.push('- `getCoverLetterCvData()` maps `finalResumeData` via `resumeDataToCvData({ skipNormalize: true })`');
lines.push('- `validateCoverLetterInputs` no longer requires target role; generic openings in `cover-letter-engine.js`');
lines.push('- `letterTargetRole()` reads only `#letterTargetRole` (not CV title fallback) for generic mode');
lines.push('');

lines.push('## Artifacts');
lines.push('');
lines.push(`- QA JSON: \`tests/output/h5-cover-letter/report.json\``);
if (data?.artifacts?.letterPdf) lines.push(`- Letter PDF: \`${path.relative(ROOT, data.artifacts.letterPdf)}\``);
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
