#!/usr/bin/env node
/**
 * UX Simplification Report — 60s onboarding gate.
 * Flow: UPLOAD → ANALYZE → SELECT TEMPLATE → DOWNLOAD
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'UX_SIMPLIFICATION_REPORT.md');
const INDEX = path.join(ROOT, 'index.html');

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const uxCss = fs.readFileSync(path.join(ROOT, 'src/ui/product/ux-simplification.css'), 'utf8');

const checks = [];

function add(id, ok, detail = '') {
  checks.push({ id, ok, detail });
}

add('file:ux-simplification-css', fs.existsSync(path.join(ROOT, 'src/ui/product/ux-simplification.css')));
add('index:links-ux-css', /ux-simplification\.css/.test(indexHtml));
add('flag:fast-onboarding', /HIRELY_FAST_ONBOARDING\s*=\s*true/.test(indexHtml));
add('fn:maybeFastTrackOnboarding', /function maybeFastTrackOnboarding/.test(indexHtml));
add('flow:4-progress-steps', (indexHtml.match(/hirelyProgressStep/g) || []).length >= 4);
add('label:progress-upload', /data-i="progressImport">Déposer</.test(indexHtml) || /progressImport:'Déposer'/.test(indexHtml));
add('label:progress-analyze', /data-i="progressReview">Analyser</.test(indexHtml) || /progressReview:'Analyser'/.test(indexHtml));
add('label:progress-download', /data-i="progressExport">Télécharger</.test(indexHtml) || /progressExport:'Télécharger'/.test(indexHtml));
add('hide:linkedin', /#linkedinImportBlock/.test(uxCss));
add('hide:format-guide', false, 'V1 shows honest format guide');
add('hide:detected-details', /#detectedDetails/.test(uxCss));
add('hide:import-options', /\.wsImport \.toolsMore/.test(uxCss));
add('hide:extraction-quality-step', /#extractionQualityStep/.test(uxCss));
add('copy:recruiter-analyze', /reviewSlimTitle:'Analyse recruteur'/.test(indexHtml) || /heroStepReview:'Analyser'/.test(indexHtml));
add('copy:flow-cta-download', /flowCtaExportCv:'Télécharger le PDF'/.test(indexHtml));
add('auto:fast-track-call', /maybeFastTrackOnboarding\(\)/.test(indexHtml));

const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
const status = pass === total ? 'PASS' : 'FAIL';

const removed = [
  'LinkedIn merge block on step 1',
  'Format guide (supported/unsupported lists)',
  'Role, industry, job description, photo fields on import',
  'Detected profile `<details>` panel',
  'Extraction quality checklist before template',
  'Duplicate step headers (studio/style/export kicker blocks)',
  'MVP import banner after upload',
  'Technical loading labels (OCR, parser, extraction pipeline)',
];

const flow = [
  { step: 1, id: 'import', user: 'UPLOAD', fr: 'Déposer', action: 'Drop PDF / Word / paste text' },
  { step: 2, id: 'edit', user: 'ANALYZE', fr: 'Analyser', action: 'CV preview + recruiter read sidebar; auto-advance ~1.6s when ready' },
  { step: 3, id: 'style', user: 'SELECT TEMPLATE', fr: 'Choisir un modèle', action: 'Template gallery only on this step' },
  { step: 4, id: 'export', user: 'DOWNLOAD', fr: 'Télécharger', action: 'A4 preview + Download PDF' },
];

const md = `# UX Simplification Report

**Generated:** ${new Date().toISOString()}
**Target:** Complete onboarding in **under 60 seconds**
**Gate status:** **${status}** (${pass}/${total} checks)

## Canonical flow

\`\`\`
UPLOAD → ANALYZE → SELECT TEMPLATE → DOWNLOAD
\`\`\`

| Step | docStep | User label (EN) | FR label | Primary UI |
| --- | --- | --- | --- | --- |
${flow.map((f) => `| ${f.step} | \`${f.id}\` | ${f.user} | ${f.fr} | ${f.action} |`).join('\n')}

## Design principles applied

1. **Four steps only** — progress nav maps 1:1 to user mental model (no verify, no extraction gate screen).
2. **Recruiter language** — "Analyze" not "Parse/OCR"; "Download" not "Export packet"; loading copy describes outcomes not pipelines.
3. **Reduced cognitive load** — import panel is drop zone + paste fallback only; advanced options hidden in production CSS.
4. **Fast track** — \`HIRELY_FAST_ONBOARDING\` + \`maybeFastTrackOnboarding()\` auto-advances to template when profile is ready and review queue is empty (~1.6s on analyze step).

## Removed / hidden (production)

${removed.map((r) => `- ${r}`).join('\n')}

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Files changed

| File | Role |
| --- | --- |
| \`index.html\` | Step labels, i18n, fast-track, CTA copy |
| \`src/ui/product/ux-simplification.css\` | Hide non-essential import/review chrome |
| \`scripts/ux-simplification-report.mjs\` | This report |

## Verification

\`\`\`bash
npm run ux-simplification-report
\`\`\`

Manual 60s test:

1. Open app → click **Déposer mon CV** → upload a text PDF.
2. Wait for analyze (sidebar shows recruiter read) — should auto-advance to templates if clean CV.
3. Tap a template → **Télécharger le PDF**.

## Success criteria

| Criterion | Target |
| --- | --- |
| Steps visible to user | 4 |
| Time import → template (clean CV) | < 20s |
| Time import → PDF download (Pro) | < 60s |
| Technical terms in primary UI | None (OCR/parser/extraction hidden) |
`;

fs.writeFileSync(OUT_MD, md, 'utf8');
console.log(`Wrote ${OUT_MD}`);
console.log(`UX simplification: ${pass}/${total} ${status}`);
process.exit(status === 'PASS' ? 0 : 1);
