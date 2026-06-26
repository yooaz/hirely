# PDF_EXTRACTION_TIMEOUT — Root Cause Trace

Generated: 2026-06-06T14:53:33.714Z

> Trace only — no parser/UI/ATS/template changes.

## First throw site (`PDF_EXTRACTION_TIMEOUT`)

| Field | Value |
|-------|-------|
| **FIRST FILE** | `src/core/extraction/pdf-extraction-timeout.js` |
| **FIRST FUNCTION** | `withExtractionTimeout` |
| **FIRST LINE** | **55** |
| Snippet | `reject(Object.assign(new Error('PDF_EXTRACTION_TIMEOUT'), { code, importStatus: 'PDF_OCR_TIMEOUT' }))` |

Wrapped at:

- `src/core/extraction/extract-file.js:67` — `extractFromFileDetailed()` calls `withExtractionTimeout(extractDocument(file), 30000, 'OCR_TIMEOUT')`

**Note:** Inner OCR uses separate errors (`OCR_ABSOLUTE_TIMEOUT`, `OCR_TIMEOUT`) from `pdf-ocr-run.js`. Only the **outer** `withExtractionTimeout` race emits the literal message `PDF_EXTRACTION_TIMEOUT`.

## Timeout values (definitions)

| Constant | Value | Defined in | Line | Role |
|----------|------:|------------|-----:|------|
| `PDF_EXTRACTION_MAX_MS` | 30000ms | `src/core/extraction/pdf-extraction-timeout.js` | 5 | hard ceiling for outer PDF extract wrap |
| `OCR_ABSOLUTE_MAX_MS` | 30000ms | `src/core/extraction/pdf-ocr-run.js` | 33 | alias of PDF_EXTRACTION_MAX_MS — inner OCR timer, throws OCR_ABSOLUTE_TIMEOUT not PDF_EXTRACTION_TIMEOUT |
| `OCR_ROTATION_TRIAL_MAX_MS` | 8000ms | `src/core/extraction/pdf-extraction-timeout.js` | 6 | per rotation trial cap (withRotationTrialTimeout) |
| `OCR_UI_SOFT_TIMEOUT_MS` | 20000ms | `src/core/extraction/pdf-ocr-run.js` | 29 | advisory only — does not throw PDF_EXTRACTION_TIMEOUT |
| `OCR_HARD_TIMEOUT_MS` | 25000ms | `src/core/extraction/pdf-ocr-run.js` | 30 | advisory only |

## Call path

1. index.html → handleFileImport (line ~4999)
1. canonical-import.js → canonicalImportFromFile → extractTextFromFile
1. extract-file.js → extractFromFileDetailed → withExtractionTimeout(extractDocument, 30000)
1. document-extract.js → extractDocument → extractPdfDocument
1. enterprise-engine.js → extractPdfEnterprise
1. pdf-lines-native.js → extractNativePdfLines (per page)
1. pdf-router.js → planPdfExtraction / routePdfExtraction
1. ocr path: pdf-ocr-run.js → runCachedTimedPdfOcr → ocr-lines / ocr-pipeline

## Document under test

| Field | Value |
|-------|-------|
| Path | `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf` |
| File | `cv2022 yohann azancot copie.pdf` |
| Size | 1308216 bytes |
| Import window | 2026-06-06T14:53:18.212Z → 2026-06-06T14:53:33.688Z (15476ms) |

## Stage timings (per requested path)

