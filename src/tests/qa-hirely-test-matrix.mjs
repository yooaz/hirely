#!/usr/bin/env node
/**
 * Hirely Test Lab — six-file matrix (import · review · template · export).
 * node src/tests/qa-hirely-test-matrix.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyTestMatrix, TEST_MATRIX_REPORT_JSON } from '../../tests/lib/hirely-test-matrix-runner.mjs';
import {
  HIRELY_TEST_MATRIX_FIXTURES,
  HIRELY_TEST_MATRIX_DIR,
  ensureHirelyTestMatrixFixtures,
} from '../../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

await ensureHirelyTestMatrixFixtures(ROOT);

for (const fx of HIRELY_TEST_MATRIX_FIXTURES) {
  const fp = path.join(ROOT, HIRELY_TEST_MATRIX_DIR, fx.file);
  ok(fs.existsSync(fp), `fixture exists: ${fx.file}`);
}

const report = await runHirelyTestMatrix();
ok(fs.existsSync(TEST_MATRIX_REPORT_JSON), 'report.json written');

for (const row of report.results) {
  const stages = ['import', 'review', 'template', 'export']
    .map((s) => `${s}:${row[s].pass ? 'PASS' : 'FAIL'}`)
    .join(' ');
  ok(row.pass, `${row.file} — ${stages}`);
}

console.log(
  failed
    ? `\nqa:hirely-test-matrix FAILED (${failed})`
    : `\nqa:hirely-test-matrix PASSED (${report.summary.passCount}/${report.count})`
);
process.exit(failed ? 1 : 0);
