#!/usr/bin/env node
/**
 * P5 — Generate CV_HELL_BENCHMARK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_HELL_BENCHMARK_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/p5-cv-hell-bench/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

console.log('Running qa:cv-hell-benchmark…');
const qa = spawnSync('node', ['src/tests/qa-cv-hell-benchmark.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const data = readJson(JSON_PATH);
const s = data?.summary || {};
const goals = data?.goals || {};
const results = data?.results || [];
const pass = data?.summary?.pass === true;

const layoutRows = Object.entries(s.byLayout || {})
  .map(([layout, row]) => `| ${layout} | ${row.count} | ${row.nameAccuracy}% | ${row.experienceAccuracy}% |`)
  .join('\n');

const worst = [...results]
  .sort((a, b) => (a.experienceAccuracy || 0) - (b.experienceAccuracy || 0))
  .slice(0, 8)
  .map((r) => `| ${r.id} | ${r.layout} | ${r.nameAccuracy}% | ${r.experienceAccuracy}% | ${r.educationAccuracy}% |`)
  .join('\n');

const md = `# CV Hell Benchmark (P5)

**Status:** ${pass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Fixtures:** ${data?.count ?? 50} real-world layout variants  
**Engine:** \`${data?.engine || 'HIRELY_P5_CV_HELL_BENCH_V1'}\`

## Purpose

Stress-test Hirely import across **50 real CV layouts** — Canva, InDesign, Figma, Word, Pages, LinkedIn export, Europass, creative portfolios, agency designers, developers, and executives.

Ground truth is taken from canonical fixture text; each case re-formats content with a layout transformer then runs the full import pipeline.

## Accuracy summary

| Dimension | Result | PASS threshold |
|-----------|--------|----------------|
| **Name** | **${s.nameAccuracy ?? '—'}%** | > ${goals.nameAccuracy ?? 95}% |
| **Contact** | **${s.contactAccuracy ?? '—'}%** | > ${goals.contactAccuracy ?? 95}% |
| **Experience** | **${s.experienceAccuracy ?? '—'}%** | > ${goals.experienceAccuracy ?? 90}% |
| **Education** | **${s.educationAccuracy ?? '—'}%** | > ${goals.educationAccuracy ?? 85}% |
| **Skills** | **${s.skillsAccuracy ?? '—'}%** | > ${goals.skillsAccuracy ?? 85}% |
| Tools | ${s.toolsAccuracy ?? '—'}% | (reported) |
| Languages | ${s.languagesAccuracy ?? '—'}% | (reported) |

## Layout coverage

| Layout | Cases | Name accuracy | Experience accuracy |
|--------|-------|---------------|-------------------|
${layoutRows || '| — | — | — | — |'}

## Lowest experience recall (debug)

| ID | Layout | Name | Experience | Education |
|----|--------|------|------------|-----------|
${worst || '| — | — | — | — | — |'}

## Modules

| File | Role |
|------|------|
| \`tests/lib/p5-cv-hell-layouts.mjs\` | Canva / InDesign / Figma / Word / Pages / LinkedIn / Europass transforms |
| \`tests/lib/p5-cv-hell-bench-catalog.mjs\` | 50-case catalog |
| \`tests/lib/p5-cv-hell-bench-metrics.mjs\` | Accuracy aggregation |
| \`src/tests/lib/p5-cv-hell-bench-suite.mjs\` | Suite runner |

## Run

\`\`\`bash
npm run qa:cv-hell-benchmark
npm run cv-hell-benchmark-report
\`\`\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT}`);
process.exit(qa.status === 0 ? 0 : 1);