| Stage | Start | End | Duration | Status | Detail |
|-------|-------|-----|----------|--------|--------|
| handleFileImport | 2026-06-06T14:53:18.212Z | 2026-06-06T14:53:33.688Z | 15476ms | success | IMPORT_READY (no PDF_EXTRACTION_TIMEOUT) |
| canonicalImportFromFile | 2026-06-06T14:53:18.265Z | 2026-06-06T14:53:33.688Z | 15423ms | success | extractTextFromFile → extractFromFileDetailed |
| extract-file.extractFromFileDetailed | 2026-06-06T14:53:18.482Z | 2026-06-06T14:53:32.898Z | 14416ms | success | withExtractionTimeout budget=30000ms |
| document-extract.extractDocument | 2026-06-06T14:53:18.483Z | 2026-06-06T14:53:18.649Z | 166ms | success | 1308216b |
| pdf-lines-native.extractNativePdfLines | 2026-06-06T14:53:18.483Z | 2026-06-06T14:53:18.649Z | 166ms | success | native probe before OCR route (low text → scanned/hybrid) |
| pdf-router.planPdfExtraction | 2026-06-06T14:53:18.483Z | 2026-06-06T14:53:18.649Z | 166ms | success | routed to OCR (OCR_STARTED follows native/router) |
| enterprise-engine.extractPdfEnterprise | 2026-06-06T14:53:18.649Z | 2026-06-06T14:53:32.898Z | 14249ms | success | 14247ms work |
| ocr-pipeline (pass A) | 2026-06-06T14:53:18.649Z | 2026-06-06T14:53:26.295Z | 7646ms | success | OCR_RESULT_TEXT_LENGTH=1297 OCR_LINES_COUNT=42 provider=tesseract |
| ocr-pipeline (pass B / rotation) | 2026-06-06T14:53:26.295Z | 2026-06-06T14:53:32.876Z | 6581ms | success | {OCR_RESULT_TEXT_LENGTH: 1297, OCR_LINES_COUNT: 42, provider: tesseract} |
| ocr-pipeline (total via pdf-ocr-run) | 2026-06-06T14:53:18.649Z | 2026-06-06T14:53:32.897Z | 14248ms | success | 14248ms pages=1 |

**PDF pages (OCR):** 1
**Document:** `cv2022 yohann azancot copie.pdf` (1308216 bytes)
**Outer timeout budget:** 30000ms (`PDF_EXTRACTION_MAX_MS`) — OCR wall in this run: ~14248ms pages=1

## Production path stages

| Stage | Result |
|-------|--------|
| handleFileImport | IMPORT_READY |
| PDF_EXTRACTION_TIMEOUT thrown (isolated wrap) | no |
| Extraction method | — |
| PDF route | — |
| File type | — |
| Pages | — |
| Console timeout signals | no |

## Extraction console log (sample)

