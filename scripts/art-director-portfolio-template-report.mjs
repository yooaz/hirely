#!/usr/bin/env node
/**
 * Art Director Portfolio template report → ART_DIRECTOR_PORTFOLIO_TEMPLATE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'ART_DIRECTOR_PORTFOLIO_TEMPLATE.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/art-director-portfolio/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-art-director-portfolio-template.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Art Director Portfolio Template

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template ID:** \`art-director-portfolio\`  
**Display name:** Art Director Portfolio

## Design brief

Luxury portfolio document for creative industry art directors — not a classic CV.

| Attribute | Value |
|-----------|-------|
| Audience | Creative industry · luxury campaigns |
| Hero | Dark masthead · name · title · summary · contact |
| Body | Cream editorial canvas · bronze accent |
| Typography | Instrument Serif + DM Sans |
| Excluded | Skill chips · client chips · progress bars · photo |

## Section order

1. **Hero** — identity + summary + contact
2. **Selected Clients**
3. **Selected Projects**
4. **Awards**
5. **Press** (publications + press)
6. **Experience** (airy)
7. **Education**
8. **Portfolio Links** — Behance · Instagram · Dribbble · Website

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/cv-templates.js\` | \`layoutArtDirectorPortfolio\`, \`headArtDirectorPortfolio\`, awards/press/links sections |
| \`src/ui/templates/cv-templates-art-director-portfolio.css\` | Luxury portfolio styling |
| \`src/ui/templates/v2/registry.js\` | V2 metadata + aliases |

## QA

\`\`\`bash
npm run qa:art-director-portfolio-template
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## PDF artifact

\`tests/output/art-director-portfolio/art-director-portfolio.pdf\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
