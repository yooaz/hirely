/**
 * Static import-graph scan for browser boot entry points.
 * Fails if any reachable module is node-only or pulls node builtins.
 */
import fs from 'node:fs';
import path from 'node:path';

const SPECIFIER_RES = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
  /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g,
  /^import\s+['"]([^'"]+)['"]/gm,
];

const FORBIDDEN_TOP_LEVEL = /from\s+['"](?:node:[^'"]+|fs|path)['"]/;
const IMPORTS_NODE_MODULE = /from\s+['"][^'"]+\.node\.js['"]/;
const DYNAMIC_NODE = /import\s*\(\s*['"]node:/;

/** @param {string} src */
function extractSpecifiers(src) {
  const specs = new Set();
  for (const re of SPECIFIER_RES) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(src))) specs.add(match[1]);
  }
  return [...specs];
}

/**
 * @param {string} spec
 * @param {string} fromFile
 */
function resolveProjectModule(spec, fromFile) {
  if (!spec.startsWith('.')) return null;
  const dir = path.dirname(fromFile);
  const base = path.normalize(path.join(dir, spec));
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, 'index.js'),
    path.join(base, 'index.mjs'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * @param {string} filePath
 */
function isNodeOnlyEntry(filePath) {
  const base = path.basename(filePath);
  return base.endsWith('.node.js') || base.includes('.persist.node.');
}

/**
 * @param {string} filePath
 * @param {string} src
 */
function fileViolations(filePath, src) {
  const issues = [];
  if (isNodeOnlyEntry(filePath)) {
    issues.push('node-only entry (.node.js) must not be in browser boot chain');
  }
  for (const line of src.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) continue;
    if (FORBIDDEN_TOP_LEVEL.test(trimmed)) {
      issues.push('top-level node:fs/path import');
    }
  }
  if (IMPORTS_NODE_MODULE.test(src)) {
    issues.push('imports a .node.js module');
  }
  if (DYNAMIC_NODE.test(src)) {
    issues.push('dynamic import("node:…")');
  }
  return issues;
}

/**
 * @param {string} root - repo root
 * @param {string[]} entryRelPaths - paths relative to root
 */
export function scanBrowserBootChain(root, entryRelPaths) {
  const visited = new Set();
  const queue = entryRelPaths.map((rel) => path.resolve(root, rel));
  const violations = [];

  while (queue.length) {
    const file = queue.shift();
    if (!file || visited.has(file)) continue;
    if (!fs.existsSync(file)) continue;
    visited.add(file);

    const rel = path.relative(root, file);
    const src = fs.readFileSync(file, 'utf8');
    for (const issue of fileViolations(file, src)) {
      violations.push(`${rel}: ${issue}`);
    }

    for (const spec of extractSpecifiers(src)) {
      const resolved = resolveProjectModule(spec, file);
      if (!resolved) continue;
      if (!resolved.includes(`${path.sep}src${path.sep}`)) continue;
      queue.push(resolved);
    }
  }

  return {
    visited: [...visited].map((f) => path.relative(root, f)).sort(),
    violations,
  };
}

/** Default browser boot + exact-transcription UI entry points. */
export const DEFAULT_BOOT_ENTRIES = [
  'src/core/boot/core-boot-loader.mjs',
  'src/core/boot/boot-contract.mjs',
  'src/core/index.js',
  'src/ui/exact-transcription-panel.js',
  'src/ui/exact-transcription-pdf-preview.js',
];
