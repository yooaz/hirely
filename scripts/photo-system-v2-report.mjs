#!/usr/bin/env node
/**
 * PHOTO_SYSTEM_V2 audit report
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PHOTO_SYSTEM_V2.md');

function runQa(script) {
  const r = spawnSync('node', [path.join(ROOT, 'src/tests', script)], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

const v2 = runQa('qa-photo-system-v2.mjs');
const legacy = runQa('qa-photo-system.mjs');

const lines = [];
lines.push('# Photo System V2 Audit');
lines.push('');
lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
lines.push('Engine: `PHOTO_SYSTEM_V2`');
lines.push('');
lines.push('## User-reported issues');
lines.push('');
lines.push('| Issue | Root cause (V1) | V2 fix |');
lines.push('|-------|-----------------|--------|');
lines.push('| Photo overlaps text | `transform: scale()` on `.cvPhoto` escaped the wrap | Scale removed; crop baked into image; `overflow: hidden` safe zone |');
lines.push('| Photo disappears | Simple upload never set `includePhoto`; ATS templates hidden by default | Upload enables photo per template; `cv--with-photo` gated on `isPhotoActive()` |');
lines.push('| Photo breaks templates | Inconsistent slot sizing + float layouts | Fixed 88×88 circle, grid gap, `float: none` on V2 headers |');
lines.push('');
lines.push('## Audit areas');
lines.push('');
lines.push('### 1. Image upload');
lines.push('');
lines.push('- **Paths:** `#proCvPhotoInput` (Pro drawer), `#photoInput` (import panel)');
lines.push('- **Formats:** JPEG, PNG, WebP → local base64 (`state.photo`)');
lines.push('- **V2:** Auto square crop + face-centered focus on upload');
lines.push('');
lines.push('### 2. Image crop');
lines.push('');
lines.push('- **Manual:** `#photoEditorDialog` — zoom/X/Y sliders, canvas bake on save (512×512 JPEG)');
lines.push('- **Automatic:** `autoCropPhotoDataUrl()` — square crop with portrait focus heuristic');
lines.push('- **Face centering:** `inferPortraitFocusPoint()` — portrait Y=38%, landscape Y=45%, square Y=42%');
lines.push('');
lines.push('### 3. Image scaling');
lines.push('');
lines.push('- **Removed:** Live `transform: scale(zoom)` (overlap risk)');
lines.push('- **Safe display:** `object-fit: cover` inside fixed 88×88 wrap');
lines.push('- **Zoom:** Applied only during editor crop bake, not at render time');
lines.push('');
lines.push('### 4. Template placement');
lines.push('');
lines.push('- Slot: `photoSlot()` → `getPhotoHtml()` in `cv-templates.js` headers');
lines.push('- Class gate: `#cvDoc.cv--with-photo` when `isPhotoActive(state, templateId)`');
lines.push('- Per-template toggle: `state.photoPerTemplate[templateId]`');
lines.push('- Hidden by default: `ats`, `ats-elite`, `ats-recruiter`, `ats-executive`');
lines.push('');
lines.push('### 5. PDF rendering');
lines.push('');
lines.push('- Export: `body.export-pdf` + `photo-system-v2.css` + `cv-pdf-export.css`');
lines.push('- Rules: 88px circle, `overflow: hidden`, `transform: none`');
lines.push('- Packet V2 export clones live `#cvDoc` sheets (WYSIWYG)');
lines.push('');
lines.push('## Safe zone contract');
lines.push('');
lines.push('| Rule | Value |');
lines.push('|------|-------|');
lines.push('| Max photo size | 88×88 px |');
lines.push('| Text gap | 12 px minimum |');
lines.push('| Wrap overflow | `hidden` (clip) |');
lines.push('| Transform at render | `none` |');
lines.push('| Export resolution | 512×512 JPEG after crop |');
lines.push('');
lines.push('## Requirements checklist');
lines.push('');
lines.push('| Requirement | Status |');
lines.push('|-------------|--------|');
lines.push('| Photo must never overlap text | ✅ Safe wrap + no scale transform |');
lines.push('| Automatic crop | ✅ On upload + editor save |');
lines.push('| Automatic face centering | ✅ Portrait heuristic (no ML dep) |');
lines.push('| Safe zones | ✅ CSS `photo-system-v2.css` |');
lines.push('');
lines.push('## Files');
lines.push('');
lines.push('| File | Role |');
lines.push('|------|------|');
lines.push('| `src/ui/pro/photo-system-v2.mjs` | Core: auto crop, face focus, safe HTML |');
lines.push('| `src/ui/pro/photo-system-v2.js` | Browser facade |');
lines.push('| `src/ui/pro/photo-system-v2.css` | Safe zone layout + PDF rules |');
lines.push('| `src/ui/pro/photo-system.mjs` | Template support + V2 delegation |');
lines.push('| `src/ui/pro/pro-cv-features.js` | Upload UI, editor, per-template toggle |');
lines.push('');
lines.push('## QA snapshot');
lines.push('');
lines.push('| Suite | Result |');
lines.push('|-------|--------|');
lines.push(`| \`qa-photo-system-v2\` | ${v2.ok ? '**PASS**' : '**FAIL**'} |`);
lines.push(`| \`qa-photo-system\` | ${legacy.ok ? '**PASS**' : '**FAIL**'} |`);
lines.push('');
lines.push('```bash');
lines.push('npm run qa:photo-system-v2');
lines.push('npm run photo-system-v2-report');
lines.push('npm run qa:photo-system');
lines.push('```');
lines.push('');
lines.push('## Future improvements');
lines.push('');
lines.push('- Optional `FaceDetector` API when available in browser');
lines.push('- Template-specific photo sizes (sidebar vs header)');
lines.push('- Regression screenshots per template with photo on/off');

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log('Wrote', OUT);
