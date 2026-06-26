#!/usr/bin/env node
import fs from 'fs';
const files = [
  'vendor/pdf.min.mjs',
  'src/ui/product/hirely-v1-stabilizer.js',
];
let ok = true;
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log('FAIL missing', f);
    ok = false;
  } else {
    console.log('PASS exists', f, fs.statSync(f).size);
  }
}
const js = fs.readFileSync('src/ui/product/hirely-v1-stabilizer.js', 'utf8');
for (const needle of ["'/vendor/pdf.min.mjs'", '/vendor/pdf.worker.min.mjs', 'PDF non lisible automatiquement']) {
  if (js.includes(needle)) console.log('PASS', needle);
  else { console.log('FAIL missing', needle); ok = false; }
}
process.exit(ok ? 0 : 1);
