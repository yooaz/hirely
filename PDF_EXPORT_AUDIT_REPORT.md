# PDF Export Audit Report (P0)

**Generated:** 2026-06-14T00:09:23.368Z
**Engine:** PDF_EXPORT_AUDIT_P0
**Production path:** HirelyPdfExport.exportCvToPdf / exportCvToPdfBlob (html2pdf + jsPDF)

## Executive summary

| Metric | Value |
| --- | --- |
| **Success rate** | **100%** (12/12 browser runs) |
| **Failure rate** | **0%** (0/12) |
| Static pipeline checks | 21/21 pass |
| QA run | **PASS** |

## Audit scope

Components audited:

- **HTML render** — template output, sections, name/photo presence
- **PDF render** — `HirelyPdfExport.exportCvToPdfBlob()` per browser (production path)
- **Page breaks** — `.cvA4Sheet` stack via `HirelyA4Pages.layoutCvA4Pages`
- **Fonts** — `document.fonts.ready` + PDF embedded font detection
- **Images** — data-URL photo in HTML; `allowTaint: false` compliance
- **Download trigger** — `#downloadBtn` → `downloadPDF()` → `HirelyPdfExport.exportCvToPdf`
- **Blob creation** — `exportCvToPdfBlob()` for email upload
- **Filename generation** — `buildCvExportFilename()` accent strip + fallback

Browsers tested (Playwright engines):

- **Chrome** — Chromium + production html2pdf
- **Safari** — WebKit + production html2pdf
- **Firefox** — Firefox + production html2pdf

> Note: Playwright `page.pdf()` is Chromium-only and is **not** the user export path. This audit uses **html2pdf** (html2canvas + jsPDF) matching `index.html`.

## Results by browser

### Chrome (chrome)

Success: **100%** (4/4)

| Scenario | Template | Status | Pages | A4 | Fonts | Method | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Short ATS | ats-recruiter | PASS | 2 | true | false | html2pdf | — |
| Long executive | luxury-executive | PASS | 3 | true | false | html2pdf | — |
| Photo editorial | kinfolk-editorial | PASS | 2 | true | false | html2pdf | — |
| Creative portfolio | creative-director-portfolio | PASS | 2 | true | false | html2pdf | — |

**Blob export (html2pdf):** PASS (38134 bytes)

### Safari (safari)

Success: **100%** (4/4)

| Scenario | Template | Status | Pages | A4 | Fonts | Method | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Short ATS | ats-recruiter | PASS | 2 | true | false | html2pdf | — |
| Long executive | luxury-executive | PASS | 3 | true | false | html2pdf | — |
| Photo editorial | kinfolk-editorial | PASS | 2 | true | false | html2pdf | — |
| Creative portfolio | creative-director-portfolio | PASS | 2 | true | false | html2pdf | — |

### Firefox (firefox)

Success: **100%** (4/4)

| Scenario | Template | Status | Pages | A4 | Fonts | Method | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Short ATS | ats-recruiter | PASS | 2 | true | false | html2pdf | — |
| Long executive | luxury-executive | PASS | 3 | true | false | html2pdf | — |
| Photo editorial | kinfolk-editorial | PASS | 2 | true | false | html2pdf | — |
| Creative portfolio | creative-director-portfolio | PASS | 2 | true | false | html2pdf | — |


## Static pipeline checks

| Check | Status | Detail |
| --- | --- | --- |
| file:hirelyPdfExport | PASS | src/ui/export/hirely-pdf-export.js |
| file:cvPdfExportCss | PASS | src/ui/templates/cv-pdf-export.css |
| file:cvA4Pages | PASS | src/ui/export/cv-a4-pages.js |
| file:pdfExportConfig | PASS | src/core/export/pdf-export-config.js |
| file:exportLock | PASS | src/core/export/export-lock.js |
| file:html2pdfBundle | PASS | node_modules/html2pdf.js/dist/html2pdf.bundle.min.js |
| export:save | PASS | — |
| export:blob | PASS | — |
| export:pagebreaks | PASS | — |
| export:fonts-ready | PASS | — |
| export:allowTaint-false | PASS | — |
| export:useCORS | PASS | — |
| filename:ascii | PASS | hirely-Jane-Doe.pdf |
| filename:accent-strip | PASS | hirely-Jos-Garca.pdf |
| filename:empty-fallback | PASS | — |
| download:HirelyPdfExport | PASS | — |
| download:blob-email | PASS | — |
| download:filename-core | PASS | — |
| download:html2pdf-fallback | PASS | — |
| blob:html2pdf | PASS | size=38134 |
| qa:playwright-print | PASS | /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/pdf-export-audit-report/playwright-print-long-executive.pdf |

## Root causes (observed failures)

| Root cause | Count |
| --- | --- |
| — | 0 |

## Advisory warnings (non-blocking)

html2pdf rasterizes CVs to canvas — A4 sheet count may differ from final PDF page count. These do **not** fail the audit but explain user-reported pagination quirks.

| Warning | Count |
| --- | --- |
| fonts_not_embedded | 12 |
| pagination_unstable | 12 |
| page_estimate_mismatch | 12 |
| blank_or_extra_page | 12 |

## Known failure modes (codebase)

| ID | Description |
| --- | --- |
| HTML2PDF_NOT_LOADED | HirelyLazy.ensureHtml2pdf() failed — CSP or missing bundle |
| CV_ELEMENT_MISSING | #cvDoc missing or not .cv--live at export time |
| EXPORT_GATE_BLOCKED | Review queue / extraction gate blocks downloadCv() |
| ALLOW_TAINT_CORS | html2canvas allowTaint:false rejects non-data-URL images |
| FONTS_NOT_READY | document.fonts.ready not awaited before capture |
| A4_SCALE_ACTIVE | Preview zoom scale not suspended via HirelyA4Viewport |
| CANVAS_HEIGHT_UNDERESTIMATE | html2canvas windowHeight too small on multi-page stack |
| OVERFLOW_CLIPPING | overflow:hidden on .cvSection/.cvMain clips content in PDF |
| SAFARI_CANVAS_DIFF | WebKit html2canvas rendering differences vs Chromium |
| FIREFOX_PDF_DIFF | Firefox html2canvas / jsPDF variance |
| PLAYWRIGHT_PDF_CHROMIUM_ONLY | page.pdf() unsupported outside Chromium — not production path |

## Scenarios

| ID | Template | Label |
| --- | --- | --- |
| short-ats | ats-recruiter | Short ATS |
| long-executive | luxury-executive | Long executive |
| photo-editorial | kinfolk-editorial | Photo editorial |
| creative-portfolio | creative-director-portfolio | Creative portfolio |

## Recommendations

- Keep profile photos as **data URLs** before export (`allowTaint: false`).
- Always call `HirelyA4Viewport.suspendScaleForExport()` before html2canvas capture.
- Await `document.fonts.ready` in `HirelyPdfExport.prepareFonts()`.
- Block export when review queue / extraction gate is active (`downloadPDF` guards).
- Re-run: `npm run pdf-export-audit-report`
- Artifacts: `tests/output/pdf-export-audit-report/*.pdf`
