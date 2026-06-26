#!/usr/bin/env node
/**
 * HIRELY H7 — PDF hardening report.
 * Output: PDF_HARDENING_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runPdfHardeningSuite,
  buildHardeningMarkdown,
  ROOT,
} from '../src/tests/lib/pdf-hardening-suite.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'PDF_HARDENING_REPORT.md');
const COUNT = Number(process.env.H7_COUNT || 100);

console.log(`pdf-hardening-report: ${COUNT} exports…`);
const report = await runPdfHardeningSuite({ count: COUNT });
const md = buildHardeningMarkdown(report);
fs.writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`Verdict: ${report.summary.pass ? 'PASS' : 'FAIL'} (${report.summary.passed}/${report.summary.total})`);
process.exit(report.summary.pass ? 0 : 1);
