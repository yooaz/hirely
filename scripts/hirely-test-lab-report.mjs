#!/usr/bin/env node
/**
 * Generate TEST_LAB_RESULTS.md from Hirely Test Lab report.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const REPORT_JSON = join(root, 'tests/output/hirely-test-lab/report.json');

const gate = spawnSync('node', ['src/tests/qa-hirely-test-lab.mjs'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  timeout: 300000,
});
const gateOk = gate.status === 0;

let report = null;
if (existsSync(REPORT_JSON)) {
  report = JSON.parse(readFileSync(REPORT_JSON, 'utf8'));
}

const lines = [];
lines.push('# Hirely Test Lab Results');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Engine:** \`${report?.engine || 'HIRELY_TEST_LAB_V1'}\``);
lines.push(`**CVs tested:** ${report?.count || 50}`);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Overall pass:** ${report?.pass ? 'YES' : 'NO'}`);
lines.push('');
lines.push('## Environment');
lines.push('');
lines.push('| Asset | Path |');
lines.push('|-------|------|');
lines.push('| Catalog | `tests/lib/hirely-test-lab-catalog.mjs` |');
lines.push('| Metrics | `tests/lib/hirely-test-lab-metrics.mjs` |');
lines.push('| Runner | `src/tests/lib/hirely-test-lab-suite.mjs` |');
lines.push('| Dashboard | `test-lab/index.html` |');
lines.push('| JSON report | `tests/output/hirely-test-lab/report.json` |');
lines.push('');
lines.push('## Coverage matrix');
lines.push('');
lines.push('| Dimension | Variants |');
lines.push('|-----------|----------|');
if (report?.summary) {
  lines.push(`| Countries | ${Object.keys(report.summary.byCountry || {}).join(', ')} |`);
  lines.push(`| Languages | ${Object.keys(report.summary.byLanguage || {}).join(', ')} |`);
  lines.push(`| Layouts | ${Object.keys(report.summary.byLayout || {}).join(', ')} |`);
  lines.push(`| Categories | ${Object.keys(report.summary.byCategory || {}).join(', ')} |`);
}
lines.push('| Source types | text, docx, scanned-pdf (OCR sim), LinkedIn PDF/export/merge |');
lines.push('| Roles | designer, developer, engineer, executive, consultant, student, marketing, sales, freelancer, artist |');
lines.push('');
lines.push('## Measured dimensions');
lines.push('');
lines.push('| Metric | Description | Goal | Result |');
lines.push('|--------|-------------|------|--------|');
if (report?.summary && report?.goals) {
  lines.push(
    `| Import success | Pipeline completes without fatal errors | ${report.goals.importSuccess}% | **${report.summary.importSuccessRate}%** |`
  );
  lines.push(
    `| Extraction accuracy | Weighted name/contact/experience/education/skills recall | ${report.goals.extractionAccuracy}% | **${report.summary.extractionAccuracy}%** |`
  );
  lines.push(
    `| Template quality | Product score + scan-zone proxy for assigned V3 template | ${report.goals.templateQuality} | **${report.summary.templateQuality}** |`
  );
  lines.push(
    `| ATS score accuracy | ATS score meets expected minimum from ground truth | ${report.goals.atsScoreAccuracy}% | **${report.summary.atsScoreAccuracy}%** |`
  );
  lines.push(
    `| PDF quality | Export-lock readiness (finalResume + contract) | ${report.goals.pdfQuality}% | **${report.summary.pdfQuality}%** |`
  );
}
lines.push('');
lines.push('## Goals met');
lines.push('');
if (report?.goalsMet) {
  for (const [key, met] of Object.entries(report.goalsMet)) {
    lines.push(`- **${key}**: ${met ? 'PASS' : 'FAIL'}`);
  }
}
lines.push('');
lines.push('## By category');
lines.push('');
lines.push('| Category | Count | Extraction | Template | ATS pass | PDF |');
lines.push('|----------|-------|------------|----------|----------|-----|');
for (const [cat, row] of Object.entries(report?.summary?.byCategory || {})) {
  lines.push(
    `| ${cat} | ${row.count} | ${row.extractionAccuracy}% | ${row.templateQuality} | ${row.atsPassRate}% | ${row.pdfQuality}% |`
  );
}
lines.push('');
lines.push('## By country');
lines.push('');
lines.push('| Country | Count | Extraction | Template | ATS pass | PDF |');
lines.push('|---------|-------|------------|----------|----------|-----|');
for (const [country, row] of Object.entries(report?.summary?.byCountry || {})) {
  lines.push(
    `| ${country} | ${row.count} | ${row.extractionAccuracy}% | ${row.templateQuality} | ${row.atsPassRate}% | ${row.pdfQuality}% |`
  );
}
lines.push('');
lines.push('## Scanned PDF / OCR');
lines.push('');
for (const [layout, row] of Object.entries(report?.summary?.scannedPdf || {})) {
  lines.push(`- **${layout}** (${row.count}): extraction ${row.extractionAccuracy}%, PDF ${row.pdfQuality}%`);
}
lines.push('');
lines.push('## LinkedIn');
lines.push('');
for (const [cat, row] of Object.entries(report?.summary?.linkedin || {})) {
  lines.push(`- **${cat}** (${row.count}): extraction ${row.extractionAccuracy}%, template ${row.templateQuality}`);
}
lines.push('');
lines.push('## Lowest extraction scores');
lines.push('');
const worst = [...(report?.results || [])]
  .sort((a, b) => (a.extractionAccuracy || 0) - (b.extractionAccuracy || 0))
  .slice(0, 8);
lines.push('| ID | Role | Country | Layout | Extraction | Notes |');
lines.push('|----|------|---------|--------|------------|-------|');
for (const r of worst) {
  lines.push(
    `| ${r.id} | ${r.role} | ${r.country} | ${r.layout} | ${r.extractionAccuracy}% | ${(r.errors || []).join('; ') || '—'} |`
  );
}
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:hirely-test-lab');
lines.push('npm run hirely-test-lab-report');
lines.push('```');
lines.push('');
lines.push('Open `test-lab/index.html` (serve repo root) to browse the JSON dashboard.');
lines.push('');
if (!gateOk && gate.stderr) {
  lines.push('### QA stderr');
  lines.push('');
  lines.push('```');
  lines.push(gate.stderr.trim().slice(0, 3000));
  lines.push('```');
}

writeFileSync(join(root, 'TEST_LAB_RESULTS.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote TEST_LAB_RESULTS.md');
process.exit(gateOk ? 0 : 1);
