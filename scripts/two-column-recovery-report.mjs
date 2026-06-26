#!/usr/bin/env node
/**
 * P1 Two-column recovery report → TWO_COLUMN_RECOVERY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TWO_COLUMN_RECOVERY_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/two-column-recovery/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-two-column-recovery.mjs', { cwd: ROOT, stdio: 'pipe' });
  qaPass = true;
} catch {
  qaPass = false;
}

try {
  execSync('node src/tests/qa-yoaz-two-column.mjs', { cwd: ROOT, stdio: 'pipe' });
} catch {
  qaPass = false;
}

if (fs.existsSync(REPORT_JSON)) {
  report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
}

const checks = report?.checks || [];
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;

const md = `# Two-Column Recovery (P1)

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**QA checks:** ${passed}/${total}

## Problem

Two-column CVs were merged into a single reading stream. Sidebar content leaked into the main column:

| Symptom | Cause |
|---------|--------|
| Skills → experience | Row-major sort interleaved columns; date/role heuristics fired in wrong section |
| Languages → education | Same-column y-band overlap without column context |
| Education → experience | Experience recovery ran on full flat text after layout blocks were correct |

## Solution

### 1. Column-aware reading order (\`layout-memory.js\`)

Positioned lines now use \`applyReadingOrder\` (full → left → right) instead of naive y-then-x sort when multi-column layout is detected.

### 2. Two-column recovery module

**File:** \`src/core/layout/two-column-recovery.js\`

| Step | Action |
|------|--------|
| Detect | \`detectLayout\` + \`applyReadingOrder\` → left / right / full columns |
| Reconstruct | \`inferSemanticSectionBlocks\` per column with isolated \`layoutMemory\` |
| Merge | Blocks tagged \`two_column_recovery\`, reading order preserved |

Exports: \`recoverTwoColumnSections\`, \`isMultiColumnLayoutType\`

### 3. Parser hooks

| Hook | Change |
|------|--------|
| \`section-detect-v2.js\` | Runs recovery before semantic classification; sets \`twoColumnRecovery\` flag |
| \`semantic-section-infer.js\` | Active section context — education/languages/skills lines stay in column section |
| \`semantic-line-classifier.js\` | Section headers reset context; schools checked before date-range → experience |
| \`structured-resume-from-blocks.js\` | Strips education schools from experience after block ingest; passes \`readingStage\` |

## Acceptance (Yoaz two-column fixture)

| Section | Expected |
|---------|----------|
| Skills | Illustration, Graphic Design, … |
| Languages | French — native, English — fluent |
| Education | LISAA, Créapole |
| Experience | Freelance, Nike clients |

**Guards:** LISAA ∉ experience · Nike ∉ education · Languages ∉ education

## QA

\`\`\`bash
npm run qa:two-column-recovery
npm run qa:yoaz-two-column
npm run two-column-recovery-report
\`\`\`

## Check results

${checks.length ? checks.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.detail || ''}`).join('\n') : '_Run QA to populate checks._'}

## Recovery stats

\`\`\`json
${JSON.stringify(report?.recovery || {}, null, 2)}
\`\`\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
