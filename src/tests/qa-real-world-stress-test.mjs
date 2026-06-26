#!/usr/bin/env node
/**
 * P0 — Real-world stress test QA gate (50 CVs, 95%+ extraction accuracy).
 */
import {
  runRealWorldStressSuite,
  REAL_WORLD_STRESS_COUNT,
  REAL_WORLD_STRESS_GOAL_PCT,
} from './lib/real-world-stress-suite.mjs';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const report = await runRealWorldStressSuite();
const s = report.summary;

ok(report.count === REAL_WORLD_STRESS_COUNT, `fixture count ${report.count}/${REAL_WORLD_STRESS_COUNT}`);
ok(s.extractionAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `overall extraction ${s.extractionAccuracy}% >= ${REAL_WORLD_STRESS_GOAL_PCT}%`);
ok(s.identityAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `identity accuracy ${s.identityAccuracy}% >= ${REAL_WORLD_STRESS_GOAL_PCT}%`);
ok(s.emailAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `email accuracy ${s.emailAccuracy}% >= ${REAL_WORLD_STRESS_GOAL_PCT}%`);
ok(s.phoneAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `phone accuracy ${s.phoneAccuracy}% >= ${REAL_WORLD_STRESS_GOAL_PCT}%`);
ok(s.experienceAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `experience accuracy ${s.experienceAccuracy}% >= ${REAL_WORLD_STRESS_GOAL_PCT}%`);
ok(s.educationAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `education accuracy ${s.educationAccuracy}% >= ${REAL_WORLD_STRESS_GOAL_PCT}%`);
ok(s.skillsAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `skills accuracy ${s.skillsAccuracy}% >= ${REAL_WORLD_STRESS_GOAL_PCT}%`);

for (const row of report.results.filter((r) => !r.pass)) {
  console.error(
    `FAIL ${row.id}: extraction=${row.extractionAccuracy}% identity=${row.identityAccuracy}% email=${row.emailAccuracy}% phone=${row.phoneAccuracy}% exp=${row.experienceAccuracy}% skills=${row.skillsAccuracy}%`
  );
  failed++;
}

console.log(
  `Real-world stress: ${s.passCount}/${report.count} pass · overall ${s.extractionAccuracy}% · success ${s.successRate}% · failure ${s.failureRate}%`
);
process.exit(failed ? 1 : 0);
