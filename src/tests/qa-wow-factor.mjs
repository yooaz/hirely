#!/usr/bin/env node
/**
 * Wow Factor Pass — smoke checks for premium UI hooks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(index.includes('hirely-wow-factor.css'), 'wow-factor CSS linked');
ok(index.includes('hirely-wow-factor.js'), 'wow-factor JS loaded');
ok(index.includes('HirelyWow?.onStepChange'), 'setDocStep hook');
ok(index.includes('HirelyWow?.onImportStart'), 'import start hook');
ok(index.includes('HirelyWow?.onScoreReport'), 'score panel hook');
ok(index.includes('HirelyWow?.decorateExtractionQuality'), 'confidence hook');
ok(fs.existsSync(path.join(ROOT, 'src/ui/hirely-wow-factor.css')), 'wow-factor CSS file');
ok(fs.existsSync(path.join(ROOT, 'src/ui/hirely-wow-factor.js')), 'wow-factor JS file');
ok(fs.existsSync(path.join(ROOT, 'WOW_FACTOR_PASS.md')), 'WOW_FACTOR_PASS.md');

if (failed) {
  process.exitCode = 1;
  console.error(`\n${failed} wow factor check(s) failed`);
} else {
  console.log('\nAll wow factor smoke checks passed');
}
