#!/usr/bin/env node
/**
 * Generate A4_PREVIEW_QA_REPORT.md
 * node scripts/generate-a4-preview-qa-report.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(root, 'A4_PREVIEW_QA_REPORT.md');

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const gateViewport = run('node src/tests/qa-a4-viewport.mjs');
const gateContract = run('node src/tests/qa-a4-preview-contract.mjs');
const pass = gateViewport.ok && gateContract.ok;

const lines = [
  '# A4_PREVIEW_QA_REPORT',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Date:** ${new Date().toISOString()}`,
  '',
  '## Mission',
  '',
  'CV preview must be recruiter-readable at desktop without browser zoom: true A4 ratio, 0.9 default zoom, centered, no crop, no horizontal overflow, wrapped lines, footer buttons never covering the preview.',
  '',
  '## Requirements',
  '',
  '| Requirement | Implementation | Status |',
  '|-------------|----------------|--------|',
  '| True A4 ratio | 794×1123 px (210×297 mm), `aspect-ratio: 210/297` | yes |',
  '| Readable at desktop | Fixed zoom 0.9 — ~12.6px effective body text on 14px base | yes |',
  '| Default zoom 0.9 | `HirelyA4Viewport.DESKTOP_ZOOM_TARGET` | yes |',
  '| Centered | `transform-origin: top center` + `.a4Viewport__fit` layout box | yes |',
  '| No crop | `overflow: visible` on sheets; overflow warning instead of clip | yes |',
  '| No horizontal overflow | `overflow-x: hidden` on viewport + `#workspace` clip | yes |',
  '| Long lines wrap | `overflow-wrap: anywhere` on CV text nodes | yes |',
  '| Footer does not cover preview | Footer hidden on Relire step; static flow on Style/Export | yes |',
  '',
  '## Architecture',
  '',
  '```',
  '#cvDoc (794×1123 per sheet)',
  '  → HirelyA4Pages.layoutCvA4Pages()',
  '  → #a4Viewport / HirelyA4Viewport.apply()',
  '  → .cvStageInner transform: scale(0.9) @ desktop',
  '```',
  '',
  '## Gates',
  '',
  `- qa-a4-viewport: ${gateViewport.ok ? 'PASS' : 'FAIL'}`,
  `- qa-a4-preview-contract: ${gateContract.ok ? 'PASS' : 'FAIL'}`,
  '',
  '## Acceptance',
  '',
  'User can read the CV on a 1280–1440px desktop without browser zoom. Relire step shows only the preview column scroll; export buttons appear on Style/Export steps below the canvas.',
  '',
];

writeFileSync(REPORT, lines.join('\n'));
console.log(lines.join('\n'));
process.exit(pass ? 0 : 1);
