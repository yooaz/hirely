#!/usr/bin/env node
/**
 * Generates PHOTO_SYSTEM_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  PHOTO_SYSTEM_V2,
  PHOTO_SUPPORTED_TEMPLATE_IDS,
  PHOTO_HIDDEN_BY_DEFAULT_IDS,
  PHOTO_ACCEPT_TYPES,
} from '../src/ui/pro/photo-system.mjs';
import { TEMPLATE_FAMILY_V2_IDS } from '../src/ui/templates/template-families-v2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PHOTO_SYSTEM_REPORT.md');

function run(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { cwd: ROOT, encoding: 'utf8' }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}

const qa = run('node src/tests/qa-photo-system.mjs');
const legacyQa = run('node src/tests/qa-photo-section-reorder.mjs');

const report = `# PHOTO_SYSTEM_REPORT

Generated: ${new Date().toISOString()}

## P2 status

| Item | Value |
|------|-------|
| Version | \`${PHOTO_SYSTEM_V2}\` |
| Module | \`src/ui/pro/photo-system.mjs\` |
| UI | \`src/ui/pro/pro-cv-features.js\` + \`#photoEditorDialog\` |
| Template slot | \`photoSlot()\` in \`cv-templates.js\` headers |
| PDF | \`cv--with-photo\` + \`cv-pdf-export.css\` + Playwright QA |
| QA | ${qa.ok ? '**PASS**' : '**FAIL**'} |

## Capabilities

| Action | Implementation |
|--------|----------------|
| **Upload** | \`#proCvPhotoInput\` / \`#photoInput\` — JPEG, PNG, WebP → base64 local state |
| **Crop** | \`#photoEditorDialog\` — canvas square crop on save (512×512 JPEG) |
| **Scale** | Zoom slider 1×–3× in editor; baked into image on save |
| **Position** | X/Y sliders → \`object-position\` + editor preview transform |
| **Hide photo** | \`hidePhotoOnTemplate()\` + « Masquer » + per-template checkbox |
| **Remove photo** | \`removePhoto()\` clears asset + crop + per-template map |

## Template support (photo on / off)

All **10 V2 families** support optional photo via \`cv--with-photo\` class:

${TEMPLATE_FAMILY_V2_IDS.map((id) => `- \`${id}\``).join('\n')}

**Hidden by default** (user must enable): ${PHOTO_HIDDEN_BY_DEFAULT_IDS.map((id) => `\`${id}\``).join(', ')}

**Accepted formats:** ${PHOTO_ACCEPT_TYPES.join(', ')}

## Data model (local only)

\`\`\`javascript
state.photo          // data URL (never sent to server)
state.photoCrop      // { zoom, x, y } — reset after canvas bake
state.includePhoto   // global toggle for active template
state.photoPerTemplate // { [templateId]: boolean }
\`\`\`

## PDF export path

1. \`renderCV()\` sets \`#cvDoc.cv--with-photo\` when \`isPhotoActive()\`
2. \`getPhotoHtml()\` injects \`<div class="cvPhotoWrap"><img class="cvPhoto">\`
3. Export adds \`body.export-pdf\` + \`cv-pdf-export.css\` rules (88px circle, object-fit cover)
4. Playwright print path includes \`cv-templates-v2-families.css\` + \`pro-cv-features.css\`

## QA snapshot

| Suite | Result |
|-------|--------|
| \`qa-photo-system\` | ${qa.ok ? '**PASS**' : '**FAIL**'} |
| \`qa-photo-section-reorder\` | ${legacyQa.ok ? '**PASS**' : '**FAIL**'} |

## Verification

\`\`\`bash
npm run qa:photo-system
npm run photo-system-report
\`\`\`
`;

fs.writeFileSync(OUT, report, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(qa.out.trim());
