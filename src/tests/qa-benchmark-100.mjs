#!/usr/bin/env node
/**
 * 100 CV stress benchmark gate.
 */
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { BENCHMARK_100_FIXTURES } from '../../tests/benchmark/benchmark-100-catalog.mjs';
import {
  computeBenchmark100Metrics,
  aggregateBenchmark100,
  BENCHMARK_100_GOALS,
} from '../../tests/lib/benchmark-100-metrics.mjs';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

async function main() {
  const rows = [];
  for (let i = 0; i < BENCHMARK_100_FIXTURES.length; i++) {
    const fixture = BENCHMARK_100_FIXTURES[i];
    process.stderr.write(`[benchmark-100] ${i + 1}/${BENCHMARK_100_FIXTURES.length} ${fixture.id}…\n`);
    const importResult = await runHirelyImportFromText(fixture.text, {
      source: fixture.id,
      extractionMethod: 'paste',
    });
    rows.push(computeBenchmark100Metrics(fixture, importResult));
  }

  const agg = aggregateBenchmark100(rows);

  ok(
    agg.experienceRecall > BENCHMARK_100_GOALS.experienceRecall,
    `Experience recall ${agg.experienceRecall}% > ${BENCHMARK_100_GOALS.experienceRecall}%`
  );
  ok(
    agg.educationRecall > BENCHMARK_100_GOALS.educationRecall,
    `Education recall ${agg.educationRecall}% > ${BENCHMARK_100_GOALS.educationRecall}%`
  );
  ok(
    agg.identityRecall > BENCHMARK_100_GOALS.identityRecall,
    `Identity recall ${agg.identityRecall}% > ${BENCHMARK_100_GOALS.identityRecall}%`
  );
  ok(rows.length === 100, `Benchmark size ${rows.length}/100`);

  if (failed) {
    console.error(`\n${failed} benchmark gate check(s) failed`);
    console.error('Top failure causes:', agg.failureCauses.slice(0, 8));
    process.exitCode = 1;
  } else {
    console.log('\n100 CV benchmark gate PASSED');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
