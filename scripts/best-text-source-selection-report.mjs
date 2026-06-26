#!/usr/bin/env node
/**
 * P0 — Generate BEST_TEXT_SOURCE_SELECTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'BEST_TEXT_SOURCE_SELECTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/best-text-source-selection/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-best-text-source-selection.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# BEST_TEXT_SOURCE_SELECTION_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.engineVersion || 'BEST_TEXT_SOURCE_SELECTION_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Native PDF text and OCR text can conflict. The pipeline must automatically pick the best source without polluting good native text with bad OCR.',
  '',
  '## Inputs',
  '',
  '| Source | Field |',
  '|--------|-------|',
  '| Native PDF text layer | `nativeText` |',
  '| OCR output | `ocrText` |',
  '| DOCX extraction | `docxText` |',
  '| User paste | `pastedText` |',
  '',
  '## Scoring dimensions',
  '',
  '| Dimension | Weight / effect |',
  '|-----------|-----------------|',
  '| Length | 18% of composite |',
  '| Plausible word ratio | 32% of composite |',
  '| Email presence | +8 |',
  '| Phone presence | +8 |',
  '| Date presence | +4 each (max 15) |',
  '| Section headers | +4 each (max 12) |',
  '| Garbage ratio | −35 × ratio |',
  '| Duplicate ratio | −22 × ratio |',
  '| Source bias | native +4, docx +3, paste +2, OCR −2 |',
  '',
  '## Rules',
  '',
  '| Rule | Behavior |',
  '|------|----------|',
  '| Do not merge bad OCR into good native | Merge rejected when OCR garbage > 35% or OCR score < 55% of best single |',
  '| Merge only if it improves score | `merged` candidate must beat best single by > 2 points |',
  '| Audit trail | `textSourceAudit` records candidates, merge decision, rejection reason |',
  '',
  '## API',
  '',
  '- `selectBestTextSource({ nativeText, ocrText, docxText, pastedText })`',
  '- `scoreTextSource(text, sourceId)`',
  '- `mergeTextSourcesConservative(native, ocr)` — native base + non-duplicate OCR lines only',
  '',
  '## Integration',
  '',
  '- `src/core/extraction/best-text-source-selection.js`',
  '- `src/core/extraction/multi-format-extraction-engine.js` → `selectBestExtractionVersion()`',
  '- `enrichMultiFormatExtraction()` attaches `textSourceAudit` to import metadata',
  '',
];

if (report?.scenarios) {
  lines.push(
    '## Scenario results',
    '',
    '| Scenario | Pass |',
    '|----------|------|',
    `| Native beats bad OCR | ${report.scenarios.nativeBeatsBadOcr ? '✓' : '✗'} |`,
    `| DOCX beats weak native | ${report.scenarios.docxBeatsWeakNative ? '✓' : '✗'} |`,
    `| Paste wins when richest | ${report.scenarios.pastedWins ? '✓' : '✗'} |`,
    `| Bad OCR merge rejected | ${report.scenarios.mergeRejectedForBadOcr ? '✓' : '✗'} |`,
    ''
  );
}

if (report?.scoring) {
  lines.push(
    '## Yoaz native scoring',
    '',
    `- Composite: ${report.scoring.nativeComposite}`,
    `- Garbage ratio: ${report.scoring.garbageRatio}`,
    `- Duplicate ratio: ${report.scoring.duplicateRatio}`,
    ''
  );
}

lines.push(
  '## Verify',
  '',
  '```bash',
  'npm run qa:best-text-source-selection',
  'npm run best-text-source-selection-report',
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
