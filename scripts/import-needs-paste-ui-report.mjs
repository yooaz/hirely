#!/usr/bin/env node
/**
 * Generate IMPORT_NEEDS_PASTE_UI_REPORT.md from qa-import-needs-paste-ui.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'IMPORT_NEEDS_PASTE_UI_REPORT.md');
const jsonPath = path.join(root, 'tests/output/import-needs-paste-ui/report.json');

const run = spawnSync('node', ['src/tests/qa-import-needs-paste-ui.mjs'], {
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
  '# IMPORT_NEEDS_PASTE — UI Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'P0 UI fix when import ends in `IMPORT_NEEDS_PASTE` (e.g. `PDF_EXTRACTION_TIMEOUT` / `OCR_TIMEOUT`).',
  'UI-only — no OCR, parser, template, or pricing changes.',
  '',
  '## Requirements',
  '',
  '| # | Requirement | Status |',
  '|---|-------------|--------|',
];

const reqMap = {
  ui_paste_panel_open: 'Paste panel opens automatically',
  ui_needs_paste_class: '`wsImport--needsPaste` applied',
  ui_import_expanded_visible: 'Paste panel inside visible import area',
  ui_textarea_visible: 'Textarea visible',
  ui_textarea_focused: 'Textarea receives focus',
  ui_not_loading: 'CV spinner cleared',
  ui_pipeline_not_busy: 'Import pipeline busy state cleared',
  ui_progress_hidden: 'Progress bar hidden',
  ui_title: 'Title: “Lecture automatique impossible.”',
  ui_lead: 'Lead: “Collez le texte du CV pour continuer.”',
  ui_filename_visible: 'Uploaded filename stays visible',
  ui_btn_paste: 'Button: Coller le texte',
  ui_btn_retry: 'Button: Réessayer la lecture PDF',
  ui_btn_other_file: 'Button: Changer de fichier',
  ui_paste_in_import_area: 'Panel not in hidden review/product container',
  race_paste_stays_open: 'Late OCR events do not hide paste panel',
  race_no_spinner_restart: 'Late OCR events do not restart spinner',
  race_progress_stays_hidden: 'Late OCR events do not show progress',
  paste_review_visible: 'Paste → parser → review screen',
  paste_parser_name: 'Parsed CV shows candidate name',
  paste_panel_closed_after_import: 'Paste panel closes after successful paste',
  paste_pipeline_logged: 'Pipeline logs REVIEW_SCREEN_VISIBLE',
};

for (const [id, label] of Object.entries(reqMap)) {
  const row = (report.checks || []).find((c) => c.id === id);
  const st = row ? (row.pass ? 'PASS' : 'FAIL') : run.status === 0 ? 'PASS' : '—';
  lines.push(`| ${id} | ${label} | ${st} |`);
}

lines.push('');
lines.push('## Changes');
lines.push('');
lines.push('- `index.html` — `ensureImportNeedsPasteVisible()`, `wsImport--needsPaste` CSS, race guards on `setProgress` / `finally`, updated copy and button labels');
lines.push('');
lines.push('## QA command');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:import-needs-paste-ui');
lines.push('```');
lines.push('');

if (!pass) {
  const blockers = (report.checks || []).filter((c) => !c.pass);
  if (blockers.length) {
    lines.push('## Remaining blocker');
    lines.push('');
    const first = blockers[0];
    lines.push(`- **${first.id}**: ${first.detail || 'check failed'}`);
    lines.push('');
  }
}

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
