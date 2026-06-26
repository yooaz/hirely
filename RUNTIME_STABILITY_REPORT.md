# HIRELY P0 — Runtime Stability Lock

**Result:** PASS
**Generated:** 2026-06-10T00:10:53.595Z

## Mission

Make Hirely impossible to break. No exception reaches UI. Every pipeline stage returns `{ success, data, warnings, errors }` — never undefined, never null, never crash.

## Stage contract

```js
{
  success: boolean,
  data: object,      // never null
  warnings: string[],
  errors: string[],
}
```

Module: `src/core/runtime/pipeline-stage-result.js`
Guards: `src/core/runtime/runtime-stability-guard.js`

## Audit by area

| Area | Guard | Key files | UI throws removed |
|------|-------|-----------|-------------------|
| Import | `normalizeImportResultShape`, extraction safe catch | `extract-file.js`, `hirely-import.js`, `canonical-import.js` | `CORE_BOOT_FAILED`, `PARSER_EMPTY` |
| OCR | `buildExtractionSafeFallback`, OCR parser gate | `extract-file.js`, `ocr-parser-gate.js` | — |
| PDF | timeout partial recovery + safe fallback | `pdf-router.js`, `hirely-pdf-export.js` | `PDF_BLOB_UNAVAILABLE` |
| Parser | `PRODUCTION_PIPELINE_SAFE_FALLBACK` | `production-pipeline.js`, `safe-fallback.js` | — |
| Review | `score-cycle-guard`, partial review recovery | `index.html`, `score-cycle-guard.js` | — |
| Export | `pdfExportFail` (no throw) | `hirely-pdf-export.js`, `export-lock.js` | — |
| Templates | render try/catch + empty state | `cv-templates.js`, `index.html` | `templates unavailable` |

## Remaining `throw new` in hot paths (core extraction — internal only)

- `src/core/extraction/document-extract.js`: 8 (caught at `extract-file.js` boundary)
- `src/core/extraction/enterprise-engine.js`: 3 (caught at `extract-file.js` boundary)

## QA checks

| Check | Status |
|-------|--------|
| contract_createStageResult | PASS |
| contract_normalizeStageResult | PASS |
| contract_runStageSafe | PASS |
| contract_shape_documented | PASS |
| guard_production_fallback | PASS |
| guard_extraction_fallback | PASS |
| guard_pdf_export_fallback | PASS |
| extract_safe_catch | PASS |
| extract_no_rethrow | PASS |
| import_no_fallback_throw | PASS |
| import_result_normalized | PASS |
| parser_safe_catch | PASS |
| parser_inner_wrapper | PASS |
| export_no_throw | PASS |
| export_safe_result | PASS |
| core_exports_contract | PASS |
| core_exports_guard | PASS |
| ui_no_core_boot_throw | PASS |
| ui_no_parser_empty_throw | PASS |
| ui_no_template_throw | PASS |
| ui_no_pdf_blob_throw | PASS |
| ui_core_boot_safe_import | PASS |
| guard_module_no_throw | PASS |

## Gates

| Command | Status |
|---------|--------|
| `npm run test:runtime-stability` | PASS |
| `npm run test:real-browser-qa-lock` | PASS |

```bash
npm run test:runtime-stability
```