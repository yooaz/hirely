# Strict Identity Extraction Report (P0)

**Status:** PASS
**Policy:** `STRICT_IDENTITY_EXTRACTION_V1`
**Generated:** 2026-06-13T23:43:08.665Z

## Goal

Correct name / email / phone — or leave empty. Missing is better than wrong.

## Acceptance

| Criterion | Status |
| --- | --- |
| No company as name | **PASS** |
| No corrupted email | **PASS** |
| No fake phone | **PASS** |
| Missing is better than wrong | **PASS** |
| Low confidence → reviewQueue | **PASS** |

## Rules

### Name

- Must be person-like (2–4 capitalized tokens)
- Cannot be company, agency, school, client, project
- Cannot contain digits, `@`, URL, internship, profile
- Employer collision rejected

### Email

- Exact source only — grounded in raw/cleaned text
- Never mutate local part (no added letters)
- No guessed correction beyond reversible OCR domain spacing

### Phone

- Valid international or local format
- Never merge with years, page numbers, postcodes
- OCR char fixes only inside phone context (`phone-normalize.js`)

### Low confidence

- Name / email / phone below 90% → stripped from CV + `reviewQueue` item

## QA suites

| Suite | Result |
| --- | --- |
| `qa-strict-identity-extraction` | PASS |
| `qa-identity-lock` | PASS |
| `qa-identity-contact-strictness` | PASS |
| `qa-email-strictness` | PASS |

## Unit checks

| Check | Status |
| --- | --- |
| version | PASS |
| missing_better_than_wrong | PASS |
| reject_company | PASS |
| reject_agency | PASS |
| reject_school | PASS |
| reject_client | PASS |
| reject_project | PASS |
| reject_profile | PASS |
| reject_internship | PASS |
| reject_digits | PASS |
| reject_email_in_name | PASS |
| reject_url_in_name | PASS |
| accept_person | PASS |
| email_no_local_mutation | PASS |
| email_recover_exact | PASS |
| email_uncertain_empty | PASS |
| phone_reject_year | PASS |
| phone_reject_page | PASS |
| phone_year_detected | PASS |
| phone_accept_valid | PASS |
| phone_reject_invented | PASS |
| review_name_on_bad | PASS |
| review_phone_on_bad | PASS |
| strip_company_name | PASS |
| strip_fake_phone | PASS |
| lock_clears_bad_fields | PASS |
| pipeline_keeps_good_name | PASS |
| pipeline_keeps_good_email | PASS |
| pipeline_keeps_good_phone | PASS |
| pipeline_no_company_name | PASS |
| pipeline_company_review_or_empty | PASS |
| extract_locked_skips_company | PASS |
| email_lock_valid | PASS |

## Implementation

| Module | Role |
| --- | --- |
| `identity-extraction.js` | `extractLockedIdentity`, `rejectAsPersonName`, header-only candidates |
| `identity-lock.js` | 90% confidence floor; empty display on failure |
| `identity-contact-strictness.js` | Enforce + reviewQueue emission |
| `email-strictness.js` | Source-grounded email; no local-part mutation |
| `phone-normalize.js` | Strict phone; year/page pollution guard |
| `sanitize-resume-display.js` | Final identity gate before preview/export |

## Verify

```bash
npm run qa:strict-identity-extraction
npm run strict-identity-extraction-report
npm run qa:identity-lock
npm run qa:identity-contact-strictness
npm run qa:email-strictness
```
