#!/usr/bin/env node
/**
 * P0 — Generate STRICT_LANGUAGE_EXTRACTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'STRICT_LANGUAGE_EXTRACTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/strict-language-extraction/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-strict-language-extraction.mjs'], {
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
  '# STRICT_LANGUAGE_EXTRACTION_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'STRICT_LANGUAGE_EXTRACTION_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**Checks:** ${report ? `${report.summary.pass}/${report.summary.total}` : 'not run'}`,
  '',
  '## Problem',
  '',
  'Language sections still showed polluted OCR values (`Native am`, `Fluent analyse`, bare `am`/`co`) instead of structured language + level pairs.',
  '',
  '## Rules enforced',
  '',
  '| Rule | Behavior |',
  '|------|----------|',
  '| Language name required | French, English, Spanish, … must be present |',
  '| Optional proficiency | `native`, `fluent`, `intermediate`, … after language name |',
  '| Allowed display | `French — native`, `English — fluent`, `Spanish — intermediate` |',
  '| Forbidden OCR junk | `Native am`, `Fluent analyse`, `native co`, `am`, `co` |',
  '| Low confidence → reviewQueue | Never promoted to CV preview |',
  '',
  '## Pipeline placement',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[raw language lines] --> B[parseLanguages / section recovery]',
  '  B --> C[extractStrictLanguageLine]',
  '  C --> D[resumeData.languages]',
  '  D --> E[sanitizeResumeForDisplay]',
  '  E --> F[ocrMicroGarbage + finalResumeData]',
  '```',
  '',
  '## Module',
  '',
  '| File | Role |',
  '|------|------|',
  '| `strict-language-extraction.js` | Canonical strict parse + review items |',
  '| `rich-parser.js` | `parseLanguages` uses strict extractor |',
  '| `unsorted-section-recovery.js` | Language recovery gated |',
  '| `resume-output-quality.js` | Output polish uses strict batch |',
  '| `sanitize-resume-display.js` | Display drain uses strict extractor |',
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
  'npm run qa:strict-language-extraction',
  'npm run strict-language-extraction-report',
  'npm run qa:ocr-micro-garbage-cleanup',
  'npm run check:core',
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
