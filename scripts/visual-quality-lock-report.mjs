#!/usr/bin/env node
/**
 * P0 — Generate VISUAL_QUALITY_LOCK_REPORT.md from browser visual QA.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'VISUAL_QUALITY_LOCK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/visual-quality-lock/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-visual-quality-lock.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function pct(n) {
  return `${Math.round((n || 0) * 1000) / 10}%`;
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const cvs = report?.cvs || [];

const lines = [
  '# VISUAL_QUALITY_LOCK_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  `**Source:** Browser visual QA (DOM order, A4 page 1, detection parity — not JSON counts)`,
  '',
  '## Rule',
  '',
  'A CV passes only when it **looks like a real professional CV** in the browser.',
  '',
  'Required hierarchy: Identity → Summary → Experience → Clients/Projects → Education → Skills → Tools → Languages',
  '',
  '## VISUAL_QA score (per template)',
  '',
  '| Dimension | Weight |',
  '|-----------|--------|',
  '| Page 1 density | 20 |',
  '| Section order | 20 |',
  '| No giant blank zones | 15 |',
  '| Experience on page 1 | 20 |',
  '| No duplicated sections | 10 |',
  '| Detection panel parity | 10 |',
  '| Meaningful identity | 5 |',
  '',
];

for (const cv of cvs) {
  lines.push(`## ${cv.label} (\`${cv.id}\`)`, '');
  lines.push(`**File:** \`${cv.file}\``);
  lines.push(`**Import:** ${cv.importStatus} (${cv.importPath})`);
  lines.push(`**CV result:** ${cv.pass ? 'PASS' : 'FAIL'}`, '');

  lines.push('### Template visual results', '');
  lines.push('| Template | Score | Page 1 fill | Exp on P1 | Order | Pass |');
  lines.push('|----------|-------|-------------|-----------|-------|------|');

  for (const t of cv.templates || []) {
    const order = (t.order || []).join(' → ');
    lines.push(
      `| ${t.templateId} | ${t.visualScore}/100 | ${pct(t.page1?.fillRatio)} (${t.page1?.textLen || 0} chars) | ${t.experienceOnPage1 ? '✓' : '✗'} | ${order || '—'} | ${t.pass ? '✓' : '✗'} |`
    );
  }
  lines.push('');

  const failed = (cv.templates || []).filter((t) => !t.pass);
  if (failed.length) {
    lines.push('### Failed checks', '');
    for (const t of failed) {
      const bad = Object.entries(t.checks || {})
        .filter(([, v]) => !v)
        .map(([k]) => k);
      lines.push(`- **${t.templateId}:** ${bad.join(', ') || 'unknown'}`);
      if (t.orderIssues?.length) lines.push(`  - order issues: ${t.orderIssues.join(', ')}`);
      if (t.duplicates?.length) {
        lines.push(`  - duplicates: ${t.duplicates.map((d) => `${d.section}×${d.count}`).join(', ')}`);
      }
      const eduRow = (t.detectionRows || []).find((r) => r.key === 'education');
      if (eduRow && !eduRow.ok) lines.push(`  - detection panel: ${eduRow.label}`);
    }
    lines.push('');
  }
}

lines.push('## Verify', '', '```bash', 'node src/tests/qa-visual-quality-lock.mjs', 'node scripts/visual-quality-lock-report.mjs', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 16000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass && report?.pass ? 0 : 1);
