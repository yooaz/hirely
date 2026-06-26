#!/usr/bin/env node
/**
 * HIRELY H8 — Generalization stress report.
 * Output: GENERALIZATION_STRESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runH8StressSuite, buildH8StressMarkdown, ROOT } from '../src/tests/lib/h8-stress-suite.mjs';

const OUT = path.join(ROOT, 'GENERALIZATION_STRESS_REPORT.md');

console.log('generalization-stress-report: 100 CV corpus…');
const report = await runH8StressSuite({ writePdfs: true });
const md = buildH8StressMarkdown(report);
fs.writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(
  `Verdict: ${report.summary.pass ? 'PASS' : 'FAIL'} (${report.summary.extracted}/${report.summary.count} extracted, ${report.summary.extractionRate}%)`
);
process.exit(report.summary.pass ? 0 : 1);
