#!/usr/bin/env node
/**
 * P0 — Generate REAL_WORLD_IMPORT_TRUTH_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_WORLD_IMPORT_TRUTH_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/real-world-import-truth/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-real-world-import-truth.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const reportPass = report?.pass === true && (qa.pass === true || qa.pass === null);

const lines = [
  '# REAL_WORLD_IMPORT_TRUTH_REPORT',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'REAL_WORLD_IMPORT_TRUTH_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Why this exists',
  '',
  'Controlled import fixtures can PASS while real user CVs fail. This benchmark uses messy corpus variants (Canva/InDesign layouts, column DOCX, scanned image PDFs, legacy DOC, image CVs) plus optional files in `tests/real-world-corpus/`.',
  '',
  '## Corpus coverage',
  '',
  '| Category | Target | Built |',
  '|----------|--------|-------|',
  `| Selectable PDF | 5 | ${report?.counts?.pdf_selectable ?? '—'} |`,
  `| Scanned PDF | 5 | ${report?.counts?.pdf_scanned ?? '—'} |`,
  `| Canva/InDesign PDF | 5 | ${report?.counts?.pdf_design_export ?? '—'} |`,
  `| DOCX columns/tables | 5 | ${report?.counts?.docx_columns ?? '—'} |`,
  `| DOC legacy | 3 | ${report?.counts?.doc_legacy ?? '—'} |`,
  `| Image CV | 3 | ${report?.counts?.image_cv ?? '—'} |`,
  `| TXT / paste | 3 | ${report?.counts?.txt_paste ?? '—'} |`,
  `| User corpus (optional) | — | ${report?.counts?.user_corpus ?? 0} |`,
  '',
  'Drop real failing CVs into `tests/real-world-corpus/` to extend the benchmark.',
  '',
  '## PASS rules',
  '',
  '- No crash, no stuck import, no fake success',
  '- If `selectedTextLength < 300` → status must be `IMPORT_NEEDS_PASTE`, `IMPORT_UNSUPPORTED`, or `IMPORT_FAILED`',
  '- If status is `IMPORT_READY` → preview must have structured content (experience/education/skills + identity)',
  '',
  '## Outcome distribution',
  '',
];

if (report?.byStatus) {
  for (const [k, v] of Object.entries(report.byStatus)) {
    lines.push(`- **${k}**: ${v}`);
  }
} else {
  lines.push('_No outcomes_');
}

lines.push(
  '',
  '## Category pass rate',
  '',
  '| Category | Pass | Fail | Total |',
  '|----------|------|------|-------|'
);

if (report?.byCategory) {
  for (const [cat, s] of Object.entries(report.byCategory)) {
    lines.push(`| ${cat} | ${s.pass} | ${s.fail} | ${s.total} |`);
  }
}

lines.push(
  '',
  '## Per-file results',
  '',
  '| fileName | fileType | native | ocr | docx | selected | source | identity | exp | edu | preview | queue | status | Pass |',
  '|----------|----------|--------|-----|------|----------|--------|----------|-----|-----|---------|-------|--------|------|'
);

if (report?.cases?.length) {
  for (const c of report.cases) {
    lines.push(
      `| ${c.fileName} | ${c.fileType || '—'} | ${c.nativeTextLength} | ${c.ocrTextLength} | ${c.docxTextLength} | ${c.selectedTextLength} | ${c.selectedSource || '—'} | ${c.identityFound ? '✓' : '✗'} | ${c.experienceCount} | ${c.educationCount} | ${c.finalPreviewLength} | ${c.reviewQueueCount} | **${c.status}** | ${c.pass ? '✓' : '✗'} |`
    );
  }
} else {
  lines.push('| _No results_ | — | — | — | — | — | — | — | — | — | — | — | — | ✗ |');
}

lines.push(
  '',
  '## Failures detail',
  ''
);

const fails = report?.cases?.filter((c) => !c.pass) || [];
if (fails.length) {
  for (const c of fails) {
    lines.push(
      `- **${c.fileName}** (${c.category}): ${c.status} — ${(c.passReasons || []).join(', ') || 'unknown'}`
    );
  }
} else {
  lines.push('_None_');
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
  `| Thin text wrong status | ${report?.forbidden?.thinTextWrongStatus ?? '—'} |`,
  `| READY without structure | ${report?.forbidden?.readyNoStructure ?? '—'} |`,
  '',
  '## Verify',
  '',
  '```bash',
  'npm run setup:vendor-tesseract',
  'npm run qa:real-world-import-truth',
  'npm run real-world-import-truth-report',
  '```',
  ''
);

if (!qa.pass && qa.out) {
  lines.push('## QA console (tail)', '', '```', qa.out.slice(-12000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
process.exit(reportPass ? 0 : 1);
