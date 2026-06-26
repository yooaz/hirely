#!/usr/bin/env node
/**
 * P0 — Generate OCR_MICRO_GARBAGE_CLEANUP_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'OCR_MICRO_GARBAGE_CLEANUP_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/ocr-micro-garbage-cleanup/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-ocr-micro-garbage-cleanup.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-3000) };
}

const qa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const pass = report?.pass === true && (qa.pass === true || qa.pass === null);

const lines = [
  '# OCR_MICRO_GARBAGE_CLEANUP_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'OCR_MICRO_GARBAGE_CLEANUP_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**Checks:** ${report ? `${report.summary.pass}/${report.summary.total}` : 'not run'}`,
  '',
  '## Problem',
  '',
  'OCR extraction still injects micro-fragments into CV preview: polluted language lines (`Native am`), isolated tokens (`am`, `co`, `20`), and trailing contact junk (`@`, `:`).',
  '',
  '## Rules enforced',
  '',
  '| Rule | Behavior |',
  '|------|----------|',
  '| Language fragments < 4 chars | Rejected unless exact language name (French, English, …) |',
  '| Known language patterns only | `French native`, `English fluent`, `Spanish intermediate`, … |',
  '| Trailing OCR junk | Strip/remove `am`, `co`, `20`, `n`, `m`, `@`, `:` |',
  '| No partial words on CV | Micro-garbage never kept in preview sections |',
  '| Low confidence → reviewQueue | `buildMicroGarbageReviewItem` before `finalResumeData` |',
  '',
  '## Pipeline placement',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[resumeData] --> B[sanitizeResumeForDisplay]',
  '  B --> C[applyOcrMicroGarbageCleanup]',
  '  C --> D[semanticConfidenceGate]',
  '  D --> E[finalResumeData]',
  '```',
  '',
  '## Module',
  '',
  '| File | Role |',
  '|------|------|',
  '| `ocr-micro-garbage-cleanup.js` | Strip/gate languages, skills, identity, unsorted |',
  '| `final-resume-contract.js` | Runs cleanup before semantic gate |',
  '| `final-cv-readability.js` | Language polish uses `sanitizeLanguageLine` |',
  '',
  '## QA summary',
  '',
  `| Metric | Value |`,
  `|--------|------:|`,
  `| Total | ${report?.summary?.total ?? '—'} |`,
  `| Passed | ${report?.summary?.pass ?? '—'} |`,
  `| Failed | ${report?.summary?.fail ?? '—'} |`,
  '',
  '## Samples',
  '',
  `| Field | Value |`,
  `|-------|-------|`,
  `| Final languages | ${(report?.samples?.languages || []).join(', ') || '—'} |`,
  `| Review items | ${report?.samples?.reviewCount ?? '—'} |`,
  '',
];

if (report?.checks?.length) {
  lines.push('## Checklist', '', '| Check | Status | Detail |', '|-------|--------|--------|');
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`);
  }
  lines.push('');
}

lines.push(
  '## Verification',
  '',
  '```bash',
  'npm run qa:ocr-micro-garbage-cleanup',
  'npm run ocr-micro-garbage-cleanup-report',
  'npm run check:exports',
  'npm run check:core',
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
