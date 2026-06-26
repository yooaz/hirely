#!/usr/bin/env node
/**
 * HIRELY P0 — Generate EXPORT_PAGE_FIX_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPORT_PAGE_FIX_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/export-page-fix/report.json');
const SHOT = path.join(ROOT, 'tests/output/export-page-fix/export-page.png');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Export page fix\n');
  const qa = run('node', ['src/tests/qa-export-page-fix.mjs']);
  console.log(qa.pass ? '  PASS qa-export-page-fix' : '  FAIL qa-export-page-fix');

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
    '# HIRELY P0 — Export Page Fix',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Requirement',
    '',
    'Export screen must show **exactly what will be exported**:',
    '',
    '- Selected template name',
    '- Full A4 preview (no blank canvas)',
    '- PDF download button',
    '- Cover letter button',
    '',
    'No blank state. No hidden preview.',
    '',
    '## QA snapshot',
    '',
    '| Check | Value |',
    '|-------|-------|',
    `| Preview visible | ${snap.previewVisible ? 'yes' : 'no'} |`,
    `| Template label | ${snap.templateLabel || '—'} |`,
    `| CV live | ${snap.cvLive ? 'yes' : 'no'} |`,
    `| Preview name | ${snap.previewName || '—'} |`,
    `| A4 stage height | ${snap.stageHeight ?? '—'}px |`,
    `| Export bar | ${snap.exportBarVisible ? 'visible' : 'hidden'} |`,
    `| PDF button | ${snap.pdfBtn ? 'yes' : 'no'} |`,
    `| Letter button | ${snap.letterBtn ? 'yes' : 'no'} |`,
    `| Letter panel default | ${snap.letterClosedByDefault ? 'closed' : 'open'} |`,
    '',
    '## Root cause',
    '',
    '1. `studioPreview` was only shown on the **edit** step — export hid the A4 canvas.',
    '2. Export step scrolled to the **footer**, away from the preview.',
    '3. Cover letter workspace auto-opened on export, crowding the layout.',
    '',
    '## Fix',
    '',
    '| Change | Location |',
    '|--------|----------|',
    '| Show preview on edit, style, and export | `syncResumeStudioChrome()` in `index.html` |',
    '| Export step header with template name | `#exportStepHead` in `index.html` |',
    '| A4 layout for style/export steps | `src/ui/studio/studio-layout.css` |',
    '| Scroll to preview header, not footer | `setDocStep(\'export\')` |',
    '| Letter panel opens on user action only | `syncCoverLetterWorkspace()` |',
    '',
    '## Gate',
    '',
    '```bash',
    'npm run test:export-page-fix',
    '```',
    '',
    '## Screenshot',
    '',
  ];

  if (fs.existsSync(SHOT)) {
    lines.push(`![Export page A4 preview](${path.relative(ROOT, SHOT)})`);
  } else {
    lines.push('_No screenshot captured._');
  }

  lines.push('');
  lines.push('## QA output');
  lines.push('');
  lines.push('```');
  lines.push(qa.out?.slice(0, 6000) || '(no output)');
  lines.push('```');
  lines.push('');

  if (!pass) {
    lines.push('## Blockers');
    lines.push('');
    if (!snap.previewVisible) lines.push('- A4 preview hidden on export step');
    if ((snap.stageHeight || 0) < 300) lines.push('- A4 stage too short or empty');
    if (!snap.exportBarVisible) lines.push('- Export action bar hidden');
    if (!snap.pdfBtn || !snap.letterBtn) lines.push('- Missing PDF or letter button');
    lines.push('');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nEXPORT PAGE FIX PASS' : '\nEXPORT PAGE FIX FAIL');
  process.exit(pass ? 0 : 1);
}

main();
