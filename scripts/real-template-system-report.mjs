#!/usr/bin/env node
/**
 * H20 — Real template system report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'REAL_TEMPLATE_SYSTEM_REPORT.md');
const jsonPath = join(root, 'tests/output/h20-real-template-system/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-real-template-system.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const templateRows = (report?.templates || [])
  .map(
    (t) =>
      `| ${t.displayName || t.name} | ${t.grid} | ${t.typography} | ${t.sectionLayout} | ${t.spacing} | ${t.pdfSignature} |`
  )
  .join('\n');

const checkRows = (report?.checks || [])
  .map((c) => `| ${c.name} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const md = `# Real Template System Report (H20)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

## Goal

Five production templates that a recruiter can identify in **under 2 seconds** — each with a distinct grid, hierarchy, typography, section layout, spacing system, and PDF output.

## Production templates

| Template | Grid | Typography | Section layout | Spacing | PDF signature |
|----------|------|------------|----------------|---------|---------------|
${templateRows || '| — | — | — | — | — | — |'}

## Differentiation axes

| Axis | Implementation |
|------|----------------|
| Grid | Single (ATS) · centered narrow (Executive) · magazine split (Creative) · 34/66 editorial · 30/70 tech rail |
| Hierarchy | Dense scan · serif authority · clients/projects first · Swiss meta rail · mono name + skills sidebar |
| Typography | IBM Plex · Cormorant/Source Serif · Playfair/DM Sans · Helvetica/Georgia · JetBrains/DM Sans |
| Section layout | Linear · centered column · creative reorder · side meta + main · dark skills rail |
| Spacing | 14px tight · 22px executive · 20px airy · 24px editorial · 16px tech |
| PDF output | Per-template rules in \`cv-pdf-export.css\` (grids, rails, backgrounds) |

## Files

- \`src/ui/templates/cv-templates.js\` — layout renderers + \`cvLayout-h20-*\` classes
- \`src/ui/templates/cv-templates-h20.css\` — typography, grid, spacing tokens
- \`src/ui/templates/cv-pdf-export.css\` — print/PDF differentiation
- \`src/ui/templates/template-system-h20.mjs\` — fingerprints + contract
- \`src/ui/templates/production-template-ids.mjs\` — canonical ids + display names

## Acceptance checks

| Check | Result | Detail |
|-------|--------|--------|
${checkRows || '| — | — | Run qa-real-template-system |'}

## Run

\`\`\`bash
npm run qa:h20-real-template-system
\`\`\`

---
Generated: ${new Date().toISOString()}
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
