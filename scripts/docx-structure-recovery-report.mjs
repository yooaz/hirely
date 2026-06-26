#!/usr/bin/env node
/**
 * P0 — Generate DOCX_STRUCTURE_RECOVERY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'DOCX_STRUCTURE_RECOVERY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/docx-structure-recovery/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-docx-structure-recovery.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# DOCX_STRUCTURE_RECOVERY_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Retention target:** ≥ ${report?.retentionTargetPct ?? 90}% visible content`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'DOCX resumes were losing content from headers, footers, tables, columns, text boxes, lists, and links when only Mammoth raw text was used.',
  '',
  '## Audit coverage',
  '',
  '| Element | Recovery |',
  '|---------|----------|',
  '| Headers | OOXML `word/header*.xml` |',
  '| Footers | OOXML `word/footer*.xml` |',
  '| Tables | `w:tbl` → row/cell join |',
  '| Columns | `w:cols` detected; body order preserved |',
  '| Text boxes | `w:txbxContent` |',
  '| Lists | `w:numPr` → bullet prefix |',
  '| Links | `w:hyperlink` + rels target URL |',
  '',
  '## Recovered sections',
  '',
  'Identity, experience, education, skills, clients, and portfolio content are retained in plain text before parsing.',
  '',
  '## Pipeline',
  '',
  '1. Unzip DOCX (JSZip)',
  '2. Walk OOXML parts (document + headers + footers)',
  '3. Extract tables, text boxes, lists, hyperlinks',
  '4. Merge with Mammoth HTML + raw text (richest union)',
  '5. Score retention vs visible OOXML corpus',
  '',
  '## Code',
  '',
  '- `src/core/extraction/docx-structure-recovery.js` — OOXML recovery engine',
  '- `src/core/extraction/docx-extract.js` — Mammoth + recovery merge',
  '- `src/core/extraction/document-extract.js` — metadata: `docxRetentionPct`, `docxRecovery`',
  '- `index.html` — lazy-load JSZip for browser DOCX imports',
  '',
];

if (report?.structured) {
  const s = report.structured;
  lines.push(
    '## Structured rich DOCX',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Retention | ${s.retentionPct}% |`,
    `| Headers | ${s.audit?.headers ? '✓' : '✗'} |`,
    `| Footers | ${s.audit?.footers ? '✓' : '✗'} |`,
    `| Tables | ${s.audit?.tables ? '✓' : '✗'} |`,
    `| Columns | ${s.audit?.columns ? '✓' : '✗'} |`,
    `| Text boxes | ${s.audit?.textboxes ? '✓' : '✗'} |`,
    `| Lists | ${s.audit?.lists ? '✓' : '✗'} |`,
    `| Links | ${s.audit?.links ? '✓' : '✗'} |`,
    `| Experiences parsed | ${s.sections?.experiences ?? '—'} |`,
    `| Education parsed | ${s.sections?.education ?? '—'} |`,
    ''
  );
}

if (report?.yoaz) {
  lines.push(
    '## Yoaz fixture DOCX',
    '',
    `- Retention: **${report.yoaz.retentionPct}%**`,
    `- Experiences: ${report.yoaz.sections?.experiences ?? '—'}`,
    `- Education: ${report.yoaz.sections?.education ?? '—'}`,
    ''
  );
}

if (report?.simple) {
  lines.push(
    '## Simple fixture DOCX',
    '',
    `- Retention: **${report.simple.retentionPct}%**`,
    `- Extracted chars: ${report.simple.extractedChars}`,
    ''
  );
}

lines.push('## Verify', '', '```bash', 'npm run qa:docx-structure-recovery', 'npm run docx-structure-recovery-report', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
