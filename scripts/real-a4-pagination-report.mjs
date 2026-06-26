#!/usr/bin/env node
/**
 * P0 — Generate REAL_A4_PAGINATION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_A4_PAGINATION_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/a4-pagination/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Real A4 pagination audit\n');
  const qa = run('src/tests/qa-a4-pagination.mjs');
  console.log(qa.ok ? '  PASS qa-a4-pagination' : '  FAIL qa-a4-pagination');

  let data = null;
  try {
    if (fs.existsSync(JSON_PATH)) data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch {
    data = null;
  }

  const pass = qa.ok && data?.pass;

  const rows = (data?.audits || [])
    .map(
      (a) =>
        `| ${a.id} | ${a.templateId} | ${a.sheetCount} | ${a.pdfPages} | ${a.overflowSheets} | ${a.blankSheets} | ${a.warnVisible ? '✗' : '✓'} |`
    )
    .join('\n');

  const lines = [
    '# HIRELY P0 — Real A4 Pagination',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Long CVs exceeded a single A4 sheet and showed:',
    '- Orange preview warning: “Content exceeds A4 page height”',
    '- Content packed into one page with hidden overflow',
    '',
    '## Rules (locked)',
    '',
    '- Never crop content',
    '- Never compress text until unreadable',
    '- Never hide sections',
    '- Split sections cleanly across pages',
    '- Repeat header only when needed (continuation pages)',
    '- PDF export must match preview page count',
    '',
    '## Fix',
    '',
    '| Layer | Change |',
    '|-------|--------|',
    '| `cv-a4-pages.js` | Conservative `PAGE_BUDGET_PX`, finer section splitting, `rebalancePageGroups()` |',
    '| `cv-a4-pages.js` | Split experience entries by bullet when a single row is too tall |',
    '| `cv-a4-pages.js` | Continuation pages re-use section titles when a section resumes |',
    '| `a4-viewport.js` | Auto `rebalanceCvA4Pages()` before showing overflow warning |',
    '| `cv-a4-pages.js` | Measure host no longer steals `#cvDoc` id (fixed phantom blank sheet) |',
    '',
    '## Fixture results',
    '',
    '| Scenario | Template | Preview sheets | PDF pages | Overflow sheets | Blank sheets | No warning |',
    '|----------|----------|---------------:|----------:|----------------:|-------------:|:----------:|',
    rows || '| — | — | — | — | — | — | — |',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Long CVs create multiple A4 pages. No overflow warning. No clipped content. No blank page. Preview ≡ PDF.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:a4-pagination',
    '```',
    '',
  ];

  if (!pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 8000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
