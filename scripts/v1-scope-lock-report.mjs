#!/usr/bin/env node
/**
 * V1 Scope Lock Report — frozen product scope gate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'V1_SCOPE_LOCK.md');
const INDEX = path.join(ROOT, 'index.html');

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const v1Css = fs.readFileSync(path.join(ROOT, 'src/ui/product/v1-scope-lock.css'), 'utf8');
const v1Const = fs.readFileSync(path.join(ROOT, 'src/core/import/v1-import-constants.js'), 'utf8');
const v1Lock = fs.readFileSync(path.join(ROOT, 'src/core/import/v1-scope-lock.js'), 'utf8');

const checks = [];
function add(id, ok, detail = '') {
  checks.push({ id, ok, detail });
}

add('file:v1-scope-lock-js', fs.existsSync(path.join(ROOT, 'src/core/import/v1-scope-lock.js')));
add('file:v1-scope-lock-css', fs.existsSync(path.join(ROOT, 'src/ui/product/v1-scope-lock.css')));
add('index:links-v1-css', /v1-scope-lock\.css/.test(indexHtml));
add('flag:HIRELY_V1_SCOPE_LOCK', /HIRELY_V1_SCOPE_LOCK\s*=\s*true/.test(indexHtml));
add('flag:OCR_DISABLED_V1', /HIRELY_OCR_DISABLED_V1\s*=\s*true/.test(indexHtml));
add('flag:OCR_AUTO_off', /HIRELY_OCR_AUTO\s*=\s*false/.test(indexHtml));
add('flag:NO_ATS_BLOCKERS', /HIRELY_V1_NO_ATS_BLOCKERS\s*=\s*true/.test(indexHtml));
add('const:no-ocr-in-supported', !/PDF scanné \(OCR\)/.test(v1Const) && v1Const.includes('PDF texte'));
add('const:unsupported-scan', v1Const.includes('PDF scanné'));
add('ui:format-guide-supported-only', /importV1SupportedTextPdf/.test(indexHtml) && !/importV1SupportedScanPdf/.test(indexHtml));
add('ui:format-guide-unsupported-scan', /importV1UnsupportedScanPdf/.test(indexHtml));
add('ui:file-input-v1-accept', /accept="\.pdf,\.doc,\.docx,\.txt/.test(indexHtml) && !/accept="[^"]*\.png/.test(indexHtml));
add('ui:paste-honest-copy', /importPasteFallbackTitle:'Ce format n/.test(indexHtml) || /pas pris en charge en V1/.test(indexHtml));
add('css:hide-ocr-ui', /#importOcrConfidence/.test(v1Css));
add('css:hide-review-required-banner', /reviewV2ReviewRequired/.test(v1Css));
add('gate:review-before-template-bypass', fs.readFileSync(path.join(ROOT, 'src/core/validation/review-before-template-lock.js'), 'utf8').includes('isV1AtsBlockersDisabled'));
add('gate:product-experience-bypass', fs.readFileSync(path.join(ROOT, 'src/core/validation/product-experience-gate.js'), 'utf8').includes('isV1AtsBlockersDisabled'));
add('simple-import:V1_OCR_DISABLED', /V1_OCR_DISABLED = true/.test(fs.readFileSync(path.join(ROOT, 'src/core/import/simple-import-mode.js'), 'utf8')));
add('api:isV1ScopeLocked', v1Lock.includes('isV1ScopeLocked'));

const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
const status = pass === total ? 'PASS' : 'FAIL';

const md = `# V1 Scope Lock

**Generated:** ${new Date().toISOString()}
**Status:** **${status}** (${pass}/${total} checks)
**Version:** \`V1_SCOPE_LOCK_V1\`

## Frozen scope

### Supported (V1)

| Format | Notes |
| --- | --- |
| **Text PDF** | Native text layer via PDF.js — no OCR |
| **DOCX** | Word Open XML |
| **TXT** | Plain text file |
| **Pasted text** | Paste panel — first-class path |

### Not supported (V1)

| Feature | User-facing behavior |
| --- | --- |
| **OCR** | Disabled — \`HIRELY_OCR_DISABLED_V1=true\` |
| **Scanned PDF auto-read** | Paste fallback with honest copy |
| **Image CV auto-read** | Rejected at extraction — paste fallback |
| **AI rewriting** | \`HIRELY_AI_RECONSTRUCTION=false\` |
| **ATS intelligence blockers** | No template/export lock from review/quality gates |

## Runtime flags (\`index.html\`)

\`\`\`javascript
HIRELY_V1_SCOPE_LOCK = true
HIRELY_V1_IMPORT = true
HIRELY_SIMPLE_IMPORT_MODE = true
HIRELY_OCR_DISABLED_V1 = true
HIRELY_OCR_AUTO = false
HIRELY_V1_NO_ATS_BLOCKERS = true
HIRELY_UNBLOCK_EVERYTHING = true
\`\`\`

## UI changes

- Format guide shows **4 supported** + **3 unsupported** lists (no OCR/photo in supported).
- File picker \`accept\` limited to PDF, DOC, DOCX, TXT.
- Paste fallback title: unsupported format → paste (not “image PDF OCR”).
- Hidden: OCR confidence, analysis stages, retry OCR, review-required export banners.
- ATS template badges remain (layout compatibility); **blockers** bypassed in validation modules.

## Module map

| File | Role |
| --- | --- |
| \`src/core/import/v1-scope-lock.js\` | Scope constants + \`isV1ScopeLocked()\` |
| \`src/core/import/v1-import-constants.js\` | Supported/unsupported lists + paste copy |
| \`src/ui/product/v1-scope-lock.css\` | Hide unsupported-feature UI |
| \`src/core/validation/review-before-template-lock.js\` | Bypass when V1 ATS blockers off |
| \`src/core/validation/product-experience-gate.js\` | Bypass low-extraction export blocks |
| \`index.html\` | Flags, i18n, format guide, file accept |

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Verification

\`\`\`bash
npm run v1-scope-lock-report
npm run v1-release-test   # txt, docx, text pdf, paste — must PASS
\`\`\`

## Out of V1 (do not ship marketing for)

- “Upload any CV including scans”
- “Automatic OCR”
- “Photo / screenshot import”
- “AI rewrite / AI reconstruction”
- “Fix ATS score before export” blocking flows

## Next version (V2+) candidates

- OCR for scanned PDFs
- Image CV pipeline
- ATS quality gates (optional strict mode)
- AI-assisted rewrite (opt-in)
`;

fs.writeFileSync(OUT, md);
console.log(`V1 scope lock: ${status} (${pass}/${total}) → ${OUT}`);
