#!/usr/bin/env node
/**
 * P0 — Generate TEMPLATE_DENSITY_POLISH_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  DENSITY_MIN_FIRST_PAGE_FILL,
  DENSITY_MIN_SECTIONS_FOR_FILL,
  DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1,
} from '../src/ui/templates/template-density.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_DENSITY_POLISH_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/template-density-polish/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-template-density-polish.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const templateAudits = (report?.audits || []).filter((a) => a.templateId);
const majorFails = templateAudits.filter((a) => a.majorPass === false);
const fillFails = templateAudits.filter(
  (a) =>
    (a.sectionCount || 0) >= DENSITY_MIN_SECTIONS_FOR_FILL &&
    (a.fillPct ?? 0) + 1e-6 < DENSITY_MIN_FIRST_PAGE_FILL * 100
);
const tailFails = templateAudits.filter(
  (a) => (a.blankTailRatio ?? 0) >= 0.42 && (a.fillPct ?? 0) + 1e-6 < DENSITY_MIN_FIRST_PAGE_FILL * 100
);

const lines = [
  '# TEMPLATE_DENSITY_POLISH_REPORT',
  '',
  `**Status:** ${qa.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Premium polish so CVs never feel empty when data exists: identity plus major sections above the fold, tighter vertical rhythm, stronger experience hierarchy, and compact clients/tools rows.',
  '',
  '## P0 rules',
  '',
  `- First A4 page shows **identity** + **≥${DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1} major sections** when resume data exists.`,
  '- Reduce excessive vertical spacing (section gaps, header lead, meta grid).',
  '- Experience uses `cvSection--primary` with stronger role/company hierarchy.',
  '- Clients and tools use `cvSection--compact` + single-line `·` separators.',
  "- Empty sections are not rendered (builders return empty string + CSS :empty hide).",
  `- Rich CVs (${DENSITY_MIN_SECTIONS_FOR_FILL}+ sections) target ≥${DENSITY_MIN_FIRST_PAGE_FILL * 100}% first-page fill; no giant blank lower half.`,
  '',
  '## Implementation',
  '',
  '| Area | Change |',
  '|------|--------|',
  '| `template-density.mjs` | `DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1`, filled threshold 4, fill gate 50% |',
  '| `cv-templates.js` | Default `expDensity: tight`, `cvSection--primary` on experience, compact clients/tools |',
  '| `cv-template-density.css` | Tighter gaps, experience emphasis, compact client chips + tools lines |',
  '| `cv-templates-professional.css` | Reduced section margins, meta grid gap, experience role weight |',
  '| `cv-a4-pages.js` | Editorial magazine `cvEmCol` columns paginate on page 1 (was header-only) |',
  '| `cv-templates-editorial-magazine.css` | Compact cover + spread padding when `cvDensity--filled` |',
  '',
  '## QA summary',
  '',
  '| Metric | Value |',
  '|--------|-------|',
  `| Templates audited | ${templateAudits.length} |`,
  `| Major-section gate failures | ${majorFails.length} |`,
  `| Fill gate failures | ${fillFails.length} |`,
  `| Blank-tail failures | ${tailFails.length} |`,
  `| Rich fixture sections | ${report?.richSectionCount ?? '—'} |`,
  '',
];

if (templateAudits.length) {
  lines.push(
    '## Per-template page 1',
    '',
    '| Template | Major sections | Fill % | Blank tail % | Exp role | Compact tools |',
    '|----------|----------------|--------|--------------|----------|---------------|'
  );
  for (const a of templateAudits) {
    lines.push(
      `| ${a.templateId} | ${a.majorSections} | ${a.fillPct}% | ${Math.round((a.blankTailRatio || 0) * 100)}% | ${a.hasExpRole ? 'yes' : 'no'} | ${a.hasCompactTools ? 'yes' : 'no'} |`
    );
  }
  lines.push('');
}

if (majorFails.length || fillFails.length || tailFails.length) {
  lines.push('## Failures', '');
  for (const f of majorFails) {
    lines.push(`- **${f.templateId}** major sections: ${f.majorSections} (need ≥${DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1})`);
  }
  for (const f of fillFails) {
    lines.push(`- **${f.templateId}** fill: ${f.fillPct}% (need ≥${DENSITY_MIN_FIRST_PAGE_FILL * 100}%)`);
  }
  for (const f of tailFails) {
    lines.push(`- **${f.templateId}** blank tail: ${Math.round((f.blankTailRatio || 0) * 100)}%`);
  }
  lines.push('');
}

if (!qa.pass && qa.out) {
  lines.push('## QA log (tail)', '', '```', qa.out.split('\n').slice(-40).join('\n'), '```', '');
}

lines.push('## Verify', '', '```bash', 'npm run qa:template-density-polish', 'npm run template-density-polish-report', '```', '');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass ? 0 : 1);
