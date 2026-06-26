#!/usr/bin/env node
/**
 * H13 — Generic classification hardening report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'GENERIC_CLASSIFICATION_HARDENING_REPORT.md');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const hardening = run('node', ['src/tests/qa-generic-classification-hardening.mjs']);
const yoaz = run('node', ['src/tests/qa-classification-fix-yoaz.mjs']);
const p7 = run('npm', ['run', 'qa:p7-stress-test']);

const pass = hardening.code === 0 && yoaz.code === 0 && p7.code === 0;

const md = `# Generic Classification Hardening Report (H13)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

## Goal

Replace candidate-specific OCR patches with generic classification rules in \`src/core\`.

## Production rules module

- \`src/core/parsing/ocr-classification-rules.js\`
  - URL/domain/social name rejection
  - OCR header category rejection (address, illustrations, expertise…)
  - URL-merged experience gate (year range + separators + URL or career signals)
  - Email local-part hint (search only — never fabricate a name)

## Audit — forbidden literals in \`src/core\`

Candidate-specific strings (\`Yohann\`, \`Yoaz\`, \`Azancot\`, \`comagi\`, fixture phrases) must not appear in production logic.

\`\`\`
qa-generic-classification-hardening: ${hardening.code === 0 ? 'PASS' : 'FAIL'}
\`\`\`

<details><summary>Output</summary>

\`\`\`
${hardening.out}
\`\`\`

</details>

## Regression tests

| Suite | Result |
|-------|--------|
| qa-generic-classification-hardening | ${hardening.code === 0 ? 'PASS' : 'FAIL'} |
| qa-classification-fix-yoaz | ${yoaz.code === 0 ? 'PASS' : 'FAIL'} |
| qa:p7-stress-test | ${p7.code === 0 ? 'PASS' : 'FAIL'} |

### Yoaz fixture output

\`\`\`
${yoaz.out}
\`\`\`

### P7 stress output

\`\`\`
${p7.out.split('\n').slice(-8).join('\n')}
\`\`\`

## Acceptance checklist

- [${hardening.code === 0 ? 'x' : ' '}] No hardcoded Yoaz/Yohann/Azancot in \`src/core\`
- [${hardening.code === 0 ? 'x' : ' '}] OCR garbage names rejected generically
- [${hardening.code === 0 ? 'x' : ' '}] URL-merged experiences recovered generically
- [${p7.code === 0 ? 'x' : ' '}] \`qa:p7-stress-test\` PASS

## Files touched (H13)

- \`src/core/parsing/ocr-classification-rules.js\` (new)
- \`src/core/parsing/classification-fixes.js\`
- \`src/core/parsing/identity-extraction.js\`
- \`src/core/validation/sanitize-resume-display.js\`
- \`src/core/validation/universal-safety-gate.js\`
- \`src/core/parsing/unsorted-section-recovery.js\`
- \`src/core/parsing/experience-recovery.js\`
- \`src/core/parsing/resume-output-quality.js\`
- \`src/core/parsing/ocr-experience-merge.js\`
- \`src/core/parsing/education-normalization-layer.js\`
- \`src/core/parsing/education-quality-engine.js\`
- \`src/core/parsing/corruption-detector.js\`
- \`src/tests/qa-generic-classification-hardening.mjs\` (new)
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
console.log(pass ? 'H13 PASS' : 'H13 FAIL');
process.exit(pass ? 0 : 1);
