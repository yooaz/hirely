#!/usr/bin/env node
/**
 * Build HIRELY_RC1_RELEASE.zip — production tree only.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ZIP_NAME = 'HIRELY_RC1_RELEASE.zip';
const ZIP_PATH = path.join(ROOT, ZIP_NAME);
const STAGING = path.join(ROOT, '.release-staging');

const ROOT_ALLOW = new Set([
  'index.html',
  'favicon.svg',
  'package.json',
  'package-lock.json',
  'START_HERE.md',
  'RELEASE_CONTENTS.md',
  'V1_SCOPE_LOCK.md',
  'RC1_REPORT.md',
]);

const SCRIPT_ALLOW = new Set([
  'scripts/test-core-boot.mjs',
  'scripts/check-core-exports.mjs',
  'scripts/v1-smoke-test.mjs',
  'scripts/v1-release-test.mjs',
  'scripts/user-flow-cleanup-audit.mjs',
]);

function rel(p) {
  return p.split(path.sep).join('/');
}

function shouldInclude(absPath) {
  const r = rel(path.relative(ROOT, absPath));
  if (!r || r.startsWith('..')) return false;

  if (r.includes('node_modules/')) return false;
  if (r.startsWith('tests/output/') || r === 'tests/output') return false;
  if (r.startsWith('.git/') || r === '.git') return false;
  if (r.startsWith('.cursor/') || r === '.cursor') return false;
  if (r.startsWith('.release-staging/') || r === '.release-staging') return false;
  if (r.endsWith('.zip')) return false;
  if (/\.(png|jpe?g|webp|gif)$/i.test(r)) return false;
  if (r.endsWith('_SPEC.md')) return false;
  if (/\/draft\//i.test(r) || /^DRAFT/i.test(path.basename(r))) return false;
  if (r.startsWith('core/')) return false;

  if (r.match(/_REPORT\.md$/)) {
    return r === 'RC1_REPORT.md';
  }

  if (!r.includes('/')) return ROOT_ALLOW.has(r);

  if (r.startsWith('src/tests/')) return false;

  if (r.startsWith('tests/')) {
    if (r.startsWith('tests/fixtures/hirely-test-lab/')) return true;
    return r === 'tests/lib/hirely-test-matrix-fixtures.mjs';
  }

  if (r.startsWith('scripts/')) return SCRIPT_ALLOW.has(r);

  if (r.startsWith('src/')) return true;

  return false;
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.cursor' || name === '.release-staging') continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out);
    } else if (shouldInclude(abs)) {
      out.push(abs);
    }
  }
}

function writeReleasePackageJson() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const keepDeps = [
    'pdfjs-dist',
    'pdf-lib',
    'jszip',
    'jspdf',
    'html2pdf.js',
    'mammoth',
    'tesseract.js',
    'playwright',
  ];
  const devDependencies = {};
  for (const k of keepDeps) {
    if (pkg.devDependencies?.[k]) devDependencies[k] = pkg.devDependencies[k];
  }
  return {
    name: 'hirely-rc1',
    private: true,
    description: 'Hirely RC1 — V1 import, review, templates, PDF export',
    scripts: {
      start: 'npx --yes serve -l 4173 .',
      'test:core-boot': 'node scripts/test-core-boot.mjs',
      'v1-smoke-test': 'node scripts/v1-smoke-test.mjs',
      'v1-release-test': 'node scripts/v1-release-test.mjs',
      'user-flow-cleanup-audit': 'node scripts/user-flow-cleanup-audit.mjs',
    },
    devDependencies,
  };
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function buildReleaseContentsMd(files) {
  const lines = [
    '# Hirely RC1 — Release contents',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Archive:** \`${ZIP_NAME}\``,
    `**Files:** ${files.length}`,
    `**Uncompressed:** ${formatBytes(files.reduce((s, f) => s + f.size, 0))}`,
    '',
    '## Included',
    '',
    '| Area | Purpose |',
    '|------|---------|',
    '| `index.html` | Main app shell + UI |',
    '| `src/core/` | Import, extraction, validation, export logic |',
    '| `src/ui/` | Templates, styles, PDF export UI |',
    '| `src/vendor/` | CSP-safe browser vendor loaders |',
    '| `package.json` | Runtime vendor deps (`npm install` required) |',
    '| `tests/fixtures/hirely-test-lab/` | RC1 smoke fixtures |',
    '| `scripts/v1-*.mjs` | Automated import/export smoke tests |',
    '| `START_HERE.md` | Run + test instructions |',
    '| `V1_SCOPE_LOCK.md` | Frozen V1 scope |',
    '| `RC1_REPORT.md` | RC1 ship gate summary |',
    '',
    '## Excluded',
    '',
    '- `node_modules/` (run `npm install` after unzip)',
    '- `tests/output/` (generated QA artifacts)',
    '- `*_REPORT.md` audit reports (except `RC1_REPORT.md`)',
    '- `src/tests/` QA harness',
    '- `scripts/` except RC1 smoke scripts',
    '- Debug screenshots, draft specs, old zip files, `.cursor/`',
    '',
    '## File tree',
    '',
    '```',
  ];

  const byDir = new Map();
  for (const f of files) {
    const d = f.rel.includes('/') ? f.rel.slice(0, f.rel.lastIndexOf('/')) : '.';
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(f);
  }
  for (const d of [...byDir.keys()].sort()) {
    lines.push(`${d}/`);
    for (const f of byDir.get(d).sort((a, b) => a.rel.localeCompare(b.rel))) {
      lines.push(`  ${path.basename(f.rel)}  (${formatBytes(f.size)})`);
    }
  }
  lines.push('```', '');
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(path.join(ROOT, 'START_HERE.md'))) {
    console.error('Missing START_HERE.md — create it before building the zip.');
    process.exit(1);
  }

  const files = [];
  for (const name of ROOT_ALLOW) {
    if (name === 'RELEASE_CONTENTS.md') continue;
    const abs = path.join(ROOT, name);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) files.push(abs);
  }
  walk(path.join(ROOT, 'src'), files);
  walk(path.join(ROOT, 'tests'), files);
  walk(path.join(ROOT, 'scripts'), files);

  const unique = [...new Set(files)].sort();
  const manifest = unique.map((abs) => ({
    abs,
    rel: rel(path.relative(ROOT, abs)),
    size: fs.statSync(abs).size,
  }));

  const slimPkg = writeReleasePackageJson();
  const slimPkgJson = `${JSON.stringify(slimPkg, null, 2)}\n`;
  const pkgEntry = manifest.find((f) => f.rel === 'package.json');
  if (pkgEntry) pkgEntry.size = Buffer.byteLength(slimPkgJson, 'utf8');

  const contentsMd = buildReleaseContentsMd(manifest);
  fs.writeFileSync(path.join(ROOT, 'RELEASE_CONTENTS.md'), contentsMd, 'utf8');
  manifest.push({
    abs: path.join(ROOT, 'RELEASE_CONTENTS.md'),
    rel: 'RELEASE_CONTENTS.md',
    size: fs.statSync(path.join(ROOT, 'RELEASE_CONTENTS.md')).size,
  });

  if (fs.existsSync(STAGING)) fs.rmSync(STAGING, { recursive: true, force: true });
  fs.mkdirSync(STAGING, { recursive: true });

  const slimPkgPath = path.join(STAGING, 'package.json');
  fs.writeFileSync(slimPkgPath, slimPkgJson, 'utf8');

  for (const f of manifest) {
    if (f.rel === 'package.json') continue;
    copyFile(f.abs, path.join(STAGING, f.rel));
  }
  copyFile(slimPkgPath, path.join(STAGING, 'package.json'));
  if (fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
    copyFile(path.join(ROOT, 'package-lock.json'), path.join(STAGING, 'package-lock.json'));
  }

  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  execSync(`cd "${STAGING}" && zip -r -q "${ZIP_PATH}" .`, { stdio: 'inherit' });
  fs.rmSync(STAGING, { recursive: true, force: true });

  const zipSize = fs.statSync(ZIP_PATH).size;
  console.log(`Created ${ZIP_NAME}`);
  console.log(`  Files: ${manifest.length}`);
  console.log(`  Size:  ${formatBytes(zipSize)}`);
  console.log(`  Docs:  START_HERE.md, RELEASE_CONTENTS.md`);
}

main();
