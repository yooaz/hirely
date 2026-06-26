#!/usr/bin/env node
/**
 * Hirely Test Lab QA — 50 CV matrix gate.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runHirelyTestLab,
  HIRELY_TEST_LAB_COUNT,
  TEST_LAB_GOALS,
} from './lib/hirely-test-lab-suite.mjs';
import {
  HIRELY_TEST_LAB_CATALOG,
  HIRELY_TEST_LAB_ENGINE,
} from '../../tests/lib/hirely-test-lab-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(HIRELY_TEST_LAB_CATALOG.length === HIRELY_TEST_LAB_COUNT, `catalog has ${HIRELY_TEST_LAB_COUNT} CVs`);
ok(existsSync(path.join(root, 'test-lab/index.html')), 'test-lab/index.html exists');

const countries = new Set(HIRELY_TEST_LAB_CATALOG.map((c) => c.country));
const languages = new Set(HIRELY_TEST_LAB_CATALOG.map((c) => c.language));
const layouts = new Set(HIRELY_TEST_LAB_CATALOG.map((c) => c.layout));
const categories = new Set(HIRELY_TEST_LAB_CATALOG.map((c) => c.category));

ok(countries.size >= 5, `countries covered: ${countries.size}`);
ok(languages.size >= 3, `languages covered: ${languages.size}`);
ok(layouts.size >= 5, `layouts covered: ${layouts.size}`);
ok(categories.has('developer') || categories.has('graphic-designer'), 'developer/designer category');
ok(categories.has('executive') || HIRELY_TEST_LAB_CATALOG.some((c) => c.role === 'executive'), 'executive cases');
ok(categories.has('linkedin'), 'linkedin cases');
ok(HIRELY_TEST_LAB_CATALOG.some((c) => c.simulateOcr || c.sourceType === 'scanned-pdf'), 'scanned PDF cases');

console.log('\nRunning Hirely Test Lab (50 CVs)…');
const report = await runHirelyTestLab({
  onProgress: (i, total, id) => {
    if (i % 10 === 0 || i === total) process.stdout.write(`  [${i}/${total}] ${id}\n`);
  },
});

ok(report.engine === HIRELY_TEST_LAB_ENGINE, 'report engine version');
ok(report.count === HIRELY_TEST_LAB_COUNT, 'report count');
ok(report.summary?.count === HIRELY_TEST_LAB_COUNT, 'summary count');

ok(report.summary.importSuccessRate >= 85, `import success ${report.summary.importSuccessRate}% (goal ${TEST_LAB_GOALS.importSuccess}%)`);
ok(report.summary.extractionAccuracy >= 70, `extraction ${report.summary.extractionAccuracy}% (goal ${TEST_LAB_GOALS.extractionAccuracy}%)`);
ok(report.summary.templateQuality >= 60, `template quality ${report.summary.templateQuality} (goal ${TEST_LAB_GOALS.templateQuality})`);
ok(report.summary.atsScoreAccuracy >= 85, `ATS accuracy ${report.summary.atsScoreAccuracy}% (goal ${TEST_LAB_GOALS.atsScoreAccuracy}%)`);
ok(report.summary.pdfQuality >= 80, `PDF quality ${report.summary.pdfQuality}% (goal ${TEST_LAB_GOALS.pdfQuality}%)`);

const linkedinRows = report.results.filter((r) => r.category === 'linkedin');
ok(linkedinRows.length >= 5, `linkedin cases run: ${linkedinRows.length}`);

console.log(failed ? `\nqa:hirely-test-lab FAILED (${failed})` : '\nqa:hirely-test-lab PASSED');
console.log(
  `Summary — extraction ${report.summary.extractionAccuracy}% · template ${report.summary.templateQuality} · ATS ${report.summary.atsScoreAccuracy}% · PDF ${report.summary.pdfQuality}%`
);
process.exit(failed ? 1 : 0);
