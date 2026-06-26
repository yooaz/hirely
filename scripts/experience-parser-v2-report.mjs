#!/usr/bin/env node
/**
 * Generate EXPERIENCE_PARSER_V2_REPORT.md from qa-experience-parser-v2.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'EXPERIENCE_PARSER_V2_REPORT.md');

const run = spawnSync('node', ['src/tests/qa-experience-parser-v2.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const pass = run.status === 0;
const stdout = (run.stdout || '').trim();
const stderr = (run.stderr || '').trim();

const lines = [
  '# Experience Parser V2 — QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'P1 rebuild of experience parsing: date-anchored entry splitting without OCR or template changes.',
  '',
  '## Problem',
  '',
  'Adjacent experience lines were merged into one sentence, e.g.:',
  '',
  '```',
  'Designer - McCann - 2011-2014',
  'Freelance - 2014-2025',
  '```',
  '',
  '## Rules',
  '',
  'A new experience entry starts when a line contains:',
  '',
  '- a date range (`2011-2014`, `2017 — Present`)',
  '- month + year (`Jan 2018 - Mar 2022`)',
  '- a standalone year on a short header line',
  '',
  'Each entry extracts: `title`, `company`, `startDate`, `endDate`, `description`.',
  '',
  '## Acceptance',
  '',
  '| Check | Status |',
  '|-------|--------|',
  '| McCann = one entry | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Freelance = one entry | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| No merged experiences | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Merged one-line blob splits | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Builder pipeline emits 2 jobs | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '',
  '## Implementation',
  '',
  '- `src/core/parsing/experience-split-parser.js` — `EXPERIENCE_SPLIT_PARSER_V2`',
  '- `isExperienceEntryStartLine()` — replaces narrow role-keyword anchor gate',
  '- `splitExperienceLines()` — wired into `splitLinesIntoDateAnchoredGroups()`',
  '- `splitMergedExperienceByDates()` — fixes multi-range single-line blobs',
  '- `parseExperiencesV2()` — structured field extraction',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:experience-parser-v2',
  '```',
  '',
  '## Console output',
  '',
  '```',
  stdout || '(no stdout)',
  '```',
];

if (!pass && stderr) {
  lines.push('', '## Errors', '', '```', stderr, '```');
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${reportPath}`);
process.exit(pass ? 0 : 1);
