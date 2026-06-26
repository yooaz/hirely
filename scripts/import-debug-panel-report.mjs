#!/usr/bin/env node
/**
 * P0 — Import debug panel report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IMPORT_DEBUG_PANEL_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/import-debug-panel/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Import debug panel\n');
  const qa = run('node', ['src/tests/qa-import-debug-panel.mjs']);
  console.log(qa.pass ? '  PASS qa-import-debug-panel' : '  FAIL qa-import-debug-panel');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && data?.pass;
  const lines = [
    '# HIRELY P0 — Import Debug Panel',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Purpose',
    '',
    'Developer-only panel visible with `?debug=true`. Shows import metrics and pipeline steps during CV import. **Never shown to production users.**',
    '',
    '## Metrics displayed',
    '',
    '| Metric | Source |',
    '|--------|--------|',
    '| PDF imported | `state.lastImportFile` (`.pdf` extension or MIME) |',
    '| Text length | `state.rawText.length` |',
    '| OCR used | `extractionMethod` / pipeline `useOcr` |',
    '| Parser used | `debugReport.parser` or `hirely-import` / `production-pipeline` |',
    '| Experiences found | `finalResumeData.experiences` or `cvData.experience` |',
    '| Education found | `finalResumeData.education` or `cvData.education` |',
    '| Skills found | `finalResumeData.skills` or `cvData.skills` |',
    '| Review items count | `getPendingReviewQueue().length` |',
    '',
    '## Pipeline steps displayed',
    '',
    '| Step | Trigger |',
    '|------|---------|',
    '| `IMPORT_STARTED` | File selected / import begins |',
    '| `TEXT_EXTRACTED` | `EXTRACTION_DONE` in `importLog` |',
    '| `PARSER_DONE` | Parser completes |',
    '| `FINAL_RESUME_READY` | `ensureImportReviewVisible` / commit |',
    '| `REVIEW_SCREEN_VISIBLE` | Review workspace shown |',
    '',
    '## Implementation',
    '',
    '| Piece | Location |',
    '|-------|----------|',
    '| Panel module | `src/ui/product/import-debug-panel.js` |',
    '| Panel styles | `src/ui/product/import-debug-panel.css` |',
    '| HTML host | `#importDebugPanel` in `#wsImport` |',
    '| User hide rule | `html:not(.debug-mode) .importDebugPanel { display: none }` |',
    '| Orchestration | `refreshImportDebugPanel()` + `importLog()` in `index.html` |',
    '',
    '## Visibility gate',
    '',
    '- Requires `?debug=true` (`DEBUG_MODE` / `DEVELOPER_MODE`)',
    '- `html.debug-mode` class added only in debug',
    '- Panel module returns early when `debugMode` is false',
    '',
    '## QA checks',
    '',
    '| Check | Status |',
    '|-------|--------|',
  ];

  for (const c of data?.checks || []) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');
  lines.push('## Gates');
  lines.push('');
  lines.push('| Command | Status |');
  lines.push('|---------|--------|');
  lines.push(`| \`npm run test:import-debug-panel\` | ${qa.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:import-debug-panel');
  lines.push('```');
  lines.push('');
  lines.push('## Manual verification');
  lines.push('');
  lines.push('1. Open `index.html?debug=true`');
  lines.push('2. Import a PDF');
  lines.push('3. Confirm `#importDebugPanel` shows metrics and all five steps tick off');
  lines.push('4. Open without `?debug=true` — panel must not appear');

  if (!pass) {
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    lines.push('- `qa-import-debug-panel` failed');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nIMPORT DEBUG PANEL PASS' : '\nIMPORT DEBUG PANEL FAIL');
  process.exit(pass ? 0 : 1);
}

main();
