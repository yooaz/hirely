# IDENTITY_LOCK_REPORT

Generated: 2026-06-13T09:10:05.179Z

## P0 status

| Item | Value |
|------|-------|
| Version | `IDENTITY_LOCK_V1` |
| Identity confidence gate | **90%** — below → `Identity needs review` |
| Phone confidence gate | **95%** — stripped + reviewQueue |
| Email confidence gate | **90%** + RFC validation |
| Principle | **Missing is better than wrong** |

## QA snapshot

| Suite | Result |
|-------|--------|
| `qa:identity-lock` | **PASS** (32 pass / 0 fail) |
| `qa:name-phone-rewrite` | **PASS** (27 pass / 0 fail) |
| `qa:identity-contact-strictness` | **PASS** (30 pass / 0 fail) |
| `qa:email-strictness` | **PASS** (12 pass / 0 fail) |
| `qa:person-company-disambiguation` | **PASS** (30 pass / 0 fail) |

## Person name rules

### Hard rejects

- Company / agency tokens (studio, impressions, agency, company, …)
- Internship / stage / trainee tokens
- Years (`2010`, `2019–2022`, year ranges)
- Any digit in name
- More than 4 words or fewer than 2 words
- Employer name collision

### Confidence

- Display only when confidence ≥ **90%**
- Otherwise show **`Identity needs review`** (never guessed name)

## Phone rules

- International strict validation (`validatePhoneStrict`)
- Minimum **8** digits
- Reject date/year pollution (`2011-2020`, trailing years)
- Reject page numbers (`Page 2 of 3`, `2/3`)
- Display only when confidence ≥ **95%**; otherwise empty + reviewQueue

## Email rules

- RFC 5322 subset validation (`validateEmailRfcStrict`)
- OCR cleanup: collapse `@@`, `..`, duplicated symbols, whitespace
- Ground in source text — never mutate local-part
- Display only when confidence ≥ **90%** and RFC-valid
- Otherwise **`Identity needs review`** + reviewQueue

## Files

| File | Role |
|------|------|
| `src/core/validation/identity-lock.js` | **NEW** — strict validators + 90% gate |
| `src/core/validation/identity-contact-strictness.js` | Wired to identity lock |
| `src/core/validation/email-strictness.js` | RFC + OCR artifact cleanup |
| `src/core/parsing/identity-extraction.js` | Internship/year rejects |
| `src/core/display/identity-labels.js` | `IDENTITY_NEEDS_REVIEW_LABEL` |
| `src/core/display/undetected-label.js` | Treat review label as uncertain |
| `src/tests/qa-identity-lock.mjs` | Acceptance tests |

## Verification

```bash
npm run qa:identity-lock
npm run identity-lock-report
```
