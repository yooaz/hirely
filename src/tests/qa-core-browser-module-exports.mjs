#!/usr/bin/env node
/**
 * Browser boot guard — browser-loaded ES modules must not import missing named exports.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../..');
const coreDir = join(root, 'src/core');

const BROWSER_BOOT_ENTRY = join(coreDir, 'index.js');
const REQUIRED_PDF_OCR_CACHE_FACADE_EXPORTS = [
  'resolveOcrPreprocessingMode',
  'getPdfOcrFileBaseKey',
  'getPdfOcrCacheKey',
  'getCachedPdfOcrIfReady',
  'clearPdfOcrCache',
  'markPdfOcrTimedOut',
  'clearPdfOcrTimedOut',
  'isPdfOcrTimedOut',
  'getOrRunCachedPdfOcr',
  'setOcrInFlightPromise',
  'clearOcrInFlightPromise',
  'peekOcrInFlightPromise',
  'awaitOcrSettlementForFile',
];

const REQUIRED_PDF_OCR_CACHE_STORE_EXPORTS = [
  'getCachedPdfOcrIfReady',
  'peekOcrInFlightPromise',
  'peekOcrInFlightPromiseByKey',
  'setOcrInFlightPromise',
  'clearOcrInFlightPromise',
  'awaitOcrSettlementForCacheKey',
  'awaitOcrSettlementForFile',
  'getOrRunCachedPdfOcr',
];

const REQUIRED_PDF_OCR_SETTLEMENT_EXPORTS = ['awaitOcrSettlementForFile'];

const pdfOcrSettlementPath = join(coreDir, 'extraction/pdf-ocr-settlement.js');
const pdfOcrSettlementSrc = readFileSync(pdfOcrSettlementPath, 'utf8');
const pdfOcrSettlementExports = parseNamedExports(pdfOcrSettlementSrc);

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function listJsFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'tests') continue;
      listJsFiles(path, acc);
    } else if (/\.(js|mjs)$/.test(name)) {
      acc.push(path);
    }
  }
  return acc;
}

function parseNamedExports(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const bit = part.trim();
      if (!bit) continue;
      const alias = bit.split(/\s+as\s+/i);
      names.add((alias[1] || alias[0]).trim());
    }
  }
  for (const m of src.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  return names;
}

function parseStaticImports(src, filePath) {
  const imports = [];
  const re =
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const symbols = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const alias = s.split(/\s+as\s+/i);
        return (alias[0] || '').trim();
      })
      .filter(Boolean);
    imports.push({ symbols, specifier: m[2], from: filePath });
  }
  return imports;
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = join(dirname(fromFile), specifier);
  const candidates = [`${base}.js`, `${base}.mjs`, join(base, 'index.js')];
  for (const c of candidates) {
    try {
      statSync(c);
      return c;
    } catch {
      /* try next */
    }
  }
  return `${base}.js`;
}

function collectImportGraph(entryFile) {
  const visited = new Set();
  const edges = [];

  function walk(filePath) {
    const norm = filePath;
    if (visited.has(norm)) return;
    visited.add(norm);
    let src;
    try {
      src = readFileSync(norm, 'utf8');
    } catch {
      return;
    }
    for (const imp of parseStaticImports(src, norm)) {
      const resolved = resolveRelativeImport(norm, imp.specifier);
      if (!resolved) continue;
      edges.push({ importer: norm, resolved, symbols: imp.symbols });
      walk(resolved);
    }
  }

  walk(entryFile);
  return edges;
}

const pdfOcrCachePath = join(coreDir, 'extraction/pdf-ocr-cache.js');
const pdfOcrCacheSrc = readFileSync(pdfOcrCachePath, 'utf8');
const pdfOcrExports = parseNamedExports(pdfOcrCacheSrc);

const pdfOcrCacheStorePath = join(coreDir, 'extraction/pdf-ocr-cache-store.js');
const pdfOcrCacheStoreSrc = readFileSync(pdfOcrCacheStorePath, 'utf8');
const pdfOcrCacheStoreExports = parseNamedExports(pdfOcrCacheStoreSrc);

for (const name of REQUIRED_PDF_OCR_CACHE_FACADE_EXPORTS) {
  ok(pdfOcrExports.has(name), `pdf-ocr-cache.js re-exports ${name}`);
  ok(pdfOcrCacheStoreExports.has(name), `pdf-ocr-cache-store.js exports ${name}`);
}

for (const name of REQUIRED_PDF_OCR_CACHE_STORE_EXPORTS) {
  ok(pdfOcrCacheStoreExports.has(name), `pdf-ocr-cache-store.js exports ${name}`);
}

ok(
  pdfOcrExports.size === REQUIRED_PDF_OCR_CACHE_FACADE_EXPORTS.length,
  'pdf-ocr-cache.js re-exports the full cache facade surface'
);

const extractionIndexPath = join(coreDir, 'extraction/index.js');
const extractionIndexSrc = readFileSync(extractionIndexPath, 'utf8');
const facadeReexport = extractionIndexSrc.match(
  /export\s*\{([^}]+)\}\s*from\s*['"]\.\/pdf-ocr-cache\.js['"]/
);
ok(!!facadeReexport, 'extraction/index.js re-exports from pdf-ocr-cache.js facade');
const facadeImportSymbols = (facadeReexport?.[1] || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const alias = s.split(/\s+as\s+/i);
    return (alias[0] || '').trim();
  })
  .filter(Boolean);
