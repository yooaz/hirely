#!/usr/bin/env node
/**
 * Verify local OCR assets — copy/download missing vendored Tesseract files.
 * No CDN at runtime; this script may fetch traineddata once during setup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TESSERACT_REQUIRED_ASSETS } from '../src/vendor/tesseract-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function rel(p) {
  return p.replace(/^\//, '');
}

function verifyAssets() {
  const rows = [];
  let ok = true;
  for (const assetPath of TESSERACT_REQUIRED_ASSETS) {
    const fp = path.join(ROOT, rel(assetPath));
    const exists = fs.existsSync(fp);
    const size = exists ? fs.statSync(fp).size : 0;
    const valid = exists && size > 1000;
    if (!valid) ok = false;
    rows.push({ path: assetPath, exists, size, valid });
  }
  return { ok, rows };
}

function main() {
  let report = verifyAssets();
  if (!report.ok) {
    console.log('OCR assets missing — running setup-vendor-tesseract…');
    const res = spawnSync('node', ['scripts/setup-vendor-tesseract.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (res.status !== 0) {
      console.error('OCR_SETUP_FAILED: setup-vendor-tesseract exited', res.status);
      process.exit(1);
    }
    report = verifyAssets();
  }

  console.log('\nOCR asset paths:');
  for (const row of report.rows) {
    const status = row.valid ? 'OK' : 'MISSING';
    console.log(`  [${status}] ${row.path} (${row.size}b)`);
  }

  const diag = {
    OCR_ASSET_PATH: '/vendor/tesseract/tesseract.min.js',
    OCR_WORKER_PATH: '/vendor/tesseract/worker.min.js',
    OCR_WASM_PATH: '/vendor/tesseract/core/tesseract-core-simd-lstm.wasm',
    OCR_LANG_PATH: '/vendor/tesseract/lang',
    OCR_WORKER_LOADED: report.rows.find((r) => r.path.endsWith('worker.min.js'))?.valid || false,
    OCR_WASM_LOADED:
      report.rows.find((r) => r.path.endsWith('tesseract-core-simd-lstm.wasm'))?.valid || false,
    OCR_LANG_LOADED:
      (report.rows.find((r) => r.path.endsWith('eng.traineddata.gz'))?.valid || false) &&
      (report.rows.find((r) => r.path.endsWith('fra.traineddata.gz'))?.valid || false),
  };
  console.log('\nOCR setup diagnostics:');
  for (const [k, v] of Object.entries(diag)) {
    console.log(`  ${k} ${v}`);
  }

  if (!report.ok) {
    console.error('\nOCR_ASSETS_MISSING — local OCR cannot run. Fix paths above.');
    process.exit(1);
  }
  console.log('\nOCR setup PASS — local browser OCR can run.');
}

main();
