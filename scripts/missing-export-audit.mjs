#!/usr/bin/env node
/**
 * Missing named-export audit for src/core.
 * node scripts/missing-export-audit.mjs
 * Output: MISSING_EXPORT_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CORE = path.join(ROOT, 'src/core');
const REPORT = path.join(ROOT, 'MISSING_EXPORT_AUDIT.md');

/** @type {Map<string, { exports: Set<string>, star: string[], parsingError?: string }>} */
const exportCache = new Map();

function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsFiles(fp));
    else if (ent.name.endsWith('.js')) out.push(fp);
  }
  return out;
}

function resolveModule(fromFile, spec) {
  if (!spec || typeof spec !== 'string') return null;
  if (spec.startsWith('node:') || !spec.startsWith('.') && !spec.startsWith('/')) {
    return { external: true, spec };
  }
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.js`,
    path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return { file: c };
  }
  return { missing: true, tried: candidates };
}

function parseNamedImports(source) {
  /** @type {{ names: string[], spec: string, line: number }[]} */
  const imports = [];
  const re = /^\s*import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(source)) !== null) {
    const names = m[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const mm = part.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        return mm ? mm[1] : part;
      });
    const line = source.slice(0, m.index).split('\n').length;
    imports.push({ names, spec: m[2], line });
  }
  return imports;
}

function parseExports(filePath, stack = new Set()) {
  if (exportCache.has(filePath)) return exportCache.get(filePath);
  if (stack.has(filePath)) {
    const entry = { exports: new Set(), star: [], parsingError: 'circular re-export' };
    exportCache.set(filePath, entry);
    return entry;
  }
  stack.add(filePath);

  const src = fs.readFileSync(filePath, 'utf8');
  const exports = new Set();
  const star = [];

  const directPatterns = [
    /export\s+(?:async\s+)?function\s+([\w$]+)/g,
    /export\s+const\s+([\w$]+)/g,
    /export\s+let\s+([\w$]+)/g,
    /export\s+var\s+([\w$]+)/g,
    /export\s+class\s+([\w$]+)/g,
  ];
  for (const re of directPatterns) {
    let m;
    while ((m = re.exec(src)) !== null) exports.add(m[1]);
  }

  const namedExportRe = /export\s*\{([^}]+)\}/g;
  let nm;
  while ((nm = namedExportRe.exec(src)) !== null) {
    const chunk = nm[1];
    if (/^\s*from\s+['"]/.test(chunk)) continue;
    for (const part of chunk.split(',')) {
      const p = part.trim();
      if (!p) continue;
      const mm = p.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (mm) exports.add(mm[2] || mm[1]);
    }
  }

  const reExportNamedRe = /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let rm;
  while ((rm = reExportNamedRe.exec(src)) !== null) {
    const resolved = resolveModule(filePath, rm[2]);
    if (resolved?.file) {
      const sub = parseExports(resolved.file, stack);
      for (const part of rm[1].split(',')) {
        const p = part.trim();
        if (!p) continue;
        const mm = p.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        if (!mm) continue;
        const local = mm[2] || mm[1];
        const remote = mm[1];
        if (sub.exports.has(remote)) exports.add(local);
      }
    }
  }

  const starRe = /export\s*\*\s*from\s*['"]([^'"]+)['"]/g;
  let sm;
  while ((sm = starRe.exec(src)) !== null) {
    star.push(sm[1]);
    const resolved = resolveModule(filePath, sm[1]);
    if (resolved?.file) {
      const sub = parseExports(resolved.file, stack);
      for (const e of sub.exports) exports.add(e);
      star.push(...sub.star);
    }
  }

  const entry = { exports, star };
  exportCache.set(filePath, entry);
  stack.delete(filePath);
  return entry;
}

const coreFiles = listJsFiles(CORE);
/** @type {{ importer: string, line: number, spec: string, name: string, target: string, reason: string }[]} */
const missing = [];
/** @type {{ importer: string, line: number, spec: string, name: string, reason: string }[]} */
const skipped = [];

let importCount = 0;
let checkedCount = 0;

for (const file of coreFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const imports = parseNamedImports(src);
  for (const imp of imports) {
    importCount += imp.names.length;
    const resolved = resolveModule(file, imp.spec);
    if (resolved?.external) {
      for (const name of imp.names) {
        skipped.push({
          importer: path.relative(ROOT, file),
          line: imp.line,
          spec: imp.spec,
          name,
          reason: 'external/package import (not audited)',
        });
      }
      continue;
    }
    if (resolved?.missing) {
      for (const name of imp.names) {
        missing.push({
          importer: path.relative(ROOT, file),
          line: imp.line,
          spec: imp.spec,
          name,
          target: '(module not found)',
          reason: `target module not found: ${imp.spec}`,
        });
      }
      continue;
    }

    const exp = parseExports(resolved.file);
    for (const name of imp.names) {
      checkedCount++;
      if (!exp.exports.has(name)) {
        missing.push({
          importer: path.relative(ROOT, file),
          line: imp.line,
          spec: imp.spec,
          name,
          target: path.relative(ROOT, resolved.file),
          reason: `named export "${name}" not found in target`,
        });
      }
    }
  }
}

const pass = missing.length === 0;
const now = new Date().toISOString();

const md = [];
md.push('# MISSING EXPORT AUDIT — src/core');
md.push('');
md.push(`Generated: ${now}`);
md.push(`Scope: all named imports in \`src/core/**/*.js\``);
md.push('');
md.push('## Verdict');
md.push('');
md.push(`**${pass ? 'PASS' : 'FAIL'}** — ${missing.length} missing named export(s)`);
md.push('');
md.push('## Summary');
md.push('');
md.push(`| Metric | Count |`);
md.push(`|--------|------:|`);
md.push(`| Core files scanned | ${coreFiles.length} |`);
md.push(`| Named imports checked | ${checkedCount} |`);
md.push(`| External imports skipped | ${skipped.length} |`);
md.push(`| Missing / unresolved | ${missing.length} |`);
md.push('');

