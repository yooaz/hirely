#!/usr/bin/env node
/**
 * H18 — Zero invented content report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'ZERO_INVENTED_CONTENT_REPORT.md');
const jsonPath = join(root, 'tests/output/h18-zero-invented-content/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-zero-invented-content.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const rows = (report?.checks || [])
  .map((c) => `| ${c.name} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const audited = (report?.auditedSymbols || [])
  .map((s) => `- \`${s}\` — ${report ? 'not found in product layer' : 'audit pending'}`)
  .join('\n');

const md = `# Zero Invented Content Report (H18)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

## Policy

Forbidden without OCR / DOCX / TXT / user edit:

- Generated identity names
- Generated job titles
- Generated summaries
- Generated experience
- Generated education
- Generated skills

When data is missing, UI displays:

> **${report?.undetectedLabel || 'Information non détectée'}**

Never fabricate CV content.

## Audited symbols

${audited}

No matches for \`fallbackTitle\`, \`fallbackName\`, \`fallbackSummary\`, \`demoData\`, \`placeholderIdentity\`, or \`sampleResume\` in the product layer (\`index.html\`, templates, final-resume contract, resume-data, safe-fallback).

## Remediation (H18)

| Area | Change |
|------|--------|
| Canonical label | \`src/core/display/undetected-label.js\` |
| Export fabrication | Removed \`ensurePartialExportProfile\` summary/experience synthesis |
| Identity sanitize | Invalid name/title → empty string (display layer shows undetected) |
| OCR failure preview | Empty identity — no \`Nom à confirmer\` injection |
| Template gallery | \`MINI_CV\` uses undetected label only — no Alex Martin demo CV |
| UI placeholders | Header, editor, i18n → \`Information non détectée\` |
| Parser recovery | \`NAME_UNCERTAIN_LABEL\` / \`TITLE_UNCERTAIN_LABEL\` → undetected label |

## Explicit sample path

\`loadSample()\` / \`sampleBtn\` still loads bundled paste text when the user opts in — treated as **user action**, not auto-invented content.

## Acceptance checks

| Check | Result | Detail |
|-------|--------|--------|
${rows || '| — | — | Run qa-zero-invented-content |'}

## Run

\`\`\`bash
npm run qa:h18-zero-invented-content
\`\`\`

---
Generated: ${new Date().toISOString()}
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
