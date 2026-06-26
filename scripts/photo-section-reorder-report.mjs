#!/usr/bin/env node
/**
 * Photo + section reorder report → PHOTO_AND_SECTION_REORDER_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PHOTO_AND_SECTION_REORDER_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/photo-section-reorder/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-photo-section-reorder.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Photo + Section Reorder (Pro)

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**QA checks:** ${passed}/${total}

## Features

### 1. Profile photo (Pro)

| Capability | Implementation |
|------------|----------------|
| Upload jpg/png/webp | \`#proCvPhotoInput\` + import panel \`#photoInput\` |
| Crop / zoom / position | \`#photoEditorDialog\` canvas crop |
| Remove | Supprimer + reset state |
| Per-template toggle | \`state.photoPerTemplate\` + « Afficher sur ce modèle » |
| Local only | Data URL in \`state.photo\` — no server upload |
| ATS Elite default | Hidden unless enabled for template |
| Creative / Executive / Editorial | Supported via \`photoSlot()\` in template heads |
| PDF export | \`cv--with-photo\` + \`cv-pdf-export.css\` + Playwright QA |
| A4 safe | 88px circular photo, max dimensions in CSS |

### 2. Section reordering (Pro)

| Capability | Implementation |
|------------|----------------|
| Drag-and-drop list | \`#proCvSectionOrder\` |
| State | \`state.sectionOrder\` |
| Template render | \`stackUniversal\` / \`stackAtsElite\` + \`applySectionOrderToHtml\` |
| ATS warning | Skills before experience on ATS Elite |
| PDF export | Same render path as preview |
| No duplication | Section count parity check in QA |

## Default section order

\`summary → experience → clients → projects → education → skills → tools → languages → portfolio\`

## Files

| File | Role |
|------|------|
| \`src/ui/pro/pro-cv-features.js\` | Photo editor + section order UI |
| \`src/ui/pro/pro-cv-features.css\` | Pro bar, photo display, editor dialog |
| \`src/ui/templates/cv-templates.js\` | \`resolveSectionOrder\`, \`applySectionOrderToHtml\` |
| \`index.html\` | Pro bar, state wiring, \`getPhotoHtml\` |

## Acceptance checklist

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.check}`).join('\n')}

## Commands

\`\`\`bash
npm run qa:photo-section-reorder
npm run photo-section-reorder-report
\`\`\`
`;

fs.writeFileSync(OUT, md);
console.log(qaPass ? 'PASS — wrote PHOTO_AND_SECTION_REORDER_REPORT.md' : 'FAIL — see PHOTO_AND_SECTION_REORDER_REPORT.md');
process.exit(qaPass ? 0 : 1);
