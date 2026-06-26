#!/usr/bin/env node
/**
 * Generate TEST_MATRIX.md from Hirely Test Matrix report.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const REPORT_JSON = join(root, 'tests/output/hirely-test-matrix/report.json');

const gate = spawnSync('node', ['src/tests/qa-hirely-test-matrix.mjs'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  timeout: 120000,
});
const gateOk = gate.status === 0;

let report = null;
if (existsSync(REPORT_JSON)) {
  report = JSON.parse(readFileSync(REPORT_JSON, 'utf8'));
}

const pf = (v) => (v ? '**PASS**' : '**FAIL**');

const lines = [];
lines.push('# Hirely Test Matrix');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Engine:** \`${report?.engine || 'HIRELY_TEST_MATRIX_V1'}\``);
lines.push(`**Fixtures:** \`${report?.fixtureDir || 'tests/fixtures/hirely-test-lab'}/\``);
lines.push(`**Overall:** ${report?.pass ? 'PASS' : 'FAIL'} (${report?.summary?.passCount ?? 0}/${report?.count ?? 6} files all-green)`);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Fixture pack');
lines.push('');
lines.push('| File | Role |');
lines.push('|------|------|');
lines.push('| `good.pdf` | Selectable text PDF — full CV import |');
lines.push('| `bad.pdf` | Corrupt PDF — must route to paste |');
lines.push('| `scan.pdf` | Image-only PDF — must route to paste |');
lines.push('| `docx.docx` | Word document — native extract |');
lines.push('| `txt.txt` | Plain text CV |');
lines.push('| `paste.txt` | Paste fallback / recovery text |');
lines.push('');
lines.push('## Matrix');
lines.push('');
lines.push('| File | Import | Review | Template | Export | Row | Notes |');
lines.push('|------|--------|--------|----------|--------|-----|-------|');

for (const row of report?.results || []) {
  lines.push(
    `| \`${row.file}\` | ${pf(row.import.pass)} | ${pf(row.review.pass)} | ${pf(row.template.pass)} | ${pf(row.export.pass)} | ${pf(row.pass)} | ${row.notes || (row.import.pasteChained ? 'Downstream via paste.txt' : '—')} |`
  );
}

lines.push('');
lines.push('## Stage totals');
lines.push('');
if (report?.summary) {
  lines.push(`| Stage | Pass |`);
  lines.push(`|-------|------|`);
  lines.push(`| Import | ${report.summary.importPass}/${report.count} |`);
  lines.push(`| Review | ${report.summary.reviewPass}/${report.count} |`);
  lines.push(`| Template | ${report.summary.templatePass}/${report.count} |`);
  lines.push(`| Export | ${report.summary.exportPass}/${report.count} |`);
}
lines.push('');
lines.push('## Import detail');
lines.push('');
lines.push('| File | State | ms | Paste chained |');
lines.push('|------|-------|-----|---------------|');
for (const row of report?.results || []) {
  lines.push(
    `| \`${row.file}\` | \`${row.import.state || '—'}\` | ${row.import.ms} | ${row.import.pasteChained ? 'yes' : 'no'} |`
  );
}
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:hirely-test-matrix');
lines.push('npm run hirely-test-matrix-report');
lines.push('```');
lines.push('');
lines.push('Fixtures live in `tests/fixtures/hirely-test-lab/`. `good.pdf`, `scan.pdf`, and `docx.docx` are generated on first run if missing.');
lines.push('');

if (!gateOk && gate.stderr) {
  lines.push('### QA stderr');
  lines.push('');
  lines.push('```');
  lines.push(gate.stderr.trim().slice(0, 2000));
  lines.push('```');
}

writeFileSync(join(root, 'TEST_MATRIX.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote TEST_MATRIX.md');
process.exit(gateOk ? 0 : 1);
