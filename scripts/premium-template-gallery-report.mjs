#!/usr/bin/env node
/**
 * Premium Template Gallery report → PREMIUM_TEMPLATE_GALLERY.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { FEATURED_TEMPLATE_IDS } from '../src/ui/templates/production-template-ids.mjs';
import { PREMIUM_TEMPLATE_GALLERY_META } from '../src/ui/templates/premium-template-gallery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PREMIUM_TEMPLATE_GALLERY.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/premium-template-gallery/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-premium-template-gallery.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const templateRows = FEATURED_TEMPLATE_IDS.map((id) => {
  const m = PREMIUM_TEMPLATE_GALLERY_META[id] || {};
  return `| \`${id}\` | ${(m.useCases || []).join(', ')} | ${m.hiringSuccess || '—'} | ${m.visualStyle || '—'} |`;
}).join('\n');

const md = `# Premium Template Gallery

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Goal:** Apple Keynote theme-picker experience for template selection

## Problem

Users could not tell which premium template matched their hiring context. The old picker showed tiny thumbnails and a single tag line.

## Solution

Premium gallery with:

- **Large previews** — 148px mini renders in a responsive grid
- **Use-case filters** — ATS · Creative · Executive · Portfolio · Tech · Consulting
- **Card metadata** — Hiring success · Best for · Visual style
- **Instant switching** — one click updates live A4 preview
- **Keynote transitions** — blur/fade/scale on CV preview swap

## Use-case filters

| Filter | Purpose |
|--------|---------|
| All | Full premium catalog |
| ATS | Parse-safe corporate applications |
| Creative | Art direction · design · culture |
| Executive | Leadership · C-suite · consulting firms |
| Portfolio | Behance · Dribbble · campaign books |
| Tech | Engineering · product · structured profiles |
| Consulting | McKinsey · BCG · Swiss editorial |

## Template catalog

| Template | Use cases | Hiring success | Visual style |
|----------|-----------|----------------|--------------|
${templateRows}

## Implementation

| File | Role |
|------|------|
| \`src/ui/templates/premium-template-gallery.mjs\` | Use-case catalog + filter helpers |
| \`src/ui/templates/premium-template-gallery.css\` | Keynote-style grid + animations |
| \`index.html\` | Gallery UI, filters, \`switchTemplateAnimated\` |

## QA

\`\`\`bash
npm run qa:premium-template-gallery
\`\`\`

**Checks:** ${passed}/${total} passed

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## Filter coverage

\`\`\`json
${JSON.stringify(report?.filterCounts || {}, null, 2)}
\`\`\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
