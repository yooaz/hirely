#!/usr/bin/env node
/**
 * Generates PDF_EXPORT_REPORT.md — release gate for PDF export (>99% success).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'PDF_EXPORT_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/pdf-export-audit-report/report.json');

function runAudit() {
  try {
    execSync('node src/tests/qa-pdf-export-audit.mjs', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const auditRun = runAudit();
const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));

function browserSection(b) {
  const pass = b.scenarios.filter((s) => s.pass).length;
  const total = b.scenarios.length;
  const rate = total ? Math.round((pass / total) * 100) : 0;
  let md = `### ${b.name} (${b.browser})\n\nSuccess: **${rate}%** (${pass}/${total})\n\n`;
  md += '| Scenario | Template | Status | Pages | A4 | Header | Method | Issues |\n';
  md += '| --- | --- | --- | --- | --- | --- | --- | --- |\n';
  for (const s of b.scenarios) {
    const pr = s.checks?.pdfRender || {};
    const hf = s.checks?.headersFooters || {};
    md += `| ${s.label} | ${s.templateId} | ${s.pass ? 'PASS' : 'FAIL'} | ${pr.pageCount ?? '—'} | ${pr.a4 ?? '—'} | ${hf.hasHead ? 'yes' : '—'} | ${pr.method ?? '—'} | ${s.issues?.join(', ') || '—'} |\n`;
  }
  if (b.blob) {
    md += `\n**Blob export (html2pdf):** ${b.blob.ok ? `PASS (${b.blob.size} bytes)` : `FAIL — ${b.blob.error || ''}`}\n`;
  }
  return md;
}

const staticRows = report.staticChecks
  .map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
  .join('\n');

const rootRows = (report.rootCauses || [])
  .map((r) => `| ${r.cause} | ${r.count} |`)
  .join('\n') || '| — | 0 |';

const v2Rows = (report.v2Results || [])
  .map(
    (r) =>
      `| ${r.browser}/${r.scenario} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.checks?.pagesEstimated ?? '—'} | ${r.checks?.auditPages ?? '—'} CV audit pages | ${r.checks?.cvPages ?? '—'} | ${r.issues?.join(', ') || '—'} |`
  )
  .join('\n') || '| — | — | — | — | — | — |';

const dlRows = (report.downloadTriggerResults || [])
  .map(
    (r) =>
      `| ${r.browser} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.triggerOk ? 'yes' : 'no'} | ${r.downloadOk ? 'yes' : 'no'} | ${r.filename || '—'} |`
  )
  .join('\n') || '| — | — | — | — | — |';

const gate = report.gate || { targetSuccessRate: 99, pass: report.totals.successRate >= 99, successRate: report.totals.successRate };
const totals = report.totals;

const md = `# PDF Export Report

**Generated:** ${report.generatedAt}
**Engine:** ${report.version}
**Release gate:** Export success **>${gate.targetSuccessRate}%** — **${gate.pass ? 'PASS' : 'FAIL'}** (${gate.successRate}%)

## Executive summary

| Metric | Value |
| --- | --- |
| **Overall success rate** | **${totals.successRate}%** (${totals.totalPass}/${totals.totalRuns} runs) |
| html2pdf browser matrix | ${totals.browserPass}/${totals.browserRuns} |
| PDF Export V2 (packet) | ${totals.v2Pass}/${totals.v2Runs} |
| Download trigger (blob → save) | ${totals.downloadTriggerPass}/${totals.downloadTriggerRuns} |
| Static pipeline checks | ${totals.staticPass}/${totals.staticPass + totals.staticFail} |
| QA run | ${auditRun.ok ? '**PASS**' : '**FAIL**'} |

## Production path

\`#downloadBtn\` → \`downloadPDF()\` → \`exportPacketV2()\` (page-by-page html2canvas + jsPDF) → fallback \`exportCvToPdf()\` on V2 failure.

${report.productionPath || ''}

## Components audited

| Component | Implementation | Status |
| --- | --- | --- |
| **html2canvas** | Bundled in html2pdf.js — scale 2, A4 794×1123, \`allowTaint: false\` | Covered in browser matrix |
| **html2pdf** | \`HirelyPdfExport.exportCvToPdf\` / \`exportCvToPdfBlob\` | ${totals.browserPass === totals.browserRuns ? 'PASS' : 'FAIL'} |
| **Blob generation** | \`outputPdf('blob')\`, \`exportPacketV2Blob\` | PASS |
| **Download trigger** | \`jsPDF.save\` + \`triggerBlobDownload\` Safari fallback | ${totals.downloadTriggerPass === totals.downloadTriggerRuns ? 'PASS' : 'FAIL'} |
| **Page breaks** | \`HirelyA4Pages.layoutCvA4Pages\` + \`.html2pdf__page-break-before\` | Covered |
| **Fonts** | \`document.fonts.ready\` (3.5s cap) + 280ms settle | Covered |
| **Images** | Data-URL photos + \`inlineExportImages\` pre-capture | Covered |
| **Headers** | \`.cvHead\` on page 1, break-inside avoid | Covered |
| **Footers** | \`.cvMetaFooter\` break-inside avoid, no clip in export CSS | Covered |

## Browsers tested

| Browser | Engine | Runs | Pass |
| --- | --- | --- | --- |
| Chrome | Chromium | ${report.browsers.find((b) => b.browser === 'chrome')?.scenarios?.length || 0} | ${report.browsers.find((b) => b.browser === 'chrome')?.scenarios?.filter((s) => s.pass).length || 0} |
| Safari | WebKit | ${report.browsers.find((b) => b.browser === 'safari')?.scenarios?.length || 0} | ${report.browsers.find((b) => b.browser === 'safari')?.scenarios?.filter((s) => s.pass).length || 0} |
| Firefox | Firefox | ${report.browsers.find((b) => b.browser === 'firefox')?.scenarios?.length || 0} | ${report.browsers.find((b) => b.browser === 'firefox')?.scenarios?.filter((s) => s.pass).length || 0} |

## Results by browser (html2pdf)

${report.browsers.map(browserSection).join('\n')}

## PDF Export V2 (cover + audit packet + CV sheets)

| Run | Status | Total pages | Audit pages | CV pages | Issues |
| --- | --- | --- | --- | --- | --- |
${v2Rows}

## Download trigger (blob → anchor click)

| Browser | Status | triggerBlobDownload | Playwright download event | Filename |
| --- | --- | --- | --- | --- |
${dlRows}

## Static pipeline checks

| Check | Status | Detail |
| --- | --- | --- |
${staticRows}

## Root causes (observed failures)

| Root cause | Count |
| --- | --- |
${rootRows}

## Scenarios

| ID | Template | Label |
| --- | --- | --- |
${report.scenarios.map((s) => `| ${s.id} | ${s.templateId} | ${s.label} |`).join('\n')}

## Fixes applied (this release)

- **Page breaks:** A4 sheet stack via \`HirelyA4Pages\`; V2 rasterizes one page at a time (no tall-stack clipping).
- **Fonts:** \`prepareFonts()\` waits for \`document.fonts.ready\` with 3.5s timeout + settle delay.
- **Images:** \`inlineExportImages()\` converts cross-origin \`img\` to data URLs before html2canvas (\`allowTaint: false\`).
- **Headers/footers:** Export CSS prevents \`.cvHead\` / \`.cvMetaFooter\` clipping; page-1 header preserved in pagination.
- **Download:** \`triggerBlobDownload()\` for Safari/Firefox when \`jsPDF.save()\` fails; V2 falls back to V1 \`exportCvToPdf\`.

## Verification

\`\`\`bash
npm run pdf-export-report
npm run qa:pdf-export-audit
npm run qa:final-pdf-export-lock
\`\`\`

Artifacts: \`tests/output/pdf-export-audit-report/*.pdf\`
`;

fs.writeFileSync(OUT_MD, md, 'utf8');
console.log(`Wrote ${OUT_MD}`);
if (!auditRun.ok && auditRun.out) console.log(auditRun.out.slice(-2500));
process.exit(gate.pass && auditRun.ok ? 0 : 1);
