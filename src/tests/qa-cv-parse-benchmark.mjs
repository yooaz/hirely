#!/usr/bin/env node
/**
 * CV parse pipeline benchmark — objective regression metrics.
 * node src/tests/qa-cv-parse-benchmark.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCvParseBenchmark } from '../../tests/lib/cv-parse-benchmark-runner.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/cv-parse-benchmark');
mkdirSync(outDir, { recursive: true });

const onlyIds = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const report = runCvParseBenchmark({ rootDir: root, onlyIds: onlyIds.length ? onlyIds : undefined });

const jsonPath = join(outDir, 'report.json');
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

console.log('\n=== CV PARSE BENCHMARK ===\n');
console.log(`Version: ${report.version}`);
console.log(`Fixtures: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed}`);
console.log(
  `Average parsing time: ${report.summary.average_parsing_time_ms}ms` +
    (report.summary.avg_parsing_time_threshold_ms != null
      ? ` (threshold ≤ ${report.summary.avg_parsing_time_threshold_ms}ms — ${report.summary.avg_parsing_time_pass ? 'PASS' : 'FAIL'})`
      : '')
);
console.log('');

const metricIds = [
  'contact_accuracy',
  'header_detection_rate',
  'section_detection_accuracy',
  'experience_segmentation_accuracy',
  'education_deduplication_success',
  'skills_purity',
  'unclassified_block_rate',
  'portfolio_leakage_rate',
];

for (const c of report.cases) {
  const status = c.pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${c.id} (${c.duration_ms}ms)`);
  for (const mid of metricIds) {
    const check = c.checks.find((x) => x.id === mid);
    const mark = check?.pass ? '✓' : '✗';
    const cmp = check?.comparator || '';
    console.log(`  ${mark} ${mid}: ${c.metrics[mid]} ${cmp} ${check?.threshold}`);
  }
  if (c.failures.length) {
    for (const f of c.failures) {
      console.log(`    ↳ ${f.metric} ${f.value} not ${f.comparator} ${f.threshold}`);
    }
  }
  console.log('');
}

console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown: npm run cv-parse-benchmark-report\n`);

if (!report.pass) {
  console.error('CV_PARSE_BENCHMARK_FAIL\n');
  process.exit(1);
}

console.log('CV_PARSE_BENCHMARK OK\n');
