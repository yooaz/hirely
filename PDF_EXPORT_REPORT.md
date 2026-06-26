# PDF Export Report

**Generated:** 2026-06-16T07:38:26.924Z
**Engine:** PDF_EXPORT_REPORT_V1
**Release gate:** Export success **>99%** — **PASS** (100%)

## Executive summary

| Metric | Value |
| --- | --- |
| **Overall success rate** | **100%** (23/23 runs) |
| html2pdf browser matrix | 21/21 |
| PDF Export V2 (packet) | 1/1 |
| Download trigger (blob → save) | 1/1 |
| Static pipeline checks | 25/25 |
| QA run | **PASS** |

## Production path

`#downloadBtn` → `downloadPDF()` → `exportPacketV2()` (page-by-page html2canvas + jsPDF) → fallback `exportCvToPdf()` on V2 failure.

downloadPDF → exportPacketV2 (page raster) → fallback exportCvToPdf (html2pdf)

## Components audited

| Component | Implementation | Status |
| --- | --- | --- |
| **html2canvas** | Bundled in html2pdf.js — scale 2, A4 794×1123, `allowTaint: false` | Covered in browser matrix |
| **html2pdf** | `HirelyPdfExport.exportCvToPdf` / `exportCvToPdfBlob` | PASS |
| **Blob generation** | `outputPdf('blob')`, `exportPacketV2Blob` | PASS |
| **Download trigger** | `jsPDF.save` + `triggerBlobDownload` Safari fallback | PASS |
| **Page breaks** | `HirelyA4Pages.layoutCvA4Pages` + `.html2pdf__page-break-before` | Covered |
| **Fonts** | `document.fonts.ready` (3.5s cap) + 280ms settle | Covered |
| **Images** | Data-URL photos + `inlineExportImages` pre-capture | Covered |
| **Headers** | `.cvHead` on page 1, break-inside avoid | Covered |
| **Footers** | `.cvMetaFooter` break-inside avoid, no clip in export CSS | Covered |

## Browsers tested

| Browser | Engine | Runs | Pass |
| --- | --- | --- | --- |
| Chrome | Chromium | 7 | 7 |
| Safari | WebKit | 7 | 7 |
| Firefox | Firefox | 7 | 7 |

## Results by browser (html2pdf)

### Chrome (chrome)

Success: **100%** (7/7)

| Scenario | Template | Status | Pages | A4 | Header | Method | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Short ATS | ats-recruiter | PASS | 2 | true | yes | html2pdf | — |
| Long executive | luxury-executive | PASS | 3 | true | yes | html2pdf | — |
| Photo editorial | kinfolk-editorial | PASS | 2 | true | yes | html2pdf | — |
| Creative portfolio | creative-director-portfolio | PASS | 2 | true | yes | html2pdf | — |
| Premium ATS (v3) | premium-ats | PASS | 2 | true | yes | html2pdf | — |
| Executive board (v3) | executive-board | PASS | 3 | true | yes | html2pdf | — |
| Creative director + photo (v3) | creative-director | PASS | 2 | true | yes | html2pdf | — |

**Blob export (html2pdf):** PASS (33722 bytes)

### Safari (safari)

Success: **100%** (7/7)

| Scenario | Template | Status | Pages | A4 | Header | Method | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Short ATS | ats-recruiter | PASS | 2 | true | yes | html2pdf | — |
| Long executive | luxury-executive | PASS | 3 | true | yes | html2pdf | — |
| Photo editorial | kinfolk-editorial | PASS | 2 | true | yes | html2pdf | — |
| Creative portfolio | creative-director-portfolio | PASS | 2 | true | yes | html2pdf | — |
| Premium ATS (v3) | premium-ats | PASS | 2 | true | yes | html2pdf | — |
| Executive board (v3) | executive-board | PASS | 3 | true | yes | html2pdf | — |
| Creative director + photo (v3) | creative-director | PASS | 2 | true | yes | html2pdf | — |

### Firefox (firefox)

Success: **100%** (7/7)

