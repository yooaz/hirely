#!/usr/bin/env node
/**
 * P0 — Final PDF export lock → FINAL_PDF_EXPORT_LOCK_REPORT.md
 */
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FINAL_PDF_EXPORT_LOCK_V1 } from '../src/tests/qa-final-pdf-export-lock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'FINAL_PDF_EXPORT_LOCK_REPORT.md');
const jsonPath = join(root, 'tests/output/final-pdf-export-lock/report.json');
const auditJsonPath = join(root, 'tests/output/pdf-export-audit-report/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 300000 });
  return { pass: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const lockRun = run('src/tests/qa-final-pdf-export-lock.mjs');
const auditRun = run('src/tests/qa-pdf-export-audit.mjs');

let report = null;
let audit = null;
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  report = null;
}
if (existsSync(auditJsonPath)) {
  try {
    audit = JSON.parse(readFileSync(auditJsonPath, 'utf8'));
  } catch {
    audit = null;
  }
}

const pass = lockRun.pass && report?.pass === true;

const auditRows = [
  ['Button click', 'audit:button_click', '#downloadBtn → downloadPDF()'],
  ['Blob creation', 'audit:blob_creation', 'exportCvToPdfBlob()'],
  ['Filename', 'audit:filename', 'buildCvExportFilename()'],
  ['html2pdf loaded locally', 'audit:html2pdf_local', 'node_modules via csp-safe-loader'],
  ['Images included', 'audit:images_data_url', 'useCORS + allowTaint:false'],
  ['Fonts loaded', 'audit:fonts_ready', 'document.fonts.ready in HirelyPdfExport'],
  ['Page breaks', 'audit:page_breaks', 'cv-a4-pages + html2pdf pagebreak'],
  ['No blank pages', 'accept:no_blank_first_page', 'PDF opens with content bytes'],
  ['No cropped text', 'accept:no_cropped_content', 'auditExportDom pre-capture'],
].map(([label, id, impl]) => {
  const c = report?.checks?.find((x) => x.id === id);
  return `| ${label} | ${impl} | ${c?.pass ? 'PASS' : 'FAIL'} |`;
});

const acceptanceRows = (report?.acceptance || [])
  .map((a) => `| ${a.id.replace('accept:', '').replace(/_/g, ' ')} | ${a.pass ? 'PASS' : 'FAIL'} | ${a.detail || '—'} |`)
  .join('\n');

const browserRows = (report?.browserRuns || [])
  .map((r) => `| ${r.browser} | ${r.scenario} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.analysis?.pageCount ?? '—'} | ${r.analysis?.bytes ?? '—'} | ${r.issues?.join(', ') || '—'} |`)
  .join('\n');

const auditBrowserSummary = audit
  ? `Extended audit: **${audit.totals?.successRate ?? 0}%** (${audit.totals?.browserPass}/${audit.totals?.browserRuns} runs) — ${auditRun.pass ? 'PASS' : 'FAIL'}`
  : 'Extended audit: not run';

const md = `# Final PDF Export Lock Report (P0)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

**System:** \`${FINAL_PDF_EXPORT_LOCK_V1}\`

**Engine:** \`${report?.engine || 'PDF_EXPORT_P6'}\`

**Generated:** ${report?.generatedAt || new Date().toISOString()}

**Checks:** ${report?.summary?.pass ?? 0}/${report?.summary?.total ?? 0}

## Goal

PDF download must work every time: button → blob → save, with local html2pdf, fonts and images ready, safe page breaks, no blank first page, no cropped content. Verified on Chrome, Safari, and Firefox.

## Production path

\`${report?.productionPath || 'downloadPDF() → HirelyPdfExport.exportCvToPdf()'}\`

1. User clicks \`#downloadBtn\`
2. \`downloadPDF()\` gates Pro + review + \`prepareLockedCvExport()\`
3. \`HirelyLazy.ensureHtml2pdf()\` loads \`node_modules/html2pdf.js/dist/html2pdf.bundle.min.js\` (same-origin, CSP-safe)
4. \`HirelyPdfExport.exportCvToPdf(#cvDoc, filename)\` — fonts ready, A4 mode, html2canvas capture, jsPDF save
5. Email path uses \`exportCvToPdfBlob()\` for upload

## Audit checklist

| Item | Implementation | Status |
| --- | --- | --- |
${auditRows.join('\n')}

## Acceptance criteria

| Criterion | Status | Detail |
| --- | --- | --- |
${acceptanceRows || '| — | — | — |'}

## Browser matrix (html2pdf production path)

| Browser | Scenario | Status | Pages | Bytes | Issues |
| --- | --- | --- | --- | --- | --- |
${browserRows || '| — | — | — | — | — | — |'}

${auditBrowserSummary}

## Modules

| Module | Role |
| --- | --- |
| \`index.html\` | \`downloadPDF()\`, \`#downloadBtn\`, lazy html2pdf loader |
| \`src/vendor/csp-safe-loader.js\` | Same-origin \`html2pdf.bundle.min.js\` |
| \`src/ui/export/hirely-pdf-export.js\` | A4 capture, fonts, page breaks, blob + save |
| \`src/ui/export/cv-a4-pages.js\` | \`.cvA4Sheet\` pagination before capture |
| \`src/ui/templates/cv-pdf-export.css\` | \`body.export-pdf\` overflow + break rules |
| \`src/core/export/pdf-export-config.js\` | Shared A4 constants |
| \`src/core/export/export-lock.js\` | Filename + export DOM validation |

## Rules

| Rule | Status |
| --- | --- |
| Download works | ${report?.acceptance?.find((a) => a.id === 'accept:download_works')?.pass ? 'PASS' : 'FAIL'} |
| PDF opens | ${report?.acceptance?.find((a) => a.id === 'accept:pdf_opens')?.pass ? 'PASS' : 'FAIL'} |
| A4 correct | ${report?.acceptance?.find((a) => a.id === 'accept:a4_correct')?.pass ? 'PASS' : 'FAIL'} |
| Photo included when enabled | ${report?.acceptance?.find((a) => a.id === 'accept:photo_included')?.pass ? 'PASS' : 'FAIL'} |
| No blank first page | ${report?.acceptance?.find((a) => a.id === 'accept:no_blank_first_page')?.pass ? 'PASS' : 'FAIL'} |
| No cropped content | ${report?.acceptance?.find((a) => a.id === 'accept:no_cropped_content')?.pass ? 'PASS' : 'FAIL'} |

## Verify

\`\`\`bash
npm run final-pdf-export-lock-report
npm run pdf-export-audit-report
\`\`\`

Artifacts: \`tests/output/final-pdf-export-lock/*.pdf\`

## Bench output

\`\`\`
--- qa-final-pdf-export-lock ---
${lockRun.out.split('\n').slice(-40).join('\n')}
\`\`\`
`;

writeFileSync(outPath, md, 'utf8');
console.log(`Wrote ${outPath}`);
process.exit(pass ? 0 : 1);
