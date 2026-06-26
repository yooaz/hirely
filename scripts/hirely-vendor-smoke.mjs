#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const required = [
  'vendor/pdf.min.mjs',
  'vendor/pdf.worker.min.mjs',
  'vendor/jszip.min.js',
  'vendor/html2pdf.bundle.min.js',
  'src/vendor/csp-safe-loader.js',
  'src/ui/product/hirely-v1-stabilizer.js',
  'src/ui/product/hirely-v1-stabilizer.css',
];

let ok = true;
for (const rel of required) {
  const fp = path.join(root, rel);
  const exists = fs.existsSync(fp);
  const size = exists ? fs.statSync(fp).size : 0;
  const pass = exists && size > 0;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${rel} ${exists ? `${size} bytes` : 'missing'}`);
  if (!pass) ok = false;
}

const loader = fs.readFileSync(path.join(root, 'src/vendor/csp-safe-loader.js'), 'utf8');
if (loader.includes('/node_modules/')) {
  console.log('FAIL loader still references /node_modules/');
  ok = false;
} else {
  console.log('PASS loader has no /node_modules runtime path');
}


const devServer = fs.readFileSync(path.join(root, 'scripts/dev-server.mjs'), 'utf8');
for (const pattern of ['pdfjs-dist', 'jszip', 'html2pdf', 'pdf-lib']) {
  if (!devServer.includes(pattern)) {
    console.log(`FAIL dev-server missing alias for ${pattern}`);
    ok = false;
  }
}
if (devServer.includes("pathname = '/vendor/pdf.min.mjs'")) console.log('PASS dev-server aliases old PDF.js path');
else { console.log('FAIL dev-server PDF.js alias missing'); ok = false; }

process.exit(ok ? 0 : 1);
