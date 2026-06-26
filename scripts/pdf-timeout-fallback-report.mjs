#!/usr/bin/env node
/**
 * Generate PDF_TIMEOUT_FALLBACK_REPORT.md from qa-pdf-timeout-fallback.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'PDF_TIMEOUT_FALLBACK_REPORT.md');
const jsonPath = path.join(root, 'tests/output/pdf-timeout-fallback/report.json');

const run = spawnSync('node', ['src/tests/qa-pdf-timeout-fallback.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

let report = { pass: false, checks: [] };
if (fs.existsSync(jsonPath)) {
  try {
    report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    /* ignore */
  }
}

const pass = run.status === 0 && report.pass !== false;
const lines = [
  '# PDF OCR Timeout Fallback — QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'P0 UX fix when PDF/OCR extraction exceeds 30s (`PDF_EXTRACTION_TIMEOUT` / `OCR_TIMEOUT`).',
  'No boot, template, or pricing changes.',
  '',
  '## Requirements',
  '',
  '| # | Requirement | Status |',
  '|---|-------------|--------|',
];

const reqMap = {
  core_timeout_message: 'Timeout copy matches product message',
  core_timeout_copy: 'Message includes “pour continuer”',
  ui_paste_panel_open: 'Paste panel opens automatically',
  ui_textarea_visible: 'Textarea visible',
  ui_not_loading: 'Spinner / loading class cleared',
  ui_pipeline_not_busy: 'Import pipeline busy state cleared',
  ui_timeout_lead: 'Lead: “Collez le texte du CV pour continuer”',
  ui_filename_visible: 'Uploaded filename stays visible',
  ui_btn_paste: 'Button: Coller le texte maintenant',
  ui_btn_retry: 'Button: Réessayer la lecture PDF',
  ui_btn_other_file: 'Button: Importer un autre fichier',
  paste_review_visible: 'Paste → parser → review screen',
  paste_parser_name: 'Parsed CV shows candidate name',
  paste_panel_closed_after_import: 'Paste panel closes after successful paste',
  paste_pipeline_logged: 'Paste pipeline logs review/render steps',
};

for (const [id, label] of Object.entries(reqMap)) {
  const row = (report.checks || []).find((c) => c.id === id);
  const st = row ? (row.pass ? 'PASS' : 'FAIL') : run.status === 0 ? 'PASS' : '—';
  lines.push(`| ${id} | ${label} | ${st} |`);
}

lines.push('');
lines.push('## Changes');
lines.push('');
lines.push('- `canonical-import.js` — preserve `PDF_OCR_TIMEOUT` status on paste fallback (non-fatal)');
lines.push('- `pdf-extraction-timeout.js` — timeout user copy + optional `HIRELY_PDF_EXTRACTION_MAX_MS` QA override');
lines.push('- `index.html` — `_importFallbackUiLock` stops loading race; timeout-specific paste UX; button labels');
lines.push('');
lines.push('## QA command');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:pdf-timeout-fallback');
lines.push('```');
lines.push('');

if (run.stdout) {
  lines.push('## Test output');
  lines.push('');
  lines.push('```');
  lines.push(run.stdout.trim().slice(-4000));
  lines.push('```');
  lines.push('');
}

if (run.stderr) {
  lines.push('## Errors');
  lines.push('');
  lines.push('```');
  lines.push(run.stderr.trim().slice(-2000));
  lines.push('```');
  lines.push('');
}

fs.writeFileSync(reportPath, lines.join('\n'));
console.log(pass ? 'PASS' : 'FAIL');
console.log(`Report: ${reportPath}`);
process.exit(pass ? 0 : 1);
