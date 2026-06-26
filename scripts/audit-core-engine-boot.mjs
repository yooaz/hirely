#!/usr/bin/env node
/**
 * P0 — Core engine boot audit: module loads, exports, circular imports, startup chain.
 * node scripts/audit-core-engine-boot.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { assessCoreModule, CORE_BOOT_FEATURES, CORE_BOOT_STARTUP_CHAIN } from '../src/core/boot/boot-contract.mjs';
import { loadHirelyCoreForBrowser } from '../src/core/boot/core-boot-loader.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');

const audit = {
  generatedAt: new Date().toISOString(),
  grep: { CORE_BOOT_FAILED: [], core_modules_incomplete: [] },
  moduleLoads: [],
  exports: { full: null, minimal: null, perFeature: [] },
  circularImports: [],
  dynamicImportFailures: [],
  initThrows: [],
  startupChain: CORE_BOOT_STARTUP_CHAIN.map((phase) => ({ phase, status: 'pending', detail: null })),
  rootCause: null,
  recommendations: [],
};

function grepFile(filePath, patterns) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  for (const [key, pattern] of Object.entries(patterns)) {
    const re = typeof pattern === 'string' ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : pattern;
    lines.forEach((line, i) => {
      if (re.test(line)) {
        audit.grep[key].push({ file: path.relative(ROOT, filePath), line: i + 1, text: line.trim().slice(0, 200) });
        re.lastIndex = 0;
      }
    });
  }
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(js|mjs|html|ts)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

async function tryImportModule(relPath) {
  const abs = path.join(ROOT, relPath);
  const entry = { module: relPath, status: 'unknown', error: null, stack: null, ms: 0 };
  const t0 = Date.now();
  try {
    await import(pathToFileURL(abs).href);
    entry.status = 'loaded';
  } catch (err) {
    entry.status = 'failed';
    entry.error = err?.message || String(err);
    entry.stack = err?.stack || null;
    audit.dynamicImportFailures.push(entry);
  }
  entry.ms = Date.now() - t0;
  audit.moduleLoads.push(entry);
  return entry;
}

async function auditFeatureModules() {
  const seen = new Set();
  for (const feat of CORE_BOOT_FEATURES) {
    if (!feat.module || seen.has(feat.module)) continue;
    seen.add(feat.module);
    const load = await tryImportModule(feat.module);
    const missing = [];
    if (load.status === 'loaded') {
      try {
        const mod = await import(pathToFileURL(path.join(ROOT, feat.module)).href);
        for (const name of feat.exports) {
          if (typeof mod[name] !== 'function') missing.push(name);
        }
      } catch (err) {
        missing.push(`import_throw:${err?.message || err}`);
      }
    }
    audit.exports.perFeature.push({
      feature: feat.id,
      module: feat.module,
      required: feat.required,
      loadStatus: load.status,
      loadError: load.error,
      missingExports: missing,
    });
  }
}

function detectCircularShallow(relPath, maxDepth = 4) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return;
  const queue = [{ rel: relPath, stack: [relPath] }];
  const seen = new Set();
  while (queue.length) {
    const { rel, stack } = queue.shift();
    if (stack.length > maxDepth) continue;
    const fileAbs = path.join(ROOT, rel);
    let text = '';
    try {
      text = fs.readFileSync(fileAbs, 'utf8');
    } catch {
      continue;
    }
    const importRe = /import\s+[^'"]*['"](\.\.?\/[^'"]+)['"]/g;
    let m;
    while ((m = importRe.exec(text))) {
      let dep = m[1];
      if (!dep.endsWith('.js') && !dep.endsWith('.mjs')) dep += '.js';
      const resolved = path.normalize(path.join(path.dirname(fileAbs), dep));
      if (!resolved.startsWith(ROOT) || !fs.existsSync(resolved)) continue;
      const depRel = path.relative(ROOT, resolved);
      const key = `${rel}->${depRel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (stack.includes(depRel)) {
        audit.circularImports.push({ cycle: [...stack, depRel].join(' → ') });
        continue;
      }
      queue.push({ rel: depRel, stack: [...stack, depRel] });
    }
  }
}

// --- Grep occurrences ---
const files = walk(ROOT).filter((f) => !f.includes('node_modules') && !f.includes('.qa-screenshots'));
for (const f of files) {
  grepFile(f, {
    CORE_BOOT_FAILED: 'CORE_BOOT_FAILED',
    core_modules_incomplete: 'core_modules_incomplete',
  });
}

// --- Module load audit ---
await tryImportModule('src/core/index.js');
await tryImportModule('src/core/boot/core-boot-loader.mjs');
await tryImportModule('src/core/boot/minimal-import-core.mjs');
await auditFeatureModules();

// --- Full boot loader trace ---
try {
  const boot = await loadHirelyCoreForBrowser();
  audit.exports.full = assessCoreModule(boot.module);
  audit.startupChain.find((s) => s.phase === 'BOOT_START').status = 'ok';
  audit.startupChain.find((s) => s.phase === 'CORE_BOOT').status = boot.tier === 'failed' ? 'failed' : 'ok';
  audit.startupChain.find((s) => s.phase === 'CORE_BOOT').detail = {
    tier: boot.tier,
    degraded: boot.degraded,
    assessment: boot.assessment,
    traceSteps: boot.trace?.steps?.length || 0,
  };
  if (boot.rootError) {
    audit.initThrows.push({
      module: 'src/core/index.js',
      message: boot.rootError?.message || String(boot.rootError),
      stack: boot.rootError?.stack || null,
    });
  }
} catch (err) {
  audit.startupChain.find((s) => s.phase === 'CORE_BOOT').status = 'failed';
  audit.startupChain.find((s) => s.phase === 'CORE_BOOT').detail = { error: err?.message || String(err) };
  audit.rootCause = err?.message || String(err);
}

// --- index.html startup markers ---
const html = fs.readFileSync(INDEX_HTML, 'utf8');
audit.startupChain.find((s) => s.phase === 'TEMPLATE_REGISTRY_READY').status =
  /TEMPLATE_REGISTRY_READY|bootTemplateRegistryDeferred/.test(html) ? 'ok' : 'missing';
audit.startupChain.find((s) => s.phase === 'IMPORT_UI_READY').status =
  /IMPORT_UI_READY|UPLOAD_BIND_OK/.test(html) ? 'ok' : 'missing';
audit.usesBootLoader = /core-boot-loader\.mjs/.test(html);
audit.legacyAllOrNothingGate = /typeof m\.canonicalImportFromFile==='function'/.test(html) &&
  !/coreImportFunctionsReady/.test(html);

// --- Light circular scan on boot-critical paths ---
for (const rel of [
  'src/core/index.js',
  'src/core/pipeline/hirely-import.js',
  'src/core/import/canonical-import.js',
]) {
  detectCircularShallow(rel);
}

// --- Root cause synthesis ---
const fullLoad = audit.moduleLoads.find((m) => m.module === 'src/core/index.js');
const indexAssessment = audit.exports.full;
if (!audit.rootCause) {
  if (fullLoad?.status === 'failed') {
    audit.rootCause = `Full barrel failed: ${fullLoad.error}`;
  } else if (indexAssessment && !indexAssessment.importOk) {
    audit.rootCause = `Missing required features: ${indexAssessment.missingRequired.join(', ')}`;
  } else if (audit.legacyAllOrNothingGate) {
    audit.rootCause =
      'Historical all-or-nothing gate: reportHirelyCoreStatus required canonicalImportFromFile + all exports; optional missing surfaces surfaced as core_modules_incomplete';
  } else if (indexAssessment?.degraded) {
    audit.rootCause = `Degraded boot: optional features unavailable (${indexAssessment.missingOptional.join(', ')})`;
  } else {
    audit.rootCause = 'No fatal boot failure detected in Node audit; browser failure may be cache, deploy skew, or runtime-only import error';
  }
}

audit.recommendations = [
  'Use core-boot-loader.mjs in browser (tiered assessment, minimal fallback).',
  'Block import UI only when import_core missing; show per-feature warnings otherwise.',
  'Never show core_modules_incomplete when paste import is available.',
  'Persist __HIRELY_CORE_BOOT_TRACE__ in bug reports.',
];

const outPath = path.join(ROOT, '.cache', 'core-engine-boot-audit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));

console.log('CORE_ENGINE_BOOT_AUDIT_OK');
console.log('rootCause:', audit.rootCause);
console.log('fullBarrel:', fullLoad?.status);
console.log('tier:', indexAssessment?.tier || 'n/a');
console.log('degraded:', indexAssessment?.degraded ?? 'n/a');
console.log('grep CORE_BOOT_FAILED:', audit.grep.CORE_BOOT_FAILED.length);
console.log('grep core_modules_incomplete:', audit.grep.core_modules_incomplete.length);
console.log('written:', path.relative(ROOT, outPath));

if (fullLoad?.status === 'failed' && !indexAssessment?.importOk) {
  console.error('CORE_BOOT_FAILED audit');
  process.exit(1);
}
