#!/usr/bin/env node
/**
 * P0 — Generate TEMPLATE_SECTION_ORDER_FIX_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { UNIVERSAL_SECTION_ORDER, TEMPLATE_SECTION_ORDER_LOCK } from '../src/ui/templates/universal-section-order.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_SECTION_ORDER_FIX_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/template-section-order/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-template-section-order.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# TEMPLATE_SECTION_ORDER_FIX_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Lock:** ${TEMPLATE_SECTION_ORDER_LOCK}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Universal section order',
  '',
  UNIVERSAL_SECTION_ORDER.join(' → '),
  '',
  '## Rules enforced',
  '',
  '- Experience before skills/tools when experiences exist',
  '- Clients near experience (immediately after)',
  '- Skills/tools/languages only in compact footer (no sidebar duplication)',
  '- A4 pagination packs main content before sidebar/meta',
  '- No duplicate skills/tools sections across pages',
  '- Experience visible on page 1 when experience exists',
  '',
  '## Code changes',
  '',
  '- `stackUniversal()` — single canonical stack for all templates',
  '- Removed portfolio-first / creative-first reordering',
  '- Sidebars with skills/tools removed (ATS Executive, Modern Two Column, Editorial Premium, etc.)',
  '- `cv-a4-pages.js` — main column units packed before side/meta',
  '',
];

for (const cv of report?.cvs || []) {
  lines.push(`## ${cv.label} (\`${cv.id}\`)`, '');
  lines.push(`**Result:** ${cv.pass ? 'PASS' : 'FAIL'}`, '');
  lines.push('| Template | Order | Exp on P1 | Duplicates | Pass |');
  lines.push('|----------|-------|-----------|------------|------|');
  for (const t of cv.templates || []) {
    const dups = Object.keys(t.duplicates || {}).length
      ? Object.entries(t.duplicates).map(([k, v]) => `${k}×${v}`).join(', ')
      : '—';
    lines.push(
      `| ${t.templateId} | ${(t.order || []).join(' → ')} | ${t.experienceOnPage1 ? '✓' : '✗'} | ${dups} | ${t.pass ? '✓' : '✗'} |`
    );
  }
  lines.push('');
  const failed = (cv.templates || []).filter((t) => !t.pass);
  if (failed.length) {
    lines.push('### Failures', '');
    for (const t of failed) {
      lines.push(`- **${t.templateId}:** ${(t.orderIssues || []).join(', ') || Object.entries(t.checks || {}).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    }
    lines.push('');
  }
}

lines.push('## Verify', '', '```bash', 'node src/tests/qa-template-section-order.mjs', 'node scripts/template-section-order-fix-report.mjs', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass && report?.pass ? 0 : 1);
