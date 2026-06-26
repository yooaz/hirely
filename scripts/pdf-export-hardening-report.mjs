#!/usr/bin/env node
/**
 * P1 — Generate PDF_EXPORT_HARDENING_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  PDF_PAGE_MARGIN_MM,
  PDF_EXPORT_ENGINE,
} from '../src/core/export/pdf-export-config.js';
import { PRODUCTION_TEMPLATE_IDS, PRODUCTION_TEMPLATE_DISPLAY_NAMES } from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PDF_EXPORT_HARDENING_REPORT.md');
const P1_JSON = path.join(ROOT, 'tests/output/pdf-export-p1/report.json');
const P6_JSON = path.join(ROOT, 'tests/output/pdf-export-p6/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P1 — PDF export hardening audit\n');
  const p1 = run('src/tests/qa-pdf-export-p1-hardening.mjs');
  const p6 = run('src/tests/qa-pdf-export-hardening.mjs');
  console.log(p1.ok ? '  PASS qa-pdf-export-p1-hardening' : '  FAIL qa-pdf-export-p1-hardening');
  console.log(p6.ok ? '  PASS qa-pdf-export-hardening' : '  FAIL qa-pdf-export-hardening');

  let p1Data = null;
  let p6Data = null;
  try {
    if (fs.existsSync(P1_JSON)) p1Data = JSON.parse(fs.readFileSync(P1_JSON, 'utf8'));
  } catch {
    p1Data = null;
  }
  try {
    if (fs.existsSync(P6_JSON)) p6Data = JSON.parse(fs.readFileSync(P6_JSON, 'utf8'));
  } catch {
    p6Data = null;
  }

  const pass = p1.ok && p6.ok && p1Data?.pass;

  const lines = [
    '# HIRELY P1 — PDF Export Hardening',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Engine:** \`${PDF_EXPORT_ENGINE}\``,
    '',
    '## Audit scope',
    '',
    'Verify **preview ≡ exported PDF**:',
    '- Same content (identity, sections, entries)',
    '- Same page count (`.cvA4Sheet` count vs PDF pages)',
    '- Same sections (clients, projects, portfolio, experience, education, skills, tools, languages)',
    '- No disappearing blocks',
    '- No overflow / clipping in export DOM',
    '',
    '## Status',
    '',
    '| Gate | Result |',
    '|------|--------|',
  ];

  lines.push(`| P1 preview ↔ PDF parity | **${p1.ok ? 'PASS' : 'FAIL'}** |`);
  lines.push(`| P6 A4 hardening (clip/overflow/pages) | **${p6.ok ? 'PASS' : 'FAIL'}** |`);
  lines.push('');
  lines.push('## A4 specification');
  lines.push('');
  lines.push('| Unit | Width | Height |');
  lines.push('|------|------:|-------:|');
  lines.push(`| CSS px | ${A4_WIDTH_PX} | ${A4_HEIGHT_PX} |`);
  lines.push(`| mm | ${A4_WIDTH_MM} | ${A4_HEIGHT_MM} |`);
  lines.push('');
  lines.push('## Margins');
  lines.push('');
  lines.push(`Playwright QA print: **${PDF_PAGE_MARGIN_MM.top}/${PDF_PAGE_MARGIN_MM.right}/${PDF_PAGE_MARGIN_MM.bottom}/${PDF_PAGE_MARGIN_MM.left} mm**`);
  lines.push('Browser html2pdf: **0 margin** (pre-paginated `.cvA4Sheet` stack at 794×1123px)');
  lines.push('');
  lines.push('## Hardening fixes (P1)');
  lines.push('');
  lines.push('- QA export HTML now loads **`cv-templates-pack.css`** + **`cv-templates-h20.css`** (parity with live preview)');
  lines.push('- Export mode: **`overflow: visible`** on `.cvA4Sheet`, `.cvA4Sheet__surface`, `.cvInner` (no clip before capture)');
  lines.push('- Premium template print rules for `minimal-swiss`, `art-director`, `behance-showcase`, `magazine-editorial`, `illustrator-portfolio`');
  lines.push('- New `auditPreviewPdfParity()` — section markers, structural DOM hints, page count, identity, clipping scan');
  lines.push('- **`magazine-editorial` A4 fix** — `cv-a4-pages.js` now collects `.cvCol--meta/center/right` (3-column body was dropped during pagination)');
  lines.push('- **`magazine-editorial` CSS** — grid rules applied to `template-magazine-editorial` (not only legacy `editorial-magazine` alias)');
  lines.push('');
  lines.push('## Scenarios');
  lines.push('');
  lines.push('| Scenario | Template | Checks |');
  lines.push('|----------|----------|--------|');
  lines.push('| Rich single-page | `portfolio-artist` | All sections, page parity |');
  lines.push('| Rich multi-page | `creative-director` | 2+ pages, no clip |');
  lines.push('| Long Swiss | `minimal-swiss` | 2+ pages, grid export |');
  lines.push('| All 10 premium templates | production pack | Section parity per template |');
  lines.push('');

  if (p1Data?.scenarios?.length) {
    lines.push('## Template parity results');
    lines.push('');
    lines.push('| Template | Preview sheets | PDF pages | Parity | Sections |');
    lines.push('|----------|---------------:|----------:|:------:|:--------:|');
    for (const row of p1Data.scenarios) {
      if (!row.templateId) continue;
      const secPass = row.parity?.sectionChecks?.every((s) => s.pass) ? '✓' : '✗';
      const parity = row.parity?.pass ? '✓' : '✗';
      lines.push(
        `| ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[row.templateId] || row.templateId} | ${row.previewSheets ?? row.parity?.previewSheets ?? '—'} | ${row.pdfPages ?? '—'} | ${parity} | ${secPass} |`
      );
    }
    lines.push('');
  }

  lines.push('## Production templates verified');
  lines.push('');
  for (const id of PRODUCTION_TEMPLATE_IDS) {
    lines.push(`- \`${id}\` — ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]}`);
  }
  lines.push('');
  lines.push('## Pipeline');
  lines.push('');
  lines.push('```');
  lines.push('Live preview:  renderCV() → layoutCvA4Pages(#cvDoc) → HirelyA4Viewport zoom');
  lines.push('Browser PDF:   prepareLockedCvExport() → suspendScaleForExport()');
  lines.push('               → body.export-pdf → html2pdf (794×captureH, sheet breaks)');
  lines.push('');
  lines.push('QA PDF:        buildPdfExportHtml (+ pack CSS) → layoutCvA4Pages');
  lines.push('               → auditPreviewPdfParity + auditExportDom → Playwright print');
  lines.push('```');
  lines.push('');
  lines.push('## Module map');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `src/ui/export/hirely-pdf-export.js` | Browser html2pdf capture |');
  lines.push('| `src/ui/export/cv-a4-pages.js` | A4 sheet pagination (preview ≡ export DOM) |');
  lines.push('| `src/ui/export/cv-a4-pages.css` | Sheet stack + export overflow visible |');
  lines.push('| `src/ui/templates/cv-pdf-export.css` | Print rules, break-avoid, no clip |');
  lines.push('| `src/tests/lib/pdf-export-playwright.mjs` | QA print + `auditPreviewPdfParity` |');
  lines.push('| `src/tests/qa-pdf-export-p1-hardening.mjs` | P1 preview↔PDF acceptance |');
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:pdf-export-hardening');
  lines.push('```');
  lines.push('');
  lines.push('## Acceptance');
  lines.push('');
  lines.push(
    pass
      ? '**PASS** — Preview and exported PDF share content, page count, and sections. No clipped or overflow-hidden export blocks detected.'
      : '**FAIL** — See QA output below.'
  );
  lines.push('');

  if (!pass && p1.out) {
    lines.push('## QA output', '', '```', p1.out.slice(0, 8000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
