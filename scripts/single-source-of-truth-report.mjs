#!/usr/bin/env node
/**
 * HIRELY P0 — Generate SINGLE_SOURCE_OF_TRUTH_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SINGLE_SOURCE_OF_TRUTH_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/single-source-of-truth/report.json');

const REQUIRED_LOGS = [
  'FINAL_DATA_COMMITTED',
  'REVIEW_RENDERED',
  'PREVIEW_RENDERED',
  'TEMPLATE_RENDERED',
  'EXPORT_RENDERED',
];

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Single source of truth\n');
  const qa = run('node', ['src/tests/qa-single-source-of-truth.mjs']);
  console.log(qa.pass ? '  PASS qa-single-source-of-truth' : '  FAIL qa-single-source-of-truth');

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
  const final = snap.sectionCounts?.final || {};
  const preview = snap.sectionCounts?.preview || {};

  const lines = [
    '# HIRELY P0 — Single Source of Truth',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Principle',
    '',
    '**`state.finalResumeData`** is the only canonical object. All surfaces derive from it:',
    '',
    '- Review panel',
    '- CV preview',
    '- Template renderer',
    '- Export screen',
    '- PDF export',
    '',
    'Forbidden: separate `cvData` / `exportData` / stale template caches as sources of truth.',
    '',
    '## Pipeline logs',
    '',
    ...REQUIRED_LOGS.map((l) => `- \`${l}\``),
    '',
    '## Section parity (final vs preview)',
    '',
    '| Section | finalResumeData | Preview | Match |',
    '|---------|-----------------|---------|-------|',
  ];

  for (const key of ['experiences', 'education', 'skills', 'tools', 'languages', 'clients', 'projects']) {
    const f = final[key] ?? 0;
    const p = preview[key] ?? 0;
    lines.push(`| ${key} | ${f} | ${p} | ${f === p ? 'yes' : 'no'} |`);
  }

  lines.push('');
  lines.push(`**Parity gate:** ${snap.sectionCounts?.parity ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('## Runtime logs captured');
  lines.push('');
  lines.push('```');
  lines.push((snap.flowLogs || []).join(', ') || '(none)');
  lines.push('```');
  lines.push('');
  lines.push('## Implementation');
  lines.push('');
  lines.push('| Change | Location |');
  lines.push('|--------|----------|');
  lines.push('| `getFinalSectionCounts` / `getPreviewSectionCounts` | `index.html` |');
  lines.push('| `syncDerivedCvDataFromFinal` (cache only) | `index.html` |');
  lines.push('| `renderAllFromFinalResume` orchestrator | `index.html` |');
  lines.push('| Review/classify actions use `getFinalCvData()` | `index.html` |');
  lines.push('| Education issue uses final counts | `collectSimpleIssues` |');
  lines.push('| Export `resumeDataSectionCounts` export | `recruiter-checklist-source.js` |');
  lines.push('');
  lines.push('## Gate');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:single-source-of-truth');
  lines.push('```');
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
    if (!snap.sectionCounts?.parity) lines.push('- Section count mismatch between finalResumeData and preview');
    for (const l of REQUIRED_LOGS) {
      if (!(snap.flowLogs || []).includes(l)) lines.push(`- Missing log \`${l}\``);
    }
    lines.push('');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nSINGLE SOURCE OF TRUTH PASS' : '\nSINGLE SOURCE OF TRUTH FAIL');
  process.exit(pass ? 0 : 1);
}

main();
