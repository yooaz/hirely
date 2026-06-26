#!/usr/bin/env node
/**
 * ATS Elite template report → ATS_ELITE_TEMPLATE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'ATS_ELITE_TEMPLATE.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/ats-elite/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-ats-elite-template.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# ATS Elite Template

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template ID:** \`ats-elite\`  
**Display name:** ATS Elite

## Design brief

Inspired by hiring teams at Google, Stripe, Linear, and Notion.

| Attribute | Value |
|-----------|-------|
| Style | Clean black & white, professional, dense, high readability |
| Tier | Pro |
| ATS safety | High |
| Icons | None |
| Progress bars | None |
| Colored blocks | None |
| Visual gimmicks | None |

## Layout (fixed order)

1. Name
2. Title
3. Contact (compact line)
4. Summary
5. Experience (tight density)
6. Education
7. Skills (comma-separated line)
8. Tools (comma-separated line)
9. Languages (plain lines)

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/cv-templates.js\` | \`layoutAtsElite\`, \`stackAtsElite\`, \`headAtsElite\` |
| \`src/ui/templates/cv-templates-ats-elite.css\` | Black/white dense typography |
| \`src/ui/templates/v2/registry.js\` | V2 metadata + alias \`ats-elite → ats-elite\` |
| \`src/ui/templates/production-template-ids.mjs\` | Featured + display name |
| \`index.html\` | Stylesheet link, picker, display name |

## QA

\`\`\`bash
npm run qa:ats-elite-template
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## Section order (render)

\`${(report?.sectionOrder || []).join(' → ')}\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
process.exitCode = qaPass ? 0 : 1;
