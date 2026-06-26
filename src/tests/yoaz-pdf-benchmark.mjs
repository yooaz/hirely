#!/usr/bin/env node
/**
 * GOLDEN YOAZ PDF BENCHMARK — permanent parsing regression for cv. Yohann azancot.pdf
 *
 * Run: npm run golden:yoaz-pdf
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runYoazPdfBenchmarkGate } from '../../tests/lib/yoaz-pdf-benchmark-gate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/golden-yoaz-pdf-benchmark');
const reportPath = join(outDir, 'report.json');
const snapshotPath = join(outDir, 'actual-snapshot.json');

const gate = await runYoazPdfBenchmarkGate({ rootDir: root });

mkdirSync(outDir, { recursive: true });
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      pass: gate.pass,
      at: new Date().toISOString(),
      id: gate.id,
      label: gate.label,
      fixture: gate.fixture,
      fixturePdf: gate.fixturePdf,
      pdfProbe: gate.pdfProbe,
      counts: gate.counts,
      failures: gate.failures,
    },
    null,
    2
  )
);
writeFileSync(snapshotPath, JSON.stringify(gate.snapshot, null, 2));

console.log('\n=== GOLDEN YOAZ PDF BENCHMARK ===\n');
console.log(`Fixture PDF: ${gate.fixturePdf}`);
console.log(`Fixture text: ${gate.fixture}`);
console.log(`PDF pages: ${gate.pdfProbe?.pageCount ?? '?'}`);
console.log(`Counts: ${JSON.stringify(gate.counts)}\n`);

if (gate.failures.length) {
  console.log('Failures:');
  for (const f of gate.failures) {
    console.log(`  ✗ ${f}`);
  }
}

console.log(`\nReport: ${reportPath}`);
console.log(`Snapshot: ${snapshotPath}`);

if (!gate.pass) {
  console.error('\nYOAZ_PDF_BENCHMARK_FAIL — parsing regression detected.\n');
  process.exit(1);
}

console.log('\nYOAZ_PDF_BENCHMARK OK — page-1 CV structure holds; page-2 isolated.\n');
