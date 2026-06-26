#!/usr/bin/env node
/**
 * Generates IDENTITY_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function runSuite(cmd) {
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}

const suites = [
  ['qa:identity-lock', 'node src/tests/qa-identity-lock.mjs'],
  ['qa:name-phone-rewrite', 'node src/tests/qa-name-phone-rewrite.mjs'],
  ['qa:identity-contact-strictness', 'node src/tests/qa-identity-contact-strictness.mjs'],
  ['qa:email-strictness', 'node src/tests/qa-email-strictness.mjs'],
  ['qa:person-company-disambiguation', 'node src/tests/qa-person-company-disambiguation.mjs'],
];

const results = suites.map(([name, cmd]) => {
  const r = runSuite(cmd);
  const pass = (r.out.match(/\bPASS\b/g) || []).length;
  const fail = (r.out.match(/\bFAIL\b/g) || []).length;
  return { name, ok: r.ok, pass, fail };
});

const report = `# IDENTITY_LOCK_REPORT

Generated: ${new Date().toISOString()}

## P0 status

| Item | Value |
|------|-------|
| Version | \`IDENTITY_LOCK_V1\` |
| Identity confidence gate | **90%** — below → \`Identity needs review\` |
| Phone confidence gate | **95%** — stripped + reviewQueue |
| Email confidence gate | **90%** + RFC validation |
| Principle | **Missing is better than wrong** |

## QA snapshot

| Suite | Result |
|-------|--------|
${results.map((r) => `| \`${r.name}\` | ${r.ok ? '**PASS**' : '**FAIL**'} (${r.pass} pass / ${r.fail} fail) |`).join('\n')}

## Person name rules

### Hard rejects

- Company / agency tokens (studio, impressions, agency, company, …)
- Internship / stage / trainee tokens
- Years (\`2010\`, \`2019–2022\`, year ranges)
- Any digit in name
- More than 4 words or fewer than 2 words
- Employer name collision

### Confidence

- Display only when confidence ≥ **90%**
- Otherwise show **\`Identity needs review\`** (never guessed name)

## Phone rules

- International strict validation (\`validatePhoneStrict\`)
- Minimum **8** digits
- Reject date/year pollution (\`2011-2020\`, trailing years)
- Reject page numbers (\`Page 2 of 3\`, \`2/3\`)
- Display only when confidence ≥ **95%**; otherwise empty + reviewQueue

## Email rules

- RFC 5322 subset validation (\`validateEmailRfcStrict\`)
- OCR cleanup: collapse \`@@\`, \`..\`, duplicated symbols, whitespace
- Ground in source text — never mutate local-part
- Display only when confidence ≥ **90%** and RFC-valid
- Otherwise **\`Identity needs review\`** + reviewQueue

## Files

| File | Role |
|------|------|
| \`src/core/validation/identity-lock.js\` | **NEW** — strict validators + 90% gate |
| \`src/core/validation/identity-contact-strictness.js\` | Wired to identity lock |
| \`src/core/validation/email-strictness.js\` | RFC + OCR artifact cleanup |
| \`src/core/parsing/identity-extraction.js\` | Internship/year rejects |
| \`src/core/display/identity-labels.js\` | \`IDENTITY_NEEDS_REVIEW_LABEL\` |
| \`src/core/display/undetected-label.js\` | Treat review label as uncertain |
| \`src/tests/qa-identity-lock.mjs\` | Acceptance tests |

## Verification

\`\`\`bash
npm run qa:identity-lock
npm run identity-lock-report
\`\`\`
`;

fs.writeFileSync(path.join(ROOT, 'IDENTITY_LOCK_REPORT.md'), report, 'utf8');
console.log('Wrote IDENTITY_LOCK_REPORT.md');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}`);
