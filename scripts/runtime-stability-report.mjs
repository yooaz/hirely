#!/usr/bin/env node
/**
 * P0 — Runtime stability lock report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'RUNTIME_STABILITY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/runtime-stability/report.json');

const STAGES = [
  { id: 'import', label: 'Import', files: ['src/core/import/canonical-import.js', 'src/core/pipeline/hirely-import.js', 'index.html'] },
  { id: 'ocr', label: 'OCR', files: ['src/core/extraction/extract-file.js', 'src/core/extraction/ocr.js', 'src/core/import/ocr-parser-gate.js'] },
  { id: 'pdf', label: 'PDF', files: ['src/core/extraction/pdf-router.js', 'src/core/extraction/document-extract.js', 'src/ui/export/hirely-pdf-export.js'] },
  { id: 'parser', label: 'Parser', files: ['src/core/pipeline/production-pipeline.js', 'src/core/parsing/safe-fallback.js'] },
  { id: 'review', label: 'Review screen', files: ['index.html', 'src/core/validation/score-cycle-guard.js'] },
  { id: 'export', label: 'Export', files: ['src/core/export/export-lock.js', 'src/ui/export/hirely-pdf-export.js'] },
  { id: 'templates', label: 'Templates', files: ['src/ui/templates/cv-templates.js', 'cv-templates.js', 'index.html'] },
];

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function countThrows(filePath) {
  const fp = path.join(ROOT, filePath);
  if (!fs.existsSync(fp)) return -1;
  const text = fs.readFileSync(fp, 'utf8');
  return (text.match(/throw new/g) || []).length;
}

function main() {
  console.log('HIRELY P0 — Runtime stability lock\n');

  const qa = run('node', ['src/tests/qa-runtime-stability.mjs']);
  console.log(qa.pass ? '  PASS qa-runtime-stability' : '  FAIL qa-runtime-stability');

  const browser = run('node', ['scripts/real-browser-qa-lock.mjs']);
  console.log(browser.pass ? '  PASS real-browser-qa-lock' : '  FAIL real-browser-qa-lock');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && browser.pass && data?.pass;
  const lines = [
    '# HIRELY P0 — Runtime Stability Lock',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Mission',
    '',
    'Make Hirely impossible to break. No exception reaches UI. Every pipeline stage returns `{ success, data, warnings, errors }` — never undefined, never null, never crash.',
    '',
    '## Stage contract',
    '',
    '```js',
    '{',
    '  success: boolean,',
    '  data: object,      // never null',
    '  warnings: string[],',
    '  errors: string[],',
    '}',
    '```',
    '',
    'Module: `src/core/runtime/pipeline-stage-result.js`',
    'Guards: `src/core/runtime/runtime-stability-guard.js`',
    '',
    '## Audit by area',
    '',
    '| Area | Guard | Key files | UI throws removed |',
    '|------|-------|-----------|-------------------|',
    '| Import | `normalizeImportResultShape`, extraction safe catch | `extract-file.js`, `hirely-import.js`, `canonical-import.js` | `CORE_BOOT_FAILED`, `PARSER_EMPTY` |',
    '| OCR | `buildExtractionSafeFallback`, OCR parser gate | `extract-file.js`, `ocr-parser-gate.js` | — |',
    '| PDF | timeout partial recovery + safe fallback | `pdf-router.js`, `hirely-pdf-export.js` | `PDF_BLOB_UNAVAILABLE` |',
    '| Parser | `PRODUCTION_PIPELINE_SAFE_FALLBACK` | `production-pipeline.js`, `safe-fallback.js` | — |',
    '| Review | `score-cycle-guard`, partial review recovery | `index.html`, `score-cycle-guard.js` | — |',
    '| Export | `pdfExportFail` (no throw) | `hirely-pdf-export.js`, `export-lock.js` | — |',
    '| Templates | render try/catch + empty state | `cv-templates.js`, `index.html` | `templates unavailable` |',
    '',
    '## Remaining `throw new` in hot paths (core extraction — internal only)',
    '',
  ];

  for (const f of ['src/core/extraction/document-extract.js', 'src/core/extraction/enterprise-engine.js']) {
    const n = countThrows(f);
    lines.push(`- \`${f}\`: ${n >= 0 ? n : 'missing'} (caught at \`extract-file.js\` boundary)`);
  }

  lines.push('');
  lines.push('## QA checks');
  lines.push('');
  lines.push('| Check | Status |');
  lines.push('|-------|--------|');
  for (const c of data?.checks || []) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');
  lines.push('## Gates');
  lines.push('');
  lines.push('| Command | Status |');
  lines.push('|---------|--------|');
  lines.push(`| \`npm run test:runtime-stability\` | ${qa.pass ? 'PASS' : 'FAIL'} |`);
  lines.push(`| \`npm run test:real-browser-qa-lock\` | ${browser.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:runtime-stability');
  lines.push('```');

  if (!pass) {
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    if (!qa.pass) lines.push('- `qa-runtime-stability` failed');
    if (!browser.pass) lines.push('- `real-browser-qa-lock` failed');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nRUNTIME STABILITY PASS' : '\nRUNTIME STABILITY FAIL');
  process.exit(pass ? 0 : 1);
}

main();
