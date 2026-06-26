#!/usr/bin/env node
/**
 * Creative Director template report → CREATIVE_DIRECTOR_TEMPLATE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CREATIVE_DIRECTOR_TEMPLATE.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/creative-director/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-creative-director-template.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Creative Director Template

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template ID:** \`creative-director\`  
**Display name:** Creative Director

## Design brief

Luxury creative portfolio CV for creative directors, illustrators, designers, and art directors.

Inspired by Kinfolk, Wallpaper Magazine, Aesop, and Apple editorial.

| Attribute | Value |
|-----------|-------|
| Style | Editorial typography · magazine aesthetic · large whitespace |
| Tier | Pro |
| ATS safety | Medium |
| Client logos | Optional (\`clientLogos[]\` on resume data) |
| Project highlights | Featured editorial cards |

## Layout (fixed order)

1. Large name
2. Professional title
3. Summary lead (optional, in header)
4. Contact (subtle)
5. Selected Clients
6. Selected Projects
7. Experience timeline
8. Skills
9. Tools
10. Education

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/cv-templates.js\` | \`layoutCreativeDirector\`, \`stackCreativeDirector\`, \`headCreativeDirector\` |
| \`src/ui/templates/cv-templates-creative-director.css\` | Kinfolk editorial typography & spacing |
| \`src/ui/templates/v2/registry.js\` | V2 metadata + alias \`creative-director → creative-director\` |
| \`src/ui/templates/production-template-ids.mjs\` | Featured + display name |
| \`index.html\` | Stylesheet link, picker, display name |

## QA

\`\`\`bash
npm run qa:creative-director-template
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## Section order (render)

\`${(report?.sectionOrder || []).join(' → ')}\`

## PDF artifact

\`tests/output/creative-director/creative-director.pdf\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
process.exitCode = qaPass ? 0 : 1;
