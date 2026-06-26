#!/usr/bin/env node
/**
 * P0 — Generate TEXT_RECONSTRUCTION_ENGINE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEXT_RECONSTRUCTION_ENGINE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/text-reconstruction-engine/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-text-reconstruction-engine.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# TEXT_RECONSTRUCTION_ENGINE_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.engineVersion || 'TEXT_RECONSTRUCTION_ENGINE_V2'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Extracted text was present but badly reconstructed:',
  '',
  '| Artifact | Example |',
  '|----------|---------|',
  '| Duplicate dates | `2011 - 2011-2011` |',
  '| Merge glitch | `Contributed as at Present` |',
  '| OCR glue | `Fluent analyse` |',
  '| Parser labels | `Company à confirmer` |',
  '| Section bleed | `Experience` glued into job lines |',
  '',
  '## TEXT_RECONSTRUCTION_ENGINE responsibilities',
  '',
];

if (report?.responsibilities?.length) {
  for (const r of report.responsibilities) lines.push(`- ${r}`);
  lines.push('');
}

lines.push(
  '## API',
  '',
  '| Function | Role |',
  '|----------|------|',
  '| `smartLineMerge()` | Merge continuation fragments only |',
  '| `smartParagraphMerge()` | Merge broken paragraph blocks |',
  '| `preserveSectionBoundaries()` | Split embedded section headers |',
  '| `normalizeReconstructedDates()` | Repair / dedupe date ranges |',
  '| `stripParserLabelsFromLine()` | Remove `à confirmer` placeholders |',
  '| `inferLineSection()` | Prevent cross-section merges |',
  '| `reconstructExtractedText()` | Full pre-parser reconstruction |',
  '',
  '## Acceptance',
  '',
  '| Criterion | Result |',
  '|-----------|--------|',
  `| No fake sentences | ${report?.acceptance?.noFakeSentences ? '✓' : '✗'} |`,
  `| No duplicated dates | ${report?.acceptance?.noDuplicatedDates ? '✓' : '✗'} |`,
  `| No parser labels in final CV | ${report?.acceptance?.noParserLabels ? '✓' : '✗'} |`,
  '',
  '## Integration',
  '',
  '- `src/core/parsing/text-reconstruction.js`',
  '- `src/core/extraction/extraction-audit.js` → `sanitizeParserInput()`',
  '- `src/core/parsing/clean.js` → `safeClean()`',
  '- `src/core/validation/data-sanitization-layer.js` → experience line normalize',
  ''
);

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
    `- Clients: ${report.yoaz.clientsCount}`,
    `- Tools: ${report.yoaz.toolsCount}`,
    `- Parser label leak: ${report.yoaz.parserLabelLeak}`,
    `- Fake sentences: ${report.yoaz.fakeSentenceCount}`,
    ''
  );
}

lines.push(
  '## Verify',
  '',
  '```bash',
  'npm run qa:text-reconstruction-engine',
  'npm run text-reconstruction-engine-report',
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
