#!/usr/bin/env node
/**
 * P0 — Core boot regression: src/core/index.js must load with required exports.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

let core;
try {
  core = await import(path.join(ROOT, 'src/core/index.js'));
} catch (err) {
  console.error('CORE_BOOT_FAILED', err?.message || err);
  process.exit(1);
}

ok(typeof core.resumeDataMeetsImportMinimum === 'function', 'resumeDataMeetsImportMinimum export');
ok(typeof core.canonicalImportFromFile === 'function', 'canonicalImportFromFile export');
ok(typeof core.runHirelyImportFromText === 'function', 'runHirelyImportFromText export');
ok(typeof core.buildResumeData === 'function', 'buildResumeData export');

const html = fs.readFileSync(INDEX_HTML, 'utf8');
ok(/async function getHirelyCore\s*\(/.test(html), 'getHirelyCore defined in index.html');
ok(/UPLOAD_BIND_OK/.test(html), 'UPLOAD_BIND_OK marker in index.html');
ok(/IMPORT_UI_READY/.test(html), 'IMPORT_UI_READY marker in index.html');
ok(/core-boot-loader\.mjs/.test(html), 'getHirelyCore uses core-boot-loader.mjs');
ok(/coreImportFunctionsReady/.test(html), 'tiered import_core gate (not all-or-nothing)');
ok(/Feature unavailable:/.test(html), 'per-feature unavailable copy in index.html');

const sample = {
  identity: { name: 'Jane Doe', email: 'jane@example.com' },
  experiences: [{ role: 'Designer', company: 'Studio', bullets: [] }],
  education: [],
  skills: [],
  clients: [],
};
ok(core.resumeDataMeetsImportMinimum(sample), 'resumeDataMeetsImportMinimum accepts partial CV');

console.log('CORE_BOOT_OK');
console.log('UPLOAD_BIND_OK');
console.log('IMPORT_UI_READY');

if (failed) {
  console.error(`\nCORE_BOOT_FAILED (${failed} check(s))`);
  process.exit(1);
}

console.log('\ntest-core-boot: PASSED');
