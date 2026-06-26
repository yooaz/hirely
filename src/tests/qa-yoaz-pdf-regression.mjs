#!/usr/bin/env node
/**
 * Yohann Azancot PDF — hard regression suite (target + hard failures + purity).
 *
 * Encodes expected target behavior AND documents known broken production path.
 * Tests are expected to FAIL until the parser pipeline is fixed — do not weaken assertions.
 *
 * node src/tests/qa-yoaz-pdf-regression.mjs
 * node src/tests/qa-yoaz-pdf-regression.mjs --only=spatial
 * node src/tests/qa-yoaz-pdf-regression.mjs --only=production
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probePdfFixture } from '../../tests/lib/yoaz-pdf-benchmark-gate.mjs';
import {
  loadYoazTargetManifest,
  runYoazSpatialRegression,
  runYoazProductionRegression,
  validateTargetBehavior,
  validateHardFailures,
  validatePageClassification,
  validateSectionPurity,
  diffNormalizedSnapshots,
} from '../../tests/lib/yoaz-pdf-regression-eval.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/yoaz-pdf-regression');
mkdirSync(outDir, { recursive: true });

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1] : 'all';

const target = loadYoazTargetManifest(root);
const targetSnapshot = JSON.parse(
  readFileSync(join(root, 'tests/golden/yoaz-pdf-normalized.target.snapshot.json'), 'utf8')
);

/** @type {{ suite: string, path: string, pass: boolean, failures: string[] }[]} */
const results = [];
let exitCode = 0;

function record(suite, path, failures) {
  const pass = failures.length === 0;
  results.push({ suite, path, pass, failures });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`\n[${tag}] ${suite} @ ${path}`);
  if (failures.length) {
    for (const f of failures) console.log(`  ✗ ${f}`);
    exitCode = 1;
  } else {
    console.log('  (all assertions met)');
  }
}

async function main() {
  console.log('\n=== YOAZ PDF HARD REGRESSION ===\n');
  console.log(`Target spec: tests/golden/yoaz-pdf-target.expected.json`);
  console.log(`Snapshot:    tests/golden/yoaz-pdf-normalized.target.snapshot.json`);

  const pdfProbe = await probePdfFixture(root, join(root, 'tests/golden/yoaz-pdf-target.expected.json'));
  const pdfFailures = [];
  if (!pdfProbe.ok) pdfFailures.push(pdfProbe.error || 'PDF missing');
  else if (pdfProbe.pageCount !== target.pdfPageCount) {
    pdfFailures.push(`PDF pages: expected ${target.pdfPageCount}, got ${pdfProbe.pageCount}`);
  }
  record('FIXTURE pdf present', 'document.pdf', pdfFailures);

  if (!existsSync(join(root, target.fixturePdf))) {
    console.error(`\nMissing mandatory fixture: ${target.fixturePdf}`);
    process.exit(1);
  }

  if (only === 'all' || only === 'spatial') {
    const spatial = await runYoazSpatialRegression(root);
    const segments = spatial.detected.sectionSegmentation?.segments || [];

    writeFileSync(
      join(outDir, 'snapshot-spatial-current.json'),
      JSON.stringify(spatial.normalized, null, 2)
    );
    writeFileSync(
      join(outDir, 'snapshot-spatial-detected.json'),
      JSON.stringify(
        {
          experienceItems: spatial.detected.experienceItems,
          educationItems: spatial.detected.educationItems,
          skillItems: spatial.detected.skillItems,
          portfolio_items: spatial.detected.portfolio_items,
          pageDocumentClassification: spatial.detected.pageDocumentClassification,
        },
        null,
        2
      )
    );

    record(
      'PAGE_CLASSIFICATION',
      'spatial',
      validatePageClassification(spatial.detected.pageDocumentClassification, target)
    );

    record(
      'SECTION_PURITY',
      'spatial',
      validateSectionPurity(segments, spatial.lines, target, {
        pageLayouts: spatial.detected.pageLayouts?.pages || spatial.detected.pageLayouts || [],
      })
    );

    record(
      'HARD_FAILURES',
      'spatial',
      validateHardFailures(spatial.normalized, target, { segments })
    );

    record(
      'TARGET_BEHAVIOR',
      'spatial',
      validateTargetBehavior(spatial.normalized, target)
    );

    const snapshotGaps = diffNormalizedSnapshots(spatial.normalized, targetSnapshot);
    record(
      'SNAPSHOT_DIFF',
      'spatial',
      snapshotGaps.length ? snapshotGaps.map((g) => `snapshot gap: ${g}`) : []
    );
  }

  if (only === 'all' || only === 'production') {
    const production = await runYoazProductionRegression(root);

    writeFileSync(
      join(outDir, 'snapshot-production-current.json'),
      JSON.stringify(production.normalized, null, 2)
    );
    writeFileSync(
      join(outDir, 'snapshot-production-broken-baseline.json'),
      JSON.stringify(
        {
          note: 'Known broken production_flat path — flat fixture.txt without spatial coordinates',
          normalized: production.normalized,
          gate_failures_sample: production.parsed.snapshot,
        },
        null,
        2
      )
    );

    record(
      'HARD_FAILURES',
      'production_flat',
      validateHardFailures(production.normalized, target, {
        cleanedText: production.cleanedText,
        skipFlatColumnMerge:
          production.parsed.importResult?.resumeData?.meta?.blockParserBridgeApplied === true,
      })
    );

    record(
      'TARGET_BEHAVIOR',
      'production_flat',
      validateTargetBehavior(production.normalized, target)
    );

    const snapshotGaps = diffNormalizedSnapshots(production.normalized, targetSnapshot);
    record(
      'SNAPSHOT_DIFF',
      'production_flat',
      snapshotGaps.length ? snapshotGaps.map((g) => `snapshot gap: ${g}`) : []
    );

    const knownBroken = [];
    if (production.normalized.contact?.full_name === 'Art Snowboard') {
      knownBroken.push('DOCUMENTED_BROKEN: identity merged with interests (Art Snowboard)');
    }
    if ((production.normalized.experiences || []).length < 3) {
      knownBroken.push(
        `DOCUMENTED_BROKEN: experience count ${(production.normalized.experiences || []).length} (target 3)`
      );
    }
    console.log('\n--- production known broken (baseline) ---');
    for (const line of knownBroken) console.log(`  • ${line}`);
  }

  const summary = {
    generated_at: new Date().toISOString(),
    target: 'tests/golden/yoaz-pdf-target.expected.json',
    only,
    pass: exitCode === 0,
    results,
  };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(summary, null, 2));

  console.log('\n--- summary ---');
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.suite} @ ${r.path}`);
  }
  console.log(`\nOutputs: ${outDir}/`);
  console.log(`  snapshot-spatial-current.json`);
  console.log(`  snapshot-production-current.json`);
  console.log(`  report.json`);

  if (exitCode !== 0) {
    console.error('\nYOAZ_PDF_REGRESSION_FAIL — target not met (expected until pipeline fix).\n');
    process.exit(1);
  }
  console.log('\nYOAZ_PDF_REGRESSION OK\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
