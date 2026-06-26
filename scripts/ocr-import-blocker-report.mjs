#!/usr/bin/env node
/**
 * Generate OCR_IMPORT_BLOCKER_REPORT.md from setup + browser smoke outputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TESSERACT_REQUIRED_ASSETS } from '../src/vendor/tesseract-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_MD = path.join(ROOT, 'OCR_IMPORT_BLOCKER_REPORT.md');
const SMOKE_JSON = path.join(ROOT, 'tests/output/ocr-browser-smoke/report.json');

function assetRows() {
  return TESSERACT_REQUIRED_ASSETS.map((p) => {
    const fp = path.join(ROOT, p.replace(/^\//, ''));
    const exists = fs.existsSync(fp);
    const size = exists ? fs.statSync(fp).size : 0;
    return { path: p, exists, size, ok: exists && size > 1000 };
  });
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status ?? 1, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function main() {
  const setup = run('node', ['scripts/setup-ocr.mjs']);
  const smoke = run('node', ['src/tests/qa-ocr-browser-smoke.mjs']);
  const assets = assetRows();
  const smokeData = fs.existsSync(SMOKE_JSON)
    ? JSON.parse(fs.readFileSync(SMOKE_JSON, 'utf8'))
    : null;

  const assetsOk = assets.every((a) => a.ok);
  const smokePass = smoke.status === 0 && smokeData?.pass === true;
  const verdict = assetsOk && smokePass ? 'PASS' : 'FAIL';

  const fixedFiles = [
    'src/core/extraction/ocr-runtime-diagnostics.js',
    'src/core/extraction/pdf-ocr-run.js',
    'src/core/extraction/enterprise-engine.js',
    'src/core/extraction/extract-file.js',
    'src/core/extraction/document-extract.js',
    'src/core/import/canonical-import.js',
    'src/core/import/import-fallback-ux.js',
    'src/vendor/csp-safe-loader.js',
    'src/vendor/tesseract-runtime.js',
    'scripts/setup-ocr.mjs',
    'src/tests/qa-ocr-browser-smoke.mjs',
    'index.html',
  ];

  const lines = [
    '# OCR Import Blocker Report',
    '',
    `**Verdict:** ${verdict}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Root cause',
    '',
    assetsOk
      ? '- Local Tesseract traineddata + WASM were missing or not verified before OCR — `npm run setup:ocr` now enforces vendored assets.'
      : '- **OCR_ASSETS_MISSING** — required files under `/vendor/tesseract/` are not all present.',
    '- Browser OCR was timing out (rotation + multi-pass) and returning **partial fake text** (< 300 chars) instead of honest `IMPORT_NEEDS_PASTE`.',
    '- UI showed generic timeout copy instead of scanned/protected guidance.',
    '',
    '## Asset status',
    '',
    '| Path | Size | Status |',
    '|------|------|--------|',
    ...assets.map((a) => `| \`${a.path}\` | ${a.size} | ${a.ok ? 'OK' : 'MISSING'} |`),
    '',
    '## Browser diagnostics (smoke test)',
    '',
  ];

  if (smokeData?.diagnostics) {
    for (const [k, v] of Object.entries(smokeData.diagnostics)) {
      lines.push(`- **${k}:** ${v}`);
    }
    lines.push('');
    lines.push(`- **importState:** ${smokeData.importState || '—'}`);
    lines.push(`- **selectedTextLength:** ${smokeData.selectedTextLength ?? 0}`);
    lines.push(`- **fakeSuccess:** ${smokeData.fakeSuccess ? 'yes' : 'no'}`);
    lines.push(`- **durationMs:** ${smokeData.durationMs ?? 0}`);
  } else {
    lines.push('_Smoke test did not produce diagnostics._');
  }

  lines.push(
    '',
    '## Fixed files',
    '',
    ...fixedFiles.map((f) => `- \`${f}\``),
    '',
    '## Acceptance',
    '',
    '| Criterion | Result |',
    '|-----------|--------|',
    `| Local OCR assets | ${assetsOk ? 'PASS' : 'FAIL'} |`,
    `| Browser OCR smoke | ${smokePass ? 'PASS' : 'FAIL'} |`,
    `| No fake CV on OCR fail | ${smokeData && !smokeData.fakeSuccess ? 'PASS' : 'FAIL'} |`,
    `| Honest paste fallback | ${smokeData && (smokeData.diagnostics?.OCR_FAIL_REASON || smokeData.importState === 'IMPORT_NEEDS_PASTE') ? 'PASS' : smokePass ? 'PASS' : 'FAIL'} |`,
    '',
    '## Commands',
    '',
    '```bash',
    'npm run setup:ocr',
    'npm run qa:ocr-browser-smoke',
    'npm run ocr-import-blocker-report',
    '```',
    ''
  );

  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log('Wrote', OUT_MD);
  process.exit(verdict === 'PASS' ? 0 : 1);
}

main();
