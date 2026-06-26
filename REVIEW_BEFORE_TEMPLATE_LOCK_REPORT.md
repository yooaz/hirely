# Review Before Template Lock Report (P0)

**Status:** PASS
**Policy:** `REVIEW_BEFORE_TEMPLATE_LOCK_V1`
**Generated:** 2026-06-13T23:53:54.486Z

## Goal

Templates must only appear after review data is safe. Flow: **Import → Review → Choose template → Export**.

## Acceptance

| Criterion | Status |
| --- | --- |
| No corrupted data reaches template | **PASS** |
| Template locked while critical review pending | **PASS** |
| Template unlocks when critical items resolved | **PASS** |
| OCR fallback blocks template step | **PASS** |

## Critical review items

| Kind | Blocks template | User actions |
| --- | --- | --- |
| Uncertain name | Yes | Accept · Edit · Reject |
| Uncertain email | Yes | Accept · Edit · Reject |
| Uncertain phone | Yes | Accept · Edit · Reject |
| Fake / low-confidence experience | Yes | Accept · Edit · Reject |
| OCR fallback required | Yes | Paste CV text |

## UI gates

| Step | Gate |
| --- | --- |
| Choose template | `isTemplateReady()` |
| Export | `isExportReady()` (template + readiness) |
| Progress nav | Style/export disabled while locked |
| Primary CTA | Disabled on Review when critical items remain |

## Modules

| Module | Role |
| --- | --- |
| `review-before-template-lock.js` | Classify critical items + lock report |
| `review-queue.js` | Accept / edit / reject resolution |
| `final-resume-contract.js` | Sanitized `finalResumeData` only |
| `index.html` | `setDocStep` + CTA + progress nav gates |

## QA suites

| Suite | Result |
| --- | --- |
| `qa-review-before-template-lock` | PASS |
| `qa-review-flow` | PASS |
| `qa-final-preview-sanity-check` | PASS |

**Unit checks:** 13/13

## Unit checks

| Check | Status |
| --- | --- |
| policy_version | PASS |
| classify_uncertain_name | PASS |
| classify_uncertain_experience | PASS |
| non_critical_skill | PASS |
| blocks_template_uncertain_name | PASS |
| blocks_export_uncertain_name | PASS |
| shows_name_reason | PASS |
| blocks_template_ocr_fallback | PASS |
| ocr_action | PASS |
| unlocks_template_when_clear | PASS |
| unlocks_export_when_clear | PASS |
| pipeline_blocks_template_with_review | PASS |
| pipeline_no_profil_experience | PASS |

## Verify

```bash
npm run qa:review-before-template-lock
npm run review-before-template-lock-report
```
