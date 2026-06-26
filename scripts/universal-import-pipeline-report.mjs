#!/usr/bin/env node
/**
 * Generates UNIVERSAL_IMPORT_PIPELINE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'UNIVERSAL_IMPORT_PIPELINE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/universal-import-pipeline/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-universal-import-pipeline.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const reportPass = report?.pass === true && (qa.pass === true || qa.pass === null);

const acc = report?.acceptance || {};
const lines = [
  '# Universal Import Pipeline Report (P0)',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'UNIVERSAL_IMPORT_PIPELINE_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Import must work or fail honestly for every supported format. Wrong data forbidden; missing data acceptable.',
  '',
  '## Rules (locked)',
  '',
  '| Rule | Enforcement |',
  '| --- | --- |',
  '| `selectedTextLength >= 300` → parse | `hasMeaningfulImportText` + `canonicalImportFromFile` |',
  '| `selectedTextLength < 300` → `IMPORT_NEEDS_PASTE` | `buildThinTextPasteResult` / `buildEmptyExtractPasteResult` |',
  '| Never fake success | No `resumeData` on paste; no `IMPORT_READY` below 300 |',
  '| Never stay loading | Import race timeout → terminal paste state |',
  '| Never silently fail | `UNIVERSAL_IMPORT_PIPELINE` log + `importFallback` reason |',
  '',
  '## Acceptance',
  '',
  '| Criterion | Status |',
  '| --- | --- |',
  `| PDF text → IMPORT_READY | ${acc.pdf_text ? '**PASS**' : 'FAIL'} |`,
  `| DOCX → IMPORT_READY | ${acc.docx ? '**PASS**' : 'FAIL'} |`,
  `| TXT → IMPORT_READY | ${acc.txt ? '**PASS**' : 'FAIL'} |`,
  `| Scanned/protected/image unreadable → IMPORT_NEEDS_PASTE | ${acc.scanned_protected_image_paste ? '**PASS**' : 'FAIL'} |`,
  `| No IMPORT_STUCK | ${acc.no_import_stuck ? '**PASS**' : 'FAIL'} |`,
  '',
  '## Per-file pipeline log',
  '',
  '| Format | File | native | ocr | selected | fileType | pages | scanned | protected | status | Pass |',
  '| --- | --- | ---: | ---: | ---: | --- | ---: | --- | --- | --- | --- |',
];

if (report?.cases?.length) {
  for (const c of report.cases) {
    lines.push(
      `| ${c.format} | ${c.fileName} | ${c.nativeTextLength} | ${c.ocrTextLength} | ${c.selectedTextLength} | ${c.fileType || '—'} | ${c.pageCount} | ${c.isScanned ? 'yes' : 'no'} | ${c.isProtected ? 'yes' : 'no'} | **${c.status}** | ${c.pass ? '✓' : '✗'} |`
    );
  }
} else {
  lines.push('| _No results_ | — | — | — | — | — | — | — | — | — | ✗ |');
}

lines.push(
  '',
  '## Forbidden totals',
  '',
  '| Check | Count |',
  '| --- | ---: |',
  `| IMPORT_STUCK | ${report?.forbidden?.IMPORT_STUCK ?? '—'} |`,
  `| IMPORT_CRASH | ${report?.forbidden?.IMPORT_CRASH ?? '—'} |`,
  `| Fake READY (<300 chars) | ${report?.forbidden?.fakeReady ?? '—'} |`,
  '',
  '## Implementation',
  '',
  '| Module | Role |',
  '| --- | --- |',
  '| `universal-import-pipeline.js` | Structured log: native/ocr/selected lengths, fileType, pageCount, isScanned, isProtected, status |',
  '| `canonical-import.js` | 300-char gate + `attachUniversalImportMeta` on every terminal result |',
  '| `extract-file.js` | Logs pipeline metrics after multi-format enrichment |',
  '| `real-cv-import-root.js` | `REAL_CV_IMPORT_MIN_CHARS = 300` policy |',
  '',
  '## Verify',
  '',
  '```bash',
  'npm run qa:universal-import-pipeline',
  'npm run universal-import-pipeline-report',
  '```',
  ''
);

if (!qa.pass && qa.out) {
  lines.push('## QA console (tail)', '', '```', qa.out.slice(-12000), '```', '');
}

const failures = report?.cases?.filter((c) => !c.pass) || [];
if (failures.length) {
  lines.push('## Failures', '');
  for (const c of failures) {
    lines.push(`- **${c.format}** (${c.fileName}): ${c.status} — ${(c.passReasons || []).join(', ') || 'unknown'}`);
  }
  lines.push('');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
process.exit(reportPass ? 0 : 1);
