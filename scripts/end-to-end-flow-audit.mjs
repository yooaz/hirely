#!/usr/bin/env node
/**
 * HIRELY P0 — Generate END_TO_END_FLOW_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'END_TO_END_FLOW_AUDIT.md');
const QA_JSON = path.join(ROOT, 'tests/output/end-to-end-flow-audit/report.json');

const STAGES = ['BOOT', 'IMPORT', 'PARSE', 'REVIEW', 'PREVIEW', 'TEMPLATE', 'EXPORT'];

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — End-to-end flow audit\n');
  const qa = run('node', ['src/tests/qa-end-to-end-flow-audit.mjs']);
  console.log(qa.pass ? '  PASS qa-end-to-end-flow-audit' : '  FAIL qa-end-to-end-flow-audit');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && data?.pass;
  const lines = [
    '# HIRELY P0 — End-to-End Flow Audit',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    pass ? '' : `**Failing stage:** ${data?.failedStage || 'unknown'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    'Full product flow with **real uploaded CVs** (no text fixtures):',
    '',
    '```',
    'IMPORT → PARSE → REVIEW → TEMPLATE → EXPORT',
    '```',
    '',
    '### Real files tested',
    '',
    ...(data?.realFilesTested || []).map((p) => `- \`${p}\``),
    '',
    'Primary run: **' + (data?.primaryCv?.label || '—') + '**',
    '',
    '## Data contract',
    '',
    'One `finalResumeData` / `getFinalCvData()` surface drives:',
    '',
    '- Review panel (`getPendingReviewQueue` — accepted items excluded)',
    '- CV preview (`renderCV` → `getFinalCvData`)',
    '- Template renderer (`HirelyTemplates.render`)',
    '- Export screen (`syncExportFinalPanel`, `prepareLockedCvExport`)',
    '- PDF export (`downloadPDF`)',
    '',
    '## Runtime flow markers',
    '',
    '| Marker | When emitted |',
    '|--------|----------------|',
    '| `IMPORT_READY` | Terminal import success (`IMPORT_READY` / `IMPORT_PARTIAL`) |',
    '| `REVIEW_READY` | Workspace review visible (`ensureImportReviewVisible`) |',
    '| `PREVIEW_READY` | `#cvDoc.cv--live` with template HTML |',
    '| `TEMPLATE_READY` | Template render complete |',
    '| `EXPORT_READY` | Export step with valid CV data |',
    '',
    'Captured markers:',
    '',
    ...(data?.flowLogs?.length
      ? data.flowLogs.map((l) => `- \`${l.marker}\``)
      : ['- _(none captured)_']),
    '',
    '## Stage results',
    '',
  ];

  for (const stage of STAGES) {
    const rows = (data?.stages || []).filter((s) => s.stage === stage);
    if (!rows.length) continue;
    lines.push(`### ${stage}`);
    lines.push('');
    lines.push('| Check | Status | Detail |');
    lines.push('|-------|--------|--------|');
    for (const r of rows) {
      const status = r.optional && !r.pass ? 'WARN' : r.pass ? 'PASS' : 'FAIL';
      lines.push(`| ${r.id}${r.optional ? ' (optional)' : ''} | ${status} | ${String(r.detail || '').replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }

  lines.push('## Forbidden (must not happen)');
  lines.push('');
  lines.push('| Rule | Check |');
  lines.push('|------|-------|');
  const forbidden = [
    ['Review shows accepted items', 'no_accepted_in_suggestions'],
    ['Template uses different data than preview', 'template_same_name_as_preview'],
    ['Export screen blank', 'export_not_blank'],
    ['Selected template lost on navigation', 'template_persists'],
  ];
  for (const [label, id] of forbidden) {
    const r = (data?.stages || []).find((s) => s.id === id);
    lines.push(`| ${label} | ${r ? (r.pass ? 'PASS' : 'FAIL') : '—'} |`);
  }

  lines.push('');
  lines.push('## Gate');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:end-to-end-flow-audit');
  lines.push('```');
  lines.push('');
  lines.push('## QA output');
  lines.push('');
  lines.push('```');
  lines.push(qa.out?.slice(0, 8000) || '(no output)');
  lines.push('```');
  lines.push('');

  if (!pass) {
    lines.push('## Blockers');
    lines.push('');
    const fails = (data?.stages || []).filter((s) => !s.pass);
    for (const f of fails) {
      lines.push(`- **${f.stage}** — \`${f.id}\`: ${f.detail || 'failed'}`);
    }
    lines.push('');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nEND_TO_END_FLOW_AUDIT: PASS' : `\nEND_TO_END_FLOW_AUDIT: FAIL (${data?.failedStage})`);
  process.exit(pass ? 0 : 1);
}

main();
