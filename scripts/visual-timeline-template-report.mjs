#!/usr/bin/env node
/**
 * Visual Timeline template report → VISUAL_TIMELINE_TEMPLATE.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'VISUAL_TIMELINE_TEMPLATE.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/visual-timeline/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-visual-timeline-template.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Visual Timeline Template

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template ID:** \`visual-timeline\`  
**Display name:** Visual Timeline

## Design brief

Timeline-based resume with Apple keynote quality and premium minimalism.

| Attribute | Value |
|-----------|-------|
| Main feature | Vertical career timeline |
| Per role | Role · Company · Years · Highlights |
| Connected work | Clients & projects branch from spine |
| Style | Inter · minimal · #0071e3 accent |

## Layout

1. Name · Title · Summary · Contact
2. **Career Timeline** — vertical spine with nodes
3. **Connected Work** — clients & projects with branch connectors
4. Education · Skills · Tools · Languages

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/cv-templates.js\` | \`layoutVisualTimeline\`, \`visualTimelineSection\`, connected branches |
| \`src/ui/templates/cv-templates-visual-timeline.css\` | Keynote-style timeline styling |
| \`src/ui/templates/v2/registry.js\` | V2 metadata |

## QA

\`\`\`bash
npm run qa:visual-timeline-template
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## PDF artifact

\`tests/output/visual-timeline/visual-timeline.pdf\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
process.exitCode = qaPass ? 0 : 1;
