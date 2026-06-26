#!/usr/bin/env node
/**
 * P0 — looksLikeCompanyOrAgencyName export + core boot contract.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { looksLikeCompanyOrAgencyName as directExport } from '../core/parsing/identity-extraction.js';
import { looksLikeCompanyOrAgencyName as barrelExport } from '../core/parsing/index.js';
import * as core from '../core/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/identity-export-boot');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

record('direct_export_function', typeof directExport === 'function');
record('barrel_export_function', typeof barrelExport === 'function');
record('core_star_export_function', typeof core.looksLikeCompanyOrAgencyName === 'function');
record('core_boot_import', typeof core.runHirelyImportFromText === 'function');
record('reject_company', directExport('Lontac Impressions') === true);
record('accept_person', directExport('Sophie Martin') === false);

const strictness = await import('../core/validation/identity-contact-strictness.js');
record('strictness_module_loads', typeof strictness.enforceIdentityContactStrictness === 'function');

const display = await import('../core/validation/sanitize-resume-display.js');
record('sanitize_module_loads', typeof display.sanitizeResumeForDisplay === 'function');

const boot = spawnSync('node', ['scripts/test-browser-boot-upload.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 120000,
});
const bootOut = `${boot.stdout || ''}\n${boot.stderr || ''}`;
record('browser_core_boot_ok', /CORE_BOOT_OK/.test(bootOut), boot.status === 0 ? 'exit 0' : `exit ${boot.status}`);
record('browser_upload_bind_ok', /UPLOAD_BIND_OK/.test(bootOut));
record('browser_import_ui_ready', /IMPORT_UI_READY|import handlers bound/.test(bootOut));
record('browser_no_core_boot_failed', !/CORE_BOOT_FAILED/.test(bootOut));

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: 'IDENTITY_EXPORT_BOOT_FIX_V1',
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  checks,
  bootExit: boot.status,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(failed ? `\n${failed} failed` : '\nidentity export boot QA passed');
process.exit(failed ? 1 : 0);
