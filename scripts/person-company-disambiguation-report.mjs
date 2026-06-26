#!/usr/bin/env node
/**
 * Generates PERSON_COMPANY_DISAMBIGUATION_REPORT.md
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
  qaOut = execSync('node src/tests/qa-person-company-disambiguation.mjs', { cwd: ROOT, encoding: 'utf8' });
} catch (e) {
  qaPass = false;
  qaOut = (e.stdout || '') + (e.stderr || '') + (e.message || '');
}

const passCount = (qaOut.match(/PASS /g) || []).length;
const failCount = (qaOut.match(/FAIL /g) || []).length;

const report = `# PERSON_COMPANY_DISAMBIGUATION_REPORT

Generated: ${new Date().toISOString()}

## P0 status

| Item | Value |
|------|-------|
| Version | \`PERSON_COMPANY_DISAMBIGUATION_V1\` |
| Entity types | person, company, school, client, skill |
| QA suite | ${qaPass ? 'PASS' : 'FAIL'} (${passCount} pass, ${failCount} fail) |

## Rule

**Never allow company names to become candidate identity.**

Entity type is detected **before render**. If type is \`company\`, it cannot populate:

- \`fullName\` (identity.name)
- \`headline\` (identity.title)
- \`email\`
- \`phone\`

School, client, and skill entities are also blocked from \`fullName\` / \`headline\`.

## Detection order

1. **Company** — agency/studio/impressions/business tokens, org suffixes (inc, ltd, sarl…)
2. **School** — school dictionary, education semantic cues
3. **Client** — brand/client dictionary (Nike, Adobe…)
4. **Skill** — tools, software, standalone disciplines
5. **Person** — valid person-name pattern or job title (headline only)

## Principle

**Missing is better than wrong** — blocked values cleared, pushed to reviewQueue / unsorted.

## Files

| File | Role |
|------|------|
| \`src/core/parsing/person-company-disambiguation.js\` | Entity classification + identity field guard |
| \`src/core/validation/sanitize-resume-display.js\` | Pre-render disambiguation pass |
| \`src/core/resume-data.js\` | \`sanitizeIdentity\` guard |
| \`src/tests/qa-person-company-disambiguation.mjs\` | QA suite |

## Verification

\`\`\`bash
node src/tests/qa-person-company-disambiguation.mjs
npm run qa:identity-false-name
npm run qa:name-phone-rewrite
\`\`\`

## QA output

\`\`\`
${qaOut.trim()}
\`\`\`
`;

fs.writeFileSync(path.join(ROOT, 'PERSON_COMPANY_DISAMBIGUATION_REPORT.md'), report);
console.log('Wrote PERSON_COMPANY_DISAMBIGUATION_REPORT.md');
