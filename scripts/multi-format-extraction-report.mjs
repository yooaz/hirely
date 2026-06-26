#!/usr/bin/env node
/**
 * P0 — Generate MULTI_FORMAT_EXTRACTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'MULTI_FORMAT_EXTRACTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/multi-format-extraction/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-multi-format-extraction.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# MULTI_FORMAT_EXTRACTION_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.engineVersion || 'MULTI_FORMAT_ENGINE_V1'}\``,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Supported formats',
  '',
  '| Format | sourceType | Native | OCR | Merge |',
  '|--------|------------|--------|-----|-------|',
  '| PDF selectable text | `pdf_text` | ✓ | — | — |',
  '| PDF scanned | `pdf_scanned` | partial | ✓ | ✓ |',
  '| PDF image-based | `pdf_image` | — | ✓ | ✓ |',
  '| PDF mixed | `pdf_mixed` | ✓ | ✓ | ✓ |',
  '| DOCX | `docx` | ✓ | — | — |',
  '| DOC | `doc` | ✓ | — | — |',
  '| TXT | `txt` | ✓ | — | — |',
  '| RTF | `rtf` | ✓ | — | — |',
  '| Image | `image` | — | ✓ | — |',
  '',
  '## Pipeline',
  '',
  '1. **Native extraction** — pdf.js text layer, mammoth (DOCX/DOC), plain read (TXT/RTF)',
  '2. **OCR extraction** — Tesseract for scans, weak pages, images',
  '3. **Merge** — dedupe native + OCR lines; prefer higher confidence',
  '4. **Confidence scoring** — line confidence + text-layer / OCR quality',
  '5. **Best version selection** — richest source (length × confidence weight)',
  '',
  '## Per-import metadata',
  '',
  'Every import via `extractFromFileDetailed` now exposes:',
  '',
  '| Field | Description |',
  '|-------|-------------|',
  '| `sourceType` | Resolved format (`pdf_text`, `docx`, `rtf`, …) |',
  '| `nativeTextLength` | Chars from native lines |',
  '| `ocrTextLength` | Chars from OCR lines |',
  '| `mergedTextLength` | Chars after native+OCR merge |',
  '| `confidenceScore` | 0–100 composite quality |',
  '| `selectedSource` | `native` \\| `ocr` \\| `merged` |',
  '',
  '## Code',
  '',
  '- `src/core/extraction/multi-format-extraction-engine.js` — orchestrator',
  '- `src/core/extraction/extract-file.js` — enrichment on every import',
  '- `src/core/extraction/document-extract.js` — DOC + RTF routes',
  '- `src/core/extraction/file-type-detect.js` — RTF / DOC detection',
  '',
];

if (report?.formats?.length) {
  lines.push('## Format runs', '', '| Format | sourceType | native | ocr | merged | confidence | selected |', '|--------|------------|--------|-----|--------|------------|----------|');
  for (const f of report.formats) {
    lines.push(
      `| ${f.id} | ${f.sourceType} | ${f.nativeTextLength} | ${f.ocrTextLength} | ${f.mergedTextLength} | ${f.confidenceScore} | ${f.selectedSource} |`
    );
  }
  lines.push('');
}

if (report?.parity) {
  const p = report.parity;
  lines.push(
    '## DOCX vs PDF structured parity',
    '',
    `| Section | DOCX | PDF (simulated native) | Match |`,
    `|---------|------|------------------------|-------|`,
    `| Experience | ${p.docx?.experiences ?? '—'} | ${p.pdf_simulated?.experiences ?? '—'} | ${p.experiencesMatch ? '✓' : '✗'} |`,
    `| Education | ${p.docx?.education ?? '—'} | ${p.pdf_simulated?.education ?? '—'} | ${p.educationMatch ? '✓' : '✗'} |`,
    `| Skills+Tools | ${(p.docx?.skills ?? 0) + (p.docx?.tools ?? 0)} | ${(p.pdf_simulated?.skills ?? 0) + (p.pdf_simulated?.tools ?? 0)} | ${p.skillsClose ? '✓' : '✗'} |`,
    ''
  );
}

lines.push('## Verify', '', '```bash', 'npm run qa:multi-format-extraction', 'npm run multi-format-extraction-report', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
