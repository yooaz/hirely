#!/usr/bin/env node
/**
 * Generate END_TO_END_FLOW_REPORT.md from H4 E2E QA.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS, PRODUCTION_TEMPLATE_DISPLAY_NAMES } from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'END_TO_END_FLOW_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/h4-end-to-end/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

console.log('Running qa:h4-end-to-end-flow…');
const qa = spawnSync('node', ['src/tests/qa-h4-end-to-end-flow.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const data = readJson(JSON_PATH);
const pass = qa.status === 0 && data?.pass !== false;
const failed = (data?.results || []).filter((r) => !r.pass);

const lines = [];
lines.push('# END_TO_END_FLOW_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
lines.push(`Checks: **${data?.passed ?? '?'}/${(data?.results || []).length}**`);
lines.push('');

lines.push('## Product flow');
lines.push('');
lines.push('```');
lines.push('Open /?pro=true → Upload PDF → Review → Score → Templates (×3) → CV PDF → Cover letter → Letter PDF');
lines.push('```');
lines.push('');

lines.push('## Templates');
lines.push('');
for (const id of PRODUCTION_TEMPLATE_IDS) {
  lines.push(`- **${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]}** (\`${id}\`)`);
}
lines.push('');

lines.push('## Acceptance');
lines.push('');
const acceptance = [
  ['no CORE_BOOT_FAILED', 'no_core_boot_failed'],
  ['no missing export', 'preflight_missing_exports'],
  ['no render loop', 'no_render_loop'],
  ['upload works', 'upload_pdf_works'],
  ['review visible', 'review_visible'],
  ['score visible', 'score_visible'],
  ['3 templates selectable', 'templates_three_selectable'],
  ['selected template persists', 'template_persists'],
  ['CV PDF exports', 'cv_pdf_exports'],
  ['PDF checklist ✓', 'pdf_checklist_ok'],
  ['cover letter panel opens', 'cover_letter_panel_opens'],
  ['cover letter generates', 'cover_letter_generated'],
  ['cover letter exports', 'cover_letter_exports'],
];
lines.push('| Criterion | Status |');
lines.push('|-----------|--------|');
for (const [label, id] of acceptance) {
  const r = (data?.results || []).find((x) => x.id === id);
  lines.push(`| ${label} | ${r?.pass ? '✅' : r ? '❌' : '—'} |`);
}
lines.push('');

if (data?.results?.length) {
  lines.push('## All checks');
  lines.push('');
  lines.push('| Check | Status | Detail |');
  lines.push('|-------|--------|--------|');
  for (const r of data.results) {
    lines.push(`| \`${r.id}\` | ${r.pass ? 'PASS' : 'FAIL'} | ${String(r.detail || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
}

if (failed.length) {
  lines.push('## Remaining blockers');
  lines.push('');
  for (const r of failed) {
    lines.push(`- \`${r.id}\`: ${r.detail || 'failed'}`);
  }
  lines.push('');
} else {
  lines.push('## Remaining blockers');
  lines.push('');
  lines.push('None.');
  lines.push('');
}

lines.push('## Artifacts');
lines.push('');
lines.push('- `tests/output/h4-end-to-end/yoaz-upload.pdf`');
lines.push('- `tests/output/h4-end-to-end/h4-cv-export.pdf`');
lines.push('- `tests/output/h4-end-to-end/h4-letter-export.pdf`');
lines.push('');

lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:h4-end-to-end-flow');
lines.push('npm run end-to-end-flow-report');
lines.push('```');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
