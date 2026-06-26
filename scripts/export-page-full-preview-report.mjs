#!/usr/bin/env node
/**
 * HIRELY P0 — Generate EXPORT_PAGE_FULL_PREVIEW_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPORT_PAGE_FULL_PREVIEW_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/export-page-full-preview/report.json');
const SHOT = path.join(ROOT, 'tests/output/export-page-full-preview/export-page.png');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Export page full preview\n');
  const qa = run('node', ['src/tests/qa-export-page-full-preview.mjs']);
  console.log(qa.pass ? '  PASS qa-export-page-full-preview' : '  FAIL qa-export-page-full-preview');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const snap = data?.snap || {};
  const pass = qa.pass && data?.pass;

  const lines = [
    '# HIRELY P0 — Export Page Full Preview',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'The export step could look empty — users landed on export without seeing the final CV.',
    '',
    '## Requirement',
    '',
    'Export screen must always show:',
    '',
    '| Element | Implementation |',
    '|---------|----------------|',
    '| Selected template name | `#exportStepTemplateName` in `#exportStepHead` |',
    '| Full A4 preview | `#studioPreview` visible on export · `ensureExportPreviewRendered()` |',
    '| Zoom fit | `#a4ZoomBar` · default `fit` on export entry |',
    '| Télécharger PDF | `#downloadBtn` in `#cvExportBar` |',
    '| Retour aux modèles | `#exportBackToTemplatesBtn` + header back button |',
    '',
    'No blank export screen.',
    '',
    '## QA snapshot',
    '',
    '| Check | Value |',
    '|-------|-------|',
    `| Preview visible | ${snap.previewVisible ? 'yes' : 'no'} |`,
    `| Template label | ${snap.templateLabel || '—'} |`,
    `| CV live | ${snap.cvLive ? 'yes' : 'no'} (${snap.cvTextLen ?? 0} chars) |`,
    `| Preview name | ${snap.previewName || '—'} |`,
    `| A4 stage height | ${snap.stageHeight ?? '—'}px |`,
    `| Zoom bar | ${snap.zoomBarVisible ? 'visible' : 'hidden'} |`,
    `| Zoom fit | ${snap.zoomFitActive || snap.zoomMode === 'fit' ? 'active' : 'no'} |`,
    `| PDF button | ${snap.pdfBtnLabel || '—'} |`,
    `| Back button | ${snap.backBtnLabel || '—'} |`,
  ];

  if (fs.existsSync(SHOT)) {
    lines.push('', '## Screenshot', '', `![Export page](${path.relative(ROOT, SHOT)})`);
  }

  lines.push(
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Export screen always displays the final CV with template name, A4 preview, zoom fit, PDF download, and back to templates.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:export-page-full-preview',
    '```',
    ''
  );

  if (!qa.pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 8000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
