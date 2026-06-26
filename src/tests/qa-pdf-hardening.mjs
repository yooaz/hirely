#!/usr/bin/env node
/**
 * HIRELY H7 — PDF export hardening (100 generated resumes).
 * PASS only if 100/100 exports succeed.
 */
import { runPdfHardeningSuite } from './lib/pdf-hardening-suite.mjs';

const COUNT = Number(process.env.H7_COUNT || 100);

console.log(`qa-pdf-hardening: running ${COUNT} exports…`);
const report = await runPdfHardeningSuite({ count: COUNT });

for (const r of report.results) {
  if (!r.pass) {
    console.error(
      `FAIL ${r.id} ${r.templateId} — ${(r.issues || []).join(', ') || r.error}`
    );
  }
}

console.log(
  `\n═══ H7 PDF Hardening: ${report.summary.passed}/${report.summary.total} ${
    report.summary.pass ? 'PASS' : 'FAIL'
  } ═══`
);

process.exit(report.summary.pass ? 0 : 1);
