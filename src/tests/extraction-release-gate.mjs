#!/usr/bin/env node
/**
 * EXTRACTION RELEASE GATE — blocks release/commits until extraction reliability passes.
 * No UI / export / feature tests. See EXTRACTION_FREEZE.md
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  EXTRACTION_RELEASE_THRESHOLDS,
  evaluateDesignerCv,
  evaluateCreativeCv,
  evaluateScannedPdfPath,
} from '../../tests/lib/extraction-release-criteria.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/extraction-release-gate');
const reportPath = join(outDir, 'report.json');

const yoazFixture = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const creativeFixture = join(root, 'tests/fixtures/creative-cv/fixture.txt');

function runScript(rel) {
  const full = join(root, rel);
  execSync(`node "${full}"`, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

/** @type {Array<{ id: string, label: string, pass: boolean, failures: string[], metrics?: object }>} */
const results = [];

function record(id, label, verdict) {
  results.push({
    id,
    label,
    pass: verdict.pass,
    failures: verdict.failures,
    metrics: verdict.metrics,
  });
}

console.log('\n=== EXTRACTION RELEASE GATE ===');
console.log('Mission: extraction reliability only (see EXTRACTION_FREEZE.md)\n');

if (!existsSync(yoazFixture)) {
  results.push({
    id: 'YOAZ_CV_DESIGNER',
    label: 'Designer CV',
    pass: false,
    failures: ['missing tests/fixtures/yoaz-cv/fixture.txt'],
  });
} else {
  const yoaz = readFileSync(yoazFixture, 'utf8');
  record('YOAZ_CV_DESIGNER', 'Designer CV (Yoaz)', evaluateDesignerCv(yoaz));
}

if (!existsSync(creativeFixture)) {
  results.push({
    id: 'CREATIVE_CV',
    label: 'Creative CV',
    pass: false,
    failures: ['missing tests/fixtures/creative-cv/fixture.txt'],
  });
} else {
  const creative = readFileSync(creativeFixture, 'utf8');
  record('CREATIVE_CV', 'Creative CV', evaluateCreativeCv(creative));
}

record('SCANNED_PDF', 'Scanned PDF (OCR text path)', evaluateScannedPdfPath());

try {
  runScript('src/tests/qa-yoaz-two-column.mjs');
  results.push({
    id: 'MULTI_COLUMN_CV',
    label: 'Multi-column CV',
    pass: true,
    failures: [],
  });
} catch (e) {
  const tail = `${e.stdout || ''}\n${e.stderr || ''}`.trim().split('\n').slice(-8).join('\n');
  results.push({
    id: 'MULTI_COLUMN_CV',
    label: 'Multi-column CV',
    pass: false,
    failures: ['qa-yoaz-two-column failed', tail],
  });
}

const pass = results.every((r) => r.pass);

mkdirSync(outDir, { recursive: true });
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      pass,
      frozen: true,
      mission: 'EXTRACTION_RELIABILITY',
      thresholds: EXTRACTION_RELEASE_THRESHOLDS,
      at: new Date().toISOString(),
      results,
    },
    null,
    2
  )
);

for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id} — ${r.label}`);
  if (r.metrics) {
    console.log(
      `      coverage ${r.metrics.coveragePercent}% | exp ${r.metrics.experienceCount} | identity ${r.metrics.identityOk ? r.metrics.name : '—'} | pipeline loss ${r.metrics.pipelineLoss} | parser loss ${r.metrics.parserLossPct}%`
    );
  }
  for (const f of r.failures || []) console.log(`      ✗ ${f}`);
}

console.log(`\nReport: ${reportPath}`);

if (!pass) {
  console.error('\nEXTRACTION_RELEASE_BLOCKED — fix extraction before any product work.\n');
  process.exit(1);
}

console.log('\nEXTRACTION_RELEASE_OK — gate passed. Product work remains frozen until you lift EXTRACTION_FREEZE.md.\n');
