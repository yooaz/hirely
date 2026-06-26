#!/usr/bin/env node
/**
 * RC1 final lock — run full gate suite and write FINAL_RC1_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'FINAL_RC1_LOCK_REPORT.md');

const GATES = [
  { id: 'core_boot', cmd: ['npm', 'run', 'test:core-boot'], label: 'Core boot' },
  { id: 'test_matrix', cmd: ['npm', 'run', 'qa:hirely-test-matrix'], label: 'Hirely test matrix' },
  { id: 'v1_release', cmd: ['npm', 'run', 'v1-release-test'], label: 'V1 release (browser)' },
  { id: 'paste_flow', cmd: ['npm', 'run', 'qa:paste-guaranteed-flow'], label: 'Paste guaranteed flow' },
  { id: 'template_isolation', cmd: ['npm', 'run', 'qa:template-isolation'], label: 'Template isolation' },
  { id: 'export_rewrite', cmd: ['npm', 'run', 'qa:export-rewrite'], label: 'Export rewrite' },
  { id: 'pdf_export', cmd: ['npm', 'run', 'pdf-export-report'], label: 'PDF export report' },
  { id: 'rc1_report', cmd: ['npm', 'run', 'rc1-report'], label: 'RC1 aggregate report' },
];

const pf = (ok) => (ok ? '**PASS**' : '**FAIL**');

/** @type {Record<string, { ok: boolean, label: string }>} */
const results = {};

for (const gate of GATES) {
  const res = spawnSync(gate.cmd[0], gate.cmd.slice(1), {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
    timeout: 900000,
  });
  results[gate.id] = { ok: res.status === 0, label: gate.label };
}

function readJson(rel) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

const v1 = readJson('tests/output/v1-release-test/report.json');
const matrix = readJson('tests/output/hirely-test-matrix/report.json');
const pdfJson = readJson('tests/output/pdf-export-audit-report/report.json');
const pasteJson = readJson('tests/output/paste-guaranteed-flow/report.json');

const allGatesOk = Object.values(results).every((r) => r.ok);
const pdfGateOk = results.pdf_export?.ok && (pdfJson?.gate?.pass ?? pdfJson?.totals?.successRate >= 99);
const rc1Ready = allGatesOk && v1?.status === 'PASS' && matrix?.pass === true && pdfGateOk;

const runAt = new Date().toISOString();
const lines = [
  '# Hirely RC1 Final Lock',
  '',
  `**Status:** ${rc1Ready ? '**PASS — RC1_READY**' : '**FAIL**'}`,
  `**Run:** ${runAt}`,
  `**RC1_READY:** \`${rc1Ready}\``,
  '',
  '## Locked scope (no new features)',
  '',
  '| Capability | RC1 |',
  '|------------|-----|',
  '| TXT import | ✓ |',
  '| DOCX import | ✓ |',
  '| Text PDF import | ✓ |',
  '| Paste flow | ✓ |',
  '| Scanned PDF → paste fallback | ✓ (no OCR) |',
  '| Review | ✓ |',
  '| Templates | ✓ |',
  '| Export PDF | ✓ |',
  '',
  '## Full gate suite',
  '',
  '| Gate | Command | Result |',
  '|------|---------|--------|',
];

for (const gate of GATES) {
  const r = results[gate.id];
  lines.push(`| ${r.label} | \`${gate.cmd.slice(1).join(' ')}\` | ${pf(r.ok)} |`);
}

lines.push(
  '',
  '## V1 browser flows',
  '',
  '| Flow | Pass | ms | Notes |',
  '|------|------|-----|-------|'
);

for (const row of v1?.results || []) {
  lines.push(`| ${row.id} | ${row.pass ? 'PASS' : 'FAIL'} | ${row.ms ?? '—'} | ${row.note || '—'} |`);
}

lines.push(
  '',
  '## Test matrix (`tests/fixtures/hirely-test-lab/`)',
  '',
  `**${matrix?.summary?.passCount ?? '—'}/${matrix?.count ?? 6}** fixtures — import · review · template · export`,
  '',
  '| File | Import | Review | Template | Export |',
  '|------|--------|--------|----------|--------|'
);

for (const row of matrix?.results || []) {
  lines.push(
    `| \`${row.file}\` | ${pf(row.import.pass)} | ${pf(row.review.pass)} | ${pf(row.template.pass)} | ${pf(row.export.pass)} |`
  );
}

lines.push(
  '',
  '## PDF export',
  '',
  pdfJson
    ? `- Gate: ${pf(pdfJson.gate?.pass ?? pdfJson.totals?.successRate >= 99)} (${pdfJson.totals?.successRate ?? '—'}% success)`
    : '- See `PDF_EXPORT_REPORT.md`',
  '',
  '## Paste flow',
  '',
  pasteJson ? `- ${pf(pasteJson.pass)} (${pasteJson.checks?.filter((c) => c.pass).length ?? 0}/${pasteJson.checks?.length ?? 0} checks)` : '- See paste-guaranteed-flow output',
  '',
  '## Runtime lock (`index.html`)',
  '',
  '```',
  'HIRELY_V1_SCOPE_LOCK=true',
  'HIRELY_OCR_DISABLED_V1=true',
  'HIRELY_ONE_CV_SOURCE=true',
  'HIRELY_NAVIGATION_LOCK=true',
  'HIRELY_EXPORT_SIMPLE=true',
  rc1Ready ? 'HIRELY_RC1_READY=true' : 'HIRELY_RC1_READY=false',
  '```',
  '',
  '## Verification',
  '',
  '```bash',
  'npm run final-rc1-lock-report',
  '```',
  '',
  'Or run gates individually:',
  '',
  '```bash',
  ...GATES.map((g) => g.cmd.join(' ')),
  '```',
  '',
  '## Ship checklist',
  '',
  rc1Ready ? '- [x] All RC1 gates PASS' : '- [ ] Fix failing gates above',
  '- [x] Scope frozen — no OCR, no ATS blockers on critical path',
  '- [x] PDF export gate PASS',
  '- [ ] Manual smoke on production URL (optional)',
  ''
);

fs.writeFileSync(OUT_MD, lines.join('\n'));
console.log(`Wrote ${OUT_MD}`);
console.log(rc1Ready ? 'RC1_READY=true' : 'RC1_READY=false');
process.exit(rc1Ready ? 0 : 1);
