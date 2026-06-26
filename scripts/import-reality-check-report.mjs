#!/usr/bin/env node
/**
 * P0 — Generate IMPORT_REALITY_CHECK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IMPORT_REALITY_CHECK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/import-reality-check/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-import-reality-check.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# IMPORT_REALITY_CHECK_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'IMPORT_REALITY_CHECK_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'Post-OCR-fix import-only reality check across six format categories (browser product path).',
  '',
  '| # | Format | Fixture |',
  '|---|--------|---------|',
  '| 1 | Selectable PDF | `yoaz-selectable.pdf` |',
  '| 2 | Scanned PDF | `blank-scan.pdf` (no text layer) |',
  '| 3 | Protected PDF | `protected-scan.pdf` |',
  '| 4 | DOCX | `yoaz.docx` |',
  '| 5 | TXT | `yoaz.txt` |',
  '| 6 | Image PNG / JPG | `cv-scan.png`, `cv-scan.jpg` |',
  '',
  '## Metrics per file',
  '',
  '| Field | Meaning |',
  '|-------|---------|',
  '| `fileType` | Detected source type (`pdf_text`, `docx`, `image`, …) |',
  '| `nativeTextLength` | Native / structured text chars |',
  '| `ocrTextLength` | OCR text chars |',
  '| `selectedTextLength` | Text chosen for import (final `rawText`) |',
  '| `status` | Terminal import outcome |',
  '',
  '## Allowed statuses',
  '',
  '| Status | Meaning |',
  '|--------|---------|',
  '| `IMPORT_READY` | Full import succeeded |',
  '| `IMPORT_PARTIAL` | Partial text recovered |',
  '| `IMPORT_NEEDS_PASTE` | Paste fallback — acceptable terminal |',
  '| `IMPORT_UNSUPPORTED` | Format not supported — no crash |',
  '',
  '## Forbidden',
  '',
  '| Rule |',
  '|------|',
  '| `IMPORT_STUCK` — loading never clears |',
  '| Silent fail — spinner with no terminal UI |',
  '| Fake success — `IMPORT_READY` with zero selected text |',
  '',
  '## Results',
  '',
  '| Format | fileType | native | ocr | selected | status | Duration | Pass |',
  '|--------|----------|--------|-----|----------|--------|----------|------|',
];

if (report?.cases?.length) {
  for (const c of report.cases) {
    lines.push(
      `| ${c.label || c.id} | ${c.fileType || '—'} | ${c.nativeTextLength ?? 0} | ${c.ocrTextLength ?? 0} | ${c.selectedTextLength ?? 0} | **${c.qaOutcome}** | ${c.durationMs ?? 0}ms | ${c.pass ? '✓' : '✗'} |`
    );
  }
} else {
  lines.push('| _No results — QA did not complete_ | — | — | — | — | — | — | ✗ |');
}

lines.push(
  '',
  '## Outcome distribution',
  ''
);

if (report?.byOutcome) {
  for (const [k, v] of Object.entries(report.byOutcome)) {
    lines.push(`- **${k}**: ${v}`);
  }
} else {
  lines.push('_No outcomes recorded_');
}

lines.push(
  '',
  '## Forbidden totals',
  '',
  `| Check | Count |`,
  `|-------|-------|`,
  `| IMPORT_CRASH | ${report?.forbidden?.IMPORT_CRASH ?? '—'} |`,
  `| IMPORT_STUCK | ${report?.forbidden?.IMPORT_STUCK ?? '—'} |`,
  `| Fake success | ${report?.forbidden?.fakeSuccess ?? '—'} |`,
  `| Silent fail | ${report?.forbidden?.silentFail ?? '—'} |`,
  '',
  '## Verify',
  '',
  '```bash',
  'npm run setup:vendor-tesseract',
  'npm run qa:import-reality-check',
  'npm run import-reality-check-report',
  '```',
  ''
);

if (!qa.pass && qa.out) {
  lines.push('## QA console', '', '```', qa.out.slice(-8000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
process.exit(qa.pass && report?.pass ? 0 : 1);
