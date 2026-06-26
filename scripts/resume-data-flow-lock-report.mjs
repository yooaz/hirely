#!/usr/bin/env node
/**
 * P0 — RESUME_DATA_FLOW_LOCK report.
 * Output: RESUME_DATA_FLOW_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS,
  assertResumeDataFlowLock,
} from '../src/core/pipeline/hirely-flow-lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'RESUME_DATA_FLOW_LOCK_REPORT.md');

const REASONS = [
  {
    key: 'exhibitions',
    source: 'src/core/parsing/creative-cv-mode.js / parser output',
    fn: 'assertResumeDataFlowLock',
    condition: 'Key present on resumeData before lockResumeDataShape folds creative sections',
    severity: 'warning',
  },
  {
    key: 'awards',
    source: 'src/core/parsing/creative-cv-mode.js / parser output',
    fn: 'assertResumeDataFlowLock',
    condition: 'Key present on resumeData before lockResumeDataShape folds creative sections',
    severity: 'warning',
  },
  {
    key: 'publications',
    source: 'src/core/parsing/creative-cv-mode.js / parser output',
    fn: 'assertResumeDataFlowLock',
    condition: 'Key present on resumeData before lockResumeDataShape folds creative sections',
    severity: 'warning',
  },
  {
    key: 'portfolioLinks',
    source: 'src/core/parsing/creative-cv-mode.js / parser output',
    condition: 'Key present on resumeData before lockResumeDataShape folds creative sections',
    fn: 'assertResumeDataFlowLock',
    severity: 'warning',
  },
  {
    key: 'blocks',
    source: 'src/core/resume-data.js normalizeResumeData (editor blocks)',
    fn: 'assertResumeDataFlowLock',
    condition: 'Transient blocks array on resumeData before lockResumeDataShape strips it',
    severity: 'warning',
  },
];

const qa = spawnSync('node', ['src/tests/qa-resume-data-flow-lock.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});
const pass = qa.status === 0;

const sample = {
  identity: { email: 'a@b.com' },
  exhibitions: ['x'],
  awards: ['y'],
  publications: ['z'],
  portfolioLinks: ['https://x'],
  blocks: [{}],
};
const beforeLock = assertResumeDataFlowLock(sample);

const md = `# RESUME_DATA_FLOW_LOCK Report

Generated: ${new Date().toISOString()}

## Issue

Import completed (EXTRACTION_DONE, PARSER_DONE, IMPORT_FINAL) but UI stayed on import screen.
Console logged \`RESUME_DATA_FLOW_LOCK\` with **5 keys** — creative/parser fields present before product shape lock.

## Before — five lock reasons

| # | Key | Source | Function | Condition | Fatal? |
|---|-----|--------|----------|-----------|--------|
${REASONS.map(
  (r, i) =>
    `| ${i + 1} | \`${r.key}\` | ${r.source} | \`${r.fn}\` | ${r.condition} | **No** (warning only) |`
).join('\n')}

**Pre-fix behavior:** \`normalizeResumeData\` asserted flow lock **before** \`lockResumeDataShape\`, so all five keys logged as \`console.error('RESUME_DATA_FLOW_LOCK', …)\`. UI gate required \`isFinalResumeValid()\` / \`cvPreviewIsLive()\` — partial CVs with valid sections still fell back to import screen.

**Sample pre-shape assert:** warnings=\`${beforeLock.warnings.join(', ')}\`, fatal=\`${beforeLock.fatal.join(', ') || '(none)'}\`

## After — behavior

1. **Shape before assert** — \`normalizeResumeData\` calls \`lockResumeDataShape\` before \`assertResumeDataFlowLock\`; folded keys no longer appear on product resumeData.
2. **Warn vs fatal** — \`FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS\` (\`${FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS.join('`, `')}\`) are **warnings only**; fatal reserved for debug/parser payload keys.
3. **Import minimum** — \`resumeDataMeetsImportMinimum\`: email, phone, experience, education, skills, or clients → advance to Review.
4. **Partial import** — \`IMPORT_PARTIAL\` when minimum met but full contract not satisfied; data is **not** deleted.
5. **UI gates** (\`index.html\`) — \`isWorkspaceReady\`, \`renderCVInner\`, \`handleFileImport\` end path advance when \`rawText > 300\` + parser done + minimum data.

## Expected flow

\`\`\`
IMPORT_STARTED → EXTRACTION_DONE → PARSER_DONE → FINAL_RESUME_READY → REVIEW_SCREEN_VISIBLE
\`\`\`

## QA

\`\`\`bash
npm run qa:resume-data-flow-lock
\`\`\`

\`\`\`
${(qa.stdout || '').trim()}
${(qa.stderr || '').trim()}
\`\`\`

## Verdict

**${pass ? 'PASS' : 'FAIL'}**

${pass
  ? '- Flow lock does not block import when minimum resumeData exists\n- Creative fold keys are warnings only\n- normalizeResumeData output is product-clean'
  : '- QA failed — see output above'}
`;

fs.writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`Verdict: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
