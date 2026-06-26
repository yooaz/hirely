#!/usr/bin/env node
/**
 * PDF Export V2 report — generates PDF_EXPORT_V2_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPdfExportV2Packet, PDF_EXPORT_V2 } from '../src/core/export/pdf-export-v2.js';
import { PDF_EXPORT_ENGINE_V2, A4_WIDTH_PX, A4_HEIGHT_PX, A4_WIDTH_MM, A4_HEIGHT_MM } from '../src/core/export/pdf-export-config.js';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { computeProductScore } from '../src/core/validation/product-score.js';
import { buildRecruiterCommandCenterAudit } from '../src/core/validation/recruiter-command-center.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PDF_EXPORT_V2_REPORT.md');

const FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
  { id: 'creative-cv', label: 'Creative CV' },
];

async function evaluate(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: entry.id, extractionMethod: 'paste' });
  const cv = imp.cvData || imp.resumeData;
  const score = computeProductScore(cv, {
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  const audit = buildRecruiterCommandCenterAudit({
    scoreReport: score,
    cvData: cv,
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  const packet = buildPdfExportV2Packet({
    cvData: cv,
    scoreReport: score,
    recruiterAudit: audit,
    templateId: 'ats',
    templateName: 'ATS Clean',
  });
  return {
    ...entry,
    packet,
    scoreTotal: score?.total ?? 0,
    auditPages: 5,
    cvPagesEstimate: Math.max(1, Math.ceil(((cv.experience || cv.experiences || []).length + 2) / 4)),
    totalPages: 5 + Math.max(1, Math.ceil(((cv.experience || cv.experiences || []).length + 2) / 4)),
  };
}

function bulletList(items) {
  if (!items?.length) return '- _(none)_';
  return items.map((i) => `- ${typeof i === 'string' ? i : i.label || i.id || i}`).join('\n');
}

async function main() {
  const rows = [];
  for (const entry of FIXTURES) {
    rows.push(await evaluate(entry));
  }

  const lines = [];
  lines.push('# PDF Export V2');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Engine: \`${PDF_EXPORT_ENGINE_V2}\``);
  lines.push(`Packet: \`${PDF_EXPORT_V2}\``);
  lines.push('');
  lines.push('## Problem');
  lines.push('');
  lines.push('The legacy export path captured the entire CV stack as one tall canvas (html2canvas → single JPEG → jsPDF). This produced:');
  lines.push('');
  lines.push('- Screenshot-like output (raster blur, no crisp page boundaries)');
  lines.push('- Clipping when `windowHeight` underestimated multi-page stacks');
  lines.push('- Page-break bugs across `.cvA4Sheet` gaps');
  lines.push('- Font and image shifts when preview zoom/scale was active during capture');
  lines.push('');
  lines.push('## Solution — Premium packet export');
  lines.push('');
  lines.push('PDF Export V2 assembles a **discrete A4 packet** page-by-page:');
  lines.push('');
  lines.push('1. **Cover page** — candidate name, title, recruiter score, template, date');
  lines.push('2. **Candidate summary** — contact, stats, professional summary');
  lines.push('3. **Audit score** — recruiter / confidence / ATS scores + dimension bars');
  lines.push('4. **Recruiter notes** — strengths, weaknesses, missing fields, interview risks');
  lines.push('5. **Recommendations** — actionable next steps before sending');
  lines.push('6+ **CV pages** — cloned `.cvA4Sheet` nodes from live `#cvDoc` preview (WYSIWYG)');
  lines.push('');
  lines.push('Each page is rasterized at **794×1123 px** (scale 2) and placed on its own jsPDF A4 sheet — no cross-page clipping.');
  lines.push('');
  lines.push('## A4 contract');
  lines.push('');
  lines.push('| Constant | Value |');
  lines.push('|----------|-------|');
  lines.push(`| Width (px) | ${A4_WIDTH_PX} |`);
  lines.push(`| Height (px) | ${A4_HEIGHT_PX} |`);
  lines.push(`| Width (mm) | ${A4_WIDTH_MM} |`);
  lines.push(`| Height (mm) | ${A4_HEIGHT_MM} |`);
  lines.push('');
  lines.push('## Preview ≡ export guarantees');
  lines.push('');
  lines.push('- `HirelyA4Viewport.suspendScaleForExport()` before capture');
  lines.push('- `applyExportMode()` on `#cvDoc` — 794px width, no transform');
  lines.push('- CV sheets **cloned** from `.cvA4Stack .cvA4Sheet` (same DOM as preview)');
  lines.push('- `document.fonts.ready` + 200ms settle before rasterize');
  lines.push('- Per-page fixed `windowWidth` / `windowHeight` — no tall-stack underestimate');
  lines.push('');
  lines.push('## Production path');
  lines.push('');
  lines.push('```');
  lines.push('downloadPDF()');
  lines.push('  → prepareLockedCvExport()');
  lines.push('  → buildPdfExportV2Context()');
  lines.push('  → HirelyPdfExportV2.buildExportRoot(#cvDoc, packet)');
  lines.push('  → HirelyPdfExport.exportPacketV2(exportRoot, filename)');
  lines.push('```');
  lines.push('');
  lines.push('Email export uses the same packet via `exportPacketV2Blob()`.');
  lines.push('');
  lines.push('## Files');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `src/core/export/pdf-export-v2.js` | Packet builder (cover, summary, audit, notes, recs) |');
  lines.push('| `src/ui/export/pdf-export-v2.js` | DOM page builders + CV sheet clone |');
  lines.push('| `src/ui/export/pdf-export-v2.css` | Fixed A4 typography for audit pages |');
  lines.push('| `src/ui/export/hirely-pdf-export.js` | Page-by-page jsPDF assembly (`exportPacketV2`) |');
  lines.push('| `index.html` | Wired `downloadPDF()` + `emailCV()` |');
  lines.push('');
  lines.push('## Corpus packet preview');
  lines.push('');
  lines.push('| Fixture | Score | Audit pages | Est. CV pages | Total pages | Cover name |');
  lines.push('|---------|-------|-------------|---------------|-------------|------------|');
  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.scoreTotal} | ${row.auditPages} | ${row.cvPagesEstimate} | ${row.totalPages} | ${row.packet.cover.name} |`
    );
  }
  lines.push('');
  lines.push('## Sample recommendations (developer-cv)');
  lines.push('');
  const dev = rows.find((r) => r.id === 'developer-cv');
  if (dev) {
    lines.push(bulletList(dev.packet.recommendations));
    lines.push('');
    lines.push('### Recruiter notes excerpt');
    lines.push('');
    lines.push('**Strengths**');
    lines.push(bulletList(dev.packet.recruiterNotes.strengths));
    lines.push('');
    lines.push('**Weaknesses**');
    lines.push(bulletList(dev.packet.recruiterNotes.weaknesses));
  }
  lines.push('');
  lines.push('## QA');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:pdf-export-v2');
  lines.push('npm run pdf-export-v2-report');
  lines.push('```');
  lines.push('');
  lines.push('## Fallback');
  lines.push('');
  lines.push('If `HirelyPdfExportV2` or `exportPacketV2` is unavailable, `downloadPDF()` falls back to legacy `exportCvToPdf()` (P6 single-stack path).');

  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  console.log('Wrote', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
