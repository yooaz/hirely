#!/usr/bin/env node
/**
 * HIRELY P7 — 20 CV stress QA gate.
 */
import { runP7StressSuite } from './lib/p7-stress-suite.mjs';
import { P7_GOALS, P7_FIXTURE_COUNT } from '../../tests/lib/p7-stress-catalog.mjs';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const report = await runP7StressSuite({ writePdfs: false });
const s = report.summary;

ok(report.count === P7_FIXTURE_COUNT, `fixture count ${report.count}/${P7_FIXTURE_COUNT}`);

for (const gate of ['import', 'parser', 'review', 'ats', 'pdf']) {
  ok(s.rates[gate] >= P7_GOALS[gate], `${gate} ${s.rates[gate]}% >= ${P7_GOALS[gate]}%`);
}

ok(s.fullPassRate >= P7_GOALS.fullPipeline, `full pipeline ${s.fullPassRate}% >= ${P7_GOALS.fullPipeline}%`);

for (const r of report.results) {
  if (!r.fullPass) {
    console.error(`FAIL ${r.id}: ${(r.blockers || []).join(', ') || 'unknown'}`);
    failed++;
  }
}

console.log(`P7 stress: ${s.fullPass}/${s.count} full pass (${s.fullPassRate}% success, ${s.failureRate}% failure)`);
process.exit(failed ? 1 : 0);
