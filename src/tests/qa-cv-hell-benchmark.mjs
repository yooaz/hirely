#!/usr/bin/env node
/**
 * P5 — Real World CV Hell benchmark gate.
 */
import { runP5CvHellBenchSuite, P5_HELL_GOALS } from './lib/p5-cv-hell-bench-suite.mjs';

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
  const report = await runP5CvHellBenchSuite({
    onProgress: (i, total, id) => process.stderr.write(`[cv-hell] ${i}/${total} ${id}…\n`),
  });

  const s = report.summary;
  ok(report.count === 50, `Benchmark size ${report.count}/50`);
  ok(
    s.nameAccuracy > P5_HELL_GOALS.nameAccuracy,
    `Name accuracy ${s.nameAccuracy}% > ${P5_HELL_GOALS.nameAccuracy}%`
  );
  ok(
    s.contactAccuracy > P5_HELL_GOALS.contactAccuracy,
    `Contact accuracy ${s.contactAccuracy}% > ${P5_HELL_GOALS.contactAccuracy}%`
  );
  ok(
    s.experienceAccuracy > P5_HELL_GOALS.experienceAccuracy,
    `Experience accuracy ${s.experienceAccuracy}% > ${P5_HELL_GOALS.experienceAccuracy}%`
  );
  ok(
    s.educationAccuracy > P5_HELL_GOALS.educationAccuracy,
    `Education accuracy ${s.educationAccuracy}% > ${P5_HELL_GOALS.educationAccuracy}%`
  );
  ok(
    s.skillsAccuracy > P5_HELL_GOALS.skillsAccuracy,
    `Skills accuracy ${s.skillsAccuracy}% > ${P5_HELL_GOALS.skillsAccuracy}%`
  );

  console.log('\n--- P5 CV Hell summary ---');
  console.log(`Name:       ${s.nameAccuracy}% (goal >${P5_HELL_GOALS.nameAccuracy}%)`);
  console.log(`Contact:    ${s.contactAccuracy}% (goal >${P5_HELL_GOALS.contactAccuracy}%)`);
  console.log(`Experience: ${s.experienceAccuracy}% (goal >${P5_HELL_GOALS.experienceAccuracy}%)`);
  console.log(`Education:  ${s.educationAccuracy}% (goal >${P5_HELL_GOALS.educationAccuracy}%)`);
  console.log(`Skills:     ${s.skillsAccuracy}% (goal >${P5_HELL_GOALS.skillsAccuracy}%)`);
  console.log(`Tools:      ${s.toolsAccuracy}%`);
  console.log(`Languages:  ${s.languagesAccuracy}%`);
  console.log(`Verdict:    ${s.pass ? 'PASS' : 'FAIL'}`);

  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
