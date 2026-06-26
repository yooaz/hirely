#!/usr/bin/env node
/**
 * Generate CV_CORPUS_QA_REPORT.md from qa-cv-corpus.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { loadCvCorpusFixtures } from '../tests/lib/cv-corpus-catalog.mjs';
import {
  computeCvCorpusMetrics,
  aggregateCvCorpus,
  CV_CORPUS_GOALS,
} from '../tests/lib/cv-corpus-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'CV_CORPUS_QA_REPORT.md');

const qaRun = spawnSync('node', ['src/tests/qa-cv-corpus.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const fixtures = loadCvCorpusFixtures();
const rows = [];
for (const fixture of fixtures) {
  const importResult = await runHirelyImportFromText(fixture.text, {
    source: fixture.id,
    extractionMethod: 'paste',
  });
  rows.push(computeCvCorpusMetrics(fixture, importResult));
}
const agg = aggregateCvCorpus(rows);
const pass = qaRun.status === 0 && agg.pass;

function goalStatus(value, goal) {
  return value >= goal ? 'PASS' : 'FAIL';
}

const perCvTable = rows
  .map(
    (r) =>
      `| ${r.label} | ${r.identityRecall}% | ${r.experienceRecall}% | ${r.educationRecall}% | ${r.skillsRecall}% | ${r.languagesRecall}% |`
  )
  .join('\n');

const failureLines = agg.failureCauses
  .slice(0, 10)
  .map((f) => `- ${f.cause} (${f.count})`)
  .join('\n');

const lines = [
  '# CV Corpus QA Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  'P1 real-world CV corpus — 10 archetypes parsed through the production import pipeline.',
  '',
  '## Corpus',
  '',
  '| Archetype | File |',
  '|-----------|------|',
  ...fixtures.map((f) => `| ${f.archetype} | \`tests/cv-corpus/${f.id}.txt\` |`),
  '',
  '## Pass thresholds',
  '',
  '| Dimension | Threshold | Aggregate | Status |',
  '|-----------|-----------|-----------|--------|',
  `| Identity | ≥ ${CV_CORPUS_GOALS.identity}% | ${agg.identityRecall}% | ${goalStatus(agg.identityRecall, CV_CORPUS_GOALS.identity)} |`,
  `| Experience | ≥ ${CV_CORPUS_GOALS.experience}% | ${agg.experienceRecall}% | ${goalStatus(agg.experienceRecall, CV_CORPUS_GOALS.experience)} |`,
  `| Education | ≥ ${CV_CORPUS_GOALS.education}% | ${agg.educationRecall}% | ${goalStatus(agg.educationRecall, CV_CORPUS_GOALS.education)} |`,
  `| Skills | ≥ ${CV_CORPUS_GOALS.skills}% | ${agg.skillsRecall}% | ${goalStatus(agg.skillsRecall, CV_CORPUS_GOALS.skills)} |`,
  `| Languages | measured | ${agg.languagesRecall}% | — |`,
  '',
  '## Per-CV recall',
  '',
  '| CV | Identity | Experience | Education | Skills | Languages |',
  '|----|----------|------------|-----------|--------|-----------|',
  perCvTable,
  '',
  '## Top failure causes',
  '',
  failureLines || '_None_',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:cv-corpus',
  '```',
  '',
  '## Console output',
  '',
  '```',
  (qaRun.stdout || '').trim() || '(no stdout)',
  '```',
];

if (qaRun.stderr?.trim()) {
  lines.push('', '## Stderr', '', '```', qaRun.stderr.trim(), '```');
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${reportPath}`);
process.exit(pass ? 0 : 1);
