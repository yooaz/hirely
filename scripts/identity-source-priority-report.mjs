#!/usr/bin/env node
/**
 * P0 — Generate IDENTITY_SOURCE_PRIORITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IDENTITY_SOURCE_PRIORITY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/identity-source-priority/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-identity-source-priority.mjs'], {
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
  '# IDENTITY_SOURCE_PRIORITY_REPORT',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'IDENTITY_SOURCE_PRIORITY_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**QA:** ${report ? `${report.checks.length - report.failed}/${report.checks.length} checks` : 'not run'}`,
  '',
  '## Problem',
  '',
  'Identity (`name` / `title`) was sometimes taken from random OCR lines anywhere in the document — including experience bullets, client lists, education entries, and footer noise.',
  '',
  '## Priority order (strict)',
  '',
  '| Rank | Source | Reason tag | Confidence |',
  '|------|--------|------------|------------|',
  '| 1 | Top **15%** of first page | `top15pct` | 93 |',
  '| 2 | Lines near email / phone (±2 lines, first page) | `contact_neighbor` | 88 |',
  '| 3 | Largest valid name-like block in header zone | `largest_header_block` | 86 |',
  '| 4 | Manual review | *(empty name)* | &lt; 80 → hidden |',
  '',
  '## Never take identity from',
  '',
  '- **Experience** section (from header through next major section)',
  '- **Clients** section',
  '- **Education** section',
  '- **Footer** zone (last 15% of lines + page markers)',
  '- **OCR garbage** (merged tokens, tool fragments, corruption patterns)',
  '',
  '## Code changes',
  '',
  '| Module | Change |',
  '|--------|--------|',
  '| `src/core/parsing/identity-extraction.js` | `buildForbiddenIdentityIndices`, `isOcrGarbageIdentityLine`, top-15% first-page scan, priority sort, confidence by source |',
  '| `src/core/parsing/index.js` | Export new identity source priority symbols |',
  '| `src/tests/qa-identity-source-priority.mjs` | Regression suite for priority + forbidden zones |',
  '',
  '## Sample outcomes',
  '',
  report?.samples
    ? [
        `- **Header name:** \`${report.samples.priorityTop?.name || '(empty)'}\` ← \`${report.samples.priorityTop?.source || 'n/a'}\``,
        `- **Near email:** \`${report.samples.nearEmail?.name || '(empty)'}\` ← \`${report.samples.nearEmail?.source || 'n/a'}\``,
        `- **Largest header block:** \`${report.samples.largestHeader?.name || '(empty)'}\` ← \`${report.samples.largestHeader?.source || 'n/a'}\``,
        `- **No auto identity:** \`${report.samples.manualReview?.name || '(empty — review)'}\``,
      ].join('\n')
    : '- *(run `npm run identity-source-priority-report`)*',
  '',
  '## Verification',
  '',
  '```bash',
  'npm run qa:identity-source-priority',
  'npm run qa:identity-false-name',
  'npm run identity-source-priority-report',
  '```',
  '',
];

if (qa.out) {
  lines.push('## QA output', '', '```', qa.out.slice(-4000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(reportPass ? 0 : 1);
