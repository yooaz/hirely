#!/usr/bin/env node
/**
 * Browser import guard — no Node builtins or .node.js in client-reachable code.
 * BFS boot-chain scan from core loader + exact transcription UI.
 * node src/tests/qa-browser-import-guard.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BOOT_ENTRIES, scanBrowserBootChain } from './lib/browser-boot-graph.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const BROWSER_SCAN_DIRS = [
  path.join(root, 'src/core'),
  path.join(root, 'src/ui'),
];

const SCAN_SKIP_DIRS = new Set(['audit', 'tests', 'node_modules']);

const SCAN_SKIP_FILES = new Set([
  'import-stability-lock.js',
  'parser-accuracy-report.js',
]);

const FORBIDDEN_STATIC = /from\s+['"](?:node:[^'"]+|fs|path)['"]/;

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

function hasForbiddenTopLevelImport(src) {
  return src.split('\n').some((line) => {
    const t = line.trim();
    if (!t.startsWith('import ')) return false;
    return FORBIDDEN_STATIC.test(t);
  });
}

function walkJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (SCAN_SKIP_DIRS.has(name)) continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      walkJsFiles(fp, out);
      continue;
    }
    if (!name.endsWith('.js')) continue;
    if (name.endsWith('.node.js')) continue;
    if (SCAN_SKIP_FILES.has(name)) continue;
    out.push(fp);
  }
  return out;
}

const violations = [];
for (const dir of BROWSER_SCAN_DIRS) {
  for (const file of walkJsFiles(dir)) {
    const rel = path.relative(root, file);
    const src = fs.readFileSync(file, 'utf8');
    if (hasForbiddenTopLevelImport(src)) {
      violations.push(`${rel} has top-level Node/fs/path import`);
    }
    if (/from\s+['"][^'"]+\.node\.js['"]/.test(src)) {
      violations.push(`${rel} imports a .node.js module`);
    }
    if (/import\s*\(\s*['"]node:/.test(src)) {
      violations.push(`${rel} has dynamic import("node:…")`);
    }
  }
}

if (violations.length) {
  console.error('STATIC SCAN VIOLATIONS:\n' + violations.join('\n'));
  process.exit(1);
}
ok(true, 'no forbidden Node imports in browser-reachable src/core + src/ui');

const bootScan = scanBrowserBootChain(root, DEFAULT_BOOT_ENTRIES);
if (bootScan.violations.length) {
  console.error(
    `BOOT CHAIN VIOLATIONS (${bootScan.violations.length}):\n` + bootScan.violations.join('\n')
  );
  process.exit(1);
}
ok(
  true,
  `boot chain clean (${bootScan.visited.length} modules from ${DEFAULT_BOOT_ENTRIES.length} entry points)`
);

let core;
try {
  core = await import(path.join(root, 'src/core/index.js'));
} catch (err) {
  throw new Error(`CORE_BOOT_FAILED: ${err?.message || err}`);
}
ok(typeof core.canonicalImportFromFile === 'function', 'src/core/index.js loads (CORE_BOOT)');

const exactImport = await import(path.join(root, 'src/core/import/exact-transcription-import.js'));
ok(typeof exactImport.exactTranscriptionFromExtracted === 'function', 'exact transcription import loads');

const panel = await import(path.join(root, 'src/ui/exact-transcription-panel.js'));
ok(typeof panel.renderExactTranscriptionPanel === 'function', 'exact transcription panel loads');

const clientArtifacts = await import(
  path.join(root, 'src/core/extraction/exact-transcription-artifacts.client.js')
);
ok(typeof clientArtifacts.attachExactTranscriptionArtifactsClient === 'function', 'client artifacts module is browser-safe');

console.log('\nBROWSER IMPORT GUARD OK');
