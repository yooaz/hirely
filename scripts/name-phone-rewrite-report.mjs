#!/usr/bin/env node
/**
 * Generates NAME_PHONE_REWRITE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

let qaOut = '';
let qaPass = true;
try {
  qaOut = execSync('node src/tests/qa-name-phone-rewrite.mjs', { cwd: ROOT, encoding: 'utf8' });
} catch (e) {
  qaPass = false;
  qaOut = (e.stdout || '') + (e.stderr || '') + (e.message || '');
}

const passCount = (qaOut.match(/PASS /g) || []).length;
const failCount = (qaOut.match(/FAIL /g) || []).length;

const report = `# NAME_PHONE_REWRITE_REPORT

Generated: ${new Date().toISOString()}

## P0 status

| Item | Value |
|------|-------|
| Version | \`NAME_PHONE_REWRITE_V1\` |
| Name confidence gate | **85%** → reviewQueue if below |
| Phone confidence gate | **95%** → reviewQueue if below |
| QA suite | ${qaPass ? 'PASS' : 'FAIL'} (${passCount} pass, ${failCount} fail) |

## Name extraction rules

### Priority order

1. Top CV header (before first section break)
2. Largest valid text block on first page
3. Text line directly above email
4. Text line directly above phone
5. Contact neighbors (±2 lines)

### Hard rejects

- Business tokens: agency, studio, company, group, inc, ltd, llc, impressions, creative, design, marketing, media, portfolio, freelance
- More than 4 words
- Contains digits, \`@\`, or URL
- Collides with employer name

### Principle

**Missing is better than wrong** — low-confidence names cleared and routed to reviewQueue.

## Phone extraction rules

### Accept

- \`+33XXXXXXXXX\` (French mobile/landline)
- \`0XXXXXXXXX\` (French national)
- Valid international E.164 patterns

### Never merge / accept

- Year ranges: \`2010-2013\`, \`2011 2014\`, \`+33… 2011-2020\`
- Postal codes: \`75011\`
- Page numbers: \`Page 2 of 3\`, \`2/3\`
- OCR junk: \`38 impressions\`

### Principle

Phone displayed only when confidence ≥ **95%** and \`validatePhoneStrict\` passes.

## Files changed

| File | Role |
|------|------|
| \`src/core/parsing/identity-extraction.js\` | v2 name priority, reject rules, 85% gate |
| \`src/core/parsing/phone-normalize.js\` | Pollution detection, 95% gate |
| \`src/core/parsing/parser-recovery.js\` | \`detectNameCandidates\` delegates to \`extractLockedIdentity\` |
| \`src/core/parsing/identity-name-phone-v2.js\` | Public rewrite API surface |

## Verification

\`\`\`bash
node src/tests/qa-name-phone-rewrite.mjs
npm run qa:phone-strict-extraction
npm run qa:identity-contact-strictness
\`\`\`

## QA output

\`\`\`
${qaOut.trim().slice(-2500)}
\`\`\`
`;

fs.writeFileSync(path.join(ROOT, 'NAME_PHONE_REWRITE_REPORT.md'), report);
console.log('Wrote NAME_PHONE_REWRITE_REPORT.md');
process.exit(qaPass ? 0 : 1);
