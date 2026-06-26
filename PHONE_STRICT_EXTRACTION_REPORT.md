# PHONE_STRICT_EXTRACTION_REPORT

**Status:** PASS
**Engine:** `PHONE_STRICT_EXTRACTION_V1`
**Generated:** 2026-06-12T09:38:16.267Z

## Problem

OCR/contact recovery promoted corrupted numbers (e.g. **+336434343830**) by truncating trailing digits instead of rejecting the match.

## Rules enforced

- Extract only from strict phone patterns with no trailing digit pollution
- Never rewrite or truncate digits to force a valid length
- Reject year ranges, page numbers, and OCR fragments glued to numbers
- French numbers must be exactly 11 digits international (`33` + 9 national)
- Display confidence below **85** → `reviewQueue` only (phone cleared from CV)
- Corrupted phones never appear in final CV render

## Code changes

| Module | Change |
|--------|--------|
| `phone-normalize.js` | Strict patterns with `(?!\d)`, digit-length validation, `scorePhoneExtraction`, confidence min 85 |
| `sanitize-resume-display.js` | Display phone only when confidence ≥ 85 |
| `confidence-gate.js` | Phone scoring via strict extraction score |
| `semantic-confidence-gate.js` | Strip phone when contact review item exists |

## QA summary

| Suite | Result |
|-------|--------|
| qa-phone-strict-extraction | PASS |
| qa-contact-phone-accuracy | PASS |

| Checks | Pass | Fail |
|--------|------|------|
| Total | 17 | 0 |

## Corrupt number regression

- Input: `+336434343830`
- Display phone: `(empty)`
- Review items: 3

## Checklist

- ✓ `confidence_min_85`
- ✓ `reject_corrupt_extract` — got 
- ✓ `reject_corrupt_validate`
- ✓ `accept_clean_extract` — got +33649434839
- ✓ `accept_clean_validate`
- ✓ `clean_score_high`
- ✓ `polluted_not_displayed` — phone=
- ✓ `polluted_review`
- ✓ `polluted_low_confidence`
- ✓ `reject_year_range`
- ✓ `page_glue_not_displayed` — phone=
- ✓ `page_glue_review`
- ✓ `pollution_detected`
- ✓ `pipeline_no_corrupt_phone` — phone=(empty)
- ✓ `pipeline_review_or_empty` — review=3
- ✓ `cvdata_phone_absent` — cvPhone=(empty)
- ✓ `render_no_corrupt_header`

## Run

```bash
npm run qa:phone-strict-extraction
npm run qa:contact-phone-accuracy
npm run phone-strict-extraction-report
```


## QA log (tail)

```
  tools: 0,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 1
}
PASS pipeline_no_corrupt_phone
PASS pipeline_review_or_empty
PASS cvdata_phone_absent
CV_TEMPLATE_BOOT_OK
PASS render_no_corrupt_header

═══ Phone Strict Extraction: 17/17 PASS ═══

(node:70785) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/parsing/phone-normalize.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
