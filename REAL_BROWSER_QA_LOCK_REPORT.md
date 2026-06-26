# REAL BROWSER QA LOCK

**Verdict:** PASS
**Generated:** 2026-06-10T00:24:15.685Z

## Real PDF

`/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`

## Captures

| Signal | Value |
|--------|-------|
| Import status | — |
| Preview visible | yes |
| Review visible | yes |
| Export button visible | yes |
| Paste fallback visible | yes |
| Paste fallback timing | 4803 ms |

## Import console tags

```
CORE_BOOT_OK
CORE_BOOT_OK
IMPORT_STARTED
IMPORT_STARTED
EXTRACTION_DONE
PARSER_DONE
FINAL_RESUME_READY
REVIEW_SCREEN_VISIBLE
RENDER_DONE
FINAL_RESUME_READY
REVIEW_SCREEN_VISIBLE
RENDER_DONE
```

## Forbidden (must be empty)

- none

## Console errors (sample)

- none

## Checks

| Check | Status | Detail |
|-------|--------|--------|
| core_boot | PASS | ok |
| real_pdf_upload | PASS | cv2022 yohann azancot copie.pdf |
| import_started | PASS | CORE_BOOT_OK,CORE_BOOT_OK,IMPORT_STARTED |
| scanned_pdf_timeout | PASS | 4803ms |
| paste_fallback_copy | PASS | Lecture automatique incomplète. Collez le texte pour continuer. |
| paste_fallback_visible | PASS | Lecture automatique incomplète. Collez le texte pour continuer. |
| paste_fallback_not_hidden | PASS |  |
| not_stuck_on_import | PASS | ok |
| cv_preview | PASS | len=145 |
| review_screen | PASS | docStep=edit |
| export_button | PASS | visible |
| export_download | PASS | 24478 bytes |
| no_forbidden_errors | PASS | none |
| no_page_errors | PASS | 0 errors |


