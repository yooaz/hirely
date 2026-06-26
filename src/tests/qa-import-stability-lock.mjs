#!/usr/bin/env node
/**
 * IMPORT_STABILITY_LOCK — all import gate reports must be PASS before template work.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  IMPORT_STABILITY_LOCK_VERSION,
  REQUIRED_IMPORT_STABILITY_REPORTS,
  assessImportStabilityLock,
  assertImportStabilityForTemplateWork,
} from '../core/import/import-stability-lock.js';
import { checkTemplateImportGate } from '../ui/templates/template-import-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/import-stability-lock/report.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const lock = assessImportStabilityLock(ROOT);
const gate = checkTemplateImportGate(ROOT);

ok(lock.version === IMPORT_STABILITY_LOCK_VERSION, 'lock version');
ok(REQUIRED_IMPORT_STABILITY_REPORTS.length === 4, 'four required reports');

for (const report of lock.reports) {
  ok(report.pass, `${report.id} → ${report.reportFile} (${report.status})`);
}

ok(lock.pass, 'import stability lock PASS');
ok(lock.templateWorkAllowed, 'template work allowed');
ok(gate.pass, 'template import gate PASS');

let assertOk = false;
try {
  assertImportStabilityForTemplateWork(ROOT);
  assertOk = true;
} catch (err) {
  ok(false, `assertImportStabilityForTemplateWork: ${err.message}`);
}
ok(assertOk, 'assertImportStabilityForTemplateWork does not throw');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      version: IMPORT_STABILITY_LOCK_VERSION,
      pass: failed === 0 && lock.pass,
      lock,
      templateWorkAllowed: lock.templateWorkAllowed,
    },
    null,
    2
  )
);

console.log('\nWrote', OUT);
console.log(failed ? `\n${failed} failed` : '\nIMPORT_STABILITY_LOCK_OK');
process.exit(failed ? 1 : 0);
