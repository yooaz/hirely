#!/usr/bin/env node
/**
 * Editorial Magazine template report → EDITORIAL_MAGAZINE_TEMPLATE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EDITORIAL_MAGAZINE_TEMPLATE.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/editorial-magazine/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-editorial-magazine-template.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Editorial Magazine Template

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template ID:** \`editorial-magazine\`  
**Display name:** Editorial Magazine

## Design brief

Magazine cover meets professional resume — the most beautiful template in Hirely.

Inspired by **Kinfolk**, **Wallpaper***, **Aesop**, and **Monocle**.

| Attribute | Value |
|-----------|-------|
| Cover | 54pt Cormorant display · editorial kicker · italic deck |
| Spread | 3-column grid — culture rail · feature · meta rail |
| Typography | Cormorant Garamond · Source Serif 4 · DM Sans |
| Spacing | Luxury editorial whitespace · hairline rules |
| Excluded | Chips · meta footer · photos |

## Layout

1. **Cover** — Résumé kicker · huge name · title · deck lede · contact
2. **Left rail** — Education · Languages
3. **Feature column** — Experience (display hierarchy)
4. **Right rail** — Skills · Tools · Clients · Projects · Portfolio

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/cv-templates.js\` | \`headEditorialMagazine\`, \`stackEditorialMagazine\`, \`layoutEditorialMagazine\` |
| \`src/ui/templates/cv-templates-editorial-magazine.css\` | Kinfolk / Monocle typography system |
| \`src/ui/templates/v2/registry.js\` | V2 metadata |

## QA

\`\`\`bash
npm run qa:editorial-magazine-template
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## PDF artifact

\`tests/output/editorial-magazine/editorial-magazine.pdf\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
