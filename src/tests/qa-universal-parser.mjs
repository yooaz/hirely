#!/usr/bin/env node
/**
 * Universal parser stabilization gate — golden resumes + hardcode scan.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUniversalGoldenSuite } from '../../tests/lib/universal-parser-gate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/universal-parser');

let failed = 0;
function fail(msg) {
  console.error('FAIL', msg);
  failed++;
}

async function main() {
  const report = await runUniversalGoldenSuite(null, root);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  if (report.hardcodeViolations?.length) {
    for (const v of report.hardcodeViolations) fail(`hardcode: ${v}`);
  } else {
    console.log('OK no parser hardcode violations');
  }

  for (const c of report.cases || []) {
    if (c.pass) {
      console.log(
        `OK ${c.id} exp=${c.metrics?.experienceCount} edu=${c.metrics?.educationCount} unsorted=${c.metrics?.unsortedCount} loss=${c.metrics?.lossChars}`
      );
    } else {
      fail(`${c.id}: ${c.failures.join('; ')}`);
    }
  }

  console.log(
    `\nUniversal parser: ${report.summary.passed}/${report.summary.total} cases, hardcode=${report.hardcodeViolations.length}`
  );

  if (!report.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
