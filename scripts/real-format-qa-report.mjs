#!/usr/bin/env node
/**
 * P0 — Generate REAL_FORMAT_QA_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_FORMAT_QA_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/real-format-qa/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-real-format-qa.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# REAL_FORMAT_QA_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'REAL_FORMAT_QA_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'Real corpus files across selectable PDFs, scanned PDFs, DOCX, legacy DOC, TXT, and images.',
  '',
  '## Allowed outcomes',
  '',
  '| Outcome | Meaning |',
  '|---------|---------|',
  '| `IMPORT_READY` | Full import succeeded |',
  '| `IMPORT_PARTIAL` | Partial text recovered, review continues |',
  '| `IMPORT_NEEDS_PASTE` | Paste fallback shown — acceptable |',
  '| `IMPORT_UNSUPPORTED` | Format not supported — terminal, no crash |',
  '',
  '## Forbidden outcomes',
  '',
  '| Outcome | Rule |',
  '|---------|------|',
  '| `IMPORT_CRASH` | Never — uncaught exception |',
  '| `IMPORT_STUCK` | Never — loading/import exceeds timeout |',
  '',
  '## Format coverage',
  '',
  '| Category | Tested |',
  '|----------|--------|',
  `| PDF selectable | ${report?.counts?.pdf_selectable ?? '—'} (min 3) |`,
  `| PDF scanned | ${report?.counts?.pdf_scanned ?? '—'} (min 3) |`,
  `| DOCX | ${report?.counts?.docx ?? '—'} (min 3) |`,
  `| DOC legacy | ${report?.counts?.doc_legacy ?? '—'} (min 1) |`,
  `| TXT | ${report?.counts?.txt ?? '—'} (min 2) |`,
  `| Image | ${report?.counts?.image ?? '—'} (min 2) |`,
  '',
  '## Outcome distribution (node)',
  '',
];

if (report?.byOutcome) {
  for (const [k, v] of Object.entries(report.byOutcome)) {
    lines.push(`- **${k}**: ${v}`);
  }
} else {
  lines.push('_No outcomes recorded_');
}

lines.push(
  '',
  '## Per-file results',
  '',
  '| File | Category | Outcome | Raw chars | Duration | Pass |',
  '|------|----------|---------|-----------|----------|------|'
);

if (report?.cases?.length) {
  for (const c of report.cases) {
    lines.push(
      `| ${c.label || c.id} | ${c.category} | ${c.qaOutcome} | ${c.rawTextLength ?? 0} | ${c.durationMs ?? 0}ms | ${c.pass ? '✓' : '✗'} |`
    );
  }
}

lines.push(
  '',
  '## Browser stuck checks',
  '',
  '| File | Outcome | Loading cleared | Pass |',
  '|------|---------|-----------------|------|'
);

if (report?.browserChecks?.length) {
  for (const b of report.browserChecks) {
    lines.push(
      `| ${b.label || b.id} | ${b.qaOutcome} | ${!b.busy ? '✓' : '✗'} | ${b.pass ? '✓' : '✗'} |`
    );
  }
} else {
  lines.push('_No browser checks_');
}

lines.push(
  '',
  `**Forbidden totals:** IMPORT_CRASH=${report?.forbidden?.IMPORT_CRASH ?? '—'}, IMPORT_STUCK=${report?.forbidden?.IMPORT_STUCK ?? '—'}`,
  '',
  '## Verify',
  '',
  '```bash',
  'npm run qa:real-format-qa',
  'npm run real-format-qa-report',
  '```',
  '',
  '---',
  '',
  '### Console',
  '',
  '```',
  qa.out.split('\n').slice(-50).join('\n'),
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
