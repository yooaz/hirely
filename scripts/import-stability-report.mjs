#!/usr/bin/env node
/**
 * H7 import stability report.
 * node scripts/import-stability-report.mjs
 * Output: IMPORT_STABILITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  H7_IMPORT_V1,
  H7_SCENARIOS,
} from '../tests/lib/h7-import-catalog.mjs';
import {
  ensureH7Fixtures,
  runNodeImportScenario,
  runBrowserImportScenarios,
  summarizeRows,
} from '../tests/lib/h7-import-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'IMPORT_STABILITY_REPORT.md');

function riskBadge(risk) {
  if (!risk || risk === 'NONE') return 'OK';
  if (risk === 'SKIP') return 'SKIP';
  if (/CRASH|STUCK|PAGE/.test(risk)) return 'CRASH RISK';
  return risk;
}

async function main() {
  const fixtures = ensureH7Fixtures(ROOT);
  const generatedAt = new Date().toISOString();

  const nodeKinds = [
    { kind: 'pdf', label: 'PDF (text layer)' },
    { kind: 'pdf_large', label: 'Large PDF (repeated pages)' },
    { kind: 'pdf_scanned', label: 'Scanned / blank-page PDF' },
    { kind: 'corrupt_pdf', label: 'Corrupt PDF' },
    { kind: 'empty_name', label: 'Empty filename' },
  ];
  if (fixtures.docx) nodeKinds.push({ kind: 'docx', label: 'DOCX' });

  const nodeRows = [];
  for (const { kind, label } of nodeKinds) {
    const row = await runNodeImportScenario(ROOT, kind, fixtures);
    nodeRows.push({ ...row, label: label || row.label });
  }

  const browserScenarios = H7_SCENARIOS.filter((s) => s.channel.includes('browser'));
  const browserRows = await runBrowserImportScenarios(ROOT, browserScenarios, fixtures);
  const summary = summarizeRows(nodeRows, browserRows);

  const lines = [];
  lines.push('# HIRELY H7 — Import Stability');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Suite: \`${H7_IMPORT_V1}\``);
  lines.push('');
  lines.push('## Requirement');
  lines.push('');
  lines.push('**No upload should crash the app.** Every path must end in a terminal import state or visible fallback (paste panel / alert), with loading cleared.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Scenarios run | ${summary.total - summary.skipCount} |`);
  lines.push(`| Passed | ${summary.passCount} |`);
  lines.push(`| Failed | ${summary.failCount} |`);
  lines.push(`| Skipped | ${summary.skipCount} |`);
  lines.push(`| Crash risks | ${summary.crashRisks.length} |`);
  lines.push('');
  const overall = summary.failCount === 0 && summary.crashRisks.length === 0 ? 'PASS' : 'FAIL';
  lines.push(`**Overall: ${overall}**`);
  lines.push('');
  lines.push('## Upload flow (audit)');
  lines.push('');
  lines.push('| Area | Entry | Timeout | Error handling |');
  lines.push('|------|-------|---------|----------------|');
  lines.push('| Click upload | `#fileInput` → `handleFileImport(f,\'click\')` | 180s PDF / 20s other | `try/catch` → paste fallback; `finally` clears loading |');
  lines.push('| Drag & drop | `#drop` / `#hirelyTestDrop` → `handleFileImport(f,\'drop\')` | same | drop-no-file → paste panel; no uncaught throw |');
  lines.push('| Mobile | same `#fileInput` (touch opens picker) | same | identical pipeline |');
  lines.push('| Core extract | `canonicalImportFromFile` → `extractFromFileDetailed` | PDF `PDF_EXTRACTION_MAX_MS` (30s) + UI race 180s | OCR timeout → `IMPORT_NEEDS_PASTE` |');
  lines.push('| Parser fail | `applyImportResult` catch | — | OCR failure → paste; else `IMPORT_FAILED` |');
  lines.push('');
  lines.push('## Scenario results');
  lines.push('');
  lines.push('| Scenario | Channel | Result | Risk | Notes |');
  lines.push('|----------|---------|--------|------|-------|');

  for (const row of summary.all) {
    const status = row.skipped ? 'SKIP' : row.pass ? 'PASS' : 'FAIL';
    lines.push(
      `| ${row.label || row.id} | ${row.channel} | ${status} | ${riskBadge(row.risk)} | ${String(row.note || row.importState || '').replace(/\|/g, '/').slice(0, 80)} |`
    );
  }

  lines.push('');
  lines.push('## Node extraction detail');
  lines.push('');
  for (const row of nodeRows) {
    if (row.skipped) continue;
    lines.push(`### ${row.label}`);
    lines.push('');
    lines.push(`- Import state: \`${row.importState || '—'}\``);
    lines.push(`- Import status: \`${row.importStatus || '—'}\``);
    lines.push(`- Raw text length: ${row.rawLen}`);
    if (row.errors?.length) lines.push(`- Errors: ${row.errors.join('; ')}`);
    lines.push('');
  }

  lines.push('## Fixtures used');
  lines.push('');
  lines.push(`- PDF: \`${fixtures.pdf || 'missing'}\``);
  lines.push(`- Large PDF: \`${fixtures.large || '—'}\`${fixtures.large ? ` (${fs.statSync(fixtures.large).size} bytes)` : ''}`);
  lines.push(`- Scanned stub: \`${fixtures.scanned || '—'}\``);
  lines.push(`- DOCX: \`${fixtures.docx || 'missing'}\``);
  lines.push(`- Unsupported: \`${fixtures.unsupported}\``);
  lines.push('');
  lines.push('## Commands');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run stress:h7');
  lines.push('npm run stress:import-report');
  lines.push('npm run qa:import');
  lines.push('```');
  lines.push('');
  lines.push('## Crash-risk checklist');
  lines.push('');
  const checks = [
    ['Null file handled', summary.all.find((r) => r.id === 'error_no_file')?.pass !== false],
    ['Unsupported type handled', summary.all.find((r) => r.id === 'error_unsupported')?.pass !== false],
    ['Loading clears after import', !summary.all.some((r) => r.busy === true)],
    ['No page uncaught errors', !summary.all.some((r) => r.pageErrors?.length > 0)],
    ['Corrupt PDF does not throw', nodeRows.find((r) => r.kind === 'corrupt_pdf')?.pass !== false],
  ];
  for (const [label, ok] of checks) {
    lines.push(`- [${ok ? 'x' : ' '}] ${label}`);
  }

  if (summary.crashRisks.length) {
    lines.push('');
    lines.push('## Failures (must fix)');
    lines.push('');
    for (const r of summary.crashRisks) {
      lines.push(`- **${r.label || r.id}**: ${r.note}`);
    }
  }

  fs.writeFileSync(OUT_PATH, `${lines.join('\n')}\n`);
  console.log('Wrote', OUT_PATH);
  console.log('Overall:', overall);
  process.exit(overall === 'PASS' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
