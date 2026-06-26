#!/usr/bin/env node
/**
 * Export Simple Report — resumeData + live preview; one Download PDF button.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPORT_SIMPLE_REPORT.md');
const INDEX = path.join(ROOT, 'index.html');

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const exportMod = fs.readFileSync(path.join(ROOT, 'src/core/export/export-simple.js'), 'utf8');
const exportCss = fs.readFileSync(path.join(ROOT, 'src/ui/product/export-simple.css'), 'utf8');
const coreIndex = fs.readFileSync(path.join(ROOT, 'src/core/index.js'), 'utf8');

const checks = [];
function add(id, ok, detail = '') {
  checks.push({ id, ok, detail });
}

add('file:export-simple-js', fs.existsSync(path.join(ROOT, 'src/core/export/export-simple.js')));
add('file:export-simple-css', fs.existsSync(path.join(ROOT, 'src/ui/product/export-simple.css')));
add('core:exports-export-simple', coreIndex.includes("from './export/export-simple.js'"));
add('index:links-export-simple-css', /export-simple\.css/.test(indexHtml));
add('flag:HIRELY_EXPORT_SIMPLE', /HIRELY_EXPORT_SIMPLE\s*=\s*true/.test(indexHtml));
add('fn:exportSimpleActive', /function exportSimpleActive\(\)/.test(indexHtml));
add('fn:canExportSimple', /function canExportSimple\(\)/.test(indexHtml));
add('export:isExportReady-simple', /exportSimpleActive\(\)\)return canExportSimple\(\)/.test(indexHtml));
add('export:prepareSimpleCvExport', /async function prepareSimpleCvExport\(\)/.test(indexHtml));
add('export:validate-no-quality-gate', /exportSimpleActive\(\)[\s\S]{0,200}EXPORT_SIMPLE_PREVIEW/.test(indexHtml));
add('export:downloadPDF-simple-gate', /exportSimpleActive\(\)[\s\S]{0,120}!canExportSimple\(\)/.test(indexHtml));
add('ui:single-download-btn', indexHtml.includes('id="downloadBtn"') && !indexHtml.includes('id="exportMoreBtn"'));
add('ui:download-not-tab-pro', /class="btn primary" id="downloadBtn"/.test(indexHtml) && !/downloadBtn[^>]*tab--pro/.test(indexHtml));
add('css:hide-export-more', exportCss.includes('.exportMoreWrap'));
add('css:hide-email-txt-export', exportCss.includes('#emailCvBtn') && exportCss.includes('#downloadTxt'));
add('fn:syncExportBarChrome', /function syncExportBarChrome\(\)/.test(indexHtml));
add('module:canExportSimple-export', exportMod.includes('canExportSimple'));

const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
const status = pass === total ? 'PASS' : 'FAIL';

const md = `# Export Simple

**Generated:** ${new Date().toISOString()}
**Status:** **${status}** (${pass}/${total} checks)
**Version:** \`EXPORT_SIMPLE_V1\` (\`export-simple-v1\`)

## Rule

Export is allowed when **both** are true:

1. \`resumeData\` exists
2. Visible CV preview is live (\`#cvDoc.cv--live\`, no empty state)

One primary control: **Download PDF** (\`#downloadBtn\` in \`#cvExportBar\` on the Export step).

## Removed / bypassed

| Blocker / duplicate | Status |
| --- | --- |
| Quality validator export gate | Bypassed when \`HIRELY_EXPORT_SIMPLE\` |
| ATS checklist export blocker | Export item follows \`canExportSimple()\` |
| \`validateExportLock\` / \`prepareLockedCvExport\` gates | \`prepareSimpleCvExport()\` when simple mode |
| Pro paywall on PDF (\`requirePro\`, \`tab--pro\`) | Skipped in export simple |
| Export More menu (email, TXT, back) | Removed from DOM + hidden in CSS |
| \`exportFinalPanel\` duplicate buttons | Hidden via CSS |

## Runtime flag

\`\`\`javascript
HIRELY_EXPORT_SIMPLE = true  // also when NAVIGATION_LOCK / ONE_CV_SOURCE
\`\`\`

## Functions (index.html)

| Function | Behavior |
| --- | --- |
| \`canExportSimple()\` | \`hasNavResumeData() && cvPreviewIsLive()\` |
| \`isExportReady()\` | Alias → \`canExportSimple()\` |
| \`prepareSimpleCvExport()\` | Render preview, no quality/ATS lock |
| \`downloadPDF()\` | Gate on \`canExportSimple()\` only |
| \`syncExportBarChrome()\` | Show bar on export step when export allowed |

## Module map

| File | Role |
| --- | --- |
| \`src/core/export/export-simple.js\` | \`canExportSimple\`, preview live check |
| \`src/ui/product/export-simple.css\` | Hide duplicate export UI |
| \`index.html\` | Single \`#downloadBtn\`, simplified export path |

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Verification

\`\`\`bash
npm run export-simple-report
\`\`\`

## UX note

Style-step **flow CTA** (\`#flowPrimaryCtaBtn\`) still navigates to the Export step — it is not a second PDF download. The only download action is \`#downloadBtn\` on the Export step.
`;

fs.writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT} — ${status} (${pass}/${total})`);
process.exit(status === 'PASS' ? 0 : 1);
