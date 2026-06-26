#!/usr/bin/env node
/**
 * Core export contract — fails fast if pipeline barrel is incomplete.
 * node scripts/check-core-exports.mjs
 */
import * as pipeline from '../src/core/pipeline/index.js';
import * as core from '../src/core/index.js';

const REQUIRED_PIPELINE = [
  'sanitizeResumeForDisplay',
  'runHirelyPipeline',
  'buildResumeData',
  'buildFinalResumeData',
  'scoreResume',
  'generateCoverLetter',
  'validateExportLock',
  'resumeDataMeetsImportMinimum',
];

const REQUIRED_CORE = [
  'sanitizeResumeForDisplay',
  'runHirelyImportFromText',
  'buildResumeData',
  'buildFinalResumeData',
  'importText',
  'validateExportLock',
  'resumeDataMeetsImportMinimum',
];

let failed = 0;

function check(mod, name, label) {
  const ok = typeof mod[name] === 'function';
  if (!ok) {
    console.error(`MISSING ${label}: ${name}`);
    failed++;
  } else {
    console.log(`OK ${label}: ${name}`);
  }
  return ok;
}

console.log('check:core — pipeline barrel');
for (const name of REQUIRED_PIPELINE) {
  check(pipeline, name, 'pipeline');
}

console.log('check:core — core facade');
for (const name of REQUIRED_CORE) {
  check(core, name, 'core');
}

if (failed) {
  console.error(`\ncheck:core FAILED (${failed} missing export(s))`);
  process.exit(1);
}

console.log('\ncheck:core PASSED');
