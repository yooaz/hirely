#!/usr/bin/env node
/**
 * HIRELY P2 — Production readiness QA (80 CVs).
 */
import { runP2ProductionReadinessSuite } from './lib/p2-production-readiness-suite.mjs';
import {
  P2_FIXTURE_COUNT,
  P2_GOALS,
  P2_CATEGORIES,
} from '../../tests/lib/p2-production-readiness-catalog.mjs';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const report = await runP2ProductionReadinessSuite({ writePdfs: false });
const s = report.summary;

ok(report.count === P2_FIXTURE_COUNT, `fixture count ${report.count}/${P2_FIXTURE_COUNT}`);
ok(s.parserCrashes <= P2_GOALS.parserCrashesMax, `parser crashes ${s.parserCrashes} (max ${P2_GOALS.parserCrashesMax})`);
ok(s.blankTemplates <= P2_GOALS.blankTemplatesMax, `blank templates ${s.blankTemplates}`);
ok(s.blankExports <= P2_GOALS.blankExportsMax, `blank exports ${s.blankExports}`);
ok(s.dataLossCount <= P2_GOALS.dataLossMax, `data loss events ${s.dataLossCount}`);
ok(
  s.avgContentPreservation >= P2_GOALS.contentPreservationMin,
  `content preservation ${s.avgContentPreservation}% >= ${P2_GOALS.contentPreservationMin}%`
);
ok(s.pass, `aggregate P2 pass (${s.fullPass}/${s.count} full pipeline)`);

for (const cat of P2_CATEGORIES) {
  const c = s.byCategory[cat];
  ok(c?.count === 20, `${cat} count ${c?.count ?? 0}/20`);
  ok((c?.crashes ?? 0) === 0, `${cat} parser crashes 0`);
  ok((c?.blankTemplates ?? 0) === 0, `${cat} blank templates 0`);
  ok((c?.blankExports ?? 0) === 0, `${cat} blank exports 0`);
  ok((c?.dataLoss ?? 0) === 0, `${cat} data loss 0`);
}

for (const row of report.results) {
  if (row.crashed || row.blankTemplate || row.blankExport || row.preservation?.dataLoss) {
    console.error(`FAIL ${row.id}: ${(row.blockers || []).join(', ') || row.error || 'unknown'}`);
    failed++;
  }
}

console.log(
  `P2 readiness: ${s.fullPass}/${s.count} full pass · preservation ${s.avgContentPreservation}% · crashes ${s.parserCrashes} · blank tpl ${s.blankTemplates} · blank pdf ${s.blankExports}`
);
process.exit(failed ? 1 : 0);
