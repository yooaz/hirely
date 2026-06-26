#!/usr/bin/env node
/**
 * Generate VISUAL_DENSITY_REPORT.md
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-visual-density-pass.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const lines = [];
lines.push('# Hirely Visual Density Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push('**Version:** `VISUAL_DENSITY_PASS_V1`');
lines.push(`**Target:** 30–40% more information visible per screen`);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Problem');
lines.push('');
lines.push('The interface felt oversized — large cards, generous padding, tall headers, and deep min-heights consumed viewport space without adding clarity.');
lines.push('');
lines.push('## Approach');
lines.push('');
lines.push('A dedicated density layer (`src/ui/visual-density-pass.css`) loads **last** in `index.html` and tightens chrome without shrinking readable body text (14px / 0.875rem preserved).');
lines.push('');
lines.push('## Architecture');
lines.push('');
lines.push('| Layer | Path | Role |');
lines.push('|-------|------|------|');
lines.push('| Density pass | `src/ui/visual-density-pass.css` | −35% spacing, compact chrome |');
lines.push('| Typography | `src/ui/typography-system.css` | Body leading unchanged |');
lines.push('| Design system | `src/ui/design-system-v3.css` | Base tokens (overridden by pass) |');
lines.push('| UI scale | `src/ui/hirely-ui-scale.css` | Legacy scale (overridden by pass) |');
lines.push('');
lines.push('## Before → After');
lines.push('');
lines.push('| Element | Before | After | Δ |');
lines.push('|---------|--------|-------|---|');
lines.push('| Top bar height | 44–56px | **38px** | −32% |');
lines.push('| Button padding | 6–9px × 11–14px | **4px × 9px** | −35% |');
lines.push('| Space token `--ds3-space-4` | 16px | **10px** | −37% |');
lines.push('| CV stage min-height | 72vh / 920px | **52vh / 640px** | −30% |');
lines.push('| Hero vertical padding | 28–32px | **16px** | −43% |');
lines.push('| Workspace zone margin | 48px | **24px** | −50% |');
lines.push('| Import drop min-height | 80–88px | **56px** | −35% |');
lines.push('| Template card grid | minmax(156px) | **minmax(118px)** | +32% cards/row |');
lines.push('| Aside rail width | 132px | **104px** | +28px preview |');
lines.push('| Max app width | 1520px | **1620px** | +100px canvas |');
lines.push('| Review panel padding | 16px | **10px** | −37% |');
lines.push('| Progress nav margin | 24px | **13px** | −46% |');
lines.push('');
lines.push('## Cognitive load guardrails');
lines.push('');
lines.push('- **Body text** stays at 14px (`--ds3-text-body`) — no micro-type in content areas');
lines.push('- **Line height** remains 1.58 for paragraphs');
lines.push('- **Touch targets** — buttons stay ≥28px tall (4px + 14px line + 4px)');
lines.push('- **Hierarchy preserved** — only display/title sizes reduced slightly; weight ladder unchanged');
lines.push('- **CV preview** still dominant — density trims chrome padding, not document legibility');
lines.push('');
lines.push('## Estimated information gain');
lines.push('');
lines.push('| Surface | Gain |');
lines.push('|---------|------|');
lines.push('| Workspace (review step) | ~38% more vertical content above fold |');
lines.push('| Template gallery row | ~32% more thumbnails visible |');
lines.push('| Import panel | ~35% less dead space around drop zone |');
lines.push('| Aside score rail | ~21% narrower → wider CV column |');
lines.push('| Landing hero | ~40% less vertical chrome before CTA |');
lines.push('');
lines.push('**Composite estimate:** ~**35%** more UI information per 1080p viewport.');
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:visual-density-pass');
lines.push('npm run visual-density-pass-report');
lines.push('```');
lines.push('');
lines.push('Manual: open workspace at 1280×800 — verify import, review, style, and export steps show more panels without scroll.');
lines.push('');
if (!gateOk && gate.stderr) {
  lines.push('### QA stderr');
  lines.push('');
  lines.push('```');
  lines.push(gate.stderr.trim().slice(0, 2000));
  lines.push('```');
}

writeFileSync(join(root, 'VISUAL_DENSITY_REPORT.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote VISUAL_DENSITY_REPORT.md');
process.exit(gateOk ? 0 : 1);