if (missing.length) {
  md.push('## Missing named exports');
  md.push('');
  md.push('| Importer | Line | Import | Target | Reason |');
  md.push('|----------|-----:|--------|--------|--------|');
  for (const row of missing) {
    md.push(
      `| \`${row.importer}\` | ${row.line} | \`${row.name}\` from \`${row.spec}\` | \`${row.target}\` | ${row.reason} |`
    );
  }
  md.push('');
} else {
  md.push('## Missing named exports');
  md.push('');
  md.push('_None — every resolvable named import in src/core matches an export in its target module._');
  md.push('');
}

if (skipped.length) {
  md.push('## Skipped (external modules)');
  md.push('');
  md.push(`${skipped.length} named import(s) from npm/bare specifiers were not statically verified.`);
  md.push('');
  const bySpec = new Map();
  for (const s of skipped) {
    if (!bySpec.has(s.spec)) bySpec.set(s.spec, 0);
    bySpec.set(s.spec, bySpec.get(s.spec) + 1);
  }
  for (const [spec, n] of [...bySpec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    md.push(`- \`${spec}\` — ${n} import(s)`);
  }
  md.push('');
}

md.push('## Method');
md.push('');
md.push('- Parse `import { ... } from "..."` in every `src/core/**/*.js` file');
md.push('- Resolve relative targets to `.js` / `index.js`');
md.push('- Collect exports: direct declarations, `export { }`, `export * from`, re-exports');
md.push('- Flag any named import with no matching export');
md.push('');

fs.writeFileSync(REPORT, md.join('\n'));

console.log(`MISSING_EXPORT_AUDIT ${pass ? 'PASS' : 'FAIL'} — ${missing.length} issue(s)`);
console.log(`Report: ${REPORT}`);
if (missing.length) {
  for (const row of missing.slice(0, 20)) {
    console.log(` - ${row.importer}:${row.line} ${row.name} from ${row.spec} → ${row.reason}`);
  }
  process.exit(1);
}
process.exit(0);
