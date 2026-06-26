#!/usr/bin/env node
/**
 * P0 — Generate REAL_CV_BENCHMARK_PACK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  BENCHMARK_DOCX_SLOTS,
  BENCHMARK_IMAGE_SLOTS,
  BENCHMARK_PDF_SLOTS,
  REAL_CV_BENCHMARK_PACK_V1,
} from '../tests/lib/real-cv-benchmark-pack-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_CV_BENCHMARK_PACK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/real-cv-benchmark-pack/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-real-cv-benchmark-pack.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 120 * 1024 * 1024,
    timeout: 600000,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-5000) };
}

const qa =
  process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

function rowFor(id) {
  return report?.cases?.find((c) => c.id === id) || null;
}

function fmtBool(v) {
  return v ? '✓' : '✗';
}

function tableRows(slots) {
  return slots
    .map((slot) => {
      const r = rowFor(slot.id);
      if (!r) return `| ${slot.label} | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |`;
      return `| ${slot.label} | ${r.fileName} | ${r.fileType || slot.pack} | ${r.nativeTextLength} | ${r.ocrTextLength} | ${r.selectedTextLength} | ${r.selectedSource || '—'} | **${r.status}** | ${r.name ? r.name.slice(0, 32) : '—'} | ${r.email ? '✓' : '✗'} | ${r.phone ? '✓' : '✗'} | ${r.experienceCount} | ${r.educationCount} | ${r.skillsCount} | ${r.previewLength} | ${r.reviewQueueCount} | ${fmtBool(r.fakeDataDetected)} | ${fmtBool(r.dataLossDetected)} |`;
    })
    .join('\n');
}

const lines = [
  '# REAL_CV_BENCHMARK_PACK_REPORT',
  '',
  `**Pack:** \`${report?.version || REAL_CV_BENCHMARK_PACK_V1}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**QA run:** ${qa.pass === true ? 'PASS' : qa.pass === false ? 'FAIL' : 'skipped'}`,
  '',
  report?.summary
    ? [
        '## Summary',
        '',
        `| Metric | Count |`,
        `|--------|------:|`,
        `| Files measured | ${report.summary.total} |`,
        `| \`IMPORT_READY\` | ${report.summary.ready} |`,
        `| \`IMPORT_NEEDS_PASTE\` | ${report.summary.needsPaste} |`,
        `| Crashes | ${report.summary.crashes} |`,
        `| Stuck loaders | ${report.summary.stuck} |`,
        `| Fake data detected | ${report.summary.fakeData} |`,
        `| Data loss detected | ${report.summary.dataLoss} |`,
        '',
      ].join('\n')
    : '## Summary\n\n*(run benchmark to populate)*\n',
  '## Corpus',
  '',
  'Messy benchmark files are generated from **diverse `tests/cv-corpus/` text** + layout transforms (Canva, InDesign, Word export, two-column, scanned image PDF, table DOCX, etc.).',
  '',
  'Override any slot by dropping a matching file in `tests/real-world-corpus/` (e.g. `pdf_canva.pdf`).',
  '',
  '## PDF benchmark (10)',
  '',
  '| Label | fileName | fileType | native | ocr | selected | source | status | name | email | phone | exp | edu | skills | preview | reviewQ | fake | loss |',
  '|-------|----------|----------|-------:|----:|---------:|--------|--------|------|-------|-------|----:|----:|-------:|--------:|--------:|------:|-----:|',
  tableRows(BENCHMARK_PDF_SLOTS),
  '',
  '## DOCX benchmark (5)',
  '',
  '| Label | fileName | fileType | native | ocr | selected | source | status | name | email | phone | exp | edu | skills | preview | reviewQ | fake | loss |',
  '|-------|----------|----------|-------:|----:|---------:|--------|--------|------|-------|-------|----:|----:|-------:|--------:|--------:|------:|-----:|',
  tableRows(BENCHMARK_DOCX_SLOTS),
  '',
  '## Image benchmark (3)',
  '',
  '| Label | fileName | fileType | native | ocr | selected | source | status | name | email | phone | exp | edu | skills | preview | reviewQ | fake | loss |',
  '|-------|----------|----------|-------:|----:|---------:|--------|--------|------|-------|-------|----:|----:|-------:|--------:|--------:|------:|-----:|',
  tableRows(BENCHMARK_IMAGE_SLOTS),
  '',
  '## Metrics',
  '',
  '| Field | Description |',
  '|-------|-------------|',
  '| `nativeTextLength` | PDF/DOCX native text layer chars |',
  '| `ocrTextLength` | OCR layer chars (when run) |',
  '| `selectedTextLength` | Text chosen for import (`rawText`) |',
  '| `selectedSource` | `native_pdf`, `ocr`, `docx`, etc. |',
  '| `fakeDataDetected` | Fake name/phone per no-fake-data policy |',
  '| `dataLossDetected` | Extracted text not reflected in preview/structure |',
  '',
  '## Verification',
  '',
  '```bash',
  'npm run qa:real-cv-benchmark-pack',
  'npm run real-cv-benchmark-pack-report',
  '```',
  '',
];

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(report?.pass === true || qa.pass === null ? 0 : 1);
