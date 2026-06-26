# Universal Import Pipeline Report (P0)

**Status:** PASS
**Engine:** `UNIVERSAL_IMPORT_PIPELINE_V1`
**Generated:** 2026-06-13T23:39:58.725Z

## Goal

Import must work or fail honestly for every supported format. Wrong data forbidden; missing data acceptable.

## Rules (locked)

| Rule | Enforcement |
| --- | --- |
| `selectedTextLength >= 300` → parse | `hasMeaningfulImportText` + `canonicalImportFromFile` |
| `selectedTextLength < 300` → `IMPORT_NEEDS_PASTE` | `buildThinTextPasteResult` / `buildEmptyExtractPasteResult` |
| Never fake success | No `resumeData` on paste; no `IMPORT_READY` below 300 |
| Never stay loading | Import race timeout → terminal paste state |
| Never silently fail | `UNIVERSAL_IMPORT_PIPELINE` log + `importFallback` reason |

## Acceptance

| Criterion | Status |
| --- | --- |
| PDF text → IMPORT_READY | **PASS** |
| DOCX → IMPORT_READY | **PASS** |
| TXT → IMPORT_READY | **PASS** |
| Scanned/protected/image unreadable → IMPORT_NEEDS_PASTE | **PASS** |
| No IMPORT_STUCK | **PASS** |

## Per-file pipeline log

| Format | File | native | ocr | selected | fileType | pages | scanned | protected | status | Pass |
| --- | --- | ---: | ---: | ---: | --- | ---: | --- | --- | --- | --- |
| PDF text | yoaz-selectable.pdf | 1769 | 0 | 1769 | pdf_text | 1 | no | no | **IMPORT_READY** | ✓ |
| DOCX | yoaz.docx | 2490 | 0 | 2490 | docx | 1 | no | no | **IMPORT_READY** | ✓ |
| TXT | yoaz.txt | 2490 | 0 | 2490 | txt | 1 | no | no | **IMPORT_READY** | ✓ |
| PDF scanned | blank-scan.pdf | 0 | 0 | 0 | pdf | 0 | no | no | **IMPORT_NEEDS_PASTE** | ✓ |
| PDF protected | protected-scan.pdf | 0 | 0 | 0 | pdf | 0 | no | yes | **IMPORT_NEEDS_PASTE** | ✓ |
| PNG | cv-scan.png | 0 | 0 | 0 | image | 0 | yes | no | **IMPORT_NEEDS_PASTE** | ✓ |
| JPG | cv-scan.jpg | 0 | 0 | 0 | image | 0 | yes | no | **IMPORT_NEEDS_PASTE** | ✓ |

## Forbidden totals

| Check | Count |
| --- | ---: |
| IMPORT_STUCK | 0 |
| IMPORT_CRASH | 0 |
| Fake READY (<300 chars) | 0 |

## Implementation

| Module | Role |
| --- | --- |
| `universal-import-pipeline.js` | Structured log: native/ocr/selected lengths, fileType, pageCount, isScanned, isProtected, status |
| `canonical-import.js` | 300-char gate + `attachUniversalImportMeta` on every terminal result |
| `extract-file.js` | Logs pipeline metrics after multi-format enrichment |
| `real-cv-import-root.js` | `REAL_CV_IMPORT_MIN_CHARS = 300` policy |

## Verify

```bash
npm run qa:universal-import-pipeline
npm run universal-import-pipeline-report
```
