# IMPORT_FALLBACK_UX_LOCK_REPORT

**Status:** PASS
**Engine:** `IMPORT_FALLBACK_UX_LOCK_V1`
**Generated:** 2026-06-11T00:30:46.591Z

## Problem

Unsupported or low-quality imports must never leave the user on a loading spinner, a technical error, or an empty CV preview.

## Required UX state

| Element | Behavior |
|---------|----------|
| Lead message | `Lecture incomplète. Collez le texte du CV pour continuer.` |
| Filename | Shown in fallback meta + drop zone |
| File type | Detected type label (PDF, Word, Image, …) |
| Reason | Plain-language cause (timeout, scan, insufficient content, …) |
| Paste box | `#importPasteFallbackText` focused |
| Retry | `#importPasteFallbackRetryOcr` — relaunch import |
| Replace file | `#importPasteFallbackDocx` — open file picker |

## Never rules

| Rule | Enforcement |
|------|-------------|
| Never stay loading | `_importFallbackUiLock` clears loading UX; progress hidden |
| Never show technical errors | `sanitizeImportErrorForUser()` + friendly status copy |
| Never show empty CV | `#cvStage` hidden; workspace reset on fallback |

## Module

- `src/core/import/import-fallback-ux.js` — canonical copy + meta builders
- `index.html` → `showImportPasteFallback()` — product UI lock

## Browser scenario (scan-timeout.pdf)

- Title: Lecture incomplète
- Lead: Lecture incomplète. Collez le texte du CV pour continuer.…
- File: scan-timeout.pdf
- Type: PDF
- Reason: La lecture automatique a pris trop de temps.
- Loading: false
- CV live: false

## Verify

```bash
npm run qa:import-fallback-ux-lock
npm run import-fallback-ux-lock-report
```

---

### Console

```
OK static_ux_lead_constant 
OK static_meta_filename 
OK static_meta_filetype 
OK static_meta_reason 
OK static_lead_copy 
OK static_retry_btn 
OK static_replace_btn 
OK static_hide_cv_on_fallback 
OK static_show_fallback_fn 
OK static_fallback_lock 
OK core_sanitize_technical 
OK core_file_type_pdf 
OK ui_panel_visible {"pasteFallback":true,"needsPasteClass":true,"title":"Lecture incomplète","lead":"Lecture incomplète. Collez le texte du CV pour continuer.","fileName":"scan-timeout.pdf","fileType":"PDF","reason":"La lecture automatique a pris trop de temps.","dropFileName":"scan-timeout.pdf","textareaVisible":true,"retryLabel":"Réessayer","replaceLabel":"Remplacer le fichier","loading":false,"pipelineBusy":false,"progressHidden":true,"cvLive":false,"cvVisible":false,"cvTextLen":0,"statusText":"Lecture incomplète. Collez le texte du CV pour continuer.","hasTechnicalStatus":false}
OK ui_needs_paste_class 
OK ui_title Lecture incomplète
OK ui_lead Lecture incomplète. Collez le texte du CV pour continuer.
OK ui_meta_filename scan-timeout.pdf
OK ui_drop_filename scan-timeout.pdf
OK ui_meta_filetype PDF
OK ui_meta_reason La lecture automatique a pris trop de temps.
OK ui_paste_box 
OK ui_retry_btn Réessayer
OK ui_replace_btn Remplacer le fichier
OK ui_not_loading 
OK ui_pipeline_not_busy 
OK ui_progress_hidden 
OK ui_no_live_cv 
OK ui_cv_hidden 
OK ui_no_empty_cv_content 0
OK ui_no_technical_status Lecture incomplète. Collez le texte du CV pour continuer.
OK paste_recovery {"reviewReady":true,"cvLive":true,"cvText":"Alex Martin\nGraphic Designer & Illustrator\n\nalex.martin@example.com · +336112233","pasteHidden":true}
OK paste_panel_closes 

All IMPORT_FALLBACK_UX_LOCK checks passed

(node:19996) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/import/import-fallback-ux.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
