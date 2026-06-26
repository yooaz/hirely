# HIRELY P0 — Import Debug Panel

**Result:** PASS
**Generated:** 2026-06-10T00:35:42.768Z

## Purpose

Developer-only panel visible with `?debug=true`. Shows import metrics and pipeline steps during CV import. **Never shown to production users.**

## Metrics displayed

| Metric | Source |
|--------|--------|
| PDF imported | `state.lastImportFile` (`.pdf` extension or MIME) |
| Text length | `state.rawText.length` |
| OCR used | `extractionMethod` / pipeline `useOcr` |
| Parser used | `debugReport.parser` or `hirely-import` / `production-pipeline` |
| Experiences found | `finalResumeData.experiences` or `cvData.experience` |
| Education found | `finalResumeData.education` or `cvData.education` |
| Skills found | `finalResumeData.skills` or `cvData.skills` |
| Review items count | `getPendingReviewQueue().length` |

## Pipeline steps displayed

| Step | Trigger |
|------|---------|
| `IMPORT_STARTED` | File selected / import begins |
| `TEXT_EXTRACTED` | `EXTRACTION_DONE` in `importLog` |
| `PARSER_DONE` | Parser completes |
| `FINAL_RESUME_READY` | `ensureImportReviewVisible` / commit |
| `REVIEW_SCREEN_VISIBLE` | Review workspace shown |

## Implementation

| Piece | Location |
|-------|----------|
| Panel module | `src/ui/product/import-debug-panel.js` |
| Panel styles | `src/ui/product/import-debug-panel.css` |
| HTML host | `#importDebugPanel` in `#wsImport` |
| User hide rule | `html:not(.debug-mode) .importDebugPanel { display: none }` |
| Orchestration | `refreshImportDebugPanel()` + `importLog()` in `index.html` |

## Visibility gate

- Requires `?debug=true` (`DEBUG_MODE` / `DEVELOPER_MODE`)
- `html.debug-mode` class added only in debug
- Panel module returns early when `debugMode` is false

## QA checks

| Check | Status |
|-------|--------|
| module_exists | PASS |
| css_exists | PASS |
| html_script_linked | PASS |
| html_css_linked | PASS |
| html_panel_host | PASS |
| html_panel_class | PASS |
| css_hidden_without_debug_mode | PASS |
| step_IMPORT_STARTED | PASS |
| step_TEXT_EXTRACTED | PASS |
| step_PARSER_DONE | PASS |
| step_FINAL_RESUME_READY | PASS |
| step_REVIEW_SCREEN_VISIBLE | PASS |
| step_alias_extraction | PASS |
| metric_pdf_imported | PASS |
| metric_text_length | PASS |
| metric_ocr_used | PASS |
| metric_parser_used | PASS |
| metric_experiences_found | PASS |
| metric_education_found | PASS |
| metric_skills_found | PASS |
| metric_review_items_count | PASS |
| ui_wired | PASS |
| ui_panel_api | PASS |
| panel_gated_on_debug_mode | PASS |
| panel_styles | PASS |

## Gates

| Command | Status |
|---------|--------|
| `npm run test:import-debug-panel` | PASS |

```bash
npm run test:import-debug-panel
```

## Manual verification

1. Open `index.html?debug=true`
2. Import a PDF
3. Confirm `#importDebugPanel` shows metrics and all five steps tick off
4. Open without `?debug=true` — panel must not appear