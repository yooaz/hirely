#!/usr/bin/env node
/**
 * Generates PDF_EXPORT_AUDIT_REPORT.md from qa-pdf-export-audit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'PDF_EXPORT_AUDIT_REPORT.md');
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
  md += '| Scenario | Template | Status | Pages | A4 | Fonts | Method | Issues |\n';
  md += '| --- | --- | --- | --- | --- | --- | --- | --- |\n';
  for (const s of b.scenarios) {
    const pr = s.checks?.pdfRender || {};
    md += `| ${s.label} | ${s.templateId} | ${s.pass ? 'PASS' : 'FAIL'} | ${pr.pageCount ?? '—'} | ${pr.a4 ?? '—'} | ${pr.embeddedFonts ?? '—'} | ${pr.method ?? '—'} | ${s.issues?.join(', ') || '—'} |\n`;
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

const knownRows = (report.knownFailureModes || [])
  .map((k) => `| ${k.id} | ${k.desc} |`)
  .join('\n');

const warningCounts = {};
for (const r of report.results || []) {
  for (const w of r.warnings || []) {
    warningCounts[w] = (warningCounts[w] || 0) + 1;
  }
}
const warningRows = Object.entries(warningCounts)
  .map(([w, c]) => `| ${w} | ${c} |`)
  .join('\n') || '| — | 0 |';

const md = `# PDF Export Audit Report (P0)

**Generated:** ${report.generatedAt}
**Engine:** ${report.version}
**Production path:** ${report.productionPath || 'html2pdf'}

## Executive summary

| Metric | Value |
| --- | --- |
| **Success rate** | **${report.totals.successRate}%** (${report.totals.browserPass}/${report.totals.browserRuns} browser runs) |
| **Failure rate** | **${report.totals.failureRate}%** (${report.totals.browserFail}/${report.totals.browserRuns}) |
| Static pipeline checks | ${report.totals.staticPass}/${report.totals.staticPass + report.totals.staticFail} pass |
| QA run | ${auditRun.ok ? '**PASS**' : '**FAIL** (see failures below)'} |

## Audit scope

Components audited:

- **HTML render** — template output, sections, name/photo presence
- **PDF render** — \`HirelyPdfExport.exportCvToPdfBlob()\` per browser (production path)
- **Page breaks** — \`.cvA4Sheet\` stack via \`HirelyA4Pages.layoutCvA4Pages\`
- **Fonts** — \`document.fonts.ready\` + PDF embedded font detection
- **Images** — data-URL photo in HTML; \`allowTaint: false\` compliance
- **Download trigger** — \`#downloadBtn\` → \`downloadPDF()\` → \`HirelyPdfExport.exportCvToPdf\`
- **Blob creation** — \`exportCvToPdfBlob()\` for email upload
- **Filename generation** — \`buildCvExportFilename()\` accent strip + fallback

Browsers tested (Playwright engines):

- **Chrome** — Chromium + production html2pdf
- **Safari** — WebKit + production html2pdf
- **Firefox** — Firefox + production html2pdf

> Note: Playwright \`page.pdf()\` is Chromium-only and is **not** the user export path. This audit uses **html2pdf** (html2canvas + jsPDF) matching \`index.html\`.

## Results by browser

${report.browsers.map(browserSection).join('\n')}

## Static pipeline checks

| Check | Status | Detail |
| --- | --- | --- |
${staticRows}

## Root causes (observed failures)

| Root cause | Count |
| --- | --- |
${rootRows}

## Advisory warnings (non-blocking)

html2pdf rasterizes CVs to canvas — A4 sheet count may differ from final PDF page count. These do **not** fail the audit but explain user-reported pagination quirks.

| Warning | Count |
| --- | --- |
${warningRows}

## Known failure modes (codebase)

| ID | Description |
| --- | --- |
${knownRows}

## Scenarios

| ID | Template | Label |
| --- | --- | --- |
${report.scenarios.map((s) => `| ${s.id} | ${s.templateId} | ${s.label} |`).join('\n')}

## Recommendations

- Keep profile photos as **data URLs** before export (\`allowTaint: false\`).
- Always call \`HirelyA4Viewport.suspendScaleForExport()\` before html2canvas capture.
- Await \`document.fonts.ready\` in \`HirelyPdfExport.prepareFonts()\`.
- Block export when review queue / extraction gate is active (\`downloadPDF\` guards).
- Re-run: \`npm run pdf-export-audit-report\`
- Artifacts: \`tests/output/pdf-export-audit-report/*.pdf\`
`;

fs.writeFileSync(OUT_MD, md, 'utf8');
console.log(`Wrote ${OUT_MD}`);
if (!auditRun.ok && auditRun.out) console.log(auditRun.out.slice(-2000));
