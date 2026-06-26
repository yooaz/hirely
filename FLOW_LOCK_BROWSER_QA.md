# FLOW_LOCK_BROWSER_QA

Generated: 2026-06-08T08:28:31.187Z

## Yoaz PDF

`/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`

## Expected console sequence

```
CORE_BOOT_OK
IMPORT_STARTED
EXTRACTION_DONE
PARSER_DONE
FINAL_RESUME_READY
REVIEW_SCREEN_VISIBLE
RENDER_DONE
```

## Observed tags (in order)

```
CORE_BOOT_OK
CORE_BOOT_OK
IMPORT_STARTED
EXTRACTION_DONE
EXTRACTION_DONE
EXTRACTION_DONE
PARSER_DONE
FINAL_RESUME_READY
REVIEW_SCREEN_VISIBLE
RENDER_DONE
```

## UI state

| Check | Result |
|-------|--------|
| Workspace visible | yes |
| CV preview live | yes |
| CV text length | 983 |
| Import status | — |
| Paste fallback | hidden |

## Forbidden

| Check | Result |
|-------|--------|
| CORE_BOOT_FAILED | no |
| RESUME_DATA_FLOW_LOCK fatal | no |
| Stuck on import screen | no |
| Empty CV after parser | no |

## Failures

- none

## Verdict

**PASS**


