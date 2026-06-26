#!/usr/bin/env node
/**
 * P0 — Generate DOCX_FULL_EXTRACTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'DOCX_FULL_EXTRACTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/docx-full-extraction/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-docx-full-extraction.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# DOCX_FULL_EXTRACTION_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.engineVersion || 'DOCX_FULL_EXTRACTION_V2'}\``,
  `**Retention target:** ≥ ${report?.retentionTargetPct ?? 90}% visible text`,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Word CVs were losing text from tables, columns, headers, footers, and text boxes when only Mammoth paragraph extraction ran.',
  '',
  '## Extraction sources',
  '',
  '| Source | Handling |',
  '|--------|----------|',
  '| Paragraphs | `w:p` runs, tabs → column separators |',
  '| Tables | `w:tbl` rows; cells joined with ` | ` |',
  '| Nested tables | Recursive cell walk |',
  '| Headers | `word/header*.xml` first in merge order |',
  '| Footers | `word/footer*.xml` after body |',
  '| Text boxes | VML `w:txbxContent` + DrawingML `wps:txbx` |',
  '| Drawing shapes | `w:drawing` / `a:t` text |',
  '| Hyperlinks | `w:hyperlink` label + rel URL |',
  '| Bullet lists | `w:numPr` → `•` prefix |',
  '| Columns | `w:cols` detected; XML reading order preserved |',
  '',
  '## Rules enforced',
  '',
  '| Rule | Implementation |',
  '|------|----------------|',
  '| Never paragraph-only when tables exist | OOXML table lines forced into merge |',
  '| Never drop columns | Document-order walk; tab → ` | ` |',
  '| Never drop header/footer contact | Headers first, footers last; contact lines required |',
  '',
  '## Acceptance',
  '',
  `DOCX extraction retains **≥ ${report?.retentionTargetPct ?? 90}%** of visible text (word-token match on OOXML corpus).`,
  '',
];

if (report?.full) {
  lines.push(
    '## Test results',
    '',
    '| Fixture | Retention | Headers | Footers | Tables | Nested | Text boxes | Lists | Links |',
    '|---------|-----------|---------|---------|--------|--------|------------|-------|-------|',
    `| Full structure | ${report.full.retentionPct}% | ${report.full.audit?.headers ? '✓' : '—'} | ${report.full.audit?.footers ? '✓' : '—'} | ${report.full.audit?.tables ? '✓' : '—'} | ${report.full.audit?.nestedTables ? '✓' : '—'} | ${report.full.audit?.textboxes ? '✓' : '—'} | ${report.full.audit?.lists ? '✓' : '—'} | ${report.full.audit?.links ? '✓' : '—'} |`,
    `| Yoaz CV DOCX | ${report.yoaz?.retentionPct ?? '—'}% | — | — | — | — | — | — | — |`,
    '',
    '### Parsed sections (full structure fixture)',
    '',
    `- Experiences: ${report.full.sections?.experiences ?? '—'}`,
    `- Education: ${report.full.sections?.education ?? '—'}`,
    `- Skills: ${report.full.sections?.skills ?? '—'}`,
    `- Clients: ${report.full.sections?.clients ?? '—'}`,
    ''
  );
}

lines.push(
  '## Code',
  '',
  '- `src/core/extraction/docx-structure-recovery.js` — OOXML full extraction engine',
  '- `src/core/extraction/docx-extract.js` — Mammoth merge + export',
  '- `src/core/extraction/document-extract.js` — product DOCX route',
  '',
  '## Verify',
  '',
  '```bash',
  'npm run qa:docx-full-extraction',
  'npm run docx-full-extraction-report',
  '```',
  '',
  '---',
  '',
  '### Console',
  '',
  '```',
  qa.out.slice(-3500),
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
process.exit(qa.pass && report?.pass ? 0 : 1);
