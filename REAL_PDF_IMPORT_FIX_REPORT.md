# HIRELY P0 — REAL PDF IMPORT FIX

**Verdict:** PASS
**Date:** 2026-06-10

## Symptom

Real user PDFs hit `PDF_EXTRACTION_TIMEOUT` / `OCR_TIMEOUT` → `IMPORT_NEEDS_PASTE` while benchmarks pass.

## Root causes

| Issue | Fix |
|-------|-----|
| OCR hard ceiling was **8s** (same as early-paste UX) | `OCR_ABSOLUTE_MAX_MS` / `OCR_HARD_FALLBACK_MS` → **20s** (`PDF_EXTRACTION_MAX_MS`) |
| Tesseract preloaded for **every** PDF before native probe | Removed from `extractPdfDocument`; OCR loads on-demand in enterprise engine |
| Duplicate soft timer at 8s aborted OCR early | Removed `softTimeoutTimer`; 8s = advisory paste only |
| UI blocked past 20s on slow scans | `triggerPdfOcrFullFallback` + `hirely:ocr-wait-timeout` show paste panel, clear loading |
| Native text lost on outer timeout | `extract-file.js` recovers `native_pdf` partial from session |

## Rules applied

| Rule | Implementation |
|------|----------------|
| Selectable text → never OCR | `pdf-router.js` `routePdfExtraction` — `ocrAllowed: false` on native route |
| Direct text extraction first | `extractNativePdfLines` (pdf.js) before `runCachedTimedPdfOcr` |
| OCR only if empty/garbage | `planPdfExtraction` + `assessPdfTextLayer` + `shouldRunOcrForTextLength` |
| 8s → paste option | `OCR_UX_EARLY_PASTE_MS` → `hirely:ocr-early-paste` |
| 20s → paste fallback | `OCR_ABSOLUTE_MAX_MS` + `triggerPdfOcrFullFallback` |
| Never block UI | `clearLoadingState` / `setCvLoading(false)` on fallback |
| Filename visible | `#fileName` set at `FILE_SELECTED` (unchanged) |
| Paste → review | `importPasteFallbackApply` → `applyCvPipeline` → `ensureImportReviewVisible` |

## Key files

- `src/core/extraction/pdf-extraction-timeout.js`
- `src/core/extraction/pdf-ocr-run.js`
- `src/core/extraction/document-extract.js`
- `src/core/extraction/pdf-router.js`
- `src/core/extraction/enterprise-engine.js`
- `src/core/extraction/extract-file.js`
- `index.html` — import timeout UX only (no templates/scoring)

## Checks (17)

| Check | Result | Detail |
|-------|--------|--------|
| pdf_extraction_max_20s | PASS | 20000 |
| ocr_early_paste_8s | PASS | 8000 |
| ocr_hard_fallback_20s | PASS | 20000 |
| ocr_absolute_max_20s | PASS | 20000 |
| ocr_ui_soft_8s | PASS | 8000 |
| ocr_absolute_gt_soft | PASS |  |
| no_tesseract_preload_pdf | PASS | native-first |
| ocr_early_paste_event | PASS |  |
| ocr_wait_timeout_event | PASS |  |
| no_duplicate_soft_timer_8s | PASS |  |
| selectable_text_detected | PASS | pdf_text |
| native_never_ocr | PASS | selectable_text_layer |
| native_route | PASS | native_pdf |
| ocr_skipped_when_text_locked | PASS | lock at 500c |
| scanned_routes_ocr | PASS | scanned_no_selectable_text |
| timeout_with_text_partial | PASS | PARTIAL_TEXT_RECOVERED |
| timeout_empty_needs_paste | PASS | PDF_OCR_TIMEOUT |

## Acceptance

| Criterion | Status |
|-----------|--------|
| Selectable PDF imports without OCR | PASS |
| Scanned PDF shows fallback | PASS |
| Paste fallback path | PASS |
| No infinite loading (20s cap) | PASS |

## Run

```bash
npm run test:real-pdf-import
node src/tests/qa-ocr-timeout-race.mjs
node src/tests/qa-pdf-routing.mjs
node src/tests/qa-real-pdf-import-fix.mjs
```


