#!/usr/bin/env node
/**
 * Generates CORE_ENGINE_RECOVERY_REPORT.md, STARTUP_DEPENDENCY_MAP.md, BOOT_FAILURE_ROOT_CAUSE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { CORE_BOOT_FEATURES, CORE_BOOT_STARTUP_CHAIN } from '../src/core/boot/boot-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const AUDIT_JSON = path.join(ROOT, '.cache', 'core-engine-boot-audit.json');

try {
  execSync('node scripts/audit-core-engine-boot.mjs', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  // audit may exit 1 on fatal — still read partial json if written
}

const audit = fs.existsSync(AUDIT_JSON)
  ? JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'))
  : { rootCause: 'audit not run', moduleLoads: [], exports: {}, startupChain: [] };

const mermaidNodes = CORE_BOOT_FEATURES.map((f) => {
  const pf = audit.exports?.perFeature?.find((x) => x.feature === f.id);
  const st = pf?.loadStatus === 'loaded' ? 'ok' : pf?.loadStatus === 'failed' ? 'fail' : '?';
  return `  ${f.id}["${f.label}${f.required ? ' *' : ''}<br/>${st}"]`;
}).join('\n');

const mermaidEdges = [
  '  BOOT_START --> CORE_BOOT',
  '  CORE_BOOT --> import_core',
  '  import_core --> file_import',
  '  import_core --> review_queue',
  '  import_core --> fact_extraction',
  '  import_core --> section_engine',
  '  import_core --> resume_graph',
  '  import_core --> identity_extraction',
  '  import_core --> ocr_pipeline',
  '  CORE_BOOT --> TEMPLATE_REGISTRY_READY',
  '  TEMPLATE_REGISTRY_READY --> IMPORT_UI_READY',
].join('\n');

const startupMap = `# STARTUP_DEPENDENCY_MAP

Generated: ${audit.generatedAt || new Date().toISOString()}

## Startup chain

| Phase | Status | Notes |
|-------|--------|-------|
${(audit.startupChain || CORE_BOOT_STARTUP_CHAIN.map((p) => ({ phase: p, status: 'unknown' })))
  .map((s) => `| ${s.phase} | ${s.status} | ${s.detail ? JSON.stringify(s.detail).slice(0, 120) : '—'} |`)
  .join('\n')}

## Feature tiers (boot contract v1)

| Feature | Required | Module | Load | Missing exports |
|---------|----------|--------|------|-----------------|
${(audit.exports?.perFeature || [])
  .map(
    (p) =>
      `| ${p.feature} | ${p.required ? 'yes' : 'no'} | \`${p.module}\` | ${p.loadStatus} | ${(p.missingExports || []).join(', ') || '—'} |`
  )
  .join('\n')}

## Dependency graph

\`\`\`mermaid
flowchart TD
${mermaidNodes}
${mermaidEdges}
\`\`\`

\* Required for import — all other features degrade independently.

## Module load matrix

| Module | Status | Error |
|--------|--------|-------|
${(audit.moduleLoads || [])
  .map((m) => `| \`${m.module}\` | ${m.status} | ${(m.error || '—').slice(0, 80)} |`)
  .join('\n')}

## Browser boot path

1. \`index.html\` → \`getHirelyCore()\`
2. Dynamic import \`src/core/boot/core-boot-loader.mjs\`
3. \`loadHirelyCoreForBrowser()\` tries \`src/core/index.js\`
4. On failure → \`minimal-import-core.mjs\` (paste + file import only)
5. \`assessCoreModule()\` — fatal only if \`import_core\` missing
6. \`TEMPLATE_REGISTRY_READY\` / \`IMPORT_UI_READY\` — UI markers after core OK
`;

const rootCause = `# BOOT_FAILURE_ROOT_CAUSE

Generated: ${audit.generatedAt || new Date().toISOString()}

## Summary

**Root cause:** ${audit.rootCause || 'unknown'}

## Why users saw \`core_modules_incomplete\`

The legacy \`reportHirelyCoreStatus()\` treated the core bundle as **all-or-nothing**:

- Required \`runHirelyImportFromText\`, \`canonicalImportFromFile\`, and \`resumeDataMeetsImportMinimum\` simultaneously
- Any missing optional export → \`loaded: false\` → banner \`Le moteur Hirely n'a pas chargé (core_modules_incomplete)\`
- Entire import UI blocked even when paste import could work

## Fix applied

| Change | File |
|--------|------|
| Tiered boot contract (required vs optional) | \`src/core/boot/boot-contract.mjs\` |
| Boot loader with trace + minimal fallback | \`src/core/boot/core-boot-loader.mjs\` |
| Emergency import-only core | \`src/core/boot/minimal-import-core.mjs\` |
| Browser uses loader; per-feature warnings | \`index.html\` |

## Failure modes

### Fatal (blocks import)

- \`import_core\` missing: no \`runHirelyImportFromText\` or \`resumeDataMeetsImportMinimum\`
- Full barrel and minimal fallback both fail to load

### Degraded (import works, feature warnings)

- Optional module missing → \`Feature unavailable: <name> failed\`
- Examples: identity extraction, OCR, review queue, section engine

## Dynamic import failures (Node audit)

${(audit.dynamicImportFailures || []).length ? audit.dynamicImportFailures.map((f) => `- \`${f.module}\`: ${f.error}`).join('\n') : '_None detected in Node audit._'}

## Init throws

${(audit.initThrows || []).length ? audit.initThrows.map((t) => `- \`${t.module}\`: ${t.message}`).join('\n') : '_None._'}

## Circular imports detected

${(audit.circularImports || []).length ? audit.circularImports.map((c) => `- ${c.cycle}`).join('\n') : '_None in boot-critical scan._'}

## Grep: \`CORE_BOOT_FAILED\` (${audit.grep?.CORE_BOOT_FAILED?.length || 0} hits)

${(audit.grep?.CORE_BOOT_FAILED || [])
  .slice(0, 15)
  .map((h) => `- \`${h.file}:${h.line}\` ${h.text.slice(0, 100)}`)
  .join('\n') || '_None_'}

## Grep: \`core_modules_incomplete\` (${audit.grep?.core_modules_incomplete?.length || 0} hits)

${(audit.grep?.core_modules_incomplete || [])
  .map((h) => `- \`${h.file}:${h.line}\` ${h.text.slice(0, 100)}`)
  .join('\n') || '_None_'}
`;

const recovery = `# CORE_ENGINE_RECOVERY_REPORT

Generated: ${audit.generatedAt || new Date().toISOString()}

## P0 status

| Check | Result |
|-------|--------|
| Full barrel \`src/core/index.js\` | ${audit.moduleLoads?.find((m) => m.module === 'src/core/index.js')?.status || '?'} |
| Boot loader wired in \`index.html\` | ${audit.usesBootLoader ? 'yes' : 'no'} |
| Tiered assessment (not all-or-nothing) | ${audit.legacyAllOrNothingGate ? 'NO — fix pending' : 'yes'} |
| Minimal import fallback | \`src/core/boot/minimal-import-core.mjs\` |
| Per-feature unavailable messages | \`Feature unavailable: … failed\` |

## Startup audit

${(audit.startupChain || [])
  .map((s) => `- **${s.phase}**: ${s.status}`)
  .join('\n')}

## Missing exports (optional features)

${(audit.exports?.perFeature || [])
  .filter((p) => p.missingExports?.length)
  .map((p) => `- **${p.feature}** (\`${p.module}\`): ${p.missingExports.join(', ')}`)
  .join('\n') || '_All feature modules export expected symbols in Node._'}

## Emergency fallback behavior

\`\`\`
Full index.js fails
  → load minimal-import-core (hirely-import + canonical-import + resume-data)
  → import_core OK → CORE_BOOT_OK (degraded)
  → optional features show amber banner, not red fatal banner
\`\`\`

## Required exports (\`import_core\`)

- \`runHirelyImportFromText\`
- \`resumeDataMeetsImportMinimum\`

## Optional exports (disable feature only)

${CORE_BOOT_FEATURES.filter((f) => !f.required)
  .map((f) => `- ${f.label}: ${f.exports.join(' | ')}`)
  .join('\n')}

## Recommendations

${(audit.recommendations || []).map((r) => `- ${r}`).join('\n')}

## Verification commands

\`\`\`bash
npm run test:core-boot
npm run test:browser-boot-upload
node scripts/audit-core-engine-boot.mjs
node scripts/check-core-exports.mjs
\`\`\`

## Related artifacts

- \`STARTUP_DEPENDENCY_MAP.md\`
- \`BOOT_FAILURE_ROOT_CAUSE.md\`
- \`.cache/core-engine-boot-audit.json\`
`;

fs.writeFileSync(path.join(ROOT, 'STARTUP_DEPENDENCY_MAP.md'), startupMap);
fs.writeFileSync(path.join(ROOT, 'BOOT_FAILURE_ROOT_CAUSE.md'), rootCause);
fs.writeFileSync(path.join(ROOT, 'CORE_ENGINE_RECOVERY_REPORT.md'), recovery);

console.log('Wrote STARTUP_DEPENDENCY_MAP.md');
console.log('Wrote BOOT_FAILURE_ROOT_CAUSE.md');
console.log('Wrote CORE_ENGINE_RECOVERY_REPORT.md');
