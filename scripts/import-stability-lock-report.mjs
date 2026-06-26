#!/usr/bin/env node
/**
 * Generate IMPORT_STABILITY_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IMPORT_STABILITY_LOCK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/import-stability-lock/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-import-stability-lock.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const data = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const pass = qa.pass && data?.pass;

const lines = [
  '# IMPORT_STABILITY_LOCK_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Lock:** \`${data?.version || 'IMPORT_STABILITY_LOCK_V1'}\``,
  `**Template work:** ${data?.templateWorkAllowed ? 'ALLOWED' : 'BLOCKED'}`,
  `**Generated:** ${data?.generatedAt || new Date().toISOString()}`,
  '',
  '## Policy',
  '',
  '**No new template work until all import stability gates pass.**',
  '',
  'Templates are visual skins only — they must not ship while import/extraction is unstable.',
  '',
  '## Required reports',
  '',
  '| Report | Status | QA script |',
  '|--------|--------|-----------|',
];

if (data?.lock?.reports?.length) {
  for (const r of data.lock.reports) {
    lines.push(`| ${r.reportFile} | ${r.pass ? 'PASS' : r.status} | \`${r.qaScript}\` |`);
  }
} else {
  lines.push('| _No report data_ | — | — |');
}

lines.push(
  '',
  '## Gate API',
  '',
  '- `src/core/import/import-stability-lock.js`',
  '- `src/ui/templates/template-import-gate.mjs` → `requireImportStabilityForTemplates()`',
  '',
  '## Verify',
  '',
  '```bash',
  'npm run qa:import-stability-lock',
  'npm run import-stability-lock-report',
  '```',
  '',
  '---',
  '',
  '### Console',
  '',
  '```',
  qa.out.split('\n').slice(-24).join('\n'),
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
