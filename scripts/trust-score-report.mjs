#!/usr/bin/env node
/**
 * H19 — Trust score report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'TRUST_SCORE_REPORT.md');
const jsonPath = join(root, 'tests/output/h19-trust-score/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-trust-score.mjs']);
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

const weights = report?.weights || {
  extraction: 0.4,
  completeness: 0.25,
  recruiterQuality: 0.25,
  formatting: 0.1,
};

const caps = report?.caps || {
  wrongName: 30,
  missingEmail: 40,
  missingExperience: 50,
  missingEducation: 60,
  criticalReview: 70,
};

const md = `# Trust Score Report (H19)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

## Model

Recruiter-facing score is a **trust score** built from pipeline quality — not a single category sum.

### Weighted pillars

| Pillar | Weight | Source |
|--------|--------|--------|
| Extraction quality | ${Math.round(weights.extraction * 100)}% | Import extraction score + classification (parser) quality |
| Completeness | ${Math.round(weights.completeness * 100)}% | CV section completeness |
| Recruiter quality | ${Math.round(weights.recruiterQuality * 100)}% | Recruiter / ATS score V2 |
| Formatting | ${Math.round(weights.formatting * 100)}% | Formatting dimension from ATS score |

Within the extraction pillar: **55% extraction + 45% classification** when import quality metrics are available.

Implementation: \`src/core/validation/trust-score.js\` → \`product-score.js\`.

## Hard caps

| Issue | Max score |
|-------|-----------|
| Wrong / unconfirmed name | ${caps.wrongName} |
| Missing email | ${caps.missingEmail} |
| Missing experience | ${caps.missingExperience} |
| Missing education | ${caps.missingEducation} |
| Unresolved **critical** review items | ${caps.criticalReview} |

Critical review items include pending identity, experience, contact, corruption/OCR, semantic-confidence gate holds, and low-confidence placements.

## Acceptance checks

| Check | Result | Detail |
|-------|--------|--------|
${rows || '| — | — | Run qa-trust-score |'}

## Run

\`\`\`bash
npm run qa:h19-trust-score
\`\`\`

---
Generated: ${new Date().toISOString()}
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
