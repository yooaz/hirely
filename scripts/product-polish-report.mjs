#!/usr/bin/env node
/**
 * Generate PRODUCT_POLISH_REPORT.md from H6 product polish QA.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PRODUCT_POLISH_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/h6-product-polish/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

console.log('Running qa:h6-product-polish…');
const qa = spawnSync('node', ['src/tests/qa-h6-product-polish.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const data = readJson(JSON_PATH);
const pass = qa.status === 0 && data?.pass !== false;
const failed = (data?.results || []).filter((r) => !r.pass);

const lines = [];
lines.push('# PRODUCT_POLISH_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
lines.push(`Checks: **${data?.passed ?? '?'}/${(data?.results || []).length}**`);
lines.push('');

lines.push('## H6 scope');
lines.push('');
lines.push('Commercial UX polish only — no parser, OCR, or templates engine changes.');
lines.push('');
lines.push('### Homepage');
lines.push('- Clear headline + simple promise');
lines.push('- Upload CTA above the fold (`#heroUploadBtn`)');
lines.push('- 3-step story: **Import → Relire → Exporter**');
lines.push('');
lines.push('### Pricing');
lines.push('- **Gratuit**: import + preview, basic ATS check');
lines.push('- **Pro 9€**: premium templates, cover letter, PDF export, LinkedIn optimization');
lines.push('');
lines.push('### Review');
lines.push('- 3-step stepper (style merged into Export)');
lines.push('- Cleaner review cards and French-first microcopy');
lines.push('- Less technical/debug language in user-facing surfaces');
lines.push('');

lines.push('## Acceptance');
lines.push('');
const acceptance = [
  ['Clear homepage headline', 'homepage_clear_headline'],
  ['Simple promise (lead)', 'homepage_simple_promise'],
  ['Upload CTA above fold', 'upload_cta_above_fold'],
  ['Hero shows 3 steps', 'hero_three_steps'],
  ['Steps: Import / Review / Export', 'hero_steps_import_review_export'],
  ['No debug jargon on hero', 'hero_no_debug_jargon'],
  ['Free plan feature list', 'pricing_free_features'],
  ['Free includes ATS check', 'pricing_free_ats'],
  ['Pro plan 4 features', 'pricing_pro_features'],
  ['Pro bundle complete', 'pricing_pro_bundle'],
  ['Pro priced at 9€', 'pricing_pro_9eur'],
  ['Stepper shows 3 steps', 'stepper_three_steps'],
  ['Stepper labels correct', 'stepper_import_review_export'],
  ['Review panel visible', 'review_panel_visible'],
  ['Review titles commercial', 'review_clean_titles'],
  ['No debug language on review', 'review_no_debug_language'],
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

lines.push('## Files touched');
lines.push('');
lines.push('- `index.html` — hero, pricing, stepper, review copy, progress nav logic');
lines.push('- `src/ui/hirely-premium-polish.css` — hero upload, pricing features, review card polish');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
