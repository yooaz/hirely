#!/usr/bin/env node
/**
 * Generate A4_FIT_MODE_REPORT.md
 * node scripts/a4-fit-mode-report.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(root, 'A4_FIT_MODE_REPORT.md');

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const gateFit = run('node src/tests/qa-a4-fit-mode.mjs');
const gateViewport = run('node src/tests/qa-a4-viewport.mjs');
const gateContract = run('node src/tests/qa-a4-preview-contract.mjs');
const pass = gateFit.ok && gateViewport.ok && gateContract.ok;

const lines = [
  '# A4_FIT_MODE_REPORT',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Date:** ${new Date().toISOString()}`,
  '',
  '## Mission',
  '',
  'CV preview always shows a complete A4 page at true 794×1123 ratio — centered, no crop, no horizontal scroll. Default **Fit** scales to viewport height (first page fully visible on desktop). Long CVs stack page 1 + page 2 with clear separation. PDF export unchanged at native A4.',
  '',
  '## Requirements',
  '',
  '| Requirement | Implementation | Status |',
  '|-------------|----------------|--------|',
  '| A4 ratio 794×1123 | `HirelyA4Viewport.A4_WIDTH_PX` / `A4_HEIGHT_PX`, `aspect-ratio: 210/297` | yes |',
  '| Default: entire first page | `computeZoom` fit mode uses `availH / A4_HEIGHT_PX` | yes |',
  '| Auto scale from viewport | `ResizeObserver` on `#cvStage` + `apply()` | yes |',
  '| Centered page | `transform-origin: top center`, `.a4Viewport__fit` margin auto | yes |',
  '| No crop | `overflow: visible` on sheets; overflow warning only | yes |',
  '| No horizontal scroll | `overflow-x: hidden` on viewport + stage | yes |',
  '| Zoom Fit / 90% / 100% | `#a4ZoomBar` + `HirelyA4Viewport.setZoomMode()` | yes |',
  '| Long CV stacked pages | `.cvA4Stack` gap 24px, page labels, sheet shadow | yes |',
  '| PDF export real A4 | `suspendScaleForExport()` / `restoreScaleAfterExport()` | yes |',
  '',
  '## Architecture',
  '',
  '- `src/ui/export/a4-viewport.js` — fit / 90% / 100% zoom, first-page fit math',
  '- `src/ui/export/a4-viewport.css` — zoom toolbar + viewport layout',
  '- `src/ui/export/cv-a4-pages.js` + `.css` — stacked A4 sheets, 24px gap',
  '- `index.html` — `#a4ZoomBar`, `renderA4ZoomBar()`, `syncStudioCvScale()`',
  '',
  '## QA gates',
  '',
  '```',
  `qa-a4-fit-mode: ${gateFit.ok ? 'PASS' : 'FAIL'}`,
  gateFit.out.trim(),
  '',
  `qa-a4-viewport: ${gateViewport.ok ? 'PASS' : 'FAIL'}`,
  gateViewport.out.trim(),
  '',
  `qa-a4-preview-contract: ${gateContract.ok ? 'PASS' : 'FAIL'}`,
  gateContract.out.trim(),
  '```',
  '',
  '## Acceptance',
  '',
  '- On desktop, first A4 page is visible entirely by default (Fit mode).',
  '- User can switch to 90% or 100%; width capped to prevent horizontal scroll.',
  '- Multi-page CVs scroll vertically with labeled stacked sheets.',
  '- PDF export captures 794×1123 per sheet without preview scale transform.',
  '',
];

writeFileSync(REPORT, lines.join('\n'), 'utf8');
console.log(`Wrote ${REPORT} (${pass ? 'PASS' : 'FAIL'})`);
process.exit(pass ? 0 : 1);
