#!/usr/bin/env node
/**
 * P1 — Generate TEMPLATE_DENSITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  DENSITY_MIN_FIRST_PAGE_FILL,
  DENSITY_MIN_SECTIONS_FOR_FILL,
  DENSITY_MIN_VISIBLE_TEXT,
} from '../src/ui/templates/template-density.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_DENSITY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/template-density/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-template-density.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const templateAudits = (report?.audits || []).filter((a) => a.templateId);
const fillFails = templateAudits.filter(
  (a) => a.sectionCount >= DENSITY_MIN_SECTIONS_FOR_FILL && a.fillPct + 1e-6 < DENSITY_MIN_FIRST_PAGE_FILL * 100
);
const completenessFails = templateAudits.filter((a) => a.completenessPass === false);

const lines = [
  '# TEMPLATE_DENSITY_REPORT',
  '',
  `**Status:** ${qa.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Fix visual density so templates never look empty when resume data exists: render every populated section, use balanced spacing for sparse CVs, and paginate long CVs to page 2+.',
  '',
  '## Rules',
  '',
  '- If a section exists in resumeData → render it in the template.',
  '- Few sections → tighter top-aligned spacing (no giant blank footer).',
  '- Many sections → A4 pagination splits overflow to page 2+.',
  `- QA gate: first A4 page uses ≥${DENSITY_MIN_FIRST_PAGE_FILL * 100}% vertical space when resumeData has ${DENSITY_MIN_SECTIONS_FOR_FILL}+ sections.`,
  `- No empty-looking preview when data exists (≥${DENSITY_MIN_VISIBLE_TEXT} visible characters).`,
  '',
  '## Implementation',
  '',
  '| Area | Change |',
  '|------|--------|',
  '| `cv-templates.js` | `cvDensity--sparse` / `cvDensity--filled` on `.cvInner` + `data-section-count` |',
  '| `cv-template-density.css` | Top-aligned layout, section rhythm, sparse preview min-height fix |',
  '| `cv-a4-pages.js` | `data-fill-pct` annotation on first sheet after layout |',
  '| `template-density.mjs` | Shared section counting + fill gate helpers for QA |',
  '',
  '## QA summary',
  '',
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Rich fixture sections | ${report?.richSectionCount ?? '—'} |`,
  `| Sparse fixture sections | ${report?.sparseSectionCount ?? '—'} |`,
  `| Templates audited | ${templateAudits.length} |`,
  `| Fill gate failures | ${fillFails.length} |`,
  `| Completeness failures | ${completenessFails.length} |`,
  '',
];

if (templateAudits.length) {
  lines.push('## Per-template first-page fill', '', '| Template | Sections | Fill % | Text | Completeness |', '|----------|----------|--------|------|--------------|');
  for (const a of templateAudits) {
    lines.push(
      `| ${a.templateId} | ${a.sectionCount} | ${a.fillPct}% | ${a.textLen} | ${a.completenessPass ? 'PASS' : 'FAIL'} (${a.completenessScore}%) |`
    );
  }
  lines.push('');
}

const scenarios = (report?.audits || []).filter((a) => a.scenario);
if (scenarios.length) {
  lines.push('## Scenarios', '');
  for (const s of scenarios) {
    lines.push(`- **${s.scenario}**: sections=${s.sectionCount}, sheets=${s.sheets ?? 1}, text=${s.textLen}`);
  }
  lines.push('');
}

if (fillFails.length) {
  lines.push('## Fill failures', '');
  for (const f of fillFails) {
    lines.push(`- ${f.templateId}: ${f.fillPct}% (need ≥${DENSITY_MIN_FIRST_PAGE_FILL * 100}%)`);
  }
  lines.push('');
}

lines.push('## Verify', '', '```bash', 'node src/tests/qa-template-density.mjs', 'node scripts/template-density-report.mjs', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 8000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass ? 0 : 1);
