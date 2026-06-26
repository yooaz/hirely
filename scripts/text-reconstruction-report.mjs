#!/usr/bin/env node
/**
 * P0 — Generate TEXT_RECONSTRUCTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEXT_RECONSTRUCTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/text-reconstruction/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-text-reconstruction.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# TEXT_RECONSTRUCTION_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.engineVersion || 'TEXT_RECONSTRUCTION_V1'}\``,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Extracted text was present but reconstructed incorrectly:',
  '',
  '| Artifact | Example |',
  '|----------|---------|',
  '| Duplicate dates | `2011 - 2011-2011` |',
  '| Entity duplication | `Independent / Freelance — Independent / Freelance` |',
  '| Merge glitch | `Contributed as at Present` |',
  '| OCR glue | `Fluent analyse` |',
  '',
  '## Audit coverage',
  '',
  '| Layer | Handler |',
  '|-------|---------|',
  '| Line merge | `smartLineMerge()` |',
  '| Paragraph merge | `smartParagraphMerge()` |',
  '| Date normalization | `normalizeReconstructedDates()` |',
  '| Entity reconstruction | `dedupeEntitySegmentsInLine()` |',
  '| Experience reconstruction | `sanitizeParserInput()` + parser pipeline |',
  '',
  '## Rules (locked)',
  '',
  '- Keep original meaning',
  '- Never concatenate unrelated lines',
  '- Never duplicate dates',
  '- Never duplicate entities',
  '- Section headers stay isolated',
  '- Experience lines with distinct dates stay separate',
  '',
  '## API',
  '',
  '- `smartLineMerge(lines)` — merge continuation fragments only',
  '- `smartParagraphMerge(text)` — merge broken paragraph blocks',
  '- `reconstructExtractedText(text)` — full pre-parser reconstruction',
  '',
  '## Integration',
  '',
  '- `src/core/parsing/text-reconstruction.js`',
  '- `src/core/extraction/extraction-audit.js` → `sanitizeParserInput()`',
  '- `src/core/parsing/clean.js` → `safeClean()`',
  '',
];

if (report?.fixes?.length) {
  lines.push('## Fixes verified', '');
  for (const f of report.fixes) lines.push(`- ${f}`);
  lines.push('');
}

if (report?.yoaz) {
  lines.push(
    '## Yoaz fixture',
    '',
    `- Experiences: ${report.yoaz.experienceCount}`,
    `- Education: ${report.yoaz.educationCount}`,
    `- Duplicate date artifact: ${report.yoaz.duplicateDateArtifact ? '✗' : '✓ none'}`,
    ''
  );
}

lines.push('## Verify', '', '```bash', 'npm run qa:text-reconstruction', 'npm run text-reconstruction-report', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
