#!/usr/bin/env node
/**
 * GOLDEN YOAZ CV — permanent classification regression.
 * Canonical reference: tests/fixtures/yoaz-cv/fixture.txt
 *
 * Run: npm run golden:yoaz
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGoldenYoazCvGate } from '../../tests/lib/golden-yoaz-cv-gate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/golden-yoaz-cv');
const reportPath = join(outDir, 'report.json');

const gate = runGoldenYoazCvGate({ rootDir: root });

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
      confidenceMin: gate.confidenceMin,
      failures: gate.failures,
      items: gate.items,
    },
    null,
    2
  )
);

console.log('\n=== GOLDEN YOAZ CV — Classification ===\n');
console.log(`Fixture: ${gate.fixture}`);
console.log(`Threshold: ${gate.confidenceMin}%\n`);

for (const item of gate.items) {
  const icon = item.failures.length ? 'FAIL' : 'PASS';
  const sample = item.results?.[0];
  const detail = sample ? `→ ${sample.bucket} (${sample.confidence}%)` : '';
  console.log(`${icon}  ${item.term} → ${item.expectedBucket} ${detail}`);
  for (const f of item.failures) {
    console.log(`      ✗ ${f}`);
  }
}

console.log(`\nReport: ${reportPath}`);

if (!gate.pass) {
  console.error('\nGOLDEN_YOAZ_CV_FAIL — classification regression detected.\n');
  process.exit(1);
}

console.log('\nGOLDEN_YOAZ_CV OK — all canonical mappings hold.\n');
