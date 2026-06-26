#!/usr/bin/env node
/**
 * HIRELY P7 — 20 CV stress test report.
 * node scripts/stress-test-report.mjs
 * Output: STRESS_TEST_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runP7StressSuite, buildP7StressMarkdown } from '../src/tests/lib/p7-stress-suite.mjs';
import { P7_GOALS } from '../tests/lib/p7-stress-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'STRESS_TEST_REPORT.md');

async function main() {
  const report = await runP7StressSuite({ writePdfs: true });
  const md = buildP7StressMarkdown(report);
  fs.writeFileSync(OUT_PATH, md);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Full pipeline: ${report.summary.fullPass}/${report.summary.count} (${report.summary.fullPassRate}%)`);

  const s = report.summary;
  const goalsMet =
    s.rates.import >= P7_GOALS.import &&
    s.rates.parser >= P7_GOALS.parser &&
    s.rates.review >= P7_GOALS.review &&
    s.rates.ats >= P7_GOALS.ats &&
    s.rates.pdf >= P7_GOALS.pdf &&
    s.fullPassRate >= P7_GOALS.fullPipeline;

  process.exit(goalsMet ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
