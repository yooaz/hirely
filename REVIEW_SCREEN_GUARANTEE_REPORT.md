# HIRELY P0 — Review Screen Guarantee

**Result:** FAIL
**Generated:** 2026-06-25T20:02:47.714Z

## Rule

If `finalResumeData` contains **any** of: name, email, phone, experience, education, skills →

- `REVIEW_SCREEN_VISIBLE` must fire
- User never returns to import screen
- Weak data shows warnings only — **never blocks**

## Implementation

| Piece | Location |
|-------|----------|
| Guarantee check | `src/core/validation/review-screen-guarantee.js` → `finalResumeDataMeetsReviewGuarantee()` |
| Weak warnings | `buildReviewGuaranteeWarnings()` → review score desc + import warn |
| Review orchestration | `ensureImportReviewVisible()` in `index.html` |
| Import pipeline bypass | `handleFileImport` — guarantee paths before paste fallback |
| Extraction gate bypass | `applyCvPipeline` — poor quality + guarantee → review with warn |

## Trigger fields

| Field | Condition |
|-------|-----------|
| name | `identity.name` length > 1 |
| email | `identity.email` length > 3 |
| phone | ≥ 8 digits |
| experience | `experiences.length > 0` |
| education | `education.length > 0` |
| skills | `skills.length > 0` |

## QA checks

| Check | Status |
|-------|--------|
| guarantee_empty_resume_object | PASS |
| guarantee_minimal_resume | PASS |
| guarantee_name | PASS |
| guarantee_email | PASS |
| guarantee_experience | PASS |
| guarantee_identity_shell | PASS |
| guarantee_null_false | PASS |
| guarantee_no_identity_false | PASS |
| weak_warnings | PASS |
| is_weak | PASS |
| ui_guarantee_helper | PASS |
| ui_reviewGuaranteeMetUi | PASS |
| ui_warnings_helper | PASS |
| ui_review_log | PASS |
| ui_guarantee_gate | PASS |
| ui_no_import_fallback_when_guarantee | PASS |
| ui_skip_extraction_gate | PASS |

## Gates

| Command | Status |
|---------|--------|
| `npm run test:review-screen-guarantee` | PASS |
| `npm run test:real-browser-qa-lock` | FAIL |

```bash
npm run test:review-screen-guarantee
```

## Blockers

- `real-browser-qa-lock` failed (review not visible)