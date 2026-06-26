#!/usr/bin/env node
/**
 * HIRELY H15 — Real CV quality benchmark QA gate.
 */
import {
  runH15RealCvBenchSuite,
  H15_BENCH_COUNT,
  H15_BENCH_GOALS,
} from './lib/h15-real-cv-bench-suite.mjs';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const report = await runH15RealCvBenchSuite();
const s = report.summary;

ok(report.count === H15_BENCH_COUNT, `fixture count ${report.count}/${H15_BENCH_COUNT}`);
ok(s.nameAccuracy >= H15_BENCH_GOALS.nameAccuracy, `name accuracy ${s.nameAccuracy}% >= ${H15_BENCH_GOALS.nameAccuracy}%`);
ok(
  s.contactAccuracy >= H15_BENCH_GOALS.contactAccuracy,
  `contact accuracy ${s.contactAccuracy}% >= ${H15_BENCH_GOALS.contactAccuracy}%`
);
ok(
  s.criticalGarbageTotal === H15_BENCH_GOALS.criticalGarbage,
  `critical garbage ${s.criticalGarbageTotal} === ${H15_BENCH_GOALS.criticalGarbage}`
);
ok(s.cleanPreviewCount === report.count, `clean CV preview ${s.cleanPreviewCount}/${report.count}`);

for (const row of report.results) {
  if (!row.pass.preview || row.garbageLeakage > 0) {
    console.error(
      `FAIL ${row.id}: preview=${row.pass.preview} garbage=${row.garbageLeakage} review=${row.manualReviewCount}`
    );
    failed++;
  }
}

console.log(
  `H15 bench: name ${s.nameAccuracy}% · contact ${s.contactAccuracy}% · garbage ${s.criticalGarbageTotal} · review avg ${s.manualReviewAvg} · clean preview ${s.cleanPreviewRate}%`
);
process.exit(failed ? 1 : 0);
