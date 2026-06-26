#!/usr/bin/env node
/**
 * P0 — Email strictness report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'EMAIL_STRICTNESS_REPORT.md');
const jsonPath = join(root, 'tests/output/email-strictness/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-email-strictness.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const checkRows = (report?.checks || [])
  .map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const md = `# Email Strictness Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**Engine:** \`${report?.version || 'EMAIL_STRICTNESS_V1'}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Score:** ${report?.passCount ?? 0}/${report?.checks?.length ?? 0}

## Mission

Prevent email corruption during import/OCR. The local-part must never be mutated or extended.

**Acceptance:** \`yoaz@hotmail.fr\` must **never** become \`yoazg@hotmail.fr\`.

## Rules

| Rule | Enforcement |
|------|-------------|
| Never mutate email local-part | \`emailLocalPartAddsLetters\` detects added characters |
| Never add letters | Mutated parse recovered from source or rejected |
| Extract exact email from source | \`extractEmailsFromSource\` — verbatim regex + loose OCR \`@host tld\` |
| Uncertain OCR → reviewQueue | \`buildEmailReviewItem\` with \`sourceText\` |
| Autocorrect only if obvious + reversible | Domain-only fix: \`user@hotmail fr\` → \`user@hotmail.fr\` |
| Show sourceText for review | Review items include source line |

## Acceptance result

| Case | Result |
|------|--------|
| Source \`yoaz@hotmail.fr\`, parsed \`yoazg@hotmail.fr\` | **${report?.acceptance?.yoazNeverBecomesYoazg ? 'PASS — recovered yoaz@hotmail.fr' : 'FAIL'}** |
| Post-sanitize display | \`${report?.acceptance?.displayEmailAfterSanitize || '—'}\` |

## QA checks

| Check | Result | Detail |
|-------|--------|--------|
${checkRows || '| — | — | Run qa first |'}

## Implementation

- \`src/core/validation/email-strictness.js\` — source grounding, mutation detection, review items
- \`src/core/validation/identity-contact-strictness.js\` — wired before name/phone strictness
- \`src/core/validation/sanitize-resume-display.js\` — passes \`sourceText\` into contact strictness
- \`src/core/parsing/identity-extraction.js\` — \`extractEmailFromBlob\` uses source extractor
- \`src/core/parsing/ocr-cleanup.js\` — email mask during OCR typo repair

## Run

\`\`\`bash
npm run qa:email-strictness
npm run email-strictness-report
\`\`\`

## Bench output

\`\`\`
${bench.out || '(no output)'}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
