#!/usr/bin/env node
/**
 * Swiss Editorial template report → SWISS_EDITORIAL_TEMPLATE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SWISS_EDITORIAL_TEMPLATE.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/swiss-editorial/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-swiss-editorial-template.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Swiss Editorial Template

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template ID:** \`swiss-editorial\`  
**Display name:** Swiss Editorial

## Design brief

Inspired by Neue Grafik, Swiss design, Monocle, and the Financial Times.

| Attribute | Value |
|-----------|-------|
| Style | Editorial · grid-based · sophisticated |
| Typography | IBM Plex Sans · strong hierarchy |
| Margins | Large (60px) · professional rhythm |
| Icons | None |
| Progress bars | None |

## Layout

1. Masthead — large uppercase name · title · contact rail
2. Profile (summary)
3. Grid body:
   - **Main column** — Experience
   - **Sidebar** — Education · Skills · Tools · Languages

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/cv-templates.js\` | \`layoutSwissEditorial\`, grid stack |
| \`src/ui/templates/cv-templates-swiss-editorial.css\` | Swiss editorial typography |
| \`src/ui/templates/v2/registry.js\` | V2 metadata + aliases |
| \`index.html\` | Stylesheet + featured picker |

## QA

\`\`\`bash
npm run qa:swiss-editorial-template
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## PDF artifact

\`tests/output/swiss-editorial/swiss-editorial.pdf\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
process.exitCode = qaPass ? 0 : 1;