| Scenario | Template | Status | Pages | A4 | Header | Method | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Short ATS | ats-recruiter | PASS | 2 | true | yes | html2pdf | — |
| Long executive | luxury-executive | PASS | 3 | true | yes | html2pdf | — |
| Photo editorial | kinfolk-editorial | PASS | 2 | true | yes | html2pdf | — |
| Creative portfolio | creative-director-portfolio | PASS | 2 | true | yes | html2pdf | — |
| Premium ATS (v3) | premium-ats | PASS | 2 | true | yes | html2pdf | — |
| Executive board (v3) | executive-board | PASS | 3 | true | yes | html2pdf | — |
| Creative director + photo (v3) | creative-director | PASS | 2 | true | yes | html2pdf | — |


## PDF Export V2 (cover + audit packet + CV sheets)

| Run | Status | Total pages | Audit pages | CV pages | Issues |
| --- | --- | --- | --- | --- | --- |
| chrome/v3-premium-ats | PASS | 6 | 5 CV audit pages | 1 | — |

## Download trigger (blob → anchor click)

| Browser | Status | triggerBlobDownload | Playwright download event | Filename |
| --- | --- | --- | --- | --- |
| chrome | PASS | yes | yes | hirely-trigger-test.pdf |

## Static pipeline checks

| Check | Status | Detail |
| --- | --- | --- |
| file:hirelyPdfExport | PASS | src/ui/export/hirely-pdf-export.js |
| file:cvPdfExportCss | PASS | src/ui/templates/cv-pdf-export.css |
| file:cvA4Pages | PASS | src/ui/export/cv-a4-pages.js |
| file:pdfExportConfig | PASS | src/core/export/pdf-export-config.js |
| file:exportLock | PASS | src/core/export/export-lock.js |
| file:html2pdfBundle | PASS | node_modules/html2pdf.js/dist/html2pdf.bundle.min.js |
| file:jspdfBundle | PASS | node_modules/jspdf/dist/jspdf.umd.min.js |
| export:save | PASS | — |
| export:blob | PASS | — |
| export:pagebreaks | PASS | — |
| export:fonts-ready | PASS | — |
| export:inline-images | PASS | — |
| export:trigger-download | PASS | — |
| export:allowTaint-false | PASS | — |
| export:useCORS | PASS | — |
| filename:ascii | PASS | hirely-Jane-Doe.pdf |
| filename:accent-strip | PASS | hirely-Jos-Garca.pdf |
| filename:empty-fallback | PASS | — |
| download:HirelyPdfExport | PASS | — |
| download:v2-fallback | PASS | — |
| download:blob-email | PASS | — |
| download:filename-core | PASS | — |
| download:html2pdf-fallback | PASS | — |
| blob:html2pdf | PASS | size=33722 |
| qa:playwright-print | PASS | /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/pdf-export-audit-report/playwright-print-long-executive.pdf |

## Root causes (observed failures)

| Root cause | Count |
| --- | --- |
| — | 0 |

## Scenarios

| ID | Template | Label |
| --- | --- | --- |
| short-ats | ats-recruiter | Short ATS |
| long-executive | luxury-executive | Long executive |
| photo-editorial | kinfolk-editorial | Photo editorial |
| creative-portfolio | creative-director-portfolio | Creative portfolio |
| v3-premium-ats | premium-ats | Premium ATS (v3) |
| v3-executive-board | executive-board | Executive board (v3) |
| v3-creative-photo | creative-director | Creative director + photo (v3) |

## Fixes applied (this release)

- **Page breaks:** A4 sheet stack via `HirelyA4Pages`; V2 rasterizes one page at a time (no tall-stack clipping).
- **Fonts:** `prepareFonts()` waits for `document.fonts.ready` with 3.5s timeout + settle delay.
- **Images:** `inlineExportImages()` converts cross-origin `img` to data URLs before html2canvas (`allowTaint: false`).
- **Headers/footers:** Export CSS prevents `.cvHead` / `.cvMetaFooter` clipping; page-1 header preserved in pagination.
- **Download:** `triggerBlobDownload()` for Safari/Firefox when `jsPDF.save()` fails; V2 falls back to V1 `exportCvToPdf`.

## Verification

```bash
npm run pdf-export-report
npm run qa:pdf-export-audit
npm run qa:final-pdf-export-lock
```

Artifacts: `tests/output/pdf-export-audit-report/*.pdf`
