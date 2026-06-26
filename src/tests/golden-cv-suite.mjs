#!/usr/bin/env node
/**
 * GOLDEN CV TEST SUITE — blocks release/commits when canonical CVs regress.
 * Run: npm test | npm run golden:cv
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGoldenCvSuite } from '../../tests/lib/golden-cv-gate.mjs';
import { runGoldenYoazCvGate } from '../../tests/lib/golden-yoaz-cv-gate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = join(root, 'tests/golden/cv-expectations.json');
const outDir = join(root, 'tests/output/golden-cv');
const reportPath = join(outDir, 'report.json');

if (!existsSync(manifestPath)) {
  console.error('GOLDEN_CV_FAIL missing manifest', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const suite = runGoldenCvSuite(manifest, root);
const yoazGate = runGoldenYoazCvGate({ rootDir: root });

mkdirSync(outDir, { recursive: true });
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      pass: suite.pass && yoazGate.pass,
      at: new Date().toISOString(),
      manifestVersion: suite.manifestVersion,
      results: suite.results,
      yoazClassification: {
        pass: yoazGate.pass,
        failures: yoazGate.failures,
        items: yoazGate.items,
      },
    },
    null,
    2
  )
);

console.log('\n=== GOLDEN CV SUITE ===\n');

for (const r of suite.results) {
  const icon = r.pass ? 'PASS' : 'FAIL';
  console.log(`${icon}  ${r.id} — ${r.label}`);
  if (r.metrics) {
    console.log(
      `      name: ${r.metrics.name}`,
      `| title: ${r.metrics.title}`,
      `| exp: ${r.metrics.experienceCount}`,
      `| skills: ${r.metrics.skillsCount}`,
      `| langs: ${r.metrics.languageCount}`,
      `| coverage: ${r.metrics.coveragePercent}%`
    );
  }
  for (const f of r.failures || []) {
    console.log(`      ✗ ${f}`);
  }
}

console.log('\n--- Yoaz classification golden ---\n');
console.log(yoazGate.pass ? 'PASS' : 'FAIL', `${yoazGate.id} — ${yoazGate.label}`);
for (const item of yoazGate.items || []) {
  if (!item.failures?.length) continue;
  for (const f of item.failures) console.log(`      ✗ ${f}`);
}

console.log(`\nReport: ${reportPath}`);

if (!suite.pass || !yoazGate.pass) {
  if (!yoazGate.pass) {
    console.error('\nGOLDEN_CV_FAIL YOAZ_CV_DESIGNER classification — build blocked.\n');
  } else {
    console.error('\nGOLDEN_CV_FAIL — build blocked.\n');
  }
  process.exit(1);
}

console.log('\nGOLDEN_CV_SUITE OK — all cases passed.\n');
