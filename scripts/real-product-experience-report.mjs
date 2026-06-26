#!/usr/bin/env node
/**
 * H16 — Real product experience report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'REAL_PRODUCT_EXPERIENCE_REPORT.md');
const jsonPath = join(root, 'tests/output/h16-real-product-experience/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-real-product-experience.mjs']);
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

const md = `# Real Product Experience Report (H16)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

## Goal

Ship a credible SaaS product experience — not a demo, prototype, or QA shell.

## Scope (product layer only)

- No OCR changes
- No parser changes
- No PDF engine changes

## Delivered

### 1. Analysis experience

Real staged import UX with visual stepper:

1. Reading PDF…
2. Extracting text…
3. Detecting sections…
4. Recruiter analysis…
5. Building CV…
6. Preparing preview…

Files: \`src/ui/product/import-analysis-stages.js\`, \`import-analysis-stages.css\`, wired in \`index.html\`.

### 2. Score credibility

Recruiter score capped by extraction / CV quality:

| Issue | Max score |
|-------|-----------|
| Wrong name | 40 |
| Missing experience | 50 |
| Missing education | 65 |
| Partial CV | 70 |
| Not clean | 80 |

File: \`src/core/validation/score-credibility-cap.js\` → \`product-score.js\`.

### 3. Template differentiation

Five production templates with distinct layout + typography:

- ATS Professional
- Creative Portfolio
- Executive
- Tech
- Modern Editorial

Files: \`cv-templates.js\`, \`cv-templates-h16.css\`.

### 4. True A4 preview

Default fit-page zoom; controls: **Fit · 75% · 100% · 125%**.

File: \`src/ui/export/a4-viewport.js\`, \`index.html\` zoom bar.

### 5. Empty state quality

When extraction quality &lt; 80:

- Hide “Ready to export”
- Hide high recruiter score band
- Show “Review required” with reasons

File: \`src/core/validation/product-experience-gate.js\` → \`enrichScoreReport()\`, Review Studio V2 badges.

## Automated checks

| Check | Result | Detail |
|-------|--------|--------|
${rows || '| — | — | Run qa-real-product-experience |'}

## Run

\`\`\`bash
npm run qa:real-product-experience
npm run qa:h16-real-product-experience
\`\`\`

## Acceptance

${pass ? 'Product layer behaves like a real SaaS import → review → export flow with credible scores and honest empty states.' : 'One or more H16 checks failed — see table above.'}
`;

writeFileSync(outPath, md);
console.log(bench.out);
console.log(`\nWrote ${outPath}`);
process.exit(pass ? 0 : 1);
