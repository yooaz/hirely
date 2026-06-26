# PDF OCR Timeout Fallback — QA Report

**Result:** PASS

**Generated:** 2026-06-08T14:08:44.035Z

## Scope

P0 UX fix when PDF/OCR extraction exceeds 30s (`PDF_EXTRACTION_TIMEOUT` / `OCR_TIMEOUT`).
No boot, template, or pricing changes.

## Requirements

| # | Requirement | Status |
|---|-------------|--------|
| core_timeout_message | Timeout copy matches product message | PASS |
| core_timeout_copy | Message includes “pour continuer” | PASS |
| ui_paste_panel_open | Paste panel opens automatically | PASS |
| ui_textarea_visible | Textarea visible | PASS |
| ui_not_loading | Spinner / loading class cleared | PASS |
| ui_pipeline_not_busy | Import pipeline busy state cleared | PASS |
| ui_timeout_lead | Lead: “Collez le texte du CV pour continuer” | PASS |
| ui_filename_visible | Uploaded filename stays visible | PASS |
| ui_btn_paste | Button: Coller le texte maintenant | PASS |
| ui_btn_retry | Button: Réessayer la lecture PDF | PASS |
| ui_btn_other_file | Button: Importer un autre fichier | PASS |
| paste_review_visible | Paste → parser → review screen | PASS |
| paste_parser_name | Parsed CV shows candidate name | PASS |
| paste_panel_closed_after_import | Paste panel closes after successful paste | PASS |
| paste_pipeline_logged | Paste pipeline logs review/render steps | PASS |

## Changes

- `canonical-import.js` — preserve `PDF_OCR_TIMEOUT` status on paste fallback (non-fatal)
- `pdf-extraction-timeout.js` — timeout user copy + optional `HIRELY_PDF_EXTRACTION_MAX_MS` QA override
- `index.html` — `_importFallbackUiLock` stops loading race; timeout-specific paste UX; button labels

## QA command

```bash
npm run qa:pdf-timeout-fallback
```

## Test output

```
OK core_timeout_message Lecture automatique impossible. Collez le texte du CV pour continuer.
OK core_timeout_copy Lecture automatique impossible. Collez le texte du CV pour continuer.
OK ui_paste_panel_open {"pasteFallback":true,"textareaVisible":true,"loading":false,"pipelineBusy":false,"lead":"Lecture automatique impossible. Collez le texte du CV pour continuer.","fileName":"timeout-test.pdf","applyLabel":"Coller le texte maintenant","retryLabel":"Réessayer la lecture PDF","otherFileLabel":"Importer un autre fichier","statusText":"Lecture automatique impossible. Collez le texte du CV pour continuer."}
OK ui_textarea_visible 
OK ui_not_loading false
OK ui_pipeline_not_busy false
OK ui_timeout_lead Lecture automatique impossible. Collez le texte du CV pour continuer.
OK ui_filename_visible timeout-test.pdf
OK ui_btn_paste Coller le texte maintenant
OK ui_btn_retry Réessayer la lecture PDF
OK ui_btn_other_file Importer un autre fichier
OK paste_review_visible {"reviewReady":true,"cvLive":true,"cvText":"Alex Martin\nGraphic Designer & Illustrator\n\nProduct designer with 8+ years crafting B2B SaaS experiences\n\nalex.martin@ex","pasteHidden":true}
OK paste_parser_name Alex Martin
Graphic Designer & Illustrator

Product designer with 8+ years crafting B2B SaaS experiences

alex.martin@ex
OK paste_panel_closed_after_import 
OK paste_pipeline_logged SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | FINAL_RESUME_READY | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | REVIEW_SCREEN_VISIBLE | RENDER_DONE | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1} | SUGGESTION_FILTER {before: 3, after: 2, hidden: 1}

All PDF timeout fallback checks passed
```

## Errors

```
(node:1143) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/import/import-status.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
