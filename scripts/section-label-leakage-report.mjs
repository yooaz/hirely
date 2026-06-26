#!/usr/bin/env node
/**
 * P0 — Generate SECTION_LABEL_LEAKAGE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SECTION_LABEL_LEAKAGE_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/section-label-leakage/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Section label leakage audit\n');
  const qa = run('src/tests/qa-section-label-leakage.mjs');
  console.log(qa.ok ? '  PASS qa-section-label-leakage' : '  FAIL qa-section-label-leakage');

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
        `| ${a.id} | ${a.skills} | ${a.clients} | ${a.labelHits?.length ? a.labelHits.join(', ') : '—'} | ${a.violations?.length ? '✗' : '✓'} |`
    )
    .join('\n');

  const lines = [
    '# HIRELY P0 — Remove Section Label Leakage',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Parser section headers were leaking into CV body content as list items or paragraphs:',
    '- `experiences`',
    '- `clients`',
    '- `summary`',
    '- `tools`',
    '- `Market Reviews` (OCR/parser metadata)',
    '',
    '## Rules (locked)',
    '',
    'Forbidden as **content lines** (section titles only):',
    '`experiences`, `experience`, `clients`, `client`, `summary`, `tools`, `skills`, `education`, `formation`, `languages`, `projects`',
    '',
    '## Root causes fixed',
    '',
    '| Layer | Issue | Fix |',
    '|-------|-------|-----|',
    '| `section-label-leakage-guard.js` | — | New P0 guard: exact-match label detection + strip |',
    '| `final-resume-data-cleanup.js` | Labels survived readability pass | `stripSectionLabelLeakage` before finalResumeData commit |',
    '| `data-sanitization-layer.js` | Template/PDF cvData path unguarded | `stripSectionLabelLeakageFromCvData` on flat cvData |',
    '| `undetected-label.js` | Export audit missed bare section words | Extended `FABRICATED_EXPORT_PATTERNS` |',
    '',
    '## Audited modules',
    '',
    '- Final builder — `buildFinalResumeData` → `applyFinalResumeDataCleanup`',
    '- Display sanitize — `sanitize-resume-display.js`',
    '- Template/PDF — `resumeDataToCvData` → `applyDataSanitizationLayer`',
    '- Header cleaner — identity fields (existing) + body guard (new)',
    '',
    '## Fixture results',
    '',
    '| Fixture | Skills | Clients | Label hits | Clean |',
    '|---------|-------:|--------:|------------|:-----:|',
    rows || '| — | — | — | — | — |',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — No raw section labels in CV content. No parser metadata in preview or PDF path.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:section-label-leakage',
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
