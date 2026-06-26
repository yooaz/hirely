#!/usr/bin/env node
/**
 * Corpus-level resume benchmark — full fixture corpus, anti-overfit guards, Yoaz as regression only.
 * node src/tests/qa-corpus-resume-benchmark.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCorpusResumeBenchmark } from '../../tests/lib/corpus-resume-benchmark.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/corpus-resume-benchmark');

mkdirSync(outDir, { recursive: true });

const report = await runCorpusResumeBenchmark({
  rootDir: root,
});

const jsonPath = join(outDir, 'report.json');
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

console.log('\n=== CORPUS RESUME BENCHMARK ===\n');
console.log(`Version: ${report.version}`);
console.log(`Inventory: ${report.inventory_version}`);
const pb = report.summary.parse_benchmark;
console.log(`Parse benchmark: ${pb.passed}/${pb.total} PASS (rate ${pb.pass_rate})`);
console.log(`Anti-overfit audit: ${report.summary.anti_overfit.pass ? 'PASS' : 'FAIL'}`);
console.log(
  `Generalization corpus: ${report.summary.generalization.passCount}/${report.summary.generalization.count} PASS`
);

console.log('\nCorpus metrics (parse benchmark average):');
for (const [k, v] of Object.entries(report.summary.corpus_metrics)) {
  console.log(`  ${k}: ${v}`);
}

if (report.before_after) {
  console.log('\nBefore → After (parse benchmark):');
  console.log(
    `  fixtures: ${report.before_after.before.fixture_count} → ${report.before_after.after.fixture_count}`
  );
  console.log(
    `  pass_rate: ${report.before_after.before.pass_rate ?? 'n/a'} → ${report.before_after.after.pass_rate}`
  );
  for (const [k, delta] of Object.entries(report.before_after.delta)) {
    if (delta !== 0) console.log(`  Δ ${k}: ${delta >= 0 ? '+' : ''}${delta}`);
  }
}

if (!report.summary.anti_overfit.pass) {
  console.log('\nAnti-overfit hits:', JSON.stringify(report.anti_overfit.production.hits, null, 2));
}

console.log(`\nJSON report: ${jsonPath}\n`);

if (pb.passed < pb.total || !report.summary.anti_overfit.pass) {
  console.error('CORPUS_RESUME_BENCHMARK_FAIL\n');
  process.exit(1);
}

console.log('CORPUS_RESUME_BENCHMARK OK (parse + anti-overfit)\n');
if (!report.summary.generalization.pass) {
  console.warn(
    `Note: generalization corpus ${report.summary.generalization.passCount}/${report.summary.generalization.count} — see report.generalization\n`
  );
}
