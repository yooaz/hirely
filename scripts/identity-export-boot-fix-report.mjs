#!/usr/bin/env node
/**
 * P0 — Generate IDENTITY_EXPORT_BOOT_FIX_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IDENTITY_EXPORT_BOOT_FIX_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/identity-export-boot/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa =
  process.env.HIRELY_SKIP_QA === '1' ? { pass: null } : run('node', ['src/tests/qa-identity-export-boot.mjs']);
const checkExports = run('npm', ['run', 'check:exports']);
const checkCore = run('npm', ['run', 'check:core']);
const build = run('npm', ['run', 'build']);

const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const pass =
  report?.pass === true &&
  checkExports.pass &&
  checkCore.pass &&
  build.pass &&
  (qa.pass === true || qa.pass === null);

const lines = [
  '# IDENTITY_EXPORT_BOOT_FIX_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Fix:** \`${report?.version || 'IDENTITY_EXPORT_BOOT_FIX_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Fatal error addressed',
  '',
  '```',
  'CORE_BOOT_FAILED',
  '../parsing/identity-extraction.js does not provide an export named looksLikeCompanyOrAgencyName',
  '```',
  '',
  '## Root cause',
  '',
  '- `looksLikeCompanyOrAgencyName` is defined in `src/core/parsing/identity-extraction.js` (line ~152)',
  '- Validation modules import it directly; it was missing from the `parsing/index.js` barrel',
  '- `identity-contact-strictness.js` imported `no-fake-data-policy.js`, creating a load-order chain that could surface as a missing export during browser boot',
  '',
  '## Fixes applied',
  '',
  '| Change | File |',
  '|--------|------|',
  '| Confirmed `export function looksLikeCompanyOrAgencyName` | `identity-extraction.js` |',
  '| Added barrel re-exports (`looksLikeCompanyOrAgencyName`, `nameCollidesWithEmployers`, `COMPANY_LIKE_NAME_RE`) | `parsing/index.js` |',
  '| Removed `no-fake-data-policy` import cycle from strictness layer | `identity-contact-strictness.js` |',
  '| Merged duplicate identity-extraction imports | `sanitize-resume-display.js` |',
  '',
  '## Verification',
  '',
  '| Command | Result |',
  '|---------|--------|',
  `| \`npm run check:exports\` | ${checkExports.pass ? 'PASS' : 'FAIL'} |`,
  `| \`npm run check:core\` | ${checkCore.pass ? 'PASS' : 'FAIL'} |`,
  `| \`npm run build\` | ${build.pass ? 'PASS' : 'FAIL'} |`,
  `| \`npm run qa:identity-export-boot\` | ${report?.pass ? 'PASS' : report ? 'FAIL' : 'skipped'} |`,
  '',
  '## Browser acceptance',
  '',
  '| Marker | Required |',
  '|--------|----------|',
  '| `CORE_BOOT_OK` | yes |',
  '| `UPLOAD_BIND_OK` | yes |',
  '| `IMPORT_UI_READY` / import handlers bound | yes |',
  '| `CORE_BOOT_FAILED` | forbidden |',
  '',
];

if (report?.checks?.length) {
  lines.push('## QA checklist', '', '| Check | Status |', '|-------|--------|');
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');
}

lines.push(
  '## Importers of `looksLikeCompanyOrAgencyName`',
  '',
  '- `src/core/validation/sanitize-resume-display.js`',
  '- `src/core/validation/identity-contact-strictness.js`',
  '- `src/core/validation/no-fake-data-policy.js`',
  '- `src/core/validation/confidence-gate.js`',
  '',
  '## Run',
  '',
  '```bash',
  'npm run check:exports',
  'npm run check:core',
  'npm run build',
  'npm run qa:identity-export-boot',
  'npm run identity-export-boot-fix-report',
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
