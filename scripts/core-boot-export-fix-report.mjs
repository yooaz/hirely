#!/usr/bin/env node
/**
 * Generate CORE_BOOT_EXPORT_FIX_REPORT.md from P0 core boot regression.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CORE_BOOT_EXPORT_FIX_REPORT.md');

console.log('Running test:core-boot…');
const boot = spawnSync('node', ['scripts/test-core-boot.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const exportCheck = spawnSync('node', ['scripts/check-core-exports.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const pass = boot.status === 0 && exportCheck.status === 0;
const bootOut = `${boot.stdout || ''}${boot.stderr || ''}`;

const lines = [];
lines.push('# CORE_BOOT_EXPORT_FIX_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
lines.push('');

lines.push('## P0 — Fix missing export core boot');
lines.push('');
lines.push('Fatal error addressed: `resumeDataMeetsImportMinimum` missing from `hirely-flow-lock.js` export surface.');
lines.push('');
lines.push('### Export');
lines.push('- `src/core/pipeline/hirely-flow-lock.js` — `export function resumeDataMeetsImportMinimum(resumeData)`');
lines.push('- Re-exported via `src/core/pipeline/index.js` and `src/core/index.js`');
lines.push('');
lines.push('### Import minimum logic');
lines.push('- `identity.email`');
lines.push('- `identity.phone`');
lines.push('- `identity.name` (non-placeholder)');
lines.push('- `experiences`, `education`, `skills`, or `clients` with at least one item');
lines.push('');
lines.push('### Boot guards');
lines.push('- `reportHirelyCoreStatus()` now requires `canonicalImportFromFile` and `resumeDataMeetsImportMinimum`');
lines.push('- `scripts/test-core-boot.mjs` imports `src/core/index.js` and asserts required exports');
lines.push('');

lines.push('## Acceptance markers');
lines.push('');
for (const marker of ['CORE_BOOT_OK', 'UPLOAD_BIND_OK', 'IMPORT_UI_READY']) {
  const hit = bootOut.includes(marker);
  lines.push(`- ${hit ? '✓' : '✗'} \`${marker}\``);
}
lines.push('');
lines.push('## Forbidden');
lines.push('');
const forbidden = [
  ['CORE_BOOT_FAILED', /CORE_BOOT_FAILED/i.test(bootOut) && boot.status !== 0],
  ['missing export', /does not provide an export named/i.test(bootOut)],
  ['ReferenceError', /ReferenceError/i.test(bootOut)],
  ['SyntaxError', /SyntaxError/i.test(bootOut)],
];
for (const [label, hit] of forbidden) {
  lines.push(`- ${hit ? '✗' : '✓'} No \`${label}\``);
}
lines.push('');

if (!pass) {
  lines.push('## Failure output');
  lines.push('');
  lines.push('```');
  lines.push(bootOut.trim().slice(0, 4000) || '(no output)');
  lines.push('```');
  lines.push('');
}

lines.push('## Run');
lines.push('');
lines.push('```bash');
lines.push('npm run test:core-boot');
lines.push('npm run check:core-exports');
lines.push('npm run core-boot-export-fix-report');
lines.push('```');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
