#!/usr/bin/env node
/**
 * P1 — Experience Reconstruction Engine V2 report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPERIENCE_RECONSTRUCTION_V2_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/experience-reconstruction-v2/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P1 — Experience Reconstruction Engine V2\n');

  const qaV2 = run('node', ['src/tests/qa-experience-reconstruction-v2.mjs']);
  console.log(qaV2.pass ? '  PASS qa-experience-reconstruction-v2' : '  FAIL qa-experience-reconstruction-v2');

  const qaEngine = run('node', ['src/tests/qa-experience-reconstruction-engine.mjs']);
  console.log(qaEngine.pass ? '  PASS qa-experience-reconstruction-engine' : '  FAIL qa-experience-reconstruction-engine');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qaV2.pass && qaEngine.pass && data?.pass;
  const yoaz = data?.yoazOcr || {};

  const lines = [
    '# HIRELY P1 — Experience Reconstruction Engine V2',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Experience recall was weak on real CVs (especially fragmented OCR): many career lines were dropped or merged incorrectly.',
    '',
    '## Solution — `EXPERIENCE_RECONSTRUCTION_ENGINE_V2`',
    '',
    '| Input | Output |',
    '|-------|--------|',
    '| Raw text (OCR / paste / PDF) | Maximum experience recovery |',
    '',
    '### Recovers',
    '',
    '- Date ranges (including space-separated OCR years `2011 2014`)',
    '- Company names (stacked OCR rows + compact single-line rows)',
    '- Freelance careers',
    '- Internships',
    '- Client lists (attached to freelance / stored on structured resume)',
    '',
    '### Never discard lines',
    '',
    'Lines that cannot be structured automatically are sent to the **review queue** (`field: experiences`, `status: pending`) — not silently dropped.',
    '',
    '## Yoaz fragmented OCR benchmark',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Experiences recovered | ${yoaz.recovered ?? '—'} |`,
    `| Unknown lines queued | ${yoaz.queued ?? '—'} |`,
    `| Recall vs 9-job ground truth | ${yoaz.recallPct ?? '—'}% |`,
    `| Recall goal | ≥ ${(data?.recallGoal ?? 0.92) * 100}% |`,
    '',
    '## Implementation',
    '',
    '| Piece | Location |',
    '|-------|----------|',
    '| V2 engine | `src/core/parsing/experience-reconstruction-engine-v2.js` |',
    '| Compact OCR parser | `parseCompactOcrExperienceLine()` |',
    '| Stacked OCR parser | `parseStackedOcrBlock()` |',
    '| Review routing | `buildReviewItemForLine()` |',
    '| Pipeline hook | `runExperienceReconstructionV2()` in `section-engine-v2.js` |',
    '',
    '## QA checks',
    '',
    '| Check | Status |',
    '|-------|--------|',
  ];

  for (const c of data?.checks || []) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');
  lines.push('## Gates');
  lines.push('');
  lines.push('| Command | Status |');
  lines.push('|---------|--------|');
  lines.push(`| \`npm run test:experience-reconstruction-v2\` | ${qaV2.pass ? 'PASS' : 'FAIL'} |`);
  lines.push(`| \`npm run qa:experience-reconstruction-engine\` | ${qaEngine.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:experience-reconstruction-v2');
  lines.push('```');

  if (!pass) {
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    if (!qaV2.pass) lines.push('- `qa-experience-reconstruction-v2` failed');
    if (!qaEngine.pass) lines.push('- `qa-experience-reconstruction-engine` regression');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nEXPERIENCE RECONSTRUCTION V2 PASS' : '\nEXPERIENCE RECONSTRUCTION V2 FAIL');
  process.exit(pass ? 0 : 1);
}

main();
