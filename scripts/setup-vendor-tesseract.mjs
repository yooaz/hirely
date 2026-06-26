#!/usr/bin/env node
/**
 * Copy Tesseract.js + core WASM + traineddata into vendor/tesseract (no CDN at runtime).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor', 'tesseract');
const NM = path.join(ROOT, 'node_modules');
const TESS = path.join(NM, 'tesseract.js');
const CORE = path.join(NM, 'tesseract.js-core');

const LANG_URLS = {
  'eng.traineddata.gz':
    'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  'fra.traineddata.gz':
    'https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz',
};

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  if (!fs.existsSync(TESS)) {
    console.error('Missing tesseract.js — run npm install');
    process.exit(1);
  }
  if (!fs.existsSync(CORE)) {
    console.error('Missing tesseract.js-core — run npm install');
    process.exit(1);
  }

  const pairs = [
    [path.join(TESS, 'dist', 'tesseract.min.js'), path.join(VENDOR, 'tesseract.min.js')],
    [path.join(TESS, 'dist', 'worker.min.js'), path.join(VENDOR, 'worker.min.js')],
    [
      path.join(CORE, 'tesseract-core-simd-lstm.wasm.js'),
      path.join(VENDOR, 'core', 'tesseract-core-simd-lstm.wasm.js'),
    ],
    [
      path.join(CORE, 'tesseract-core-simd-lstm.wasm'),
      path.join(VENDOR, 'core', 'tesseract-core-simd-lstm.wasm'),
    ],
    [
      path.join(CORE, 'tesseract-core-lstm.wasm.js'),
      path.join(VENDOR, 'core', 'tesseract-core-lstm.wasm.js'),
    ],
    [path.join(CORE, 'tesseract-core-lstm.wasm'), path.join(VENDOR, 'core', 'tesseract-core-lstm.wasm')],
  ];

  for (const [src, dest] of pairs) copyFile(src, dest);

  const manifest = {
    version: 'tesseract-vendor-1',
    package: JSON.parse(fs.readFileSync(path.join(TESS, 'package.json'), 'utf8')).version,
    core: JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8')).version,
    files: pairs.map(([, dest]) => path.relative(ROOT, dest)),
    langs: Object.keys(LANG_URLS).map((f) => `vendor/tesseract/lang/${f}`),
  };

  fs.writeFileSync(path.join(VENDOR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Tesseract vendor copied to', VENDOR);

  await Promise.all(
    Object.entries(LANG_URLS).map(([name, url]) =>
      download(url, path.join(VENDOR, 'lang', name))
    )
  );
  console.log('Traineddata downloaded');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
