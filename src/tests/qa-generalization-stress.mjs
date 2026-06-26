#!/usr/bin/env node
/**
 * HIRELY H8 — 100 CV generalization stress gate.
 * PASS if extraction success ≥ 95%.
 */
import { runH8StressSuite } from './lib/h8-stress-suite.mjs';
import { H8_EXTRACTION_GOAL_PCT } from '../../tests/lib/h8-stress-metrics.mjs';

console.log('qa-generalization-stress: 100 CV corpus…');
const report = await runH8StressSuite({ writePdfs: false });

for (const r of report.results.filter((x) => !x.extraction?.success)) {
  console.error(
    `FAIL ${r.id} ${r.archetype} — ${(r.extraction?.failures || []).join(', ') || r.error}`
  );
}

const { summary } = report;
console.log(
  `\n═══ H8 Generalization Stress: ${summary.extracted}/${summary.count} extracted (${summary.extractionRate}%) ` +
    `${summary.pass ? 'PASS' : 'FAIL'} (goal ≥ ${H8_EXTRACTION_GOAL_PCT}%) ═══`
);

process.exit(summary.pass ? 0 : 1);
