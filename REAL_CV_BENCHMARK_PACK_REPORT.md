# REAL_CV_BENCHMARK_PACK_REPORT

**Pack:** `REAL_CV_BENCHMARK_PACK_V1`
**Generated:** 2026-06-12T10:22:21.209Z
**QA run:** skipped

## Summary

| Metric | Count |
|--------|------:|
| Files measured | 18 |
| `IMPORT_READY` | 14 |
| `IMPORT_NEEDS_PASTE` | 4 |
| Crashes | 0 |
| Stuck loaders | 0 |
| Fake data detected | 0 |
| Data loss detected | 1 |

## Corpus

Messy benchmark files are generated from **diverse `tests/cv-corpus/` text** + layout transforms (Canva, InDesign, Word export, two-column, scanned image PDF, table DOCX, etc.).

Override any slot by dropping a matching file in `tests/real-world-corpus/` (e.g. `pdf_canva.pdf`).

## PDF benchmark (10)

| Label | fileName | fileType | native | ocr | selected | source | status | name | email | phone | exp | edu | skills | preview | reviewQ | fake | loss |
|-------|----------|----------|-------:|----:|---------:|--------|--------|------|-------|-------|----:|----:|-------:|--------:|--------:|------:|-----:|
| Selectable PDF | benchmark-selectable-developer.pdf | native_pdf | 0 | 0 | 731 | native_pdf | **IMPORT_READY** | Alex Chen | ✓ | ✗ | 2 | 1 | 5 | 362 | 0 | ✗ | ✗ |
| Scanned PDF | benchmark-scanned-nurse.pdf | pdf | 0 | 0 | 0 | — | **IMPORT_NEEDS_PASTE** | — | ✗ | ✗ | 0 | 0 | 0 | 0 | 0 | ✗ | ✗ |
| Canva PDF | benchmark-canva-marketing.pdf | native_pdf | 0 | 0 | 796 | native_pdf | **IMPORT_READY** | — | ✓ | ✗ | 2 | 2 | 1 | 368 | 0 | ✗ | ✗ |
| InDesign PDF | benchmark-indesign-designer.pdf | native_pdf | 0 | 0 | 693 | native_pdf | **IMPORT_READY** | Jordan Garcia | ✓ | ✗ | 1 | 1 | 3 | 535 | 0 | ✗ | ✗ |
| Protected PDF | benchmark-protected.pdf | pdf | 0 | 0 | 0 | — | **IMPORT_NEEDS_PASTE** | — | ✗ | ✗ | 0 | 0 | 0 | 0 | 0 | ✗ | ✗ |
| Two-column PDF | benchmark-two-column.pdf | pdf | 0 | 0 | 0 | — | **IMPORT_NEEDS_PASTE** | — | ✗ | ✗ | 0 | 0 | 0 | 0 | 0 | ✗ | ✗ |
| Image-heavy PDF | benchmark-image-heavy.pdf | pdf | 0 | 0 | 0 | — | **IMPORT_NEEDS_PASTE** | — | ✗ | ✗ | 0 | 0 | 0 | 0 | 0 | ✗ | ✗ |
| Creative portfolio PDF | benchmark-creative-portfolio.pdf | native_pdf | 0 | 0 | 798 | native_pdf | **IMPORT_READY** | Yohann Azancot | ✓ | ✓ | 1 | 0 | 3 | 335 | 0 | ✗ | ✗ |
| Corporate PDF | benchmark-corporate-executive.pdf | native_pdf | 0 | 0 | 492 | native_pdf | **IMPORT_READY** | New York | ✓ | ✗ | 4 | 1 | 0 | 283 | 0 | ✗ | ✗ |
| Old exported PDF | benchmark-old-word-export.pdf | native_pdf | 0 | 0 | 730 | native_pdf | **IMPORT_READY** | Sophie Martin | ✓ | ✓ | 3 | 2 | 0 | 463 | 0 | ✗ | ✗ |

## DOCX benchmark (5)

| Label | fileName | fileType | native | ocr | selected | source | status | name | email | phone | exp | edu | skills | preview | reviewQ | fake | loss |
|-------|----------|----------|-------:|----:|---------:|--------|--------|------|-------|-------|----:|----:|-------:|--------:|--------:|------:|-----:|
| Simple Word CV | benchmark-simple-word.docx | docx | 0 | 0 | 738 | docx | **IMPORT_READY** | Alex Chen | ✓ | ✗ | 4 | 1 | 5 | 450 | 0 | ✗ | ✗ |
| Table layout DOCX | benchmark-table-layout.docx | docx | 0 | 0 | 786 | docx | **IMPORT_READY** | Laura Bennett | ✓ | ✗ | 3 | 0 | 1 | 225 | 0 | ✗ | ✗ |
| Two-column Word CV | benchmark-two-column-word.docx | docx | 0 | 0 | 335 | docx | **IMPORT_READY** | Marie Dupont | ✓ | ✓ | 0 | 0 | 0 | 51 | 0 | ✗ | ✓ |
| Header/footer contact DOCX | benchmark-header-footer.docx | docx | 0 | 0 | 524 | docx | **IMPORT_READY** | New York | ✓ | ✗ | 4 | 1 | 0 | 283 | 0 | ✗ | ✗ |
| Creative Word CV | benchmark-creative-word.docx | docx | 0 | 0 | 1016 | docx | **IMPORT_READY** | — | ✓ | ✓ | 2 | 0 | 6 | 466 | 0 | ✗ | ✗ |

## Image benchmark (3)

| Label | fileName | fileType | native | ocr | selected | source | status | name | email | phone | exp | edu | skills | preview | reviewQ | fake | loss |
|-------|----------|----------|-------:|----:|---------:|--------|--------|------|-------|-------|----:|----:|-------:|--------:|--------:|------:|-----:|
| PNG CV | benchmark-cv.png | ocr | 0 | 0 | 451 | ocr | **IMPORT_READY** | Lucas Moreau | ✓ | ✓ | 3 | 0 | 0 | 317 | 0 | ✗ | ✗ |
| JPG CV | benchmark-cv.jpg | ocr | 0 | 0 | 575 | ocr | **IMPORT_READY** | Jordan Garcia | ✓ | ✗ | 1 | 1 | 3 | 492 | 0 | ✗ | ✗ |
| Screenshot CV | benchmark-cv-screenshot.png | ocr | 0 | 0 | 654 | ocr | **IMPORT_READY** | Sophie Martin | ✓ | ✓ | 2 | 2 | 0 | 269 | 0 | ✗ | ✗ |

## Metrics

| Field | Description |
|-------|-------------|
| `nativeTextLength` | PDF/DOCX native text layer chars |
| `ocrTextLength` | OCR layer chars (when run) |
| `selectedTextLength` | Text chosen for import (`rawText`) |
| `selectedSource` | `native_pdf`, `ocr`, `docx`, etc. |
| `fakeDataDetected` | Fake name/phone per no-fake-data policy |
| `dataLossDetected` | Extracted text not reflected in preview/structure |

## Verification

```bash
npm run qa:real-cv-benchmark-pack
npm run real-cv-benchmark-pack-report
```
