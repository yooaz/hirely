#!/usr/bin/env node
/**
 * Executive Luxury template report → EXECUTIVE_LUXURY_TEMPLATE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXECUTIVE_LUXURY_TEMPLATE.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/executive-luxury/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-executive-luxury-template.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Executive Luxury Template

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template ID:** \`executive-luxury\`  
**Display name:** Executive Luxury

## Design brief

Inspired by McKinsey, BCG, Goldman Sachs, and Airbnb executives.

| Attribute | Value |
|-----------|-------|
| Style | Luxury minimalism · strong hierarchy |
| Typography | Source Serif 4 headings · IBM Plex Sans body |
| Tier | Pro |
| ATS safety | High |
| Focus | Impact — result · revenue · team · achievement |

## Layout (fixed order)

1. Large name + professional title + contact
2. Executive Summary
3. Leadership Experience (impact metrics per role)
4. Achievements
5. Education
6. Skills
7. Languages

## Impact fields (per experience)

Explicit on \`experiences[]\`:

- \`result\`
- \`revenue\`
- \`teamSize\` (or \`team\`)
- \`achievement\`
- \`impact: { result, revenue, teamSize, achievement }\`

Bullets are used as fallback inference when explicit fields are absent.

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/cv-templates.js\` | \`layoutExecutiveLuxury\`, impact rendering |
| \`src/ui/templates/cv-templates-executive-luxury.css\` | Luxury minimal typography |
| \`src/ui/templates/v2/registry.js\` | V2 metadata |
| \`index.html\` | Stylesheet + featured picker |

## QA

\`\`\`bash
npm run qa:executive-luxury-template
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## Section order

\`${(report?.sectionOrder || []).join(' → ')}\`

## PDF artifact

\`tests/output/executive-luxury/executive-luxury.pdf\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
process.exitCode = qaPass ? 0 : 1;
