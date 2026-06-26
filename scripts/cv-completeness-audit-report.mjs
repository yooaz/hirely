#!/usr/bin/env node
/**
 * P3 CV completeness audit report → CV_COMPLETENESS_AUDIT_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_COMPLETENESS_AUDIT_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/cv-completeness-audit/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-cv-completeness-audit.mjs', { cwd: ROOT, stdio: 'pipe' });
  qaPass = true;
} catch {
  qaPass = false;
}

if (fs.existsSync(REPORT_JSON)) {
  report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
}

const checks = report?.checks || [];
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const sparse = report?.sparseAudit || {};
const rich = report?.richAudit || {};

const md = `# CV Completeness Audit (P3)

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Coverage target:** ${report?.targetPct ?? 80}%+  
**QA checks:** ${passed}/${total}

## Problem

After parsing, imported **raw text** must appear in **finalResumeData** (preview). Silent loss is unacceptable.

Example:

| Metric | Value |
|--------|-------|
| Raw text | 1500 chars |
| Preview | 700 chars |
| Coverage | **46%** — not acceptable |

## Solution — CV completeness audit

**Module:** \`src/core/validation/cv-completeness-audit.js\`

| Function | Role |
|----------|------|
| \`auditCvCompleteness(rawText, finalResumeData)\` | Compare raw vs preview; line + char coverage |
| \`flattenFinalResumePreviewText\` | Flatten finalResumeData for preview char count |
| \`findUnclassifiedLines\` | Orphan lines not in structured fields |
| \`buildCompletenessReviewItems\` | Push orphans into review queue |

**Target:** \`CV_COMPLETENESS_TARGET_PCT = 80\`

**Below target:**

- French message: **« ${"Une partie du CV n'a pas été classifiée"} »**
- Review queue opened (\`openReviewQueue: true\`)
- Unclassified lines → \`finalResumeData.suggestions\` (to-classify panel)
- Banner in UI (\`renderCvIncompleteBanner\`)

### Pipeline hook

\`buildFinalResumeData\` runs the audit after shaping and attaches:

- \`quality.completeness\` on finalResumeData
- \`completenessAudit\` on build result
- Merged \`reviewItems\` for review panel

### UI

- \`commitResumeData\` passes \`rawText\` / \`cleanText\` into builder
- \`state.completenessAudit\` drives banner + product experience gate
- Review studio shows « Relecture requise » when coverage &lt; 80%

## Acceptance (QA)

| Fixture | Expected |
|---------|----------|
| Sparse finalResumeData vs rich raw | Coverage &lt; 80%, review items queued |
| Rich Yoaz-like resume | Coverage ≥ 80% |
| Char ratio example (1500 → ~700) | ~46% char coverage |

### Latest run

| Case | rawChars | previewChars | coveragePct |
|------|----------|--------------|-------------|
| Sparse | ${sparse.rawChars ?? '—'} | ${sparse.previewChars ?? '—'} | ${sparse.coveragePct ?? '—'}% |
| Rich | — | — | ${rich.coveragePct ?? '—'}% (${rich.meetsTarget ? 'PASS' : 'FAIL'}) |

## Commands

\`\`\`bash
npm run qa:cv-completeness-audit
npm run cv-completeness-audit-report
\`\`\`

## Checks

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.id}**${c.detail ? ` — ${c.detail}` : ''}`).join('\n')}
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT}`);
process.exit(qaPass ? 0 : 1);
