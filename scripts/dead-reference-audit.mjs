#!/usr/bin/env node
/**
 * Dead DOM reference audit — maps JS references to live HTML after P0 subtraction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(root, 'DEAD_REFERENCE_REPORT.md');

const SCAN_ROOTS = ['index.html', 'src', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'docs/screenshots', 'fixtures', 'test-fixtures']);
const EXT = new Set(['.js', '.mjs', '.html']);

const REQUIRED = new Set([
  'app',
  'docNav',
  'wsImport',
  'drop',
  'fileInput',
  'cvPreview',
]);
const OPTIONAL = new Set([
  'auditPanelInner',
  'auditPanel',
  'linkedinPanel',
  'letterPanel',
  'linkedinText',
  'letterText',
  'hirelyDebugPanel',
  'hirelyForensicPanel',
  'pipelineReportPanel',
  'importDebugPanel',
  'extractionGate',
  'extractionAlert',
  'exportFinalPanel',
  'hirelyTestClickBtn',
  'hirelyTestImport',
  'recruiterReviewPanel',
  'studioScorePanel',
  'wsInsights',
  'coverLetterWorkspace',
  'resultFlow',
  'templateGallery',
  'rawDetails',
  'workspace',
  'workspaceGrid',
  'wsProduct',
  'cvPanel',
  'cvDoc',
  'importPasteFallback',
  'statusText',
  'progress',
  'progressBar',
]);

const ALIASES = { cvPreview: 'cvDoc' };

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(name))) out.push(p);
  }
  return out;
}

function collectFiles() {
  const files = [];
  for (const r of SCAN_ROOTS) {
    const p = path.join(root, r);
    if (r === 'index.html' && fs.existsSync(p)) files.push(p);
    else if (fs.statSync(p).isDirectory()) walk(p, files);
  }
  return [...new Set(files)];
}

function extractHtmlIds(html) {
  const ids = new Set();
  const re = /\bid=["']([a-zA-Z][\w-]*)["']/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function resolveExists(id, htmlIds) {
  const resolved = ALIASES[id] || id;
  return htmlIds.has(resolved) || htmlIds.has(id);
}

function classifyDom(id) {
  if (REQUIRED.has(id) || REQUIRED.has(ALIASES[id] || '')) return 'required';
  if (OPTIONAL.has(id) || OPTIONAL.has(ALIASES[id] || '')) return 'optional';
  return 'unknown';
}

function findFunctionName(lines, lineIdx) {
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 80); i--) {
    const m = lines[i].match(/^(?:async\s+)?function\s+(\w+)/);
    if (m) return m[1];
    const m2 = lines[i].match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
    if (m2) return m2[1];
    const m3 = lines[i].match(/(\w+)\s*:\s*(?:async\s*)?function/);
    if (m3) return m3[1];
  }
  return '(module)';
}

function hasNearbyGuard(lines, lineIdx, varName, line, domId) {
  const window = lines.slice(Math.max(0, lineIdx - 8), lineIdx + 3).join('\n');
  if (/\?\.(innerHTML|textContent|classList|addEventListener|value)/.test(line)) return true;
  if (domId && new RegExp(`if\\s*\\(\\s*\\$\\(['"]${domId}['"]\\)`).test(line)) return true;
  const patterns = [
    varName ? new RegExp(`if\\s*\\(\\s*${varName}\\s*\\)`) : null,
    varName ? new RegExp(`if\\s*\\(\\s*!${varName}\\s*\\)`) : null,
    varName ? new RegExp(`${varName}\\?\\.`) : null,
    /if\s*\(\s*!\w+\s*\)\s*return/,
    /setHTML\s*\(/,
    /setText\s*\(/,
    /trackRenderHtml\s*\(/,
    /HirelyDomSafe/,
    /HirelyDomContract/,
    /try\s*\{/,
  ].filter(Boolean);
  return patterns.some((re) => re.test(window));
}

function extractIdFromMatch(kind, text) {
  if (kind === 'getElementById') {
    const m = text.match(/getElementById\s*\(\s*['"]([a-zA-Z][\w-]*)['"]/);
    return m?.[1] || null;
  }
  if (kind === 'dollar') {
    const m = text.match(/\$\s*\(\s*['"]([a-zA-Z][\w-]*)['"]/);
    return m?.[1] || null;
  }
  if (kind === 'querySelector') {
    const m = text.match(/querySelector(?:All)?\s*\(\s*['"]#([a-zA-Z][\w-]*)['"]/);
    return m?.[1] || null;
  }
  if (kind === 'byId') {
    const m = text.match(/byId\s*\(\s*['"]([a-zA-Z][\w-]*)['"]/);
    return m?.[1] || null;
  }
  return null;
}

function scoreSeverity(ref) {
  if (ref.exists) return { level: 'OK', score: 0, flag: null };
  const guarded = ref.guarded;
  const domClass = ref.domClass;
  const op = ref.operation;

  const crashOps = new Set(['innerHTML', 'textContent', 'classList', 'addEventListener', 'value', 'focus']);
  const isCrashOp = crashOps.has(op) || ref.raw.includes('.innerHTML') || ref.raw.includes('addEventListener');

  if (domClass === 'required') {
    if (!guarded && isCrashOp) return { level: 'CRITICAL', score: 100, flag: 'BROKEN_REFERENCE' };
    return { level: 'HIGH', score: 80, flag: 'BROKEN_REFERENCE' };
  }
  if (domClass === 'optional') {
    if (!guarded && isCrashOp) return { level: 'HIGH', score: 70, flag: 'BROKEN_REFERENCE' };
    return { level: 'MEDIUM', score: 40, flag: 'BROKEN_REFERENCE' };
  }
  if (!guarded && isCrashOp) return { level: 'MEDIUM', score: 50, flag: 'BROKEN_REFERENCE' };
  return { level: 'LOW', score: 20, flag: 'BROKEN_REFERENCE' };
}

function scanFile(filePath, htmlIds) {
  const rel = path.relative(root, filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const refs = [];

  const patterns = [
    { kind: 'getElementById', re: /getElementById\s*\(\s*['"][^'"]+['"]/g },
    { kind: 'dollar', re: /\$\s*\(\s*['"][^'"]+['"]/g },
    { kind: 'querySelector', re: /querySelector(?:All)?\s*\(\s*['"]#[^'"]+['"]/g },
    { kind: 'byId', re: /byId\s*\(\s*['"][^'"]+['"]/g },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/dead-reference-audit/.test(rel)) continue;

    for (const { kind, re } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const id = extractIdFromMatch(kind, m[0]);
        if (!id) continue;

        let operation = 'lookup';
        const rest = line.slice(m.index + m[0].length);
        if (/\.innerHTML/.test(line)) operation = 'innerHTML';
        else if (/\.textContent/.test(line)) operation = 'textContent';
        else if (/\.classList/.test(line)) operation = 'classList';
        else if (/addEventListener/.test(line)) operation = 'addEventListener';
        else if (/\.value/.test(rest)) operation = 'value';

        const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:document\.getElementById|\$\()/);
        const varName = varMatch?.[1] || null;
        const guarded = hasNearbyGuard(lines, i, varName || id, line, id);

        const exists = resolveExists(id, htmlIds);
        const domClass = classifyDom(id);
        const fn = findFunctionName(lines, i);

        const ref = {
          domId: id,
          file: rel,
          line: i + 1,
          function: fn,
          domClass,
          exists,
          operation,
          guarded,
          raw: line.trim().slice(0, 140),
        };
        const sev = scoreSeverity(ref);
        ref.severity = sev.level;
        ref.severityScore = sev.score;
        ref.flag = sev.flag;
        refs.push(ref);
      }
    }

    // Unguarded chained access $('id').prop on same line
    const chain = line.match(/\$\s*\(\s*['"]([a-zA-Z][\w-]*)['"]\s*\)\s*\.(innerHTML|textContent|classList|addEventListener|value)/);
    if (chain) {
      const id = chain[1];
      const exists = resolveExists(id, htmlIds);
      const domClass = classifyDom(id);
      const ref = {
        domId: id,
        file: rel,
        line: i + 1,
        function: findFunctionName(lines, i),
        domClass,
        exists,
        operation: chain[2],
        guarded: false,
        raw: line.trim().slice(0, 140),
      };
      const sev = scoreSeverity(ref);
      ref.severity = sev.level;
      ref.severityScore = sev.score;
      ref.flag = sev.flag;
      if (!refs.some((r) => r.file === ref.file && r.line === ref.line && r.domId === ref.domId)) {
        refs.push(ref);
      }
    }
  }

  return refs;
}

function dedupeRefs(refs) {
  const seen = new Set();
  return refs.filter((r) => {
    const k = `${r.file}:${r.line}:${r.domId}:${r.operation}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function main() {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const htmlIds = extractHtmlIds(indexHtml);
  const files = collectFiles();
  let allRefs = [];
  for (const f of files) {
    allRefs.push(...scanFile(f, htmlIds));
  }
  allRefs = dedupeRefs(allRefs);

  const broken = allRefs.filter((r) => r.flag === 'BROKEN_REFERENCE');
  broken.sort((a, b) => b.severityScore - a.severityScore || a.domId.localeCompare(b.domId));

  const byId = new Map();
  for (const r of broken) {
    if (!byId.has(r.domId)) byId.set(r.domId, []);
    byId.get(r.domId).push(r);
  }

  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const counts = Object.fromEntries(severityOrder.map((s) => [s, broken.filter((r) => r.severity === s).length]));

  const lines = [
    '# DEAD_REFERENCE_REPORT',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**HTML IDs in index.html:** ${htmlIds.size}`,
    `**References scanned:** ${allRefs.length} across ${files.length} files`,
    `**BROKEN_REFERENCE flags:** ${broken.length}`,
    '',
    '## Severity summary (ranked)',
    '',
    '| Severity | Count | Meaning |',
    '|----------|-------|---------|',
    '| CRITICAL | ' + counts.CRITICAL + ' | Required DOM missing + unguarded crash op |',
    '| HIGH | ' + counts.HIGH + ' | Optional missing + unguarded crash op, or required missing guarded |',
    '| MEDIUM | ' + counts.MEDIUM + ' | Missing DOM, guarded or non-crash lookup |',
    '| LOW | ' + counts.LOW + ' | Missing unknown DOM, low crash risk |',
    '',
    '## Required DOM contract',
    '',
    ...[...REQUIRED].map((id) => {
      const live = resolveExists(id, htmlIds);
      return `- \`${id}\`${id === 'cvPreview' ? ' → `#cvDoc`' : ''} — ${live ? '**exists**' : '**MISSING FROM HTML**'}`;
    }),
    '',
    '## BROKEN_REFERENCE — ranked by crash severity',
    '',
    '| Rank | Severity | DOM ID | Required? | Exists? | File | Function | Operation | Guarded? |',
    '|------|----------|--------|-----------|---------|------|----------|-----------|----------|',
  ];

  broken.forEach((r, idx) => {
    lines.push(
      `| ${idx + 1} | ${r.severity} | \`${r.domId}\` | ${r.domClass} | ${r.exists ? 'yes' : '**no**'} | \`${r.file}:${r.line}\` | ${r.function} | ${r.operation} | ${r.guarded ? 'yes' : '**no**'} |`
    );
  });

  lines.push('', '## BROKEN_REFERENCE detail', '');
  for (const [domId, refs] of [...byId.entries()].sort((a, b) => {
    const sa = Math.max(...a[1].map((r) => r.severityScore));
    const sb = Math.max(...b[1].map((r) => r.severityScore));
    return sb - sa;
  })) {
    const maxSev = refs[0].severity;
    lines.push(`### \`${domId}\` — ${maxSev} (${refs.length} refs)`);
    lines.push('');
    lines.push('| File | Line | Function | Required? | Exists? | Guarded? | Operation |');
    lines.push('|------|------|----------|-----------|---------|----------|-----------|');
    for (const r of refs.sort((a, b) => b.severityScore - a.severityScore)) {
      lines.push(
        `| \`${r.file}\` | ${r.line} | ${r.function} | ${r.domClass} | ${r.exists ? 'yes' : 'no'} | ${r.guarded ? 'yes' : 'no'} | ${r.operation} |`
      );
    }
    lines.push('');
    lines.push('```');
    lines.push(refs[0].raw);
    lines.push('```');
    lines.push('');
  }

  lines.push('## Full reference map (all DOM lookups)', '');
  lines.push('| DOM ID | File | Function | Required? | Optional? | Still exists? | Flag |');
  lines.push('|--------|------|----------|-----------|-----------|---------------|------|');
  const sorted = [...allRefs].sort(
    (a, b) =>
      (a.exists === b.exists ? 0 : a.exists ? 1 : -1) ||
      b.severityScore - a.severityScore ||
      a.domId.localeCompare(b.domId)
  );
  for (const r of sorted) {
    lines.push(
      `| \`${r.domId}\` | \`${r.file}:${r.line}\` | ${r.function} | ${r.domClass === 'required' ? 'yes' : ''} | ${r.domClass === 'optional' ? 'yes' : ''} | ${r.exists ? 'yes' : 'no'} | ${r.flag || ''} |`
    );
  }

  lines.push('', '## Production runtime (`index.html` only)', '');
  const prodBroken = broken.filter((r) => r.file === 'index.html');
  if (!prodBroken.length) {
    lines.push('No unguarded **BROKEN_REFERENCE** in `index.html`. Boot path is clean.');
  } else {
    lines.push('| Severity | DOM ID | Line | Function | Operation | Guarded? |');
    lines.push('|----------|--------|------|----------|-----------|----------|');
    for (const r of prodBroken) {
      lines.push(
        `| ${r.severity} | \`${r.domId}\` | ${r.line} | ${r.function} | ${r.operation} | ${r.guarded ? 'yes' : '**no**'} |`
      );
    }
  }

  lines.push('', '## Notes', '');
  lines.push('- `cvPreview` contract id resolves to live `#cvDoc` in `dom-safe.js`.');
  lines.push('- Guarded = nearby `if (el)`, optional chaining, `setHTML`/`setText`/`trackRenderHtml`, or try/catch within 8 lines.');
  lines.push('- QA-only files under `scripts/` may reference probes; production boot path is `index.html` + `src/ui/runtime/*`.');
  lines.push('- **No CRITICAL** = no required missing DOM with unguarded crash writes on boot path.');

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`BROKEN_REFERENCE: ${broken.length} (CRITICAL=${counts.CRITICAL} HIGH=${counts.HIGH} MEDIUM=${counts.MEDIUM} LOW=${counts.LOW})`);
}

main();
