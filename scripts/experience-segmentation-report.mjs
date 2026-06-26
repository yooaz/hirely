#!/usr/bin/env node
/**
 * Generate EXPERIENCE_SEGMENTATION_REPORT.md
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'EXPERIENCE_SEGMENTATION_REPORT.md');

const run = spawnSync('node', ['src/tests/qa-experience-segmentation.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const pass = run.status === 0;
const stdout = (run.stdout || '').trim();
const stderr = (run.stderr || '').trim();

const lines = [
  '# Experience Segmentation — QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Multiple jobs collapsed into one experience blob.',
  '',
  '## Engine',
  '',
  '`EXPERIENCE_SEGMENTATION_ENGINE` in `src/core/parsing/experience-segmentation-engine.js`',
  '',
  'Each experience requires:',
  '',
  '- title',
  '- company',
  '- date range',
  '',
  'Split when:',
  '',
  '- new company',
  '- new year range',
  '- new title',
  '',
  '## Acceptance',
  '',
  '| Entry | Status |',
  '|-------|--------|',
  '| McCann — separate | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Freelance — separate | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Nike projects — separate | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| No merged mega-line | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '',
  '## Wiring',
  '',
  '- `parseSegmentedExperiences()` — primary segmentation API',
  '- `reconstructExperienceEntries()` — delegates to segmentation first',
  '- `applyExperienceReconstruction()` — production `normalizeCvData()` path',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:experience-segmentation',
  '```',
  '',
  '## Console output',
  '',
  '```',
  stdout || '(no stdout)',
  '```',
];

if (!pass && stderr) {
  lines.push('', '## Errors', '', '```', stderr, '```');
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${reportPath}`);
process.exit(pass ? 0 : 1);
