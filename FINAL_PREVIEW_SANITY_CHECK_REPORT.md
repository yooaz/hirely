# FINAL_PREVIEW_SANITY_CHECK_REPORT

**Status:** PASS
**Generated:** 2026-06-12T14:58:27.472Z

## Goal

Run a last-mile sanity gate before CV preview render. Any line that fails a rule is removed from preview and moved to `reviewQueue`.

## Rules

- **no_fake_phone** — No fake or polluted phone numbers in identity
- **no_company_as_name** — No company/agency used as person name
- **no_partial_language** — No partial or polluted language lines (e.g. "Native am")
- **no_ocr_fragments** — No isolated OCR micro-fragments (am, co, @, etc.)
- **no_empty_sections** — No empty section entries in preview payload
- **no_duplicated_sections** — No duplicate lines within a section
- **no_parser_labels** — No parser section labels as CV body content

## Implementation

| Area | Change |
|------|--------|
| `final-preview-sanity-check.js` | `applyFinalPreviewSanityCheck()` + `auditFinalPreviewSanity()` |
| `final-resume-contract.js` | Runs sanity check after density/OCR cleanup, before contract commit |
| `index.html` | `buildFinalResumeData` review items merged into `state.reviewQueue` on commit |

## QA summary

| Metric | Value |
|--------|-------|
| Policy | FINAL_PREVIEW_SANITY_CHECK_V1 |
| Checks run | 18 |
| Failures | 0 |
| Pipeline review items | 1 |
| Preview lines (OCR fixture) | 9 |

## Verify

```bash
npm run qa:final-preview-sanity-check
npm run final-preview-sanity-check-report
```
