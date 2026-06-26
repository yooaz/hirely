#!/usr/bin/env node
/**
 * H14 — Semantic confidence gate report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'SEMANTIC_CONFIDENCE_GATE_REPORT.md');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const h14 = run('node', ['src/tests/qa-semantic-confidence-gate.mjs']);
const recruiter = run('node', ['src/tests/qa-recruiter-review-mode.mjs']);
const p7 = run('npm', ['run', 'qa:p7-stress-test']);

const pass = h14.code === 0 && recruiter.code === 0 && p7.code === 0;

const md = `# Semantic Classification Confidence Gate Report (H14)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

## Goal

Before \`finalResumeData\`, uncertain classified text must not auto-place in the CV preview.
Items below **80% confidence** (or ambiguous) are stripped from product sections and sent to **À valider** review cards.

## Gate module

- \`src/core/validation/semantic-confidence-gate.js\`
  - \`SEMANTIC_CONFIDENCE_GATE_MIN = 80\`
  - \`applySemanticConfidenceGate(resumeData)\` — strips low-confidence placements, returns \`reviewItems\`
  - \`assessSemanticPlacement(text, section)\` — per-line gate decision
  - \`auditSemanticConfidenceGate(finalResumeData, reviewItems)\` — post-build audit

## Pipeline insertion

\`buildFinalResumeData()\` in \`final-resume-contract.js\`:

\`\`\`
resumeData → sanitizeResumeForDisplay → applySemanticConfidenceGate → ensurePartialExportProfile → finalResumeData
\`\`\`

Review items are merged into \`state.reviewQueue\` on commit (wired to existing accept/move/edit/ignore UI).

## Review card fields

Each gated item includes:

| Field | Description |
|-------|-------------|
| \`detectedType\` | Suggested section type |
| \`confidence\` | Classification score (0–100) |
| \`sourceText\` | Original extracted line |
| \`reason\` | Why auto-place was blocked |

## Regression cases

| Case | Expected |
|------|----------|
| visual communication | Review queue — not in skills/education |
| JB Impressions | Review queue — not in name/clients/experience |
| URL/domain lines | Review queue — not in experience/education/skills |
| High-confidence lines | Remain in CV sections |

## Test results

| Suite | Result |
|-------|--------|
| qa-semantic-confidence-gate | ${h14.code === 0 ? 'PASS' : 'FAIL'} |
| qa-recruiter-review-mode | ${recruiter.code === 0 ? 'PASS' : 'FAIL'} |
| qa:p7-stress-test | ${p7.code === 0 ? 'PASS' : 'FAIL'} |

### H14 gate output

\`\`\`
${h14.out}
\`\`\`

### Recruiter review output

\`\`\`
${recruiter.out.split('\n').slice(0, 12).join('\n')}
\`\`\`

### P7 stress (tail)

\`\`\`
${p7.out.split('\n').slice(-6).join('\n')}
\`\`\`

## Acceptance checklist

- [${h14.code === 0 ? 'x' : ' '}] Uncertain items appear in À valider (review queue)
- [${h14.code === 0 ? 'x' : ' '}] CV preview stays clean (no gated text in sections)
- [${h14.code === 0 ? 'x' : ' '}] No garbage in header/education/experience from low-confidence lines
- [${h14.code === 0 ? 'x' : ' '}] User can accept/move/edit/ignore via existing review cards
- [${recruiter.code === 0 ? 'x' : ' '}] H12 recruiter review regressions still pass
- [${p7.code === 0 ? 'x' : ' '}] P7 stress suite still passes

---

*Generated ${new Date().toISOString()}*
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
console.log(pass ? 'PASS semantic-confidence-gate-report' : 'FAIL semantic-confidence-gate-report');
process.exit(pass ? 0 : 1);
