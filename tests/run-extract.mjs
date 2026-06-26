#!/usr/bin/env node
/**
 * Hirely extraction test pack — quality gate for all fixtures.
 * Run: npm run test:extract
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadHirelyParse } from '../src/tests/load-hirely-parse.mjs';
import { loadFixtureEntry } from './lib/load-fixture.mjs';
import { evaluateExtraction, evaluateYoazFixture } from './lib/quality-gate.mjs';
import { linesRemoved } from '../src/debug/stats.js';
import { formatCvAsStructuredText } from '../src/core/export/format-cv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));

function pad(label, value, width = 22) {
  return `${label.padEnd(width)} ${value}`;
}

function printReport(result) {
  const sep = '─'.repeat(52);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`Fixture: ${result.id}`);
  console.log(sep);
  console.log(pad('file name:', result.fileName));
  console.log(pad('document type:', result.documentType));
  console.log(pad('extraction method:', result.extractionMethod));
  console.log(pad('raw text length:', result.rawLength));
  console.log(pad('cleaned text length:', result.cleanLength));
  console.log(pad('rejected lines count:', result.rejectedLines));
  console.log(
    pad(
      'structured completeness:',
      `${result.completeness.percent}% (${result.completeness.filled.join(', ')})`
    )
  );
  console.log(
    pad(
      'missing critical fields:',
      result.missingCritical.length ? result.missingCritical.join(', ') : '(none)'
    )
  );
  if (result.failures.length) {
    console.log(pad('failures:', result.failures.join('; ')));
  }
  if (result.reviews.length) {
    console.log(pad('review notes:', result.reviews.join('; ')));
  }
  console.log(pad('final status:', result.status));
}

async function runFixture(Parse, entry) {
  const fx = loadFixtureEntry(root, entry);
  const extractionMethod =
    fx.binaryName && process.env.HIRELY_USE_BINARY_FIXTURES === '1'
      ? fx.expectedMethod
      : `${fx.expectedMethod} (fixture.txt)`;

  const pipe = await Parse.runExtractionPipeline(fx.rawText, {
    extractionMethod: fx.expectedMethod,
  });

  const cv = pipe.validatedCVData || {};
  const removed = linesRemoved(pipe.rawText, pipe.cleanedText);
  const finalText = formatCvAsStructuredText(cv);
  const audit = pipe.audit || Parse.auditPipeline(pipe.rawText, pipe.cleanedText, cv, finalText);

  const gate = evaluateExtraction({
    cv,
    audit,
    rejectedLinesCount: removed.count,
  });

  if (fx.id === 'yoaz-cv') {
    const yoazFails = evaluateYoazFixture(cv, pipe.cleanedText);
    gate.failures.push(...yoazFails);
    if (yoazFails.length) gate.status = 'FAIL';
  }

  return {
    id: fx.id,
    fileName: fx.fileName,
    documentType: fx.documentType,
    extractionMethod,
    rawLength: String(pipe.rawText?.length ?? 0),
    cleanLength: String(pipe.cleanedText?.length ?? 0),
    rejectedLines: String(removed.count),
    completeness: gate.completeness,
    missingCritical: gate.missingCritical,
    failures: gate.failures,
    reviews: gate.reviews,
    status: gate.status,
    cv,
  };
}

function selfTestQualityGate() {
  const blank = evaluateExtraction({ cv: {}, audit: null });
  if (blank.status !== 'FAIL' || !blank.failures.includes('blank CV')) {
    throw new Error('gate self-test: blank CV must FAIL');
  }
  const eduContact = evaluateExtraction({
    cv: {
      name: 'Test User',
      experience: ['PM at Acme'],
      education: ['marie@test.com'],
    },
    audit: null,
  });
  if (eduContact.status !== 'FAIL' || !eduContact.failures.some((f) => f.includes('education'))) {
    throw new Error('gate self-test: contact in education must FAIL');
  }
}

async function main() {
  console.log('HIRELY EXTRACTION TEST PACK');
  console.log(`Fixtures: ${manifest.length} · Gate: PASS | NEEDS_REVIEW | FAIL\n`);

  selfTestQualityGate();

  const Parse = await loadHirelyParse();
  const results = [];

  for (const entry of manifest) {
    results.push(await runFixture(Parse, entry));
  }

  for (const r of results) {
    printReport(r);
  }

  const fail = results.filter((r) => r.status === 'FAIL');
  const review = results.filter((r) => r.status === 'NEEDS_REVIEW');
  const pass = results.filter((r) => r.status === 'PASS');

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`SUMMARY  PASS ${pass.length}  NEEDS_REVIEW ${review.length}  FAIL ${fail.length}`);

  if (fail.length) {
    console.error('\nQuality gate FAILED. Fix extraction/parsing before UI work.');
    fail.forEach((r) => console.error(`  ✗ ${r.id}: ${r.failures.join(', ')}`));
    process.exit(1);
  }

  if (review.length) {
    console.warn('\nSome fixtures need review (non-blocking):');
    review.forEach((r) => console.warn(`  ⚠ ${r.id}: ${r.reviews.join('; ')}`));
  }

  console.log('\nQuality gate passed.');
  process.exit(0);
}

main().catch((e) => {
  console.error('test:extract crashed:', e.message);
  process.exit(1);
});