for (const sym of facadeImportSymbols) {
  ok(
    pdfOcrExports.has(sym),
    `extraction/index.js imports { ${sym} } from pdf-ocr-cache.js and facade re-exports it`
  );
}

for (const name of REQUIRED_PDF_OCR_SETTLEMENT_EXPORTS) {
  ok(pdfOcrSettlementExports.has(name), `pdf-ocr-settlement.js exports ${name}`);
}

ok(
  /export\s*\{[\s\S]*awaitOcrSettlementForFile[\s\S]*\}\s*from\s+['"]\.\/pdf-ocr-cache-store\.js['"]/.test(
    pdfOcrCacheSrc
  ),
  'pdf-ocr-cache.js statically re-exports awaitOcrSettlementForFile from pdf-ocr-cache-store'
);

ok(
  !/export\s+async\s+function\s+awaitOcrSettlementForFile/.test(pdfOcrCacheSrc),
  'pdf-ocr-cache.js does not define a lazy awaitOcrSettlementForFile forwarder'
);

ok(
  !/import\s/.test(pdfOcrCacheSrc),
  'pdf-ocr-cache.js is re-export only (no import-run-guard side effects)'
);

ok(
  !/from\s+['"]\.\.\/import\/ocr-import-usability\.js['"]/.test(pdfOcrSettlementSrc),
  'pdf-ocr-settlement.js does not import ocr-import-usability'
);

ok(
  !/from\s+['"]\.\.\/import\/ocr-import-usability\.js['"]/.test(pdfOcrCacheStoreSrc),
  'pdf-ocr-cache-store.js does not import ocr-import-usability (leaf boot module)'
);

ok(
  !/from\s+['"]\.\.\/import\//.test(pdfOcrCacheStoreSrc),
  'pdf-ocr-cache-store.js does not import import-layer modules'
);

ok(
  /from\s+['"]\.\/pdf-ocr-cache-store\.js['"]/.test(pdfOcrSettlementSrc),
  'pdf-ocr-settlement.js imports pdf-ocr-cache-store (not pdf-ocr-cache facade)'
);

ok(
  !/from\s+['"]\.\/pdf-ocr-cache\.js['"]/.test(pdfOcrSettlementSrc),
  'pdf-ocr-settlement.js does not statically import pdf-ocr-cache.js'
);

const usabilityPath = join(coreDir, 'import/ocr-import-usability.js');
const usabilityImports = parseStaticImports(
  readFileSync(usabilityPath, 'utf8'),
  usabilityPath
);
const settlementImport = usabilityImports.find((i) =>
  i.specifier.includes('pdf-ocr-settlement.js')
);
ok(!!settlementImport, 'ocr-import-usability imports pdf-ocr-settlement.js');
ok(
  settlementImport?.symbols.includes('awaitOcrSettlementForFile'),
  'ocr-import-usability imports awaitOcrSettlementForFile from pdf-ocr-settlement'
);
ok(
  !usabilityImports.some(
    (i) =>
      i.specifier.includes('pdf-ocr-cache.js') &&
      i.symbols.includes('awaitOcrSettlementForFile')
  ),
  'ocr-import-usability does not import awaitOcrSettlementForFile from pdf-ocr-cache'
);

const graph = collectImportGraph(BROWSER_BOOT_ENTRY);
const mismatches = [];
for (const edge of graph) {
  let exportSrc;
  try {
    exportSrc = readFileSync(edge.resolved, 'utf8');
  } catch {
    continue;
  }
  const exports = parseNamedExports(exportSrc);
  for (const sym of edge.symbols) {
    if (!exports.has(sym)) {
      mismatches.push({
        importer: relative(root, edge.importer),
        target: relative(root, edge.resolved),
        symbol: sym,
      });
    }
  }
}

ok(mismatches.length === 0, `no missing named exports in core boot graph (${mismatches.length})`);
for (const mm of mismatches.slice(0, 8)) {
  console.error(`  ${mm.importer} imports { ${mm.symbol} } from ${mm.target} — not exported`);
}

let coreMod;
try {
  coreMod = await import(pathToFileURL(BROWSER_BOOT_ENTRY).href);
} catch (err) {
  console.error('FAIL core/index.js dynamic import', err?.message || err);
  failed++;
  coreMod = null;
}

ok(!!coreMod, 'core/index.js loads without SyntaxError');
ok(typeof coreMod?.canonicalImportFromFile === 'function', 'canonicalImportFromFile available after boot');
ok(
  typeof coreMod?.awaitOcrSettlementBeforeImportPaste === 'function',
  'awaitOcrSettlementBeforeImportPaste available after boot'
);
ok(
  typeof coreMod?.enrichImportResultWithOcrSettlement === 'function',
  'enrichImportResultWithOcrSettlement available after boot'
);
ok(
  typeof coreMod?.finalizePdfImportWithOcr === 'function',
  'finalizePdfImportWithOcr available after boot'
);

console.log(failed ? `\n${failed} failed` : '\nCORE BROWSER MODULE EXPORTS QA OK');
process.exit(failed ? 1 : 0);