- `2026-06-06T14:53:18.265Z` [Hirely import] EXTRACTION_STARTED
- `2026-06-06T14:53:18.482Z` [Hirely extraction] EXTRACTION_IMPORT_RUN 1
- `2026-06-06T14:53:18.483Z` [Hirely extraction] PDF_BUFFER_READ 1308216b
- `2026-06-06T14:53:18.483Z` [Hirely extraction] PDF_BUFFER_CLONED_FOR_PDF_JS 1308216b
- `2026-06-06T14:53:18.484Z` [Hirely extraction] PDF_BUFFER_CLONED_FOR_PDF_LIB 1308216b
- `2026-06-06T14:53:18.484Z` [Hirely extraction] PDF_BUFFER_CLONED_FOR_OCR pdfjs-proxy
- `2026-06-06T14:53:18.649Z` [Hirely extraction] OCR_STARTED run=1
- `2026-06-06T14:53:18.649Z` [Hirely extraction] OCR_CACHE_MISS cv2022 yohann azancot copie.pdf|1308216|1780757598260|1|bestpass
- `2026-06-06T14:53:26.295Z` [Hirely extraction] OCR_PIPELINE OCR_RESULT_TEXT_LENGTH=1297 OCR_LINES_COUNT=42 provider=tesseract
- `2026-06-06T14:53:26.295Z` [Hirely OCR propagate] OCR_PIPELINE {OCR_RESULT_TEXT_LENGTH: 1297, OCR_LINES_COUNT: 42, provider: tesseract}
- `2026-06-06T14:53:26.329Z` OCR_ROTATION_TEST {rotation: 0, variant: standard, charCount: 1292, qualityScore: 77, topWords: Array(8)}
- `2026-06-06T14:53:26.330Z` OCR_ROTATION_TEST {rotation: 0, variant: standard, charCount: 1292, qualityScore: 77, topWords: Array(8)}
- `2026-06-06T14:53:26.330Z` [Hirely extraction] OCR_ROTATION_EARLY_STOP 0° score=77
- `2026-06-06T14:53:26.330Z` [Hirely extraction] OCR_ROTATION_CHOSEN 0° score=77 variant=standard
- `2026-06-06T14:53:30.650Z` [Hirely extraction] OCR_SLOW_HINT 12000ms
- `2026-06-06T14:53:32.876Z` [Hirely extraction] OCR_PIPELINE OCR_RESULT_TEXT_LENGTH=1297 OCR_LINES_COUNT=42 provider=tesseract
- `2026-06-06T14:53:32.876Z` [Hirely OCR propagate] OCR_PIPELINE {OCR_RESULT_TEXT_LENGTH: 1297, OCR_LINES_COUNT: 42, provider: tesseract}
- `2026-06-06T14:53:32.880Z` [Hirely extraction] OCR_PASS_TEXT_CAPTURED textLength=1297
- `2026-06-06T14:53:32.897Z` [Hirely extraction] OCR_ALL_PAGES OCR_LINES_COUNT=42 OCR_JOINED_TEXT_LENGTH=1292 OCR_RESULT_TEXT_LENGTH=1292 pages=1 note=early-pass=A
- `2026-06-06T14:53:32.897Z` [Hirely OCR propagate] OCR_ALL_PAGES {OCR_LINES_COUNT: 42, OCR_JOINED_TEXT_LENGTH: 1292, OCR_RESULT_TEXT_LENGTH: 1292, pages: 1, note: early-pass=A}
- `2026-06-06T14:53:32.897Z` [Hirely extraction] OCR_CACHE_STORE_TEXT 1292c
- `2026-06-06T14:53:32.897Z` [Hirely extraction] PDF_OCR_RUN OCR_RESULT_TEXT_LENGTH=1292 OCR_LINES_COUNT=42 OCR_JOINED_TEXT_LENGTH=1292
- `2026-06-06T14:53:32.897Z` [Hirely OCR propagate] PDF_OCR_RUN {OCR_RESULT_TEXT_LENGTH: 1292, OCR_LINES_COUNT: 42, OCR_JOINED_TEXT_LENGTH: 1292}
- `2026-06-06T14:53:32.897Z` [Hirely extraction] OCR_FINISHED 14247ms work
- `2026-06-06T14:53:32.897Z` [Hirely extraction] OCR_RESULT_RECEIVED textLength=1292
- `2026-06-06T14:53:32.897Z` [Hirely extraction] OCR_SUCCESS_RETURNED textLength=1292
- `2026-06-06T14:53:32.897Z` [Hirely extraction] OCR_CACHE_STORE_SUCCESS 1292c
- `2026-06-06T14:53:32.898Z` [Hirely extraction] ENTERPRISE_AFTER_OCR ENTERPRISE_RESULT_TEXT_LENGTH=1292 OCR_LINES_COUNT=42
- `2026-06-06T14:53:32.898Z` [Hirely OCR propagate] ENTERPRISE_AFTER_OCR {ENTERPRISE_RESULT_TEXT_LENGTH: 1292, OCR_LINES_COUNT: 42}
- `2026-06-06T14:53:32.898Z` [Hirely extraction] ENTERPRISE_AFTER_OCR OCR_TEXT_LENGTH=1292 OCR_LINES_COUNT=42

## Root cause summary

**Yoaz PDF did not hit `PDF_EXTRACTION_TIMEOUT` in this run** (total 15476ms).

- **Document:** `cv2022 yohann azancot copie.pdf`, **page 1** (single-page OCR in logs)
- **Route:** scanned/hybrid → full OCR (native text insufficient)
- **OCR duration:** 14248ms — **15752ms headroom** before outer `PDF_EXTRACTION_TIMEOUT`

When timeout **does** fire: same document/page still in flight inside `extractDocument()` → typically **page 1 OCR multipass** not finished before 30s.

## What causes `PDF_EXTRACTION_TIMEOUT` (mechanism)

```
extractFromFileDetailed (PDF)
  └─ withExtractionTimeout(extractDocument(file), PDF_EXTRACTION_MAX_MS=30000)
       ├─ extractDocument → extractPdfDocument
       │    ├─ pdf-lines-native.extractNativePdfLines (each page)
       │    ├─ pdf-router.planPdfExtraction
       │    └─ enterprise-engine.extractPdfEnterprise
       │         └─ [ocr route] pdf-ocr-run → ocr-pipeline (per page/pass)
       └─ setTimeout(30000ms) → reject PDF_EXTRACTION_TIMEOUT  ← FIRST THROW
```
