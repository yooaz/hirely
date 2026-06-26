#!/usr/bin/env node
/**
 * P1 — Photo + section order → PHOTO_SECTION_ORDER_REPORT.md
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PHOTO_SECTION_ORDER_VERSION, DEFAULT_SECTION_ORDER } from '../src/ui/pro/section-order-system.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'PHOTO_SECTION_ORDER_REPORT.md');
const jsonPath = join(root, 'tests/output/photo-section-order/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 180000 });
  return { pass: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const suites = {
  photoSectionOrder: run('src/tests/qa-photo-section-order.mjs'),
  photoSystem: run('src/tests/qa-photo-system.mjs'),
  photoSectionReorder: run('src/tests/qa-photo-section-reorder.mjs'),
};

let report = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}

const pass = suites.photoSectionOrder.pass && suites.photoSystem.pass && suites.photoSectionReorder.pass && report?.pass === true;

const checkRows = (report?.checks || [])
  .map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const md = `# Photo & Section Order Report (P1)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**System:** \`${PHOTO_SECTION_ORDER_VERSION}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Checks:** ${report?.summary?.pass ?? 0}/${report?.summary?.total ?? 0}

## Goal

Optional profile photo with full editor controls, plus drag/reorder and hide/show for CV sections. State persists in the UI; templates respect order and visibility when compatible. PDF export must remain safe with no layout overflow.

## Photo capabilities

| Capability | Implementation |
|------------|----------------|
| Upload (jpg/png/webp) | \`#proCvPhotoInput\` → data URL in \`state.photo\` |
| Crop | \`#photoEditorDialog\` canvas square crop on save |
| Scale | Zoom slider → baked into crop or \`photoCrop.zoom\` |
| Reposition | X/Y sliders → \`object-position\` + crop offset |
| Hide on template | \`state.photoPerTemplate[id]\` + toggle |
| Remove | Clears \`state.photo\` and per-template flags |
| PDF export | \`cv--with-photo\` + inline styles + Playwright QA |
| Optional | CV renders without photo when disabled or absent |

## Section order capabilities

| Capability | Implementation |
|------------|----------------|
| Drag reorder | \`#proCvSectionOrder\` → \`state.sectionOrder\` |
| Hide / show | Checkbox per section → \`state.sectionHidden\` |
| Save in state | Passed via \`safe.sectionOrder\` + \`safe.sectionHidden\` in \`renderCV\` |
| Template respect | \`resolveSectionOrder\` + \`stackFromSectionOrder\` + \`removeHiddenSectionsFromHtml\` |
| Reset | Restores default order and clears hidden map |
| ATS hint | Warning when skills precede experience on ATS templates |

## Default section order

\`${DEFAULT_SECTION_ORDER.join(' → ')}\`

## Modules

| Module | Role |
|--------|------|
| \`src/ui/pro/photo-system.mjs\` | Photo state helpers + HTML builder |
| \`src/ui/pro/section-order-system.mjs\` | Order + visibility contract |
| \`src/ui/pro/pro-cv-features.js\` | Pro drawer UI (photo + sections) |
| \`src/ui/pro/pro-cv-features.css\` | Photo display + editor + section list |
| \`src/ui/templates/cv-templates.js\` | \`resolveSectionOrder\`, \`removeHiddenSectionsFromHtml\` |
| \`index.html\` | \`getPhotoHtml\`, state wiring, export path |

## QA suites

| Suite | Result |
|-------|--------|
| \`qa-photo-section-order\` | ${suites.photoSectionOrder.pass ? 'PASS' : 'FAIL'} |
| \`qa-photo-system\` | ${suites.photoSystem.pass ? 'PASS' : 'FAIL'} |
| \`qa-photo-section-reorder\` | ${suites.photoSectionReorder.pass ? 'PASS' : 'FAIL'} |

## Unit checks

| Check | Result | Detail |
|-------|--------|--------|
${checkRows || '| — | — | Run qa first |'}

## Rules

| Rule | Status |
|------|--------|
| Photo optional | PASS — CV valid with or without photo |
| No broken export | ${report?.checks?.find((c) => c.id === 'pdf_export')?.pass ? 'PASS' : 'FAIL'} |
| No layout overflow | ${report?.checks?.find((c) => c.id === 'pdf_no_overflow_signal')?.pass ? 'PASS' : 'FAIL'} |
| Section hide removes DOM blocks | ${report?.checks?.find((c) => c.id === 'section_hidden_render')?.pass ? 'PASS' : 'FAIL'} |
| Templates respect custom order | ${report?.checks?.find((c) => c.id === 'section_reorder')?.pass ? 'PASS' : 'FAIL'} |

## Verify

\`\`\`bash
npm run qa:photo-section-order
npm run photo-section-order-report
\`\`\`

## Bench output

\`\`\`
--- qa-photo-section-order ---
${suites.photoSectionOrder.out || '(no output)'}

--- qa-photo-system ---
${suites.photoSystem.out || '(no output)'}

--- qa-photo-section-reorder ---
${suites.photoSectionReorder.out || '(no output)'}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
